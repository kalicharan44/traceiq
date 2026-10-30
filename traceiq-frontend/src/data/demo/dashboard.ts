import type { DashboardExecutiveSummary, DashboardPeriod } from '../../types/api';

const periodConfig: Record<DashboardPeriod, { points: number; stepHours: number }> = {
  today: { points: 24, stepHours: 1 },
  '7d': { points: 7, stepHours: 24 },
  '30d': { points: 30, stepHours: 24 },
  '90d': { points: 13, stepHours: 24 * 7 },
};

function makeSeries(period: DashboardPeriod, now: Date) {
  const { points, stepHours } = periodConfig[period];
  const currentHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const first = new Date(currentHour.getTime() - (points - 1) * stepHours * 60 * 60 * 1000);
  const scale = period === 'today' ? 0.2 : period === '7d' ? 0.65 : period === '90d' ? 1.5 : 1;

  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin(index * 0.68) + Math.cos(index * 0.29);
    const bucket = new Date(first.getTime() + index * stepHours * 60 * 60 * 1000);
    return {
      bucket_start: bucket.toISOString(),
      documents_processed: Math.max(0, Math.round((15 + wave * 5) * scale)),
      checks_passed: Math.max(0, Math.round((24 + Math.cos(index * 0.51) * 8 + Math.sin(index * 0.2) * 4) * scale)),
      quality_exceptions: index % 7 === 3 ? (period === 'today' ? 1 : 2) : index % 5 === 1 ? 1 : 0,
      recalls_opened: index === Math.floor(points * 0.72) ? 1 : 0,
    };
  });
}

function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

export function createDemoDashboard(period: DashboardPeriod): DashboardExecutiveSummary {
  const now = new Date();
  const days = period === 'today' ? 0 : period === '7d' ? 6 : period === '90d' ? 89 : 29;
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

  return {
    period,
    period_start: periodStart.toISOString(),
    generated_at: now.toISOString(),
    kpis: {
      suppliers: { total: 500, active: 472 },
      material_lots: { total: 10000, pending_inspection: 38, on_hold: 24 },
      production_orders: { active: 47, completed: 1284, exceptions: 6 },
      inventory: {
        available_by_unit: [
          { unit: 'cases', quantity: 48250, positions: 1240 },
          { unit: 'kg', quantity: 18320, positions: 86 },
        ],
        blocked_by_unit: [
          { unit: 'cases', quantity: 340, positions: 12 },
          { unit: 'kg', quantity: 125, positions: 4 },
        ],
        available_positions: 1326,
        blocked_positions: 16,
        at_risk_lots: 62,
      },
      documents: { processed: 8492, pending_review: 23, failed: 4 },
      quality: { checks_passed: 18640, critical_failures: 3, open_findings: 18 },
    },
    series: makeSeries(period, now),
    activities: [
      { id: 'demo-activity-1', action: 'DOCUMENT_VERIFIED', title: 'Document Verified', description: 'COA for raw material lot RM-2841 passed all required checks.', entity_type: 'DOCUMENT', entity_id: 'DOC-DEMO-2841', status: 'COMPLETED', route: '/documents', created_at: hoursAgo(now, 0.3) },
      { id: 'demo-activity-2', action: 'QUALITY_CHECK_FAILED', title: 'Quality Check Failed', description: 'Finished lot FG-7712 requires quality review before release.', entity_type: 'QUALITY_CHECK', entity_id: 'QC-DEMO-7712', status: 'ATTENTION', route: '/validation', created_at: hoursAgo(now, 1.2) },
      { id: 'demo-activity-3', action: 'GOODS_RECEIVED', title: 'Goods Received', description: '1,200 cases were received at the North warehouse.', entity_type: 'INVENTORY', entity_id: 'INV-DEMO-1200', status: 'RECORDED', route: '/inventory', created_at: hoursAgo(now, 2.5) },
      { id: 'demo-activity-4', action: 'PRODUCTION_ORDER_COMPLETED', title: 'Production Order Completed', description: 'Order PO-6428 consumed 3 verified material lots.', entity_type: 'PRODUCTION_ORDER', entity_id: 'PO-DEMO-6428', status: 'COMPLETED', route: '/traceability?lot=FG-DEMO-6428', created_at: hoursAgo(now, 4) },
      { id: 'demo-activity-5', action: 'SUPPLIER_REVIEW_RECORDED', title: 'Supplier Review Recorded', description: 'Annual review completed for Meridian Ingredients.', entity_type: 'SUPPLIER', entity_id: 'SUP-DEMO-018', status: 'RECORDED', route: '/suppliers', created_at: hoursAgo(now, 7) },
    ],
    risks: [
      { id: 'demo-risk-1', title: 'Critical validation failures', severity: 'CRITICAL', count: 3, detail: 'Unresolved critical checks need disposition.', route: '/validation' },
      { id: 'demo-risk-2', title: 'Lots awaiting quality disposition', severity: 'HIGH', count: 38, detail: 'Pending release or inspection decision.', route: '/quality' },
      { id: 'demo-risk-3', title: 'Blocked or quarantined inventory', severity: 'HIGH', count: 16, detail: 'Inventory positions in a containment or hold state.', route: '/inventory' },
      { id: 'demo-risk-4', title: 'Finished lots with incomplete genealogy', severity: 'HIGH', count: 7, detail: 'Missing production-order link in the lot ledger.', route: '/traceability' },
      { id: 'demo-risk-5', title: 'Documents requiring review', severity: 'MEDIUM', count: 23, detail: 'Human verification is required before checks can run.', route: '/documents?status=REVIEW_REQUIRED' },
      { id: 'demo-risk-6', title: 'Active recalls requiring attention', severity: 'HIGH', count: 1, detail: 'Open workflow actions or closure blockers remain.', route: '/recalls' },
    ],
    document_processing: { queued: 8, processing: 12, review_required: 23, failed: 4, verified: 8445, total: 8492 },
    recall_readiness: { active_recalls: 1, awaiting_customer_acknowledgement: 4, outstanding_recovery_quantity: 860, unresolved_closure_blockers: 2 },
    recent_findings: [
      { id: 'demo-finding-1', rule_id: 'QUALITY-017', title: 'Temperature excursion needs review', severity: 'CRITICAL', entity_type: 'LOT', entity_id: 'FG-7712', status: 'FAIL', created_at: hoursAgo(now, 1.1) },
      { id: 'demo-finding-2', rule_id: 'DOC-004', title: 'Supplier certificate expires soon', severity: 'HIGH', entity_type: 'DOCUMENT', entity_id: 'DOC-DEMO-2406', status: 'WARNING', created_at: hoursAgo(now, 3.4) },
      { id: 'demo-finding-3', rule_id: 'TRACE-009', title: 'Production order link is missing', severity: 'MEDIUM', entity_type: 'LOT', entity_id: 'FG-7704', status: 'INCOMPLETE', created_at: hoursAgo(now, 6) },
    ],
  };
}
