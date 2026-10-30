import type { InventoryRow, ShipmentRow } from '../../types/api';
import { apiRequest } from './client';

export const inventoryApi = {
  list: (q = '', signal?: AbortSignal) => apiRequest<InventoryRow[]>(`/inventory?q=${encodeURIComponent(q)}`, { signal }),
  shipments: (q = '', signal?: AbortSignal) => apiRequest<ShipmentRow[]>(`/shipments?q=${encodeURIComponent(q)}`, { signal }),
  repairShipmentCustomer: (shipmentId: string, customerId: string, updatedBy: string) =>
    apiRequest<{ id: string; customer_id: string; status: string }>(`/shipments/${encodeURIComponent(shipmentId)}/customer`, {
      method: 'PATCH', body: JSON.stringify({ customer_id: customerId, updated_by: updatedBy }),
    }),
  receive: (input: { id: string; lot_id: string; warehouse_id: string; warehouse_name: string; quantity: number; unit: string; bay: string }) =>
    apiRequest<{ id: string; lot_id: string; quantity: number; unit: string; status: string; warehouse_name: string }>('/inventory/receipts', { method: 'POST', body: JSON.stringify(input) }),
  dispatch: (input: { id: string; lot_id: string; customer_id: string; quantity: number; unit: string; destination: string; carrier: string; tracking_number: string }) =>
    apiRequest<ShipmentRow>('/shipments', { method: 'POST', body: JSON.stringify(input) }),
};
