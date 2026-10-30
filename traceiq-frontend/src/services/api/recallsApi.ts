import type { RecallAction, RecallImpact, RecallRecord, Reconciliation } from '../../types/api';
import { apiRequest } from './client';

export interface RecallApprovalInput {
  target_lot_id: string;
  reason: string;
  authorized_by: string;
  approval_note: string;
}

export const recallsApi = {
  impact: (targetLotId: string, signal?: AbortSignal) => apiRequest<RecallImpact>(`/recalls/impact?target_lot_id=${encodeURIComponent(targetLotId)}`, { signal }),
  list: (signal?: AbortSignal) => apiRequest<RecallRecord[]>('/recalls', { signal }),
  get: (id: string, signal?: AbortSignal) => apiRequest<RecallRecord>(`/recalls/${encodeURIComponent(id)}`, { signal }),
  approveAndActivate: (input: RecallApprovalInput) => apiRequest<RecallRecord>('/recalls', { method: 'POST', body: JSON.stringify(input) }),
  completeAction: (recallId: string, actionId: string, completedBy: string) =>
    apiRequest<RecallAction>(`/recalls/${encodeURIComponent(recallId)}/actions/${encodeURIComponent(actionId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED', completed_by: completedBy }) }),
  addAction: (recallId: string, input: { action_type: 'CUSTOMER_NOTIFICATION' | 'RETURN' | 'DESTROY' | 'OTHER'; entity_id?: string; description: string; quantity: number }) =>
    apiRequest<RecallAction>(`/recalls/${encodeURIComponent(recallId)}/actions`, { method: 'POST', body: JSON.stringify(input) }),
  reconcile: (recallId: string, input: Omit<Reconciliation, 'accounted_units' | 'expected_units' | 'matches_scope' | 'recorded_at'>) =>
    apiRequest<Reconciliation>(`/recalls/${encodeURIComponent(recallId)}/reconcile`, { method: 'POST', body: JSON.stringify(input) }),
  closureCheck: (recallId: string, signal?: AbortSignal) => apiRequest<{ recall_id: string; can_close: boolean; blockers: string[] }>(`/recalls/${encodeURIComponent(recallId)}/closure-check`, { signal }),
  close: (recallId: string, actor: string) => apiRequest<RecallRecord>(`/recalls/${encodeURIComponent(recallId)}/close?actor=${encodeURIComponent(actor)}`, { method: 'POST' }),
  report: (recallId: string, signal?: AbortSignal) => apiRequest<Record<string, unknown>>(`/reports/recalls/${encodeURIComponent(recallId)}`, { signal }),
};
