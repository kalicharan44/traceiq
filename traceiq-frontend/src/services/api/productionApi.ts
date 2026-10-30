import { apiRequest } from './client';

export interface ProductionOrderInput {
  lot_id: string;
  quantity: number;
  unit: string;
}

export interface ProductionOrderOutput {
  lot_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface CreateProductionOrder {
  id: string;
  product_id: string;
  facility: string;
  input_lots: ProductionOrderInput[];
  output_lots: ProductionOrderOutput[];
}

export const productionApi = {
  list: (signal?: AbortSignal) => apiRequest<Array<Record<string, unknown>>>('/production-orders', { signal }),
  create: (input: CreateProductionOrder) => apiRequest<{ id: string; status: string; output_lots: string[] }>('/production-orders', { method: 'POST', body: JSON.stringify(input) }),
};
