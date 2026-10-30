import type { RecallImpact, TraceabilityResult } from '../../types/api';
import { apiRequest } from './client';

export const traceabilityApi = {
  getTraceabilityGraph(targetId: string, signal?: AbortSignal): Promise<TraceabilityResult> {
    return apiRequest<TraceabilityResult>(`/traceability?targetId=${encodeURIComponent(targetId)}`, { signal });
  },
  getRecallImpact(targetLotId: string, signal?: AbortSignal): Promise<RecallImpact> {
    return apiRequest<RecallImpact>(`/recalls/impact?target_lot_id=${encodeURIComponent(targetLotId)}`, { signal });
  }
};
