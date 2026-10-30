import type { Lot, Supplier } from '../../types/api';
import { apiRequest } from './client';

export const suppliersApi = {
  list: (q = '', signal?: AbortSignal) => apiRequest<Supplier[]>(`/suppliers?q=${encodeURIComponent(q)}&limit=200`, { signal }),
  lots: (supplierId: string, signal?: AbortSignal) => apiRequest<Lot[]>(`/lots?supplier_id=${encodeURIComponent(supplierId)}&lot_type=RAW&limit=200`, { signal }),
  create: (input: { id: string; name: string; country: string }) => apiRequest<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(input) }),
};
