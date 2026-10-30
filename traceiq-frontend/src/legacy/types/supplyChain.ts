export type EntityStatus = 
  | 'Active' 
  | 'Under Audit' 
  | 'Suspended' 
  | 'Quarantined' 
  | 'Exhausted' 
  | 'Missing' 
  | 'Completed' 
  | 'In Production' 
  | 'Flagged' 
  | 'Released' 
  | 'Recalled' 
  | 'In Transit' 
  | 'Delivered' 
  | 'Quarantine Hold' 
  | 'Recall Staged';

export interface Supplier {
  id: string;
  name: string;
  location: string;
  country: string;
  status: 'Active' | 'Under Audit' | 'Suspended';
  isoCert: string;
  contactEmail: string;
  riskScore: number; // 0 - 100
  tier: 'Tier 1' | 'Tier 2';
}

export interface RawMaterialInput {
  rawMaterialLotId: string;
  quantity: number;
  unit: string;
  isMissing?: boolean;
}

export interface RawMaterialLot {
  id: string;
  name: string;
  supplierId: string;
  supplierName: string;
  materialType: string;
  receivedDate: string;
  initialQuantity: number;
  availableQuantity: number;
  unit: string;
  status: 'Active' | 'Quarantined' | 'Exhausted' | 'Missing';
  purityPct: number;
  storageConditions: string;
  expiryDate: string;
  warehouseId: string;
  isAnomalous?: boolean;
}

export interface ProductionOrder {
  id: string;
  facility: string;
  facilityLocation: string;
  finishedGoodsLotId: string;
  productName: string;
  outputQuantity: number;
  unit: string;
  scheduledDate: string;
  completedDate: string;
  status: 'Completed' | 'In Production' | 'Flagged';
  inputs: RawMaterialInput[];
}

export interface FinishedGoodsLot {
  id: string;
  productName: string;
  sku: string;
  productionOrderId: string;
  totalQuantity: number;
  unitPriceUsd: number;
  expiryDate: string;
  releaseDate: string;
  status: 'Released' | 'Quarantined' | 'Recalled';
  dosageForm: string;
}

export interface WarehouseInventory {
  id: string;
  warehouseId: string;
  warehouseName: string;
  locationCode: string;
  itemType: 'RAW' | 'FINISHED';
  lotId: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: 'Available' | 'Quarantined' | 'Reserved';
  bayLocation: string;
}

export interface Shipment {
  id: string;
  finishedGoodsLotId: string;
  productName: string;
  quantity: number;
  customerId: string;
  customerName: string;
  destinationCity: string;
  destinationState: string;
  status: 'In Transit' | 'Delivered' | 'Quarantine Hold' | 'Recall Staged';
  dispatchedDate: string;
  estimatedDelivery: string;
  trackingNumber: string;
  carrier: string;
  priority: 'Standard' | 'Expedited' | 'Cold-Chain Overnight';
}

export interface Customer {
  id: string;
  name: string;
  accountType: string;
  contactPerson: string;
  urgentRecallPhone: string;
  email: string;
  address: string;
  regulatoryContactLevel: 'Tier 1 Critical Healthcare' | 'Tier 2 Retail Pharmacy' | 'Tier 3 Commercial';
}

export type AnomalySeverity = 'Critical' | 'Warning' | 'Info';
export type AnomalyType = 'MISSING_LINK' | 'QUANTITY_MISMATCH' | 'STATUS_CONFLICT';
export type AnomalyStatus = 'Unresolved' | 'Investigating' | 'Resolved';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  title: string;
  severity: AnomalySeverity;
  affectedEntityId: string;
  affectedEntityType: 'RAW_LOT' | 'PRODUCTION_ORDER' | 'WAREHOUSE_INVENTORY' | 'SHIPMENT';
  expectedBehavior: string;
  observedBehavior: string;
  rootCause: string;
  riskSummary: string;
  status: AnomalyStatus;
  detectedAt: string;
}

export type AuditActionType = 
  | 'INTAKE' 
  | 'QC_CHECK' 
  | 'PO_EXECUTION' 
  | 'SHIPMENT_DISPATCH' 
  | 'ANOMALY_FLAGGED' 
  | 'QUARANTINE_APPLIED' 
  | 'RECALL_AUTHORIZED' 
  | 'DATA_RESET'
  | 'ANOMALY_STATUS_CHANGED';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actionType: AuditActionType;
  user: string;
  targetId: string;
  targetType: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface RecallRecord {
  id: string;
  initiatedAt: string;
  authorizedBy: string;
  targetLotId: string;
  targetType: 'RAW' | 'FINISHED' | 'PO';
  reason: string;
  impactedLots: string[];
  impactedUnitsTotal: number;
  onHandUnits: number;
  inTransitUnits: number;
  deliveredUnits: number;
  financialExposureUsd: number;
  affectedCustomerIds: string[];
  quarantinedInventoryIds: string[];
  heldShipmentIds: string[];
  status: 'ACTIVE_RECALL' | 'COMPLETED';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  suggestedAction?: {
    label: string;
    actionType: 'navigate' | 'trace';
    payload: string;
  };
  highlightEntities?: string[];
  severity?: AnomalySeverity;
}
