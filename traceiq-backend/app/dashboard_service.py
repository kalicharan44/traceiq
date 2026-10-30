"""Single-query-group dashboard snapshot and time-series aggregation."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Any
from urllib.parse import quote

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CorrectiveAction,
    DashboardActivityItem,
    DashboardDocumentStates,
    DashboardExecutiveSummary,
    DashboardFindingItem,
    DashboardInventoryKpi,
    DashboardKpis,
    DashboardLotsKpi,
    DashboardProductionKpi,
    DashboardQuantity,
    DashboardQualityKpi,
    DashboardRecallReadiness,
    DashboardRiskItem,
    DashboardSeriesPoint,
    DashboardDocumentsKpi,
    DashboardSuppliersKpi,
    DocumentProcessingEvent,
    DocumentRecord,
    InventoryBalance,
    Lot,
    ProductionOrder,
    QualityCheck,
    RecallAction,
    RecallCase,
    Shipment,
    Supplier,
    ValidationFindingRecord,
    ValidationRunRecord,
    utc_now,
)
from app.services import closure_blockers

OPEN_FINDING_STATUSES = ("FAIL", "INCOMPLETE", "WARNING", "PENDING")
BLOCKED_INVENTORY_STATUSES = ("QUARANTINED", "RECALL_HOLD", "RECALLED", "HOLD", "BLOCKED")
PROCESSED_DOCUMENT_STATUSES = ("EXTRACTED", "REVIEW_REQUIRED", "VERIFIED", "REJECTED", "SUPERSEDED")


def _count(db: Session, model: Any, *conditions: Any) -> int:
    return int(db.scalar(select(func.count()).select_from(model).where(*conditions)) or 0)


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _quantities_by_unit(db: Session, statuses: tuple[str, ...]) -> tuple[list[DashboardQuantity], int]:
    rows = db.execute(
        select(InventoryBalance.unit, func.coalesce(func.sum(InventoryBalance.quantity), 0), func.count())
        .where(InventoryBalance.status.in_(statuses))
        .group_by(InventoryBalance.unit)
        .order_by(InventoryBalance.unit)
    ).all()
    values = [DashboardQuantity(unit=unit or "unknown", quantity=float(quantity or 0), positions=int(positions)) for unit, quantity, positions in rows]
    return values, sum(item.positions for item in values)


def _latest_quality_results(db: Session) -> list[tuple[str, str, str]]:
    ranked = select(
        QualityCheck.entity_type.label("entity_type"),
        QualityCheck.entity_id.label("entity_id"),
        QualityCheck.result.label("result"),
        func.row_number().over(
            partition_by=(QualityCheck.entity_type, QualityCheck.entity_id),
            order_by=(QualityCheck.created_at.desc(), QualityCheck.id.desc()),
        ).label("rank"),
    ).subquery()
    return [(entity_type, entity_id, result) for entity_type, entity_id, result in db.execute(
        select(ranked.c.entity_type, ranked.c.entity_id, ranked.c.result).where(ranked.c.rank == 1)
    ).all()]


def _activity_route(event: AuditEvent) -> str:
    entity_type = event.entity_type.upper()
    entity_id = quote(event.entity_id, safe="")
    if "DOCUMENT" in entity_type:
        return "/documents"
    if "VALIDATION" in entity_type or "QUALITY" in entity_type or "CORRECTIVE" in entity_type:
        return "/validation"
    if "RECALL" in entity_type:
        return "/recalls"
    if "SHIPMENT" in entity_type or "INVENTORY" in entity_type:
        return "/inventory"
    if "SUPPLIER" in entity_type:
        return "/suppliers"
    if entity_type in {"LOT", "PRODUCTION_ORDER", "PRODUCT"}:
        return f"/traceability?lot={entity_id}"
    return "/audit-log"


def _activity_status(action: str) -> str:
    normalized = action.upper()
    if any(token in normalized for token in ("FAIL", "REJECT", "BLOCK", "QUARANTINE")):
        return "ATTENTION"
    if any(token in normalized for token in ("PASS", "APPROVE", "COMPLETE", "CLOSED", "DELIVER")):
        return "COMPLETED"
    return "RECORDED"


def _series_for_period(db: Session, period: str, now: datetime, start: datetime) -> list[DashboardSeriesPoint]:
    if period == "today":
        slots = [start + timedelta(hours=hour) for hour in range(24)]
    else:
        slot_count = 13 if period == "90d" else (7 if period == "7d" else 30)
        slots = [start + timedelta(days=(index * 7 if period == "90d" else index)) for index in range(slot_count)]

    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def bucket_key(value: datetime) -> str:
        value = _aware(value)
        if period == "today":
            return value.strftime("%Y-%m-%dT%H")
        day_offset = (value.date() - start.date()).days
        if period == "90d":
            day_offset = day_offset // 7 * 7
        return (start.date() + timedelta(days=day_offset)).isoformat()

    series_sources = (
        (DocumentProcessingEvent, "documents_processed", (DocumentProcessingEvent.to_state == "REVIEW_REQUIRED",)),
        (QualityCheck, "checks_passed", (QualityCheck.result == "PASS",)),
        (QualityCheck, "quality_exceptions", (QualityCheck.result.in_(("FAIL", "INCOMPLETE")),)),
        (RecallCase, "recalls_opened", (RecallCase.created_at.is_not(None),)),
    )
    for model, name, filters in series_sources:
        for created_at in db.scalars(select(model.created_at).where(model.created_at >= start, *filters)).all():
            if created_at and _aware(created_at) <= now:
                counts[bucket_key(created_at)][name] += 1

    points = []
    for slot in slots:
        key = slot.strftime("%Y-%m-%dT%H") if period == "today" else slot.date().isoformat()
        values = counts.get(key, {})
        points.append(DashboardSeriesPoint(
            bucket_start=slot,
            documents_processed=values.get("documents_processed", 0),
            checks_passed=values.get("checks_passed", 0),
            quality_exceptions=values.get("quality_exceptions", 0),
            recalls_opened=values.get("recalls_opened", 0),
        ))
    return points


def get_executive_dashboard(db: Session, period: str = "30d") -> DashboardExecutiveSummary:
    now = utc_now()
    today = now.date()
    if period == "today":
        start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    else:
        days = {"7d": 6, "30d": 29, "90d": 89}[period]
        start = datetime.combine(today - timedelta(days=days), time.min, tzinfo=timezone.utc)

    suppliers_total = _count(db, Supplier)
    suppliers_active = _count(db, Supplier, Supplier.status == "ACTIVE")
    lots_total = _count(db, Lot)
    pending_inspection = _count(db, Lot, Lot.status == "PENDING_QUALITY")
    lots_on_hold = _count(db, Lot, Lot.status.in_(("QUARANTINED", "FLAGGED", "HOLD", "RECALLED")))
    orders_active = _count(db, ProductionOrder, ProductionOrder.status.in_(("PLANNED", "IN_PROGRESS", "ACTIVE")))
    orders_completed = _count(db, ProductionOrder, ProductionOrder.status == "COMPLETED")
    orders_exceptions = _count(db, ProductionOrder, ProductionOrder.status.in_(("FAILED", "BLOCKED", "CANCELLED", "EXCEPTION", "FLAGGED")))

    available_by_unit, available_positions = _quantities_by_unit(db, ("AVAILABLE",))
    blocked_by_unit, blocked_positions = _quantities_by_unit(db, BLOCKED_INVENTORY_STATUSES)
    at_risk_lots = _count(db, Lot, Lot.status.in_(("PENDING_QUALITY", "QUARANTINED", "FLAGGED", "HOLD", "RECALLED")))

    active_document = DocumentRecord.archived_at.is_(None)
    docs_processed = _count(db, DocumentRecord, active_document, DocumentRecord.status.in_(PROCESSED_DOCUMENT_STATUSES))
    docs_review = _count(db, DocumentRecord, active_document, DocumentRecord.status == "REVIEW_REQUIRED")
    docs_failed = _count(db, DocumentRecord, active_document, DocumentRecord.status == "FAILED")
    docs_queued = _count(db, DocumentRecord, active_document, DocumentRecord.status == "QUEUED")
    docs_processing = _count(db, DocumentRecord, active_document, DocumentRecord.status.in_(("EXTRACTING", "EXTRACTED")))
    docs_verified = _count(db, DocumentRecord, active_document, DocumentRecord.status == "VERIFIED")

    document_checks_passed = int(db.scalar(
        select(func.coalesce(func.sum(ValidationRunRecord.passed_count), 0)).where(ValidationRunRecord.entity_type == "DOCUMENT")
    ) or 0)
    checks_passed = _count(db, QualityCheck, QualityCheck.result == "PASS") + document_checks_passed
    open_finding_records = set(db.execute(
        select(ValidationRunRecord.entity_type, ValidationRunRecord.entity_id)
        .join(ValidationFindingRecord, ValidationFindingRecord.run_id == ValidationRunRecord.id)
        .where(ValidationFindingRecord.status.in_(OPEN_FINDING_STATUSES))
    ).all())
    latest_quality = _latest_quality_results(db)
    open_finding_records.update((entity_type, entity_id) for entity_type, entity_id, result in latest_quality if result in {"FAIL", "INCOMPLETE", "PENDING"})
    open_finding_records.update(db.execute(
        select(CorrectiveAction.entity_type, CorrectiveAction.entity_id).where(CorrectiveAction.status == "OPEN")
    ).all())
    open_findings = len(open_finding_records)
    critical_entities = set(db.execute(
        select(ValidationRunRecord.entity_type, ValidationRunRecord.entity_id)
        .join(ValidationFindingRecord, ValidationFindingRecord.run_id == ValidationRunRecord.id)
        .where(ValidationFindingRecord.severity == "CRITICAL", ValidationFindingRecord.status.in_(("FAIL", "INCOMPLETE")))
    ).all())
    critical_entities.update((entity_type, entity_id) for entity_type, entity_id, result in latest_quality if result in {"FAIL", "INCOMPLETE"})
    critical_failures = len(critical_entities)

    active_recalls = db.scalars(select(RecallCase).where(RecallCase.status == "ACTIVE").order_by(RecallCase.created_at.desc())).all()
    active_recall_ids = [recall.id for recall in active_recalls]
    awaiting_acknowledgement = _count(db, RecallAction, RecallAction.recall_id.in_(active_recall_ids), RecallAction.action_type == "CUSTOMER_NOTIFICATION", RecallAction.status != "COMPLETED") if active_recall_ids else 0
    outstanding_recovery = sum(max(0.0, float(recall.affected_units) - float((recall.reconciliation or {}).get("accounted_units", 0))) for recall in active_recalls)
    recall_blocker_lists = [closure_blockers(db, recall) for recall in active_recalls]
    unresolved_blockers = sum(len(blockers) for blockers in recall_blocker_lists)

    incomplete_genealogy = int(db.scalar(
        select(func.count()).select_from(Lot).outerjoin(ProductionOrder, Lot.production_order_id == ProductionOrder.id)
        .where(Lot.lot_type == "FG", or_(Lot.production_order_id.is_(None), ProductionOrder.id.is_(None)))
    ) or 0)
    critical_risk_count = critical_failures
    blocked_inventory_count = blocked_positions
    recalls_need_attention = sum(1 for blockers in recall_blocker_lists if blockers)

    risks = [
        DashboardRiskItem(id="critical-findings", title="Critical validation failures", severity="CRITICAL", count=critical_risk_count, detail="Unresolved critical checks need disposition.", route="/validation"),
        DashboardRiskItem(id="quality-disposition", title="Lots awaiting quality disposition", severity="HIGH", count=pending_inspection, detail="Pending release or inspection decision.", route="/quality"),
        DashboardRiskItem(id="blocked-inventory", title="Blocked or quarantined inventory", severity="HIGH", count=blocked_inventory_count, detail="Inventory positions in a containment or hold state.", route="/inventory"),
        DashboardRiskItem(id="missing-genealogy", title="Finished lots with incomplete genealogy", severity="HIGH", count=incomplete_genealogy, detail="Missing production-order link in the lot ledger.", route="/traceability"),
        DashboardRiskItem(id="documents-review", title="Documents requiring review", severity="MEDIUM", count=docs_review, detail="Human verification is required before checks can run.", route="/documents?status=REVIEW_REQUIRED"),
        DashboardRiskItem(id="recalls-attention", title="Active recalls requiring attention", severity="HIGH", count=recalls_need_attention, detail="Open workflow actions or closure blockers remain.", route="/recalls"),
    ]

    audit_rows = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(30)).all()
    activities = [DashboardActivityItem(
        id=event.id,
        action=event.action,
        title=event.action.replace("_", " ").title(),
        description=event.description,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        status=_activity_status(event.action),
        route=_activity_route(event),
        created_at=_aware(event.created_at),
    ) for event in audit_rows[:8]]

    recent_rows = db.execute(
        select(ValidationFindingRecord, ValidationRunRecord.entity_type, ValidationRunRecord.entity_id)
        .join(ValidationRunRecord, ValidationFindingRecord.run_id == ValidationRunRecord.id)
        .order_by(ValidationFindingRecord.created_at.desc())
        .limit(8)
    ).all()
    recent_findings = [DashboardFindingItem(
        id=finding.id,
        rule_id=finding.rule_id,
        title=finding.title,
        severity=finding.severity,
        entity_type=entity_type,
        entity_id=entity_id,
        status=finding.status,
        created_at=_aware(finding.created_at),
    ) for finding, entity_type, entity_id in recent_rows]

    return DashboardExecutiveSummary(
        period=period,
        period_start=start,
        generated_at=now,
        kpis=DashboardKpis(
            suppliers=DashboardSuppliersKpi(total=suppliers_total, active=suppliers_active),
            material_lots=DashboardLotsKpi(total=lots_total, pending_inspection=pending_inspection, on_hold=lots_on_hold),
            production_orders=DashboardProductionKpi(active=orders_active, completed=orders_completed, exceptions=orders_exceptions),
            inventory=DashboardInventoryKpi(available_by_unit=available_by_unit, blocked_by_unit=blocked_by_unit, available_positions=available_positions, blocked_positions=blocked_positions, at_risk_lots=at_risk_lots),
            documents=DashboardDocumentsKpi(processed=docs_processed, pending_review=docs_review, failed=docs_failed),
            quality=DashboardQualityKpi(checks_passed=checks_passed, critical_failures=critical_failures, open_findings=open_findings),
        ),
        series=_series_for_period(db, period, now, start),
        activities=activities,
        risks=risks,
        document_processing=DashboardDocumentStates(queued=docs_queued, processing=docs_processing, review_required=docs_review, failed=docs_failed, verified=docs_verified, total=_count(db, DocumentRecord, active_document)),
        recall_readiness=DashboardRecallReadiness(active_recalls=len(active_recalls), awaiting_customer_acknowledgement=awaiting_acknowledgement, outstanding_recovery_quantity=outstanding_recovery, unresolved_closure_blockers=unresolved_blockers),
        recent_findings=recent_findings,
    )
