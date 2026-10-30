export interface DashboardSummary {
  supplier_count: number;
  raw_lot_count: number;
  finished_lot_count: number;
  open_anomaly_count: number;
  active_recall_count: number;
  units_in_stock: number;
  shipments_in_transit: number;
}

export type DashboardPeriod = 'today' | '7d' | '30d' | '90d';
export interface DashboardQuantity { unit: string; quantity: number; positions: number }
export interface DashboardExecutiveKpis {
  suppliers: { total: number; active: number };
  material_lots: { total: number; pending_inspection: number; on_hold: number };
  production_orders: { active: number; completed: number; exceptions: number };
  inventory: { available_by_unit: DashboardQuantity[]; blocked_by_unit: DashboardQuantity[]; available_positions: number; blocked_positions: number; at_risk_lots: number };
  documents: { processed: number; pending_review: number; failed: number };
  quality: { checks_passed: number; critical_failures: number; open_findings: number };
}
export interface DashboardSeriesPoint { bucket_start: string; documents_processed: number; checks_passed: number; quality_exceptions: number; recalls_opened: number }
export interface DashboardActivity { id: string; action: string; title: string; description: string; entity_type: string; entity_id: string; status: string; route: string; created_at: string }
export interface DashboardRisk { id: string; title: string; severity: string; count: number; detail: string; route: string }
export interface DashboardFinding { id: string; rule_id: string; title: string; severity: string; entity_type: string; entity_id: string; status: string; created_at: string }
export interface DashboardExecutiveSummary {
  period: DashboardPeriod;
  period_start: string;
  generated_at: string;
  kpis: DashboardExecutiveKpis;
  series: DashboardSeriesPoint[];
  activities: DashboardActivity[];
  risks: DashboardRisk[];
  document_processing: { queued: number; processing: number; review_required: number; failed: number; verified: number; total: number };
  recall_readiness: { active_recalls: number; awaiting_customer_acknowledgement: number; outstanding_recovery_quantity: number; unresolved_closure_blockers: number };
  recent_findings: DashboardFinding[];
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  status: string;
  risk_score: number;
}

export interface Lot {
  id: string;
  lot_type: 'RAW' | 'FG';
  name: string;
  supplier_id: string | null;
  product_id: string | null;
  production_order_id: string | null;
  quantity: number;
  unit: string;
  status: string;
}

export interface TraceNode {
  id: string;
  type: string;
  label: string;
  status: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface TraceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
}

export interface QuantityFinding {
  lot_id: string;
  produced_quantity: number;
  inventory_quantity: number;
  shipped_quantity: number;
  accounted_quantity: number;
  difference: number;
  status: 'OVER_ALLOCATED' | 'UNDER_RECONCILED' | 'RECONCILED';
  unit: string;
}

export interface TraceabilityResult {
  target_id: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  suppliers: string[];
  raw_lots: string[];
  production_orders: string[];
  finished_lots: string[];
  inventory_ids: string[];
  shipment_ids: string[];
  customer_ids: string[];
  missing_links: string[];
  quantity_findings: QuantityFinding[];
}

export interface RecallImpact extends Omit<TraceabilityResult, 'target_id' | 'nodes' | 'edges'> {
  target_lot_id: string;
  affected_units: number;
  on_hand_units: number;
  in_transit_units: number;
  delivered_units: number;
  financial_exposure_usd: number;
  warnings: string[];
}

export interface RecallAction {
  id: string;
  recall_id: string;
  action_type: string;
  entity_id: string | null;
  description: string;
  status: 'PENDING' | 'COMPLETED';
  quantity: number;
  completed_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Reconciliation {
  quarantined_units?: number;
  held_or_delivered_units?: number;
  returned_units?: number;
  destroyed_units?: number;
  documented_other_units?: number;
  accounted_units: number;
  expected_units: number;
  matches_scope: boolean;
  recorded_by?: string;
  recorded_at?: string;
}

export interface RecallRecord {
  id: string;
  target_lot_id: string;
  reason: string;
  status: 'ACTIVE' | 'CLOSED';
  authorized_by: string;
  approval_note: string;
  affected_units: number;
  impact_snapshot: RecallImpact;
  reconciliation: Reconciliation | null;
  created_at: string;
  closed_at: string | null;
  actions?: RecallAction[];
  closure_blockers?: string[];
}

export interface Anomaly {
  id: string;
  type: string;
  severity: string;
  entity_id: string;
  title: string;
  description: string;
  status: string;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  description: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface InventoryRow {
  id: string;
  lot_id: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
  unit: string;
  status: string;
  bay: string;
}

export interface ShipmentRow {
  id: string;
  lot_id: string;
  customer_id: string | null;
  quantity: number;
  unit: string;
  status: string;
  destination: string;
  tracking_number: string;
}

export interface QualityCheck {
  id: string;
  entity_type: string;
  entity_id: string;
  rule_version: string;
  result: string;
  findings: Array<{ code: string; message: string }>;
  evidence: Array<Record<string, unknown>>;
  checked_by: string;
  created_at: string;
}

export interface CorrectiveAction {
  id: string;
  check_id: string | null;
  entity_type: string;
  entity_id: string;
  description: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

export type DocumentState = 'UPLOADED' | 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'REVIEW_REQUIRED' | 'VERIFIED' | 'FAILED' | 'REJECTED' | 'SUPERSEDED';
export interface DocumentRecord {
  id: string;
  filename: string;
  media_type: string;
  file_type: string;
  category: string;
  sha256: string;
  size_bytes: number;
  status: DocumentState;
  uploaded_by: string;
  extractor_version: string | null;
  processing_error: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentField {
  field_name: string;
  value: unknown;
  page_number: number | null;
  source_reference: string | null;
  source_snippet: string;
  bbox: [number, number, number, number] | null;
  method: string;
  confidence: number | null;
  review_status: string;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  schema_version: string;
  extracted_text: string;
  fields: DocumentField[];
  model_used: string | null;
  extractor_version: string;
  warnings: string[];
  created_at: string;
}

export interface DocumentLink {
  id: string;
  entity_type: string;
  entity_id: string;
  relationship: string;
  created_by: string;
  created_at: string;
}

export interface DocumentProcessingEvent {
  id: string;
  from_state: string | null;
  to_state: string;
  message: string;
  actor: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentRecord {
  latest_extraction: DocumentExtraction | null;
  latest_review: { id: string; decision: string; reviewed_fields: Record<string, unknown>; reviewer: string; note: string; created_at: string } | null;
  links: DocumentLink[];
}

export interface DocumentListPage { items: DocumentRecord[]; total: number; offset: number; limit: number }
export interface DocumentBatchResult { uploaded: number; rejected: number; documents: DocumentRecord[]; errors: Array<{ filename: string; detail: string; status_code: number }> }

export interface ValidationRun {
  id: string;
  entity_type: string;
  entity_id: string;
  document_id: string | null;
  status: string;
  passed_count: number;
  failed_count: number;
  incomplete_count: number;
  warning_count: number;
  run_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface ValidationFinding {
  id: string;
  run_id: string;
  rule_id: string;
  rule_version: string;
  status: string;
  severity: string;
  title: string;
  expected: Record<string, unknown> | null;
  actual: Record<string, unknown> | null;
  evidence: Array<Record<string, unknown>>;
  suggested_action: string;
  blocks_transition: boolean;
  resolved_by: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}
