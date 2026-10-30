"""Document storage, workflow state, extraction orchestration, and review records."""

from __future__ import annotations

import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.config import configured_document_categories, document_limits, private_storage_path
from app.database import SessionLocal
from app.extraction import EXTRACTOR_VERSION, TYPE_MEDIA, detect_file_type, extract_document
from app.models import (
    AuditEvent,
    Customer,
    DocumentExtractionRecord,
    DocumentLinkRecord,
    DocumentProcessingEvent,
    DocumentRecord,
    DocumentReviewCreate,
    DocumentReviewRecord,
    Lot,
    Product,
    ProductionOrder,
    RecallCase,
    Shipment,
    Supplier,
    utc_now,
)
from app.services import new_id, record_audit

logger = logging.getLogger("traceiq.documents")

TRANSITIONS: dict[str, set[str]] = {
    "UPLOADED": {"QUEUED", "REJECTED", "SUPERSEDED"},
    "QUEUED": {"EXTRACTING", "FAILED"},
    "EXTRACTING": {"EXTRACTED", "FAILED"},
    "EXTRACTED": {"REVIEW_REQUIRED", "FAILED"},
    "REVIEW_REQUIRED": {"VERIFIED", "REJECTED", "QUEUED", "SUPERSEDED"},
    "FAILED": {"QUEUED", "REJECTED", "SUPERSEDED"},
    "REJECTED": {"QUEUED", "SUPERSEDED"},
    # A completed review may be reopened explicitly when a human needs to
    # reassess the extracted values. The prior review record remains intact.
    "VERIFIED": {"REVIEW_REQUIRED", "SUPERSEDED"},
    "SUPERSEDED": set(),
}


class DocumentError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _business_id() -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"DOC-{now}-{uuid.uuid4().hex[:8].upper()}"


def safe_filename(filename: str) -> str:
    basename = filename.replace("\\", "/").split("/")[-1]
    basename = re.sub(r"[\x00-\x1f\x7f]", "", basename).strip()
    basename = re.sub(r"[<>:\"|?*]", "_", basename)
    if not basename or basename in {".", ".."}:
        raise DocumentError("A valid filename is required.")
    return basename[:255]


def _storage_path(storage_key: str) -> Path:
    root = private_storage_path()
    path = (root / storage_key).resolve()
    if root != path and root not in path.parents:
        raise DocumentError("Document storage key is invalid.", 500)
    return path


def get_document(db: Session, document_id: str) -> DocumentRecord:
    document = db.get(DocumentRecord, document_id)
    if document is None:
        raise DocumentError(f"Document {document_id} was not found.", 404)
    return document


def add_processing_event(db: Session, document: DocumentRecord, next_state: str, message: str, actor: str = "system") -> None:
    previous = document.status
    if next_state not in TRANSITIONS.get(previous, set()):
        raise DocumentError(f"Invalid document state transition: {previous} → {next_state}.", 409)
    document.status = next_state
    document.updated_at = utc_now()
    db.add(DocumentProcessingEvent(id=new_id("DPE"), document_id=document.id, from_state=previous, to_state=next_state, message=message, actor=actor))


def create_document(db: Session, filename: str, content: bytes, category: str, uploaded_by: str) -> DocumentRecord:
    clean_name = safe_filename(filename)
    category = category.strip().upper()
    if category not in configured_document_categories():
        raise DocumentError("Select a supported document category or OTHER.")
    max_bytes, max_pages, _ = document_limits()
    try:
        file_type = detect_file_type(clean_name, content, max_bytes, max_pages)
    except ValueError as exc:
        raise DocumentError(str(exc)) from exc
    checksum = hashlib.sha256(content).hexdigest()
    duplicate = db.scalar(select(DocumentRecord).where(DocumentRecord.sha256 == checksum))
    if duplicate:
        raise DocumentError(f"Duplicate file detected. It is already stored as {duplicate.id}.", 409)

    ext = {"jpeg": ".jpg"}.get(file_type, f".{file_type}")
    storage_key = f"{checksum[:2]}/{uuid.uuid4().hex}{ext}"
    path = _storage_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as stream:
            stream.write(content)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        document = DocumentRecord(
            id=_business_id(),
            filename=clean_name,
            media_type=TYPE_MEDIA[file_type],
            file_type=file_type,
            category=category,
            sha256=checksum,
            size_bytes=len(content),
            storage_key=storage_key,
            status="UPLOADED",
            uploaded_by=uploaded_by.strip()[:120] or "Local Operator",
        )
        db.add(document)
        db.flush()
        db.add(DocumentProcessingEvent(id=new_id("DPE"), document_id=document.id, from_state=None, to_state="UPLOADED", message="Private original uploaded and checksum recorded.", actor=document.uploaded_by))
        record_audit(db, "DOCUMENT", document.id, "DOCUMENT_UPLOADED", document.uploaded_by, f"Uploaded {document.filename} as {document.category}.", {"sha256": checksum, "size_bytes": len(content), "file_type": file_type})
        db.commit()
        db.refresh(document)
        return document
    except IntegrityError as exc:
        db.rollback()
        path.unlink(missing_ok=True)
        duplicate = db.scalar(select(DocumentRecord).where(DocumentRecord.sha256 == checksum))
        if duplicate:
            raise DocumentError(f"Duplicate file detected. It is already stored as {duplicate.id}.", 409) from exc
        raise DocumentError("The document could not be stored because a record conflicts with existing data.", 409) from exc
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise


