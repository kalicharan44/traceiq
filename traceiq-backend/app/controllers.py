"""Versioned REST endpoints. Keep request handling thin; services own rules."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import investigate
from app.database import get_db
from app.models import (
    AiInvestigationRequest,
    AuditEvent,
    AuditEventOut,
    CorrectiveAction,
    CorrectiveActionOut,
    CorrectiveActionUpdate,
    Customer,
    DashboardExecutiveSummary,
    DashboardSummary,
    InventoryReceiptCreate,
    InventoryBalance,
    Lot,
    LotCreate,
    LotOut,
    ProductionInput,
    ProductionOrderCreate,
    ProductionOrder,
    Product,
    ProductOut,
    QualityCheck,
    QualityCheckCreate,
    QualityCheckOut,
    RecallAction,
    RecallActionCreate,
    RecallActionOut,
    RecallActionUpdate,
    RecallCase,
    RecallCreate,
    RecallDetail,
    RecallImpact,
    RecallOut,
    RecallSimulationRequest,
    ReconciliationInput,
    RecordUpdate,
    Shipment,
    ShipmentCreate,
    ShipmentCustomerUpdate,
    Supplier,
    SupplierCreate,
    SupplierOut,
    TraceabilityResult,
    utc_now,
)
from app.dashboard_service import get_executive_dashboard
from app.services import (
    activate_recall,
    add_recall_action,
    closure_blockers,
    create_inventory_receipt,
    create_production_order,
    create_shipment,
    create_supplier,
    detect_anomalies,
    recall_actions,
    recall_impact,
    record_audit,
    record_reconciliation,
    run_quality_check,
    traceability,
    update_corrective_action,
    update_lot_record,
    update_recall_action,
)

router = APIRouter(prefix="/api/v1")


def _get_recall(db: Session, recall_id: str) -> RecallCase:
    recall = db.get(RecallCase, recall_id)
    if recall is None:
        raise HTTPException(status_code=404, detail=f"Recall {recall_id} was not found.")
    return recall


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "traceiq-api"}


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    suppliers = int(db.scalar(select(func.count()).select_from(Supplier)) or 0)
    raw_lots = int(db.scalar(select(func.count()).select_from(Lot).where(Lot.lot_type == "RAW")) or 0)
    finished_lots = int(db.scalar(select(func.count()).select_from(Lot).where(Lot.lot_type == "FG")) or 0)
    stock = float(db.scalar(select(func.coalesce(func.sum(InventoryBalance.quantity), 0)).where(InventoryBalance.status.in_(["AVAILABLE", "QUARANTINED", "RESERVED"]))) or 0)
    in_transit = int(db.scalar(select(func.count()).select_from(Shipment).where(Shipment.status == "IN_TRANSIT")) or 0)
    active_recalls = int(db.scalar(select(func.count()).select_from(RecallCase).where(RecallCase.status == "ACTIVE")) or 0)
    return {
        "supplier_count": suppliers,
        "raw_lot_count": raw_lots,
        "finished_lot_count": finished_lots,
        "open_anomaly_count": len(detect_anomalies(db)),
        "active_recall_count": active_recalls,
        "units_in_stock": stock,
        "shipments_in_transit": in_transit,
    }


@router.get("/dashboard/summary", response_model=DashboardExecutiveSummary)
def executive_dashboard(period: Literal["today", "7d", "30d", "90d"] = Query("30d"), db: Session = Depends(get_db)) -> DashboardExecutiveSummary:
    return get_executive_dashboard(db, period)


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(q: str = "", offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(Supplier)
    if q.strip():
        statement = statement.where(Supplier.name.ilike(f"%{q.strip()}%") | Supplier.id.ilike(f"%{q.strip()}%"))
    return db.scalars(statement.order_by(Supplier.name).offset(offset).limit(limit)).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
def register_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    try:
        supplier = create_supplier(db, payload, "Frontend User")
        db.commit()
        db.refresh(supplier)
        return supplier
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/products", response_model=list[ProductOut])
def products(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.name).offset(offset).limit(limit)).all()


@router.get("/production-orders")
def production_orders(offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    orders = db.scalars(select(ProductionOrder).order_by(ProductionOrder.id).offset(offset).limit(limit)).all()
    return [{"id": order.id, "product_id": order.product_id, "facility": order.facility, "status": order.status, "input_lots": [{"lot_id": row.input_lot_id, "quantity": row.quantity, "unit": row.unit} for row in db.scalars(select(ProductionInput).where(ProductionInput.production_order_id == order.id)).all()], "output_lots": [{"id": lot.id, "quantity": lot.quantity, "unit": lot.unit, "status": lot.status} for lot in db.scalars(select(Lot).where(Lot.production_order_id == order.id)).all()]} for order in orders]


@router.post("/production-orders", status_code=201)
def record_production_order(payload: ProductionOrderCreate, db: Session = Depends(get_db)):
    try:
        order = create_production_order(db, payload, "Production Planner")
        db.commit()
        db.refresh(order)
        return {"id": order.id, "status": order.status, "output_lots": [row.lot_id for row in payload.output_lots]}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/lots", response_model=list[LotOut])
def list_lots(q: str = "", lot_type: str | None = None, supplier_id: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(Lot)
    if q.strip():
        statement = statement.where(Lot.id.ilike(f"%{q.strip()}%") | Lot.name.ilike(f"%{q.strip()}%"))
    if lot_type:
        statement = statement.where(Lot.lot_type == lot_type.upper())
    if supplier_id and supplier_id.strip():
        statement = statement.where(Lot.supplier_id == supplier_id.strip().upper())
    return db.scalars(statement.order_by(Lot.id).offset(offset).limit(limit)).all()


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot(lot_id: str, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id.upper())
    if lot is None:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} was not found.")
    return lot


@router.post("/lots", response_model=LotOut, status_code=201)
def create_lot(payload: LotCreate, db: Session = Depends(get_db)):
    if db.get(Lot, payload.id.upper()):
        raise HTTPException(status_code=409, detail=f"Lot {payload.id} already exists.")
    if payload.supplier_id and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=422, detail=f"Supplier {payload.supplier_id} was not found.")
    if payload.product_id and not db.get(Product, payload.product_id):
        raise HTTPException(status_code=422, detail=f"Product {payload.product_id} was not found.")
    lot = Lot(**payload.model_dump(exclude={"id"}), id=payload.id.upper())
    db.add(lot)
    record_audit(db, "LOT", lot.id, "LOT_CREATED", "Frontend User", f"Lot {lot.id} was registered.", payload.model_dump())
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/lots/{lot_id}/traceability", response_model=TraceabilityResult)
def lot_traceability(lot_id: str, db: Session = Depends(get_db)):
    try:
        return traceability(db, lot_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/traceability", response_model=TraceabilityResult)
def traceability_query(target_id: str = Query(alias="targetId"), db: Session = Depends(get_db)):
    return lot_traceability(target_id, db)


@router.get("/inventory")
def inventory(q: str = "", status: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(InventoryBalance)
    if q.strip():
        statement = statement.where(InventoryBalance.lot_id.ilike(f"%{q.strip()}%") | InventoryBalance.warehouse_name.ilike(f"%{q.strip()}%"))
    if status:
        statement = statement.where(InventoryBalance.status == status.upper())
    rows = db.scalars(statement.order_by(InventoryBalance.id).offset(offset).limit(limit)).all()
    return [{"id": row.id, "lot_id": row.lot_id, "warehouse_id": row.warehouse_id, "warehouse_name": row.warehouse_name, "quantity": row.quantity, "unit": row.unit, "status": row.status, "bay": row.bay} for row in rows]


@router.get("/shipments")
def shipments(q: str = "", status: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(Shipment)
    if q.strip():
        statement = statement.where(Shipment.id.ilike(f"%{q.strip()}%") | Shipment.lot_id.ilike(f"%{q.strip()}%") | Shipment.tracking_number.ilike(f"%{q.strip()}%"))
    if status:
        statement = statement.where(Shipment.status == status.upper())
    rows = db.scalars(statement.order_by(Shipment.dispatched_at.desc()).offset(offset).limit(limit)).all()
    return [{"id": row.id, "lot_id": row.lot_id, "customer_id": row.customer_id, "quantity": row.quantity, "unit": row.unit, "status": row.status, "destination": row.destination, "tracking_number": row.tracking_number} for row in rows]


@router.patch("/shipments/{shipment_id}/customer")
def update_shipment_customer(shipment_id: str, payload: ShipmentCustomerUpdate, db: Session = Depends(get_db)):
    shipment = db.get(Shipment, shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment was not found.")
    if db.get(Customer, payload.customer_id) is None:
        raise HTTPException(status_code=422, detail="Customer was not found.")
    previous = shipment.customer_id
    shipment.customer_id = payload.customer_id
    record_audit(db, "SHIPMENT", shipment.id, "SHIPMENT_CUSTOMER_LINK_CORRECTED", payload.updated_by, f"Shipment recipient link updated for {shipment.id}.", {"previous_customer_id": previous, "customer_id": payload.customer_id})
    db.commit()
    return {"id": shipment.id, "customer_id": shipment.customer_id, "status": "updated"}


@router.post("/inventory/receipts", status_code=201)
def receive_inventory(payload: InventoryReceiptCreate, db: Session = Depends(get_db)):
    try:
        row = create_inventory_receipt(db, payload, "Warehouse Operator")
        db.commit()
        db.refresh(row)
        return {"id": row.id, "lot_id": row.lot_id, "quantity": row.quantity, "unit": row.unit, "status": row.status, "warehouse_name": row.warehouse_name}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/shipments", status_code=201)
def dispatch_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)):
    try:
        shipment = create_shipment(db, payload, "Shipping Operator")
        db.commit()
        db.refresh(shipment)
        return {"id": shipment.id, "lot_id": shipment.lot_id, "customer_id": shipment.customer_id, "quantity": shipment.quantity, "unit": shipment.unit, "status": shipment.status, "tracking_number": shipment.tracking_number}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.patch("/lots/{lot_id}", response_model=LotOut)
def correct_lot(lot_id: str, payload: RecordUpdate, db: Session = Depends(get_db)):
    lot = db.get(Lot, lot_id.upper())
    if lot is None:
        raise HTTPException(status_code=404, detail="Lot was not found.")
    try:
        update_lot_record(db, lot, payload.quantity, payload.status, payload.updated_by)
        db.commit()
        db.refresh(lot)
        return lot
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/quality/checks", response_model=QualityCheckOut, status_code=201)
def create_quality_check(payload: QualityCheckCreate, db: Session = Depends(get_db)):
    check = run_quality_check(db, payload.entity_type, payload.entity_id, payload.checked_by, payload.evidence_reference)
    db.commit()
    db.refresh(check)
    return check


@router.get("/quality/checks", response_model=list[QualityCheckOut])
def quality_checks(entity_id: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(QualityCheck)
    if entity_id:
        statement = statement.where(QualityCheck.entity_id == entity_id)
    return db.scalars(statement.order_by(QualityCheck.created_at.desc()).offset(offset).limit(limit)).all()


@router.get("/quality/corrective-actions", response_model=list[CorrectiveActionOut])
def corrective_actions(status: str | None = None, db: Session = Depends(get_db)):
    statement = select(CorrectiveAction)
    if status:
        statement = statement.where(CorrectiveAction.status == status.upper())
    return db.scalars(statement.order_by(CorrectiveAction.opened_at.desc())).all()


@router.patch("/quality/corrective-actions/{action_id}", response_model=CorrectiveActionOut)
def patch_corrective_action(action_id: str, payload: CorrectiveActionUpdate, db: Session = Depends(get_db)):
    action = db.get(CorrectiveAction, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Corrective action was not found.")
    try:
        update_corrective_action(db, action, payload.status, payload.updated_by, payload.resolution)
        db.commit()
        db.refresh(action)
        return action
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/anomalies")
def anomalies(db: Session = Depends(get_db)):
    return detect_anomalies(db)


@router.get("/recalls/impact", response_model=RecallImpact)
def recall_impact_query(target_lot_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        return recall_impact(db, target_lot_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/recalls/simulations", response_model=RecallImpact)
def simulate_recall(payload: RecallSimulationRequest, db: Session = Depends(get_db)):
    try:
        return recall_impact(db, payload.target_lot_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _recall_detail(db: Session, recall: RecallCase) -> dict[str, Any]:
    return {
        **{key: getattr(recall, key) for key in ["id", "target_lot_id", "reason", "status", "authorized_by", "approval_note", "affected_units", "impact_snapshot", "reconciliation", "created_at", "closed_at"]},
        "actions": recall_actions(db, recall.id),
        "closure_blockers": closure_blockers(db, recall) if recall.status == "ACTIVE" else [],
    }


@router.get("/recalls", response_model=list[RecallOut])
def list_recalls(status: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    statement = select(RecallCase)
    if status:
        statement = statement.where(RecallCase.status == status.upper())
    return db.scalars(statement.order_by(RecallCase.created_at.desc()).offset(offset).limit(limit)).all()


@router.post("/recalls", response_model=RecallDetail, status_code=201)
def create_recall(payload: RecallCreate, db: Session = Depends(get_db)):
    try:
        recall = activate_recall(db, payload.target_lot_id, payload.reason, payload.authorized_by, payload.approval_note)
        db.commit()
        db.refresh(recall)
        return _recall_detail(db, recall)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise


@router.get("/recalls/{recall_id}", response_model=RecallDetail)
def get_recall(recall_id: str, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    return _recall_detail(db, recall)


@router.post("/recalls/{recall_id}/actions", response_model=RecallActionOut, status_code=201)
def create_recall_action(recall_id: str, payload: RecallActionCreate, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    if recall.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Actions can only be added to an active recall.")
    action = add_recall_action(db, recall, payload.action_type, payload.entity_id, payload.description, payload.quantity, "Frontend User")
    db.commit()
    db.refresh(action)
    return action


@router.patch("/recalls/{recall_id}/actions/{action_id}", response_model=RecallActionOut)
def patch_recall_action(recall_id: str, action_id: str, payload: RecallActionUpdate, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    action = db.get(RecallAction, action_id)
    if action is None or action.recall_id != recall.id:
        raise HTTPException(status_code=404, detail="Recall action was not found.")
    update_recall_action(db, action, payload.status, payload.completed_by, payload.description)
    db.commit()
    db.refresh(action)
    return action


@router.post("/recalls/{recall_id}/reconcile")
def reconcile_recall(recall_id: str, payload: ReconciliationInput, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    if recall.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Only active recalls can be reconciled.")
    reconciliation = record_reconciliation(db, recall, payload.model_dump(exclude={"recorded_by"}), payload.recorded_by)
    reconciliation["recorded_by"] = payload.recorded_by
    recall.reconciliation = reconciliation
    db.commit()
    return reconciliation


@router.get("/recalls/{recall_id}/closure-check")
def recall_closure_check(recall_id: str, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    return {"recall_id": recall.id, "can_close": not closure_blockers(db, recall), "blockers": closure_blockers(db, recall)}


@router.post("/recalls/{recall_id}/close", response_model=RecallDetail)
def close_recall(recall_id: str, actor: str = Query(min_length=2), db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    if recall.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Recall is not active.")
    blockers = closure_blockers(db, recall)
    if blockers:
        raise HTTPException(status_code=409, detail={"message": "Recall closure checks are incomplete.", "blockers": blockers})
    recall.status = "CLOSED"
    recall.closed_at = utc_now()
    record_audit(db, "RECALL", recall.id, "RECALL_CLOSED", actor, "Recall closed after required actions and reconciliation passed.", {"reconciliation": recall.reconciliation})
    db.commit()
    db.refresh(recall)
    return _recall_detail(db, recall)


@router.get("/audit-events", response_model=list[AuditEventOut])
def audit_events(entity_id: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    statement = select(AuditEvent)
    if entity_id:
        statement = statement.where(AuditEvent.entity_id == entity_id)
    return db.scalars(statement.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit)).all()


@router.get("/reports/recalls/{recall_id}")
def recall_report(recall_id: str, db: Session = Depends(get_db)):
    recall = _get_recall(db, recall_id)
    events = db.scalars(select(AuditEvent).where(AuditEvent.entity_id == recall.id).order_by(AuditEvent.created_at)).all()
    return {"report_type": "recall-closure", "recall": _recall_detail(db, recall), "audit_events": events, "generated_at": datetime.now(timezone.utc).isoformat()}


@router.post("/ai/investigations")
async def ai_investigation(payload: AiInvestigationRequest, db: Session = Depends(get_db)):
    try:
        trace = traceability(db, payload.target_lot_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    impact = recall_impact(db, payload.target_lot_id)
    evidence = {
        "trace": {key: trace[key] for key in ["target_id", "suppliers", "raw_lots", "production_orders", "finished_lots", "shipment_ids", "customer_ids", "missing_links"]},
        "deterministic_findings": impact["warnings"],
        "quantity_findings": impact["quantity_findings"],
    }
    answer = await investigate(evidence, payload.question)
    record_audit(db, "AI_INVESTIGATION", payload.target_lot_id, "AI_INVESTIGATION_REQUESTED", "Frontend User", "Evidence-grounded AI investigation requested.", {"question": payload.question, "generated_by_ai": answer.generated_by_ai})
    db.commit()
    return answer

