"""Versioned validation registry and persisted execution for documents and domain records."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    DocumentExtractionRecord,
    DocumentLinkRecord,
    DocumentRecord,
    DocumentReviewRecord,
    Lot,
    QualityCheck,
    RecallCase,
    Shipment,
    Supplier,
    ValidationFindingRecord,
    ValidationRuleRecord,
    ValidationRunRecord,
    utc_now,
)
from app.services import new_id, record_audit, run_quality_check


@dataclass(frozen=True)
class RuleDefinition:
    id: str
    name: str
    version: str
    category: str
    description: str
    severity: str
    entity_types: tuple[str, ...]
    blocks_transition: bool
    prerequisites: tuple[str, ...] = ()


RULE_REGISTRY = (
    RuleDefinition("DOC-REQ-001", "Required document fields", "1.0", "DOCUMENT", "Required reviewed fields must be present for the selected document type.", "HIGH", ("DOCUMENT",), True, ("Human review",)),
    RuleDefinition("DOC-COA-001", "Certificate lot matches linked lot", "1.0", "QUALITY", "A certificate lot identifier must match the linked registered material lot.", "CRITICAL", ("DOCUMENT",), True, ("Certificate of Analysis", "Lot link")),
    RuleDefinition("DOC-LINK-001", "Evidence has a business-record link", "1.0", "DOCUMENT", "Verified evidence should be linked to a supplier, lot, order, shipment, or recall.", "WARNING", ("DOCUMENT",), False),
    RuleDefinition("DOC-TEXT-001", "Readable source text exists", "1.0", "DOCUMENT", "A document needs readable extracted text or a documented manual review.", "HIGH", ("DOCUMENT",), True),
    RuleDefinition("QMS-QUALITY-001", "Quality and traceability gate", "quality-v1", "QUALITY", "Run deterministic lot or supplier qualification rules.", "CRITICAL", ("LOT", "SUPPLIER"), True),
)

REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "SUPPLIER_INVOICE": ("invoice_number", "supplier_name", "invoice_date", "total_amount"),
    "GOODS_RECEIPT_NOTE": ("document_number", "supplier_name", "purchase_order_reference"),
    "CERTIFICATE_OF_ANALYSIS": ("document_number", "lot_identifier"),
    "PROOF_OF_DELIVERY": ("shipment_reference", "customer", "delivery_date", "delivered_quantity"),
    "PURCHASE_ORDER": ("document_number", "supplier_name", "purchase_order_reference"),
}

FINDING_RULES = {
    "NON_POSITIVE_QUANTITY": ("LOT-001", "Lot quantity must be positive."),
    "SUPPLIER_EVIDENCE_MISSING": ("QMS-001", "A raw lot must reference an eligible supplier."),
    "SUPPLIER_QUALIFICATION_PENDING": ("QMS-001", "Supplier qualification must pass."),
    "LOT_NOT_RELEASED": ("QMS-002", "The lot is not in an eligible release state."),
    "PRODUCTION_GENEALOGY_MISSING": ("GEN-001", "Finished lot must reference a production order."),
    "INPUT_EVIDENCE_MISSING": ("GEN-001", "Production order must contain input-lot evidence."),
    "QUANTITY_OVERAGE": ("QTY-001", "Recorded inventory and shipments must not exceed output."),
    "SUPPLIER_NOT_QUALIFIED": ("QMS-001", "Supplier qualification must pass."),
    "SUPPLIER_RISK_HIGH": ("QMS-005", "Supplier risk must be below the configured threshold."),
    "ENTITY_MISSING": ("REF-001", "The referenced business record must exist."),
}


def ensure_registered_rules(db: Session) -> None:
    existing = {row.id for row in db.scalars(select(ValidationRuleRecord)).all()}
    for definition in RULE_REGISTRY:
        if definition.id not in existing:
            db.add(ValidationRuleRecord(
                id=definition.id,
                name=definition.name,
                version=definition.version,
                category=definition.category,
                description=definition.description,
                severity=definition.severity,
                applicable_entity_types=list(definition.entity_types),
                prerequisites=list(definition.prerequisites),
                enabled=True,
                blocks_transition=definition.blocks_transition,
            ))
    if db.new:
        db.commit()


def list_rules(db: Session) -> list[ValidationRuleRecord]:
    ensure_registered_rules(db)
    return db.scalars(select(ValidationRuleRecord).order_by(ValidationRuleRecord.category, ValidationRuleRecord.id)).all()


def _latest_extraction(db: Session, document_id: str) -> DocumentExtractionRecord | None:
    return db.scalar(select(DocumentExtractionRecord).where(DocumentExtractionRecord.document_id == document_id).order_by(DocumentExtractionRecord.created_at.desc()))


def _latest_review(db: Session, document_id: str) -> DocumentReviewRecord | None:
    return db.scalar(select(DocumentReviewRecord).where(DocumentReviewRecord.document_id == document_id).order_by(DocumentReviewRecord.created_at.desc()))


def _document_facts(db: Session, document: DocumentRecord) -> tuple[dict[str, Any], list[dict[str, Any]], list[ValidationFindingRecord]]:
    extraction = _latest_extraction(db, document.id)
    review = _latest_review(db, document.id)
    values = {field.get("field_name"): field.get("value") for field in (extraction.fields if extraction else [])}
    if review:
        values.update(review.reviewed_fields)
    evidence = [{"document_id": document.id, "sha256": document.sha256, "filename": document.filename, "extraction_id": extraction.id if extraction else None}]
    pending_findings: list[ValidationFindingRecord] = []
    return values, evidence, pending_findings


def _append_finding(
    db: Session,
    run: ValidationRunRecord,
    rule_id: str,
    rule_version: str,
    status: str,
    severity: str,
    expected: dict[str, Any] | None,
    actual: dict[str, Any] | None,
    evidence: list[dict[str, Any]],
    action: str,
    blocks: bool,
) -> ValidationFindingRecord:
    definition = next((rule for rule in RULE_REGISTRY if rule.id == rule_id), None)
    title = str(actual.get("message")) if actual and actual.get("message") else definition.name if definition else rule_id.replace("-", " ")
    finding = ValidationFindingRecord(
        id=new_id("VFD"), run_id=run.id, rule_id=rule_id, rule_version=rule_version,
        status=status, severity=severity, title=title, expected=expected, actual=actual,
        evidence=evidence, suggested_action=action, blocks_transition=blocks,
    )
    db.add(finding)
    return finding


def _overall_status(statuses: list[str]) -> str:
    if "FAIL" in statuses:
        return "FAIL"
    if "INCOMPLETE" in statuses:
        return "INCOMPLETE"
    if "PENDING" in statuses:
        return "PENDING"
    if "WARNING" in statuses:
        return "WARNING"
    return "PASS"


def _run_document(db: Session, document: DocumentRecord, run_by: str) -> ValidationRunRecord:
    ensure_registered_rules(db)
    if document.status != "VERIFIED":
        raise ValueError("Document validation requires a human-reviewed VERIFIED document.")
    extraction = _latest_extraction(db, document.id)
    if extraction is None:
        raise ValueError("Document has no extraction record. Process and review it first.")
    values, base_evidence, _ = _document_facts(db, document)
    findings: list[tuple[str, str, str, str, dict[str, Any] | None, dict[str, Any] | None, list[dict[str, Any]], str, bool]] = []

    if not extraction.extracted_text.strip():
        findings.append(("DOC-TEXT-001", "1.0", "INCOMPLETE", "HIGH", {"readable_text": True}, {"readable_text": False}, base_evidence, "Provide a legible source or record a supported manual transcription.", True))
    else:
        findings.append(("DOC-TEXT-001", "1.0", "PASS", "HIGH", {"readable_text": True}, {"characters": len(extraction.extracted_text)}, base_evidence, "No action required.", True))

    required = REQUIRED_FIELDS.get(document.category, ())
    if required:
        missing = [name for name in required if values.get(name) in (None, "", [], {})]
        state = "INCOMPLETE" if missing else "PASS"
        findings.append(("DOC-REQ-001", "1.0", state, "HIGH", {"required_fields": list(required)}, {"missing_fields": missing, "present_fields": [name for name in required if name not in missing]}, base_evidence, "Review the source and enter or mark each missing field as not applicable with a note.", True))

    links = db.scalars(select(DocumentLinkRecord).where(DocumentLinkRecord.document_id == document.id)).all()
    coa_lot = next((link for link in links if link.entity_type == "LOT"), None)
    if document.category == "CERTIFICATE_OF_ANALYSIS":
        lot_value = str(values.get("lot_identifier") or "").strip().upper()
        if not coa_lot or not lot_value:
            state, expected, actual = "INCOMPLETE", {"linked_lot": "required", "certificate_lot": "required"}, {"linked_lot": coa_lot.entity_id if coa_lot else None, "certificate_lot": lot_value or None}
        elif lot_value != coa_lot.entity_id.upper():
            state, expected, actual = "FAIL", {"lot_identifier": coa_lot.entity_id.upper()}, {"lot_identifier": lot_value}
        else:
            state, expected, actual = "PASS", {"lot_identifier": coa_lot.entity_id.upper()}, {"lot_identifier": lot_value}
        findings.append(("DOC-COA-001", "1.0", state, "CRITICAL", expected, actual, base_evidence + ([{"entity_type": "LOT", "entity_id": coa_lot.entity_id}] if coa_lot else []), "Resolve the certificate-to-lot mismatch or link the correct verified lot.", True))

    if not links:
        findings.append(("DOC-LINK-001", "1.0", "WARNING", "WARNING", {"business_record_link": True}, {"business_record_link": False}, base_evidence, "Link this evidence to its supplier, lot, order, shipment, or recall when known.", False))
    else:
        findings.append(("DOC-LINK-001", "1.0", "PASS", "WARNING", {"business_record_link": True}, {"links": [{"entity_type": item.entity_type, "entity_id": item.entity_id} for item in links]}, base_evidence, "No action required.", False))

    statuses = [item[2] for item in findings]
    run = ValidationRunRecord(
        id=new_id("VRN"), entity_type="DOCUMENT", entity_id=document.id, document_id=document.id,
        status=_overall_status(statuses), passed_count=statuses.count("PASS"), failed_count=statuses.count("FAIL"),
        incomplete_count=statuses.count("INCOMPLETE"), warning_count=statuses.count("WARNING"), run_by=run_by,
        completed_at=utc_now(),
    )
    db.add(run)
    for item in findings:
        _append_finding(db, run, *item)
    record_audit(db, "VALIDATION_RUN", run.id, "DOCUMENT_CHECKS_RUN", run_by, f"Validation checks for document {document.id} returned {run.status}.", {"document_id": document.id, "status": run.status})
    db.commit()
    db.refresh(run)
    return run


def _run_quality(db: Session, entity_type: str, entity_id: str, run_by: str) -> ValidationRunRecord:
    ensure_registered_rules(db)
    check: QualityCheck = run_quality_check(db, entity_type, entity_id.upper(), run_by)
    statuses = ["PASS"] if not check.findings else []
    findings: list[tuple[str, str, str, str, dict[str, Any] | None, dict[str, Any] | None, list[dict[str, Any]], str, bool]] = []
    if check.findings:
        for item in check.findings:
            code = str(item.get("code", "QUALITY_RULE"))
            rule_id, title = FINDING_RULES.get(code, (f"QUALITY-{code}", item.get("message", code)))
            state = check.result if check.result in {"FAIL", "INCOMPLETE", "PENDING"} else "WARNING"
            findings.append((rule_id, check.rule_version, state, "CRITICAL" if state in {"FAIL", "INCOMPLETE"} else "WARNING", {"result": "PASS"}, {"result": state, "message": item.get("message")}, check.evidence, "Resolve the finding, preserve evidence, and rerun the quality check.", state in {"FAIL", "INCOMPLETE"}))
            statuses.append(state)
    else:
        rule = "QMS-QUALITY-001"
        findings.append((rule, check.rule_version, "PASS", "CRITICAL", {"quality_gate": "PASS"}, {"quality_gate": "PASS"}, check.evidence, "No action required.", True))
    run = ValidationRunRecord(
        id=new_id("VRN"), entity_type=entity_type, entity_id=entity_id.upper(), document_id=None,
        status=_overall_status(statuses), passed_count=statuses.count("PASS"), failed_count=statuses.count("FAIL"),
        incomplete_count=statuses.count("INCOMPLETE"), warning_count=statuses.count("WARNING"), run_by=run_by,
        completed_at=utc_now(),
    )
    db.add(run)
    db.flush()
    for item in findings:
        _append_finding(db, run, *item)
    record_audit(db, "VALIDATION_RUN", run.id, "QUALITY_CHECKS_RUN", run_by, f"Validation checks for {entity_type.lower()} {entity_id} returned {run.status}.", {"quality_check_id": check.id, "status": run.status})
    db.commit()
    db.refresh(run)
    return run


def run_validation(db: Session, entity_type: str, entity_id: str, document_id: str | None, run_by: str) -> ValidationRunRecord:
    if entity_type == "DOCUMENT":
        doc = db.get(DocumentRecord, document_id or entity_id)
        if doc is None:
            raise ValueError(f"Document {document_id or entity_id} was not found.")
        return _run_document(db, doc, run_by)
    if entity_type == "LOT":
        if db.get(Lot, entity_id.upper()) is None:
            raise ValueError(f"Lot {entity_id} was not found.")
        return _run_quality(db, entity_type, entity_id, run_by)
    if entity_type == "SUPPLIER":
        if db.get(Supplier, entity_id.upper()) is None:
            raise ValueError(f"Supplier {entity_id} was not found.")
        return _run_quality(db, entity_type, entity_id, run_by)
    raise ValueError(f"Validation is not configured for {entity_type}.")


def validation_run_findings(db: Session, run_id: str) -> list[ValidationFindingRecord]:
    return db.scalars(select(ValidationFindingRecord).where(ValidationFindingRecord.run_id == run_id).order_by(ValidationFindingRecord.created_at, ValidationFindingRecord.id)).all()


def resolve_finding(db: Session, finding: ValidationFindingRecord, actor: str, resolution: str) -> ValidationFindingRecord:
    if finding.status == "RESOLVED":
        raise ValueError("Finding is already resolved.")
    finding.status = "RESOLVED"
    finding.resolved_by = actor.strip()
    finding.resolution = resolution.strip()
    finding.resolved_at = utc_now()
    record_audit(db, "VALIDATION_FINDING", finding.id, "VALIDATION_FINDING_RESOLVED", actor, "Recorded a finding resolution. A rerun is required to change its check result.", {"run_id": finding.run_id, "rule_id": finding.rule_id, "resolution": resolution.strip()})
    db.commit()
    db.refresh(finding)
    return finding