def queue_document(db: Session, document_id: str, actor: str) -> DocumentRecord:
    document = get_document(db, document_id)
    if document.archived_at:
        raise DocumentError("Archived documents cannot be processed.", 409)
    if document.status not in {"UPLOADED", "FAILED", "REJECTED"}:
        raise DocumentError(f"Document in {document.status} state cannot be queued.", 409)
    document.processing_error = None
    add_processing_event(db, document, "QUEUED", "Document queued for safe extraction.", actor)
    record_audit(db, "DOCUMENT", document.id, "DOCUMENT_QUEUED", actor, f"Queued {document.filename} for extraction.")
    db.commit()
    db.refresh(document)
    return document


def process_document(db: Session, document_id: str) -> DocumentRecord:
    document = get_document(db, document_id)
    if document.status != "QUEUED":
        return document
    add_processing_event(db, document, "EXTRACTING", "File signature and checksum verified; extraction started.")
    db.commit()
    try:
        path = _storage_path(document.storage_key)
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != document.sha256:
            raise DocumentError("Stored file checksum does not match the uploaded original.", 500)
        result = extract_document(data, document.file_type)
        if document.category in {"AUTO", "OTHER"} and result.detected_category != "OTHER":
            document.category = result.detected_category
        extraction = DocumentExtractionRecord(
            id=new_id("DEX"),
            document_id=document.id,
            extracted_text=result.text[:2_000_000],
            fields=result.fields,
            warnings=result.warnings,
            extractor_version=result.extractor_version,
        )
        document.extractor_version = result.extractor_version
        db.add(extraction)
        add_processing_event(db, document, "EXTRACTED", f"Extracted {len(result.text)} characters and {len(result.fields)} candidate fields.")
        db.commit()
        add_processing_event(db, document, "REVIEW_REQUIRED", "Extraction is unverified; a human reviewer must accept or reject it.")
        record_audit(db, "DOCUMENT", document.id, "DOCUMENT_EXTRACTION_COMPLETED", "system", f"Extracted evidence from {document.filename} for human review.", {"field_count": len(result.fields), "warning_count": len(result.warnings)})
        db.commit()
    except Exception as exc:
        db.rollback()
        current = db.get(DocumentRecord, document_id)
        if current and current.status == "EXTRACTING":
            message = str(exc) if isinstance(exc, (DocumentError, ValueError)) else f"Extraction failed ({type(exc).__name__}). See server logs for details."
            current.processing_error = message[:1000]
            add_processing_event(db, current, "FAILED", message[:1000])
            record_audit(db, "DOCUMENT", current.id, "DOCUMENT_EXTRACTION_FAILED", "system", f"Extraction failed for {current.filename}.", {"error_type": type(exc).__name__})
            db.commit()
        logger.exception("Document extraction failed for %s", document_id)
    db.refresh(document)
    return document


def process_document_background(document_id: str, session_factory: sessionmaker = SessionLocal) -> None:
    with session_factory() as db:
        process_document(db, document_id)


def read_private_content(document: DocumentRecord) -> bytes:
    try:
        path = _storage_path(document.storage_key)
        content = path.read_bytes()
    except FileNotFoundError as exc:
        raise DocumentError("The private original is no longer available.", 410) from exc
    if hashlib.sha256(content).hexdigest() != document.sha256:
        raise DocumentError("The stored original failed its integrity check.", 500)
    return content


