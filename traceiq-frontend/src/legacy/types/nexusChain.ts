export const STATUS = {
  OK: 'OK',
  WARNING: 'WARNING',
  QUARANTINED: 'QUARANTINED',
  RECALLED: 'RECALLED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  HOLD: 'HOLD'
} as const;

export type LotStatus = typeof STATUS[keyof typeof STATUS];

export interface Supplier {
  id: string;
  name: string;
  riskScore: number; // 0 - 100
  country?: string;
  category?: string;
}

export interface Lot {
  id: string;
  type: 'RAW' | 'FG';
  supplierId?: string;
  name?: string;
  qty: number;
  uom: 'kg' | 'units' | 'L';
  status: LotStatus;
  receivedDate?: string;
}

export interface InputLot {
  id: string;
  qty: number;
}

export interface ProductionOrder {
  id: string;
  inputLots: InputLot[];
  outputLot: string;
  productName?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FLAGGED';
  facility?: string;
  completedDate?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

export interface InventoryItem {
  id: string;
  lotId: string;
  warehouseId: string;
  qty: number;
  status: LotStatus;
  bay?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  location?: string;
  tier?: string;
}

export interface Shipment {
  id: string;
  lotId: string;
  customerId: string;
  qty: number;
  status: LotStatus;
  date: string;
  carrier?: string;
  tracking?: string;
  recallStatus?: 'NOTIFIED' | 'RETURNED' | 'HELD' | 'ACKNOWLEDGED';
  notificationTimestamp?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
}

export interface DatabaseState {
  suppliers: Supplier[];
  lots: Lot[];
  productionOrders: ProductionOrder[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  customers: Customer[];
  shipments: Shipment[];
  auditEvents: AuditEvent[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceType: 'supplier' | 'raw' | 'missing' | 'po' | 'fg' | 'inventory' | 'shipment';
  targetType: 'raw' | 'missing' | 'po' | 'fg' | 'inventory' | 'shipment' | 'customer';
  label?: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'BROKEN';
  isAnomaly?: boolean;
}

export interface TraceabilityGraphResult {
  targetId: string;
  suppliers: string[];
  rawLots: string[];
  pos: string[];
  fgLots: string[];
  inventory: string[];
  shipments: string[];
  customers: string[];
  missingLots: string[];
  edges?: GraphEdge[];
}

export interface LotQuantityValidation {
  lotId: string;
  producedQty: number;
  uom: string;
  inventoryQty: number;
  shippedQty: number;
  totalRecorded: number;
  difference: number;
  overAllocated: boolean;
  status: 'OVER_ALLOCATED' | 'UNDER_RECONCILED' | 'RECONCILED';
}

export interface MissingInputResult {
  productionOrderId: string;
  missingLotId: string;
  requiredQty: number;
  outputLot: string;
}
