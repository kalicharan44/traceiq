import type { CorrectiveAction, QualityCheck } from '../../types/api';
import { apiRequest } from './client';

export const qualityApi = {
  listChecks: (signal?: AbortSignal) => apiRequest<QualityCheck[]>('/quality/checks', { signal }),
  runCheck: (entityType: 'LOT' | 'SUPPLIER', entityId: string, checkedBy: string, evidenceReference?: string) =>
    apiRequest<QualityCheck>('/quality/checks', { method: 'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, checked_by: checkedBy, evidence_reference: evidenceReference || null }) }),
  correctiveActions: (signal?: AbortSignal) => apiRequest<CorrectiveAction[]>('/quality/corrective-actions', { signal }),
  closeCorrectiveAction: (id: string, updatedBy: string, resolution: string) =>
    apiRequest<CorrectiveAction>(`/quality/corrective-actions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', updated_by: updatedBy, resolution }) }),
};