def review_document(db: Session, document_id: str, payload: DocumentReviewCreate) -> DocumentReviewRecord:
    document = get_document(db, document_id)
    if document.status != "REVIEW_REQUIRED":
        raise DocumentError("Only an extracted document awaiting review can be verified or rejected.", 409)
    review = DocumentReviewRecord(
        id=new_id("DVR"),
        document_id=document.id,
        decision=payload.decision,
        reviewed_fields=payload.reviewed_fields,
        reviewer=payload.reviewer.strip(),
        note=payload.note.strip(),
    )
    db.add(review)
    add_processing_event(db, document, payload.decision, f"Human review recorded by {payload.reviewer.strip()}.", payload.reviewer.strip())
    record_audit(db, "DOCUMENT", document.id, f"DOCUMENT_{payload.decision}", payload.reviewer.strip(), payload.note.strip() or f"Document {payload.decision.lower()} after extraction review.", {"review_id": review.id, "corrected_field_count": len(payload.reviewed_fields)})
    db.commit()
    db.refresh(review)
    return review


def reopen_document_review(db: Session, document_id: str, actor: str, reason: str) -> DocumentRecord:
    document = get_document(db, document_id)
    if document.archived_at:
        raise DocumentError("Archived documents cannot be reopened for review.", 409)
    if document.status != "VERIFIED":
        raise DocumentError("Only a verified document can be reopened for review.", 409)
    extraction = db.scalar(
        select(DocumentExtractionRecord)
        .where(DocumentExtractionRecord.document_id == document.id)
        .order_by(DocumentExtractionRecord.created_at.desc())
    )
    if extraction is None:
        raise DocumentError("This document has no extraction to review.", 409)

    reviewer = actor.strip()
    review_reason = reason.strip()
    if len(reviewer) < 2 or len(review_reason) < 3:
        raise DocumentError("A reviewer name and a short reason are required to reopen review.", 422)
    add_processing_event(db, document, "REVIEW_REQUIRED", f"Review reopened by {reviewer}: {review_reason}", reviewer)
    record_audit(
        db,
        "DOCUMENT",
        document.id,
        "DOCUMENT_REVIEW_REOPENED",
        reviewer,
        review_reason,
        {"previous_review_id": db.scalar(select(DocumentReviewRecord.id).where(DocumentReviewRecord.document_id == document.id).order_by(DocumentReviewRecord.created_at.desc()))},
    )
    db.commit()
    db.refresh(document)
    return document


def link_document(db: Session, document_id: str, entity_type: str, entity_id: str, relationship: str, created_by: str) -> DocumentLinkRecord:
    document = get_document(db, document_id)
    entity_type = entity_type.upper()
    entity_id = entity_id.strip().upper()
    entity_models = {
        "SUPPLIER": Supplier,
        "LOT": Lot,
        "PRODUCT": Product,
        "PRODUCTION_ORDER": ProductionOrder,
        "SHIPMENT": Shipment,
        "RECALL": RecallCase,
        "CUSTOMER": Customer,
    }
    entity_model = entity_models.get(entity_type)
    if entity_model is None:
        raise DocumentError(f"Linking to {entity_type} is not supported by the current domain model.", 422)
    if db.get(entity_model, entity_id) is None:
        raise DocumentError(f"{entity_type.lower().replace('_', ' ')} {entity_id} was not found.", 404)
    existing = db.scalar(select(DocumentLinkRecord).where(DocumentLinkRecord.document_id == document.id, DocumentLinkRecord.entity_type == entity_type, DocumentLinkRecord.entity_id == entity_id))
    if existing:
        return existing
    link = DocumentLinkRecord(id=new_id("DLK"), document_id=document.id, entity_type=entity_type, entity_id=entity_id, relationship=relationship.strip().upper(), created_by=created_by.strip())
    db.add(link)
    record_audit(db, "DOCUMENT", document.id, "DOCUMENT_LINKED", created_by, f"Linked evidence to {entity_type} {entity_id}.", {"entity_type": entity_type, "entity_id": entity_id, "relationship": relationship})
    db.commit()
    db.refresh(link)
    return link


def archive_document(db: Session, document_id: str, actor: str) -> DocumentRecord:
    document = get_document(db, document_id)
    if document.archived_at is None:
        document.archived_at = utc_now()
        document.updated_at = utc_now()
        record_audit(db, "DOCUMENT", document.id, "DOCUMENT_ARCHIVED", actor, f"Archived {document.filename}; the original remains in private storage.")
        db.commit()
        db.refresh(document)
    return document
