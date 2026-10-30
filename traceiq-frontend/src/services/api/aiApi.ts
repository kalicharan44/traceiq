import { apiRequest } from './client';

export interface AiInvestigationAnswer {
  summary: string;
  evidence: string[];
  uncertainties: string[];
  suggested_next_steps: string[];
  generated_by_ai: boolean;
}

export const aiApi = {
  investigate: (targetLotId: string, question: string) => apiRequest<AiInvestigationAnswer>('/ai/investigations', { method: 'POST', body: JSON.stringify({ target_lot_id: targetLotId, question }) }),
};
