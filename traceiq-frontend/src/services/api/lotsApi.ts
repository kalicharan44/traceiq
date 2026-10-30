import type { Lot } from '../../types/api';
import { apiRequest } from './client';

export interface CreateLotInput {
  id: string;
  lot_type: 'RAW' | 'FG';
  name: string;
  supplier_id?: string | null;
  product_id?: string | null;
  production_order_id?: string | null;
  quantity: number;
  unit: string;
}

export const lotsApi = {
  list: (q = '', lotType?: 'RAW' | 'FG', signal?: AbortSignal) => {
    const params = new URLSearchParams({ q });
    if (lotType) params.set('lot_type', lotType);
    return apiRequest<Lot[]>(`/lots?${params}`, { signal });
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<Lot>(`/lots/${encodeURIComponent(id)}`, { signal }),
  create: (body: CreateLotInput) => apiRequest<Lot>('/lots', { method: 'POST', body: JSON.stringify(body) }),
};
