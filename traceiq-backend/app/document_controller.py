"""HTTP routes for private document intake, extraction review, and persisted checks."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.documents import (
    DocumentError,
    add_processing_event,
    archive_document,
    create_document,
    get_document,
    link_document,
    process_document_background,
    queue_document,
    read_private_content,
    reopen_document_review,
    review_document,
)
from app.models import (
    DocumentRecord,
    DocumentExtractionOut,
    DocumentLinkCreate,
    DocumentOut,
    DocumentProcessingEvent,
    DocumentReviewCreate,
    DocumentReviewReopen,
    DocumentReviewRecord,
    DocumentExtractionRecord,
    DocumentLinkRecord,
    ValidationFindingOut,
    ValidationFindingRecord,
    ValidationFindingResolve,
    ValidationRunCreate,
    ValidationRunRecord,
    ValidationRunOut,
)
from app.rules_engine import list_rules, resolve_finding, run_validation, validation_run_findings
from app.services import new_id, record_audit

router = APIRouter(prefix="/api/v1")


def _raise_document_error(exc: DocumentError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


async def _read_upload(upload: UploadFile) -> bytes:
    from app.config import document_limits

    max_bytes, _, _ = document_limits()
    content = bytearray()
    while True:
        part = await upload.read(min(1024 * 1024, max_bytes + 1 - len(content)))
        if not part:
            break
        content.extend(part)
        if len(content) > max_bytes:
            raise DocumentError(f"File exceeds the configured {max_bytes // (1024 * 1024)} MB upload limit.")
    return bytes(content)


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(default="AUTO"),
    uploaded_by: str = Form(default="Local Operator"),
    db: Session = Depends(get_db),
):
    try:
        content = await _read_upload(file)
        return create_document(db, file.filename or "", content, category, uploaded_by)
    except DocumentError as exc:
        _raise_document_error(exc)
    finally:
        await file.close()


@router.post("/documents/batch", status_code=207)
async def upload_documents_batch(
    files: list[UploadFile] = File(...),
    category: str = Form(default="AUTO"),
    uploaded_by: str = Form(default="Local Operator"),
    db: Session = Depends(get_db),
):
    from app.config import document_limits

    _, _, max_batch = document_limits()
    if not files:
        raise HTTPException(status_code=422, detail="Choose at least one file.")
    if len(files) > max_batch:
        raise HTTPException(status_code=413, detail=f"Batch exceeds the configured limit of {max_batch} files.")
    accepted: list[dict] = []
    rejected: list[dict] = []
    for upload in files:
        try:
            content = await _read_upload(upload)
            record = create_document(db, upload.filename or "", content, category, uploaded_by)
            accepted.append(DocumentOut.model_validate(record).model_dump(mode="json"))
        except DocumentError as exc:
            rejected.append({"filename": upload.filename or "(unnamed)", "detail": str(exc), "status_code": exc.status_code})
        finally:
            await upload.close()
    return {"uploaded": len(accepted), "rejected": len(rejected), "documents": accepted, "errors": rejected}


@router.get("/documents")
def list_documents(
    q: str = "",
    category: str | None = None,
    status: str | None = None,
    include_archived: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    statement = select(DocumentRecord)
    if q.strip():
        like = f"%{q.strip()}%"
        statement = statement.where(DocumentRecord.filename.ilike(like) | DocumentRecord.id.ilike(like) | DocumentRecord.sha256.ilike(like))
    if category:
        statement = statement.where(DocumentRecord.category == category.strip().upper())
    if status:
        statement = statement.where(DocumentRecord.status == status.strip().upper())
    if not include_archived:
        statement = statement.where(DocumentRecord.archived_at.is_(None))
    total = db.query(DocumentRecord).filter(statement.whereclause).count() if statement.whereclause is not None else db.query(DocumentRecord).count()
    rows = db.scalars(statement.order_by(DocumentRecord.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [DocumentOut.model_validate(row).model_dump(mode="json") for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/documents/{document_id}")
def get_document_detail(document_id: str, db: Session = Depends(get_db)):
    try:
        document = get_document(db, document_id)
    except DocumentError as exc:
        _raise_document_error(exc)
    extraction = db.scalar(select(DocumentExtractionRecord).where(DocumentExtractionRecord.document_id == document_id).order_by(DocumentExtractionRecord.created_at.desc()))
    review = db.scalar(select(DocumentReviewRecord).where(DocumentReviewRecord.document_id == document_id).order_by(DocumentReviewRecord.created_at.desc()))
    links = db.scalars(select(DocumentLinkRecord).where(DocumentLinkRecord.document_id == document_id).order_by(DocumentLinkRecord.created_at)).all()
    return {
        **DocumentOut.model_validate(document).model_dump(mode="json"),
        "latest_extraction": DocumentExtractionOut.model_validate(extraction).model_dump(mode="json") if extraction else None,
        "latest_review": {"id": review.id, "decision": review.decision, "reviewed_fields": review.reviewed_fields, "reviewer": review.reviewer, "note": review.note, "created_at": review.created_at.isoformat()} if review else None,
        "links": [{"id": link.id, "entity_type": link.entity_type, "entity_id": link.entity_id, "relationship": link.relationship, "created_by": link.created_by, "created_at": link.created_at.isoformat()} for link in links],
    }


@router.get("/documents/{document_id}/content")
def get_document_content(document_id: str, download: bool = False, db: Session = Depends(get_db)):
    try:
        document = get_document(db, document_id)
        content = read_private_content(document)
    except DocumentError as exc:
        _raise_document_error(exc)
    disposition = "attachment" if download else "inline"
    filename = quote(document.filename, safe="")
    return Response(content=content, media_type=document.media_type, headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.post("/documents/{document_id}/process", status_code=202, response_model=DocumentOut)
def process_document(document_id: str, background_tasks: BackgroundTasks, actor: str = Form(default="Local Operator"), db: Session = Depends(get_db)):
    try:
        document = queue_document(db, document_id, actor)
    except DocumentError as exc:
        _raise_document_error(exc)
    background_tasks.add_task(process_document_background, document.id, SessionLocal)
    return document


@router.get("/documents/{document_id}/processing-status")
def document_processing_status(document_id: str, db: Session = Depends(get_db)):
    try:
        document = get_document(db, document_id)
    except DocumentError as exc:
        _raise_document_error(exc)
    events = db.scalars(select(DocumentProcessingEvent).where(DocumentProcessingEvent.document_id == document_id).order_by(DocumentProcessingEvent.created_at, DocumentProcessingEvent.id)).all()
    return {"document_id": document.id, "status": document.status, "processing_error": document.processing_error, "events": [{"id": row.id, "from_state": row.from_state, "to_state": row.to_state, "message": row.message, "actor": row.actor, "created_at": row.created_at.isoformat()} for row in events]}


@router.get("/documents/{document_id}/extraction", response_model=DocumentExtractionOut)
def get_document_extraction(document_id: str, db: Session = Depends(get_db)):
    try:
        get_document(db, document_id)
    except DocumentError as exc:
        _raise_document_error(exc)
    extraction = db.scalar(select(DocumentExtractionRecord).where(DocumentExtractionRecord.document_id == document_id).order_by(DocumentExtractionRecord.created_at.desc()))
    if extraction is None:
        raise HTTPException(status_code=404, detail="Document has not been processed yet.")
    return extraction


@router.patch("/documents/{document_id}/review")
def review_document_extraction(document_id: str, payload: DocumentReviewCreate, db: Session = Depends(get_db)):
    try:
        review = review_document(db, document_id, payload)
        document = get_document(db, document_id)
    except DocumentError as exc:
        _raise_document_error(exc)
    return {"document": DocumentOut.model_validate(document), "review": {"id": review.id, "decision": review.decision, "reviewed_fields": review.reviewed_fields, "reviewer": review.reviewer, "note": review.note, "created_at": review.created_at}}


@router.post("/documents/{document_id}/reopen-review", response_model=DocumentOut)
def reopen_document_extraction_review(document_id: str, payload: DocumentReviewReopen, db: Session = Depends(get_db)):
    try:
        return reopen_document_review(db, document_id, payload.reopened_by, payload.reason)
    except DocumentError as exc:
        _raise_document_error(exc)


@router.post("/documents/{document_id}/links", status_code=201)
def create_document_link(document_id: str, payload: DocumentLinkCreate, db: Session = Depends(get_db)):
    try:
        link = link_document(db, document_id, payload.entity_type, payload.entity_id, payload.relationship, payload.created_by)
    except DocumentError as exc:
        _raise_document_error(exc)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Document link conflicts with an existing record.") from exc
    return link


@router.get("/documents/{document_id}/links")
def list_document_links(document_id: str, db: Session = Depends(get_db)):
    try:
        get_document(db, document_id)
    except DocumentError as exc:
        _raise_document_error(exc)
    rows = db.scalars(select(DocumentLinkRecord).where(DocumentLinkRecord.document_id == document_id).order_by(DocumentLinkRecord.created_at)).all()
    return rows


@router.patch("/documents/{document_id}/archive", response_model=DocumentOut)
def archive_document_record(document_id: str, actor: str = Query(min_length=2, max_length=120), db: Session = Depends(get_db)):
    try:
        return archive_document(db, document_id, actor)
    except DocumentError as exc:
        _raise_document_error(exc)


@router.post("/documents/{document_id}/run-checks", response_model=ValidationRunOut, status_code=201)
def run_document_checks(document_id: str, run_by: str = Form(default="Local Operator"), db: Session = Depends(get_db)):
    try:
        return run_validation(db, "DOCUMENT", document_id, document_id, run_by)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/checks/rules")
def get_validation_rules(enabled_only: bool = True, db: Session = Depends(get_db)):
    rows = list_rules(db)
    if enabled_only:
        rows = [row for row in rows if row.enabled]
    return rows


@router.post("/checks/runs", response_model=ValidationRunOut, status_code=201)
def create_validation_run(payload: ValidationRunCreate, db: Session = Depends(get_db)):
    try:
        return run_validation(db, payload.entity_type, payload.entity_id, payload.document_id, payload.run_by)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/checks/runs")
def list_validation_runs(
    status: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    statement = select(ValidationRunRecord)
    if status:
        statement = statement.where(ValidationRunRecord.status == status.upper())
    if entity_type:
        statement = statement.where(ValidationRunRecord.entity_type == entity_type.upper())
    if entity_id:
        statement = statement.where(ValidationRunRecord.entity_id == entity_id.upper())
    total = db.query(ValidationRunRecord).filter(statement.whereclause).count() if statement.whereclause is not None else db.query(ValidationRunRecord).count()
    rows = db.scalars(statement.order_by(ValidationRunRecord.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [ValidationRunOut.model_validate(row).model_dump(mode="json") for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/checks/runs/{run_id}")
def get_validation_run(run_id: str, db: Session = Depends(get_db)):
    run = db.get(ValidationRunRecord, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Validation run {run_id} was not found.")
    findings = validation_run_findings(db, run_id)
    return {"run": ValidationRunOut.model_validate(run), "findings": [ValidationFindingOut.model_validate(item) for item in findings]}


@router.get("/checks/findings")
def list_validation_findings(
    status: str | None = None,
    severity: str | None = None,
    run_id: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    statement = select(ValidationFindingRecord)
    if status:
        statement = statement.where(ValidationFindingRecord.status == status.upper())
    if severity:
        statement = statement.where(ValidationFindingRecord.severity == severity.upper())
    if run_id:
        statement = statement.where(ValidationFindingRecord.run_id == run_id)
    total = db.query(ValidationFindingRecord).filter(statement.whereclause).count() if statement.whereclause is not None else db.query(ValidationFindingRecord).count()
    rows = db.scalars(statement.order_by(ValidationFindingRecord.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [ValidationFindingOut.model_validate(item).model_dump(mode="json") for item in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/checks/findings/{finding_id}", response_model=ValidationFindingOut)
def get_validation_finding(finding_id: str, db: Session = Depends(get_db)):
    finding = db.get(ValidationFindingRecord, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail=f"Finding {finding_id} was not found.")
    return finding


@router.post("/checks/findings/{finding_id}/resolve", response_model=ValidationFindingOut)
def resolve_validation_finding(finding_id: str, payload: ValidationFindingResolve, db: Session = Depends(get_db)):
    finding = db.get(ValidationFindingRecord, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail=f"Finding {finding_id} was not found.")
    try:
        return resolve_finding(db, finding, payload.resolved_by, payload.resolution)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
