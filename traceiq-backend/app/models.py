"""Database entities and the API schemas returned by FastAPI."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="Unknown")
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE", index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="units")
    unit_price_usd: Mapped[float] = mapped_column(Float, default=0)


class Lot(Base):
    __tablename__ = "lots"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    lot_type: Mapped[str] = mapped_column(String(12), index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    supplier_id: Mapped[str | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    # Kept as a string so imported records with missing links remain visible to validation.
    production_order_id: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="units")
    status: Mapped[str] = mapped_column(String(24), default="APPROVED", index=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ProductionOrder(Base):
    __tablename__ = "production_orders"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    facility: Mapped[str] = mapped_column(String(160), default="Primary Facility")
    status: Mapped[str] = mapped_column(String(24), default="COMPLETED", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProductionInput(Base):
    __tablename__ = "production_inputs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    production_order_id: Mapped[str] = mapped_column(ForeignKey("production_orders.id"), index=True)
    input_lot_id: Mapped[str] = mapped_column(String(60), index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="kg")


class InventoryBalance(Base):
    __tablename__ = "inventory"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    lot_id: Mapped[str] = mapped_column(ForeignKey("lots.id"), index=True)
    warehouse_id: Mapped[str] = mapped_column(String(60), index=True)
    warehouse_name: Mapped[str] = mapped_column(String(160), default="Main Warehouse")
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="units")
    status: Mapped[str] = mapped_column(String(24), default="AVAILABLE", index=True)
    bay: Mapped[str] = mapped_column(String(40), default="A-01")


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(180), nullable=True)
    location: Mapped[str] = mapped_column(String(180), default="Unknown")
    tier: Mapped[str] = mapped_column(String(40), default="Commercial")


class Shipment(Base):
    __tablename__ = "shipments"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    lot_id: Mapped[str] = mapped_column(ForeignKey("lots.id"), index=True)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(24), default="units")
    status: Mapped[str] = mapped_column(String(24), default="IN_TRANSIT", index=True)
    destination: Mapped[str] = mapped_column(String(180), default="Unknown")
    carrier: Mapped[str] = mapped_column(String(120), default="TraceIQ Logistics")
    tracking_number: Mapped[str] = mapped_column(String(100), default="")
    dispatched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class QualityCheck(Base):
    __tablename__ = "quality_checks"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(60), index=True)
    rule_version: Mapped[str] = mapped_column(String(40), default="quality-v1")
    result: Mapped[str] = mapped_column(String(24), index=True)
    findings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    checked_by: Mapped[str] = mapped_column(String(120), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    check_id: Mapped[str | None] = mapped_column(ForeignKey("quality_checks.id"), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="OPEN", index=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RecallCase(Base):
    __tablename__ = "recalls"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    target_lot_id: Mapped[str] = mapped_column(ForeignKey("lots.id"), index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE", index=True)
    authorized_by: Mapped[str] = mapped_column(String(120), nullable=False)
    approval_note: Mapped[str] = mapped_column(Text, default="")
    affected_units: Mapped[float] = mapped_column(Float, default=0)
    impact_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    reconciliation: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RecallAction(Base):
    __tablename__ = "recall_actions"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    recall_id: Mapped[str] = mapped_column(ForeignKey("recalls.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(24), default="PENDING", index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0)
    completed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(60), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    actor: Mapped[str] = mapped_column(String(120), default="system")
    description: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class DocumentRecord(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_created_status", "created_at", "status"),)

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_type: Mapped[str] = mapped_column(String(12), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="OTHER", index=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(32), default="UPLOADED", index=True)
    uploaded_by: Mapped[str] = mapped_column(String(120), default="Local Operator")
    extractor_version: Mapped[str | None] = mapped_column(String(60), nullable=True)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class DocumentExtractionRecord(Base):
    __tablename__ = "document_extractions"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    schema_version: Mapped[str] = mapped_column(String(40), default="document-extraction-v1")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    model_used: Mapped[str | None] = mapped_column(String(160), nullable=True)
    extractor_version: Mapped[str] = mapped_column(String(60), default="traceiq-extractor-v1")
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class DocumentReviewRecord(Base):
    __tablename__ = "document_reviews"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    decision: Mapped[str] = mapped_column(String(24), nullable=False)
    reviewed_fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    reviewer: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class DocumentLinkRecord(Base):
    __tablename__ = "document_links"
    __table_args__ = (UniqueConstraint("document_id", "entity_type", "entity_id", name="uq_document_entity_link"),)
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    relationship: Mapped[str] = mapped_column(String(80), default="SUPPORTING_EVIDENCE")
    created_by: Mapped[str] = mapped_column(String(120), default="Local Operator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DocumentProcessingEvent(Base):
    __tablename__ = "document_processing_events"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    from_state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_state: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, default="")
    actor: Mapped[str] = mapped_column(String(120), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class ValidationRuleRecord(Base):
    __tablename__ = "validation_rules"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(24), default="WARNING")
    applicable_entity_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    prerequisites: Mapped[list[str]] = mapped_column(JSON, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    blocks_transition: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ValidationRunRecord(Base):
    __tablename__ = "validation_runs"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(80), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), default="PENDING", index=True)
    passed_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    incomplete_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    run_by: Mapped[str] = mapped_column(String(120), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ValidationFindingRecord(Base):
    __tablename__ = "validation_findings"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("validation_runs.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[str] = mapped_column(String(60), index=True)
    rule_version: Mapped[str] = mapped_column(String(40), default="1")
    status: Mapped[str] = mapped_column(String(24), index=True)
    severity: Mapped[str] = mapped_column(String(24), default="WARNING", index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    expected: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    actual: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    suggested_action: Mapped[str] = mapped_column(Text, default="")
    blocks_transition: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


Index("ix_production_input_order_lot", ProductionInput.production_order_id, ProductionInput.input_lot_id)


# Pydantic schemas are kept in this file for the requested compact starter layout.
class ApiSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(ApiSchema):
    supplier_count: int
    raw_lot_count: int
    finished_lot_count: int
    open_anomaly_count: int
    active_recall_count: int
    units_in_stock: float
    shipments_in_transit: int


class DashboardQuantity(ApiSchema):
    unit: str
    quantity: float
    positions: int


class DashboardSuppliersKpi(ApiSchema):
    total: int
    active: int


class DashboardLotsKpi(ApiSchema):
    total: int
    pending_inspection: int
    on_hold: int


class DashboardProductionKpi(ApiSchema):
    active: int
    completed: int
    exceptions: int


class DashboardInventoryKpi(ApiSchema):
    available_by_unit: list[DashboardQuantity]
    blocked_by_unit: list[DashboardQuantity]
    available_positions: int
    blocked_positions: int
    at_risk_lots: int


class DashboardDocumentsKpi(ApiSchema):
    processed: int
    pending_review: int
    failed: int


class DashboardQualityKpi(ApiSchema):
    checks_passed: int
    critical_failures: int
    open_findings: int


class DashboardKpis(ApiSchema):
    suppliers: DashboardSuppliersKpi
    material_lots: DashboardLotsKpi
    production_orders: DashboardProductionKpi
    inventory: DashboardInventoryKpi
    documents: DashboardDocumentsKpi
    quality: DashboardQualityKpi


class DashboardSeriesPoint(ApiSchema):
    bucket_start: datetime
    documents_processed: int
    checks_passed: int
    quality_exceptions: int
    recalls_opened: int


class DashboardActivityItem(ApiSchema):
    id: str
    action: str
    title: str
    description: str
    entity_type: str
    entity_id: str
    status: str
    route: str
    created_at: datetime


class DashboardRiskItem(ApiSchema):
    id: str
    title: str
    severity: str
    count: int
    detail: str
    route: str


class DashboardDocumentStates(ApiSchema):
    queued: int
    processing: int
    review_required: int
    failed: int
    verified: int
    total: int


class DashboardRecallReadiness(ApiSchema):
    active_recalls: int
    awaiting_customer_acknowledgement: int
    outstanding_recovery_quantity: float
    unresolved_closure_blockers: int


class DashboardFindingItem(ApiSchema):
    id: str
    rule_id: str
    title: str
    severity: str
    entity_type: str
    entity_id: str
    status: str
    created_at: datetime


class DashboardExecutiveSummary(ApiSchema):
    period: Literal["today", "7d", "30d", "90d"]
    period_start: datetime
    generated_at: datetime
    kpis: DashboardKpis
    series: list[DashboardSeriesPoint]
    activities: list[DashboardActivityItem]
    risks: list[DashboardRiskItem]
    document_processing: DashboardDocumentStates
    recall_readiness: DashboardRecallReadiness
    recent_findings: list[DashboardFindingItem]


class SupplierOut(ApiSchema):
    id: str
    name: str
    country: str
    status: str
    risk_score: int


class SupplierCreate(BaseModel):
    id: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=180)
    country: str = Field(default="Unknown", max_length=100)


class ProductOut(ApiSchema):
    id: str
    name: str
    sku: str
    unit: str
    unit_price_usd: float


class LotOut(ApiSchema):
    id: str
    lot_type: str
    name: str
    supplier_id: str | None
    product_id: str | None
    production_order_id: str | None
    quantity: float
    unit: str
    status: str


class LotCreate(BaseModel):
    id: str = Field(min_length=2, max_length=60)
    lot_type: Literal["RAW", "FG"]
    name: str = Field(min_length=2, max_length=180)
    supplier_id: str | None = None
    product_id: str | None = None
    production_order_id: str | None = None
    quantity: float = Field(gt=0)
    unit: str = "units"
    status: Literal["PENDING_QUALITY", "QUARANTINED", "FLAGGED"] = "PENDING_QUALITY"


class ProductionInputCreate(BaseModel):
    lot_id: str
    quantity: float = Field(gt=0)
    unit: str = "kg"


class ProductionOutputCreate(BaseModel):
    lot_id: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=2, max_length=180)
    quantity: float = Field(gt=0)
    unit: str = "units"


class ProductionOrderCreate(BaseModel):
    id: str = Field(min_length=2, max_length=60)
    product_id: str
    facility: str = Field(default="Primary Facility", max_length=160)
    input_lots: list[ProductionInputCreate] = Field(min_length=1)
    output_lots: list[ProductionOutputCreate] = Field(min_length=1)


class InventoryReceiptCreate(BaseModel):
    id: str = Field(min_length=2, max_length=60)
    lot_id: str
    warehouse_id: str
    warehouse_name: str
    quantity: float = Field(gt=0)
    unit: str = "units"
    bay: str = "A-01"


class ShipmentCreate(BaseModel):
    id: str = Field(min_length=2, max_length=60)
    lot_id: str
    customer_id: str
    quantity: float = Field(gt=0)
    unit: str = "units"
    destination: str
    carrier: str = "TraceIQ Logistics"
    tracking_number: str = ""


class RecordUpdate(BaseModel):
    status: str | None = None
    quantity: float | None = Field(default=None, gt=0)
    updated_by: str = Field(min_length=2, max_length=120)


class CorrectiveActionUpdate(BaseModel):
    status: Literal["OPEN", "CLOSED"]
    updated_by: str = Field(min_length=2, max_length=120)
    resolution: str | None = Field(default=None, max_length=1000)


class TraceNode(ApiSchema):
    id: str
    type: str
    label: str
    status: str = ""
    quantity: float | None = None
    unit: str | None = None


class TraceEdge(ApiSchema):
    id: str
    source: str
    target: str
    label: str = ""
    status: str = "OK"


class QuantityFinding(ApiSchema):
    lot_id: str
    produced_quantity: float
    inventory_quantity: float
    shipped_quantity: float
    accounted_quantity: float
    difference: float
    status: str
    unit: str


class TraceabilityResult(ApiSchema):
    target_id: str
    nodes: list[TraceNode]
    edges: list[TraceEdge]
    suppliers: list[str]
    raw_lots: list[str]
    production_orders: list[str]
    finished_lots: list[str]
    inventory_ids: list[str]
    shipment_ids: list[str]
    customer_ids: list[str]
    missing_links: list[str]
    quantity_findings: list[QuantityFinding]


class RecallImpact(ApiSchema):
    target_lot_id: str
    affected_units: float
    on_hand_units: float
    in_transit_units: float
    delivered_units: float
    raw_lots: list[str]
    production_orders: list[str]
    finished_lots: list[str]
    inventory_ids: list[str]
    shipment_ids: list[str]
    customer_ids: list[str]
    missing_links: list[str]
    quantity_findings: list[QuantityFinding]
    financial_exposure_usd: float
    warnings: list[str]


class RecallCreate(BaseModel):
    target_lot_id: str
    reason: str = Field(min_length=4, max_length=1200)
    authorized_by: str = Field(min_length=2, max_length=120)
    approval_note: str = Field(min_length=3, max_length=1200)


class RecallActionCreate(BaseModel):
    action_type: Literal["CUSTOMER_NOTIFICATION", "RETURN", "DESTROY", "OTHER"]
    entity_id: str | None = None
    description: str = Field(min_length=3, max_length=1000)
    quantity: float = Field(default=0, ge=0)


class RecallActionUpdate(BaseModel):
    status: Literal["PENDING", "COMPLETED"]
    completed_by: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)


class ReconciliationInput(BaseModel):
    quarantined_units: float = Field(default=0, ge=0)
    held_or_delivered_units: float = Field(default=0, ge=0)
    returned_units: float = Field(default=0, ge=0)
    destroyed_units: float = Field(default=0, ge=0)
    documented_other_units: float = Field(default=0, ge=0)
    recorded_by: str = Field(min_length=2, max_length=120)


class RecallOut(ApiSchema):
    id: str
    target_lot_id: str
    reason: str
    status: str
    authorized_by: str
    approval_note: str
    affected_units: float
    impact_snapshot: dict[str, Any]
    reconciliation: dict[str, Any] | None
    created_at: datetime
    closed_at: datetime | None


class RecallActionOut(ApiSchema):
    id: str
    recall_id: str
    action_type: str
    entity_id: str | None
    description: str
    status: str
    quantity: float
    completed_by: str | None
    created_at: datetime
    completed_at: datetime | None


class RecallDetail(RecallOut):
    actions: list[RecallActionOut]
    closure_blockers: list[str] = []


class AnomalyOut(ApiSchema):
    id: str
    type: str
    severity: str
    entity_id: str
    title: str
    description: str
    status: str = "OPEN"


class AuditEventOut(ApiSchema):
    id: str
    entity_type: str
    entity_id: str
    action: str
    actor: str
    description: str
    details: dict[str, Any]
    created_at: datetime


class ShipmentCustomerUpdate(BaseModel):
    customer_id: str = Field(min_length=2, max_length=60)
    updated_by: str = Field(min_length=2, max_length=120)


class QualityCheckCreate(BaseModel):
    entity_type: Literal["LOT", "SUPPLIER"]
    entity_id: str = Field(min_length=2, max_length=60)
    checked_by: str = Field(min_length=2, max_length=120)
    evidence_reference: str | None = Field(default=None, max_length=300)


class QualityCheckOut(ApiSchema):
    id: str
    entity_type: str
    entity_id: str
    rule_version: str
    result: str
    findings: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    checked_by: str
    created_at: datetime


class CorrectiveActionOut(ApiSchema):
    id: str
    check_id: str | None
    entity_type: str
    entity_id: str
    description: str
    status: str
    opened_at: datetime
    closed_at: datetime | None


class AiInvestigationRequest(BaseModel):
    target_lot_id: str
    question: str = Field(min_length=3, max_length=1200)


class RecallSimulationRequest(BaseModel):
    target_lot_id: str = Field(min_length=2, max_length=60)


class DocumentOut(ApiSchema):
    id: str
    filename: str
    media_type: str
    file_type: str
    category: str
    sha256: str
    size_bytes: int
    status: str
    uploaded_by: str
    extractor_version: str | None
    processing_error: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DocumentExtractionOut(ApiSchema):
    id: str
    document_id: str
    schema_version: str
    extracted_text: str
    fields: list[dict[str, Any]]
    model_used: str | None
    extractor_version: str
    warnings: list[str]
    created_at: datetime


class DocumentReviewCreate(BaseModel):
    decision: Literal["VERIFIED", "REJECTED"]
    reviewed_fields: dict[str, Any] = Field(default_factory=dict)
    reviewer: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=2000)


class DocumentReviewReopen(BaseModel):
    reopened_by: str = Field(min_length=2, max_length=120)
    reason: str = Field(min_length=3, max_length=500)


class DocumentLinkCreate(BaseModel):
    entity_type: Literal["SUPPLIER", "CUSTOMER", "LOT", "PRODUCT", "PURCHASE_ORDER", "PRODUCTION_ORDER", "SHIPMENT", "RECALL"]
    entity_id: str = Field(min_length=2, max_length=80)
    relationship: str = Field(default="SUPPORTING_EVIDENCE", min_length=2, max_length=80)
    created_by: str = Field(default="Local Operator", min_length=2, max_length=120)


class ValidationRunOut(ApiSchema):
    id: str
    entity_type: str
    entity_id: str
    document_id: str | None
    status: str
    passed_count: int
    failed_count: int
    incomplete_count: int
    warning_count: int
    run_by: str
    created_at: datetime
    completed_at: datetime | None


class ValidationFindingOut(ApiSchema):
    id: str
    run_id: str
    rule_id: str
    rule_version: str
    status: str
    severity: str
    title: str
    expected: dict[str, Any] | None
    actual: dict[str, Any] | None
    evidence: list[dict[str, Any]]
    suggested_action: str
    blocks_transition: bool
    resolved_by: str | None
    resolution: str | None
    resolved_at: datetime | None
    created_at: datetime


class ValidationRunCreate(BaseModel):
    entity_type: Literal["DOCUMENT", "LOT", "SUPPLIER"]
    entity_id: str = Field(min_length=2, max_length=80)
    document_id: str | None = Field(default=None, max_length=60)
    run_by: str = Field(default="Local Operator", min_length=2, max_length=120)


class ValidationFindingResolve(BaseModel):
    resolved_by: str = Field(min_length=2, max_length=120)
    resolution: str = Field(min_length=3, max_length=2000)

