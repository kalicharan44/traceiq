import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Supplier,
  RawMaterialLot,
  ProductionOrder,
  FinishedGoodsLot,
  WarehouseInventory,
  Shipment,
  Customer,
  Anomaly,
  AuditEvent,
  RecallRecord,
  ChatMessage,
  AnomalyStatus,
  AnomalySeverity
} from '../types/supplyChain';
import {
  SEED_SUPPLIERS,
  SEED_RAW_LOTS,
  SEED_PRODUCTION_ORDERS,
  SEED_FINISHED_LOTS,
  SEED_INVENTORY,
  SEED_CUSTOMERS,
  SEED_SHIPMENTS,
  SEED_ANOMALIES,
  SEED_AUDIT_EVENTS
} from '../data/seedData';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export interface TraceabilityNode {
  id: string;
  type: 'SUPPLIER' | 'RAW_MATERIAL' | 'PRODUCTION_ORDER' | 'FINISHED_GOODS' | 'WAREHOUSE' | 'SHIPMENT' | 'CUSTOMER';
  label: string;
  sublabel: string;
  status: string;
  isMissing?: boolean;
  isAnomalous?: boolean;
  quantity?: number;
  unit?: string;
  details?: Record<string, any>;
}

export interface TraceabilityGraph {
  targetId: string;
  targetType: string;
  suppliers: TraceabilityNode[];
  rawMaterials: TraceabilityNode[];
  productionOrders: TraceabilityNode[];
  finishedGoods: TraceabilityNode[];
  warehouses: TraceabilityNode[];
  shipments: TraceabilityNode[];
  customers: TraceabilityNode[];
  hasMissingLinks: boolean;
  missingEntities: string[];
  anomaliesDetected: Anomaly[];
  totalUnitsProduced: number;
  onHandUnits: number;
  inTransitUnits: number;
  deliveredUnits: number;
  totalFinancialExposure: number;
}

export interface ImpactAnalysisResult {
  targetLotId: string;
  targetName: string;
  targetType: 'RAW' | 'FINISHED' | 'PO';
  isValid: boolean;
  errorMessage?: string;
  impactedRawLots: RawMaterialLot[];
  impactedPOs: ProductionOrder[];
  impactedFinishedLots: FinishedGoodsLot[];
  inventoryRecords: WarehouseInventory[];
  shipmentRecords: Shipment[];
  affectedCustomers: Customer[];
  onHandUnits: number;
  inTransitUnits: number;
  deliveredUnits: number;
  totalAffectedUnits: number;
  financialExposureUsd: number;
  exposureAssumptions: string[];
  anomalies: Anomaly[];
  alreadyRecalled: boolean;
}

interface SupplyChainContextType {
  suppliers: Supplier[];
  rawLots: RawMaterialLot[];
  productionOrders: ProductionOrder[];
  finishedLots: FinishedGoodsLot[];
  inventory: WarehouseInventory[];
  shipments: Shipment[];
  customers: Customer[];
  anomalies: Anomaly[];
  auditEvents: AuditEvent[];
  recallRecords: RecallRecord[];
  chatMessages: ChatMessage[];
  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  resetToDemoData: () => void;
  executeRecall: (targetLotId: string, authorizedBy: string, reason: string) => RecallRecord | null;
  updateAnomalyStatus: (anomalyId: string, newStatus: AnomalyStatus) => void;
  addAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  getTraceabilityPath: (identifier: string) => TraceabilityGraph | null;
  analyzeRecallImpact: (targetLotId: string) => ImpactAnalysisResult;
  sendChatMessage: (query: string) => Promise<void>;
  clearChat: () => void;
  activeRecallTarget: string | null;
  setActiveRecallTarget: (target: string | null) => void;
}

const STORAGE_KEY_PREFIX = 'traceiq_supply_chain_v1_';

const SupplyChainContext = createContext<SupplyChainContextType | null>(null);

export const SupplyChainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Local storage loader helper
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  const [suppliers] = useState<Supplier[]>(() => loadState('suppliers', SEED_SUPPLIERS));
  const [rawLots, setRawLots] = useState<RawMaterialLot[]>(() => loadState('rawLots', SEED_RAW_LOTS));
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(() => loadState('productionOrders', SEED_PRODUCTION_ORDERS));
  const [finishedLots, setFinishedLots] = useState<FinishedGoodsLot[]>(() => loadState('finishedLots', SEED_FINISHED_LOTS));
  const [inventory, setInventory] = useState<WarehouseInventory[]>(() => loadState('inventory', SEED_INVENTORY));
  const [shipments, setShipments] = useState<Shipment[]>(() => loadState('shipments', SEED_SHIPMENTS));
  const [customers] = useState<Customer[]>(() => loadState('customers', SEED_CUSTOMERS));
  const [anomalies, setAnomalies] = useState<Anomaly[]>(() => loadState('anomalies', SEED_ANOMALIES));
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => loadState('auditEvents', SEED_AUDIT_EVENTS));
  const [recallRecords, setRecallRecords] = useState<RecallRecord[]>(() => loadState('recallRecords', []));
  const [activeRecallTarget, setActiveRecallTarget] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return loadState('chatMessages', [
      {
        id: 'msg-init-1',
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `**TraceIQ AI Investigation Workspace Ready.**

I am your deterministic supply chain compliance intelligence copilot. I analyze the end-to-end graph across raw materials, bill-of-materials batch executions, multi-echelon warehouse stocks, and commercial distribution channels.

**You can ask me to:**
- Trace lot genealogy (e.g., *"Trace RAW-1042"* or *"Investigate FG-4401"*)
- Audit supply chain anomalies (e.g., *"Identify all traceability gaps"*)
- Clarify mass-balance discrepancies (e.g., *"Explain the quantity mismatch on RAW-9912"*)
- Assess downstream exposure (e.g., *"Evaluate exposure for customer CUST-906"*)
- Formulate a Class I/II recall plan (e.g., *"Draft a recall incident report"*)`,
        suggestedAction: {
          label: 'Trace RAW-1042',
          actionType: 'trace',
          payload: 'RAW-1042'
        }
      }
    ]);
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'rawLots', JSON.stringify(rawLots));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'productionOrders', JSON.stringify(productionOrders));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'finishedLots', JSON.stringify(finishedLots));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'inventory', JSON.stringify(inventory));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'shipments', JSON.stringify(shipments));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'anomalies', JSON.stringify(anomalies));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'auditEvents', JSON.stringify(auditEvents));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'recallRecords', JSON.stringify(recallRecords));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'chatMessages', JSON.stringify(chatMessages));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [rawLots, productionOrders, finishedLots, inventory, shipments, anomalies, auditEvents, recallRecords, chatMessages]);

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'info') => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: 'AUD-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toISOString()
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  };

  const resetToDemoData = () => {
    setRawLots(SEED_RAW_LOTS);
    setProductionOrders(SEED_PRODUCTION_ORDERS);
    setFinishedLots(SEED_FINISHED_LOTS);
    setInventory(SEED_INVENTORY);
    setShipments(SEED_SHIPMENTS);
    setAnomalies(SEED_ANOMALIES);
    setRecallRecords([]);
    setActiveRecallTarget(null);

    const resetEvent: AuditEvent = {
      id: 'AUD-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toISOString(),
      actionType: 'DATA_RESET',
      user: 'SYSTEM_ADMIN',
      targetId: 'ALL_DATA',
      targetType: 'SYSTEM',
      description: 'Reset all supply chain state, lots, anomalies, and active recalls back to baseline state.'
    };
    setAuditEvents([resetEvent, ...SEED_AUDIT_EVENTS]);
    addToast('System Reset Complete', 'Baseline supply chain data successfully restored.', 'success');
  };

  const updateAnomalyStatus = (anomalyId: string, newStatus: AnomalyStatus) => {
    setAnomalies((prev) =>
      prev.map((a) => {
        if (a.id === anomalyId) {
          return { ...a, status: newStatus };
        }
        return a;
      })
    );
    addAuditEvent({
      actionType: 'ANOMALY_STATUS_CHANGED',
      user: 'qa.lead@traceiq.corp',
      targetId: anomalyId,
      targetType: 'Anomaly',
      description: `Updated anomaly ${anomalyId} status to "${newStatus}".`
    });
    addToast('Status Updated', `Anomaly ${anomalyId} marked as ${newStatus}.`, 'info');
  };

  // Traceability graph generator
  const getTraceabilityPath = (identifier: string): TraceabilityGraph | null => {
    if (!identifier || !identifier.trim()) return null;
    const cleanId = identifier.trim().toUpperCase();

    // Determine target category
    const isRaw = rawLots.some((r) => r.id.toUpperCase() === cleanId) || cleanId.startsWith('RAW-');
    const isPO = productionOrders.some((p) => p.id.toUpperCase() === cleanId) || cleanId.startsWith('PO-');
    const isFG = finishedLots.some((f) => f.id.toUpperCase() === cleanId) || cleanId.startsWith('FG-');

    let resolvedRawLots: RawMaterialLot[] = [];
    let resolvedPOs: ProductionOrder[] = [];
    let resolvedFGLots: FinishedGoodsLot[] = [];
    let missingEntities: string[] = [];

    if (isRaw) {
      const matchRaw = rawLots.find((r) => r.id.toUpperCase() === cleanId);
      if (matchRaw) {
        resolvedRawLots = [matchRaw];
      } else {
        // Unregistered ghost raw lot (like RAW-4040)
        missingEntities.push(cleanId);
      }

      // Find POs that consume this raw lot
      const connectedPOs = productionOrders.filter((po) =>
        po.inputs.some((inp) => inp.rawMaterialLotId.toUpperCase() === cleanId)
      );
      resolvedPOs = connectedPOs;

      // Find FG lots from those POs
      const fgIds = connectedPOs.map((p) => p.finishedGoodsLotId);
      resolvedFGLots = finishedLots.filter((fg) => fgIds.includes(fg.id));
    } else if (isPO) {
      const matchPO = productionOrders.find((p) => p.id.toUpperCase() === cleanId);
      if (matchPO) {
        resolvedPOs = [matchPO];
        // Inputs
        matchPO.inputs.forEach((inp) => {
          const raw = rawLots.find((r) => r.id.toUpperCase() === inp.rawMaterialLotId.toUpperCase());
          if (raw) {
            resolvedRawLots.push(raw);
          } else {
            missingEntities.push(inp.rawMaterialLotId);
          }
        });
        // FG
        const matchFG = finishedLots.find((f) => f.id === matchPO.finishedGoodsLotId);
        if (matchFG) resolvedFGLots.push(matchFG);
      }
    } else if (isFG) {
      const matchFG = finishedLots.find((f) => f.id.toUpperCase() === cleanId);
      if (matchFG) {
        resolvedFGLots = [matchFG];
        // Connected PO
        const matchPO = productionOrders.find((p) => p.finishedGoodsLotId === matchFG.id || p.id === matchFG.productionOrderId);
        if (matchPO) {
          resolvedPOs = [matchPO];
          matchPO.inputs.forEach((inp) => {
            const raw = rawLots.find((r) => r.id.toUpperCase() === inp.rawMaterialLotId.toUpperCase());
            if (raw) {
              resolvedRawLots.push(raw);
            } else {
              missingEntities.push(inp.rawMaterialLotId);
            }
          });
        }
      }
    } else {
      // Fallback: check if matches any supplier, shipment, or customer
      return null;
    }

    if (resolvedRawLots.length === 0 && resolvedPOs.length === 0 && resolvedFGLots.length === 0 && missingEntities.length === 0) {
      return null;
    }

    // Map suppliers
    const supplierIds = Array.from(new Set(resolvedRawLots.map((r) => r.supplierId)));
    const connectedSuppliers = suppliers.filter((s) => supplierIds.includes(s.id));

    // Map warehouse inventories for FG lots
    const fgIds = resolvedFGLots.map((f) => f.id);
    const connectedInventories = inventory.filter((inv) => fgIds.includes(inv.lotId));

    // Map shipments for FG lots
    const connectedShipments = shipments.filter((shp) => fgIds.includes(shp.finishedGoodsLotId));

    // Map customers
    const customerIds = Array.from(new Set(connectedShipments.map((s) => s.customerId)));
    const connectedCustomers = customers.filter((c) => customerIds.includes(c.id));

    // Check connected anomalies
    const allEntityIds = [
      ...resolvedRawLots.map((r) => r.id),
      ...resolvedPOs.map((p) => p.id),
      ...resolvedFGLots.map((f) => f.id),
      ...connectedShipments.map((s) => s.id),
      ...missingEntities
    ];
    const anomaliesDetected = anomalies.filter((a) => allEntityIds.includes(a.affectedEntityId));

    // Metrics computation
    const totalUnitsProduced = resolvedFGLots.reduce((sum, f) => sum + f.totalQuantity, 0);
    const onHandUnits = connectedInventories.reduce((sum, inv) => sum + inv.quantity, 0);
    const inTransitUnits = connectedShipments
      .filter((s) => s.status === 'In Transit' || s.status === 'Quarantine Hold')
      .reduce((sum, s) => sum + s.quantity, 0);
    const deliveredUnits = connectedShipments
      .filter((s) => s.status === 'Delivered' || s.status === 'Recall Staged')
      .reduce((sum, s) => sum + s.quantity, 0);

    const avgPrice = resolvedFGLots.length > 0 ? resolvedFGLots[0].unitPriceUsd : 50;
    const totalFinancialExposure = Math.round((onHandUnits + inTransitUnits + deliveredUnits) * avgPrice * 1.12);

    return {
      targetId: cleanId,
      targetType: isRaw ? 'RAW_MATERIAL' : isPO ? 'PRODUCTION_ORDER' : 'FINISHED_GOODS',
      suppliers: connectedSuppliers.map((s) => ({
        id: s.id,
        type: 'SUPPLIER',
        label: s.name,
        sublabel: `${s.location}, ${s.country}`,
        status: s.status,
        details: s
      })),
      rawMaterials: [
        ...resolvedRawLots.map((r) => ({
          id: r.id,
          type: 'RAW_MATERIAL' as const,
          label: r.name,
          sublabel: `Received: ${r.receivedDate} | Stock: ${r.availableQuantity} ${r.unit}`,
          status: r.status,
          quantity: r.initialQuantity,
          unit: r.unit,
          isAnomalous: r.isAnomalous,
          details: r
        })),
        ...missingEntities.map((missingId) => ({
          id: missingId,
          type: 'RAW_MATERIAL' as const,
          label: `Unregistered Lot [${missingId}]`,
          sublabel: 'CRITICAL: No ERP intake / missing supplier link',
          status: 'Missing',
          isMissing: true,
          details: { missing: true }
        }))
      ],
      productionOrders: resolvedPOs.map((p) => ({
        id: p.id,
        type: 'PRODUCTION_ORDER',
        label: p.productName,
        sublabel: `${p.facility} · Output: ${p.outputQuantity.toLocaleString()} ${p.unit}`,
        status: p.status,
        quantity: p.outputQuantity,
        unit: p.unit,
        details: p
      })),
      finishedGoods: resolvedFGLots.map((f) => ({
        id: f.id,
        type: 'FINISHED_GOODS',
        label: f.productName,
        sublabel: `Exp: ${f.expiryDate} · $${f.unitPriceUsd.toFixed(2)}/unit`,
        status: f.status,
        quantity: f.totalQuantity,
        unit: 'units',
        details: f
      })),
      warehouses: connectedInventories.map((inv) => ({
        id: inv.id,
        type: 'WAREHOUSE',
        label: inv.warehouseName,
        sublabel: `${inv.bayLocation} · In Stock: ${inv.quantity.toLocaleString()} ${inv.unit}`,
        status: inv.status,
        quantity: inv.quantity,
        unit: inv.unit,
        details: inv
      })),
      shipments: connectedShipments.map((s) => ({
        id: s.id,
        type: 'SHIPMENT',
        label: `${s.carrier} (${s.trackingNumber})`,
        sublabel: `To: ${s.customerName} · Qty: ${s.quantity.toLocaleString()} units`,
        status: s.status,
        quantity: s.quantity,
        unit: 'units',
        details: s
      })),
      customers: connectedCustomers.map((c) => ({
        id: c.id,
        type: 'CUSTOMER',
        label: c.name,
        sublabel: `${c.contactPerson} · ${c.regulatoryContactLevel}`,
        status: 'Active Commercial Account',
        details: c
      })),
      hasMissingLinks: missingEntities.length > 0,
      missingEntities,
      anomaliesDetected,
      totalUnitsProduced,
      onHandUnits,
      inTransitUnits,
      deliveredUnits,
      totalFinancialExposure
    };
  };

  // Recall Impact Analyzer
  const analyzeRecallImpact = (targetLotId: string): ImpactAnalysisResult => {
    if (!targetLotId || !targetLotId.trim()) {
      return {
        targetLotId: '',
        targetName: '',
        targetType: 'RAW',
        isValid: false,
        errorMessage: 'Please enter a valid Lot identifier (e.g., RAW-1042, RAW-9912, FG-2002, FG-4401).',
        impactedRawLots: [],
        impactedPOs: [],
        impactedFinishedLots: [],
        inventoryRecords: [],
        shipmentRecords: [],
        affectedCustomers: [],
        onHandUnits: 0,
        inTransitUnits: 0,
        deliveredUnits: 0,
        totalAffectedUnits: 0,
        financialExposureUsd: 0,
        exposureAssumptions: [],
        anomalies: [],
        alreadyRecalled: false
      };
    }

    const cleanId = targetLotId.trim().toUpperCase();

    // Check if target exists
    const rawMatch = rawLots.find((r) => r.id.toUpperCase() === cleanId);
    const poMatch = productionOrders.find((p) => p.id.toUpperCase() === cleanId);
    const fgMatch = finishedLots.find((f) => f.id.toUpperCase() === cleanId);

    if (!rawMatch && !poMatch && !fgMatch) {
      return {
        targetLotId: cleanId,
        targetName: 'Unknown Identifier',
        targetType: 'RAW',
        isValid: false,
        errorMessage: `Identifier "${cleanId}" not recognized in active ERP registry. Valid example IDs: RAW-1042, RAW-9912, FG-1001, FG-2002, FG-4401, PO-8815.`,
        impactedRawLots: [],
        impactedPOs: [],
        impactedFinishedLots: [],
        inventoryRecords: [],
        shipmentRecords: [],
        affectedCustomers: [],
        onHandUnits: 0,
        inTransitUnits: 0,
        deliveredUnits: 0,
        totalAffectedUnits: 0,
        financialExposureUsd: 0,
        exposureAssumptions: [],
        anomalies: [],
        alreadyRecalled: false
      };
    }

    let targetType: 'RAW' | 'FINISHED' | 'PO' = 'RAW';
    let targetName = '';
    let impactedRaw: RawMaterialLot[] = [];
    let impactedPOs: ProductionOrder[] = [];
    let impactedFGs: FinishedGoodsLot[] = [];

    if (rawMatch) {
      targetType = 'RAW';
      targetName = rawMatch.name;
      impactedRaw = [rawMatch];
      impactedPOs = productionOrders.filter((po) =>
        po.inputs.some((inp) => inp.rawMaterialLotId.toUpperCase() === cleanId)
      );
      const fgIds = impactedPOs.map((p) => p.finishedGoodsLotId);
      impactedFGs = finishedLots.filter((fg) => fgIds.includes(fg.id));
    } else if (poMatch) {
      targetType = 'PO';
      targetName = poMatch.productName;
      impactedPOs = [poMatch];
      impactedFGs = finishedLots.filter((fg) => fg.id === poMatch.finishedGoodsLotId);
      poMatch.inputs.forEach((inp) => {
        const r = rawLots.find((raw) => raw.id === inp.rawMaterialLotId);
        if (r) impactedRaw.push(r);
      });
    } else if (fgMatch) {
      targetType = 'FINISHED';
      targetName = fgMatch.productName;
      impactedFGs = [fgMatch];
      const matchedPO = productionOrders.find((po) => po.finishedGoodsLotId === fgMatch.id);
      if (matchedPO) {
        impactedPOs = [matchedPO];
        matchedPO.inputs.forEach((inp) => {
          const r = rawLots.find((raw) => raw.id === inp.rawMaterialLotId);
          if (r) impactedRaw.push(r);
        });
      }
    }

    const fgIds = impactedFGs.map((f) => f.id);
    const affectedInventory = inventory.filter((inv) => fgIds.includes(inv.lotId));
    const affectedShipments = shipments.filter((shp) => fgIds.includes(shp.finishedGoodsLotId));
    const customerIds = Array.from(new Set(affectedShipments.map((s) => s.customerId)));
    const affectedCusts = customers.filter((c) => customerIds.includes(c.id));

    // Unit calculations
    const onHandUnits = affectedInventory.reduce((acc, inv) => acc + inv.quantity, 0);
    const inTransitUnits = affectedShipments
      .filter((s) => s.status === 'In Transit' || s.status === 'Quarantine Hold')
      .reduce((acc, s) => acc + s.quantity, 0);
    const deliveredUnits = affectedShipments
      .filter((s) => s.status === 'Delivered' || s.status === 'Recall Staged')
      .reduce((acc, s) => acc + s.quantity, 0);
    const totalAffectedUnits = onHandUnits + inTransitUnits + deliveredUnits;

    // Financial Exposure Calculation
    // Base product wholesale value + reverse logistics cost ($4.50/unit) + regulatory filing buffer ($25,000 flat)
    const baseValue = impactedFGs.reduce((sum, fg) => {
      const unitsForThisFG =
        affectedInventory.filter((inv) => inv.lotId === fg.id).reduce((a, b) => a + b.quantity, 0) +
        affectedShipments.filter((shp) => shp.finishedGoodsLotId === fg.id).reduce((a, b) => a + b.quantity, 0);
      return sum + unitsForThisFG * fg.unitPriceUsd;
    }, 0);

    const reverseLogistics = totalAffectedUnits * 4.50;
    const regulatoryFilingCost = totalAffectedUnits > 0 ? 25000 : 0;
    const financialExposureUsd = Math.round(baseValue + reverseLogistics + regulatoryFilingCost);

    const exposureAssumptions = [
      `Wholesale Unit Value: Calculated per Finished Goods SKU catalog price (avg $${impactedFGs.length ? (baseValue / (totalAffectedUnits || 1)).toFixed(2) : '0.00'}/unit).`,
      `Reverse-Logistics & Hazmat Retrieval: Estimated at $4.50 per commercial unit in transit or delivered.`,
      `Regulatory Notification & Legal Filing Buffer: Flat estimated overhead of $25,000 for FDA/EMA Class II protocol.`,
      `Excludes potential civil product-liability or contractual distributor penalties.`
    ];

    // Relevant anomalies
    const connectedEntityIds = [
      cleanId,
      ...impactedRaw.map((r) => r.id),
      ...impactedPOs.map((p) => p.id),
      ...impactedFGs.map((f) => f.id),
      ...affectedShipments.map((s) => s.id)
    ];
    const connectedAnomalies = anomalies.filter((a) => connectedEntityIds.includes(a.affectedEntityId));

    // Check if already recalled
    const alreadyRecalled = recallRecords.some(
      (r) => r.targetLotId.toUpperCase() === cleanId && r.status === 'ACTIVE_RECALL'
    ) || (fgMatch?.status === 'Recalled');

    return {
      targetLotId: cleanId,
      targetName,
      targetType,
      isValid: true,
      impactedRawLots: impactedRaw,
      impactedPOs: impactedPOs,
      impactedFinishedLots: impactedFGs,
      inventoryRecords: affectedInventory,
      shipmentRecords: affectedShipments,
      affectedCustomers: affectedCusts,
      onHandUnits,
      inTransitUnits,
      deliveredUnits,
      totalAffectedUnits,
      financialExposureUsd,
      exposureAssumptions,
      anomalies: connectedAnomalies,
      alreadyRecalled
    };
  };

  // Execute Recall action
  const executeRecall = (targetLotId: string, authorizedBy: string, reason: string): RecallRecord | null => {
    const impact = analyzeRecallImpact(targetLotId);
    if (!impact.isValid) return null;

    if (impact.alreadyRecalled) {
      addToast('Recall Already Active', `Target lot ${targetLotId} has already been recalled. Duplicate execution blocked.`, 'warning');
      return null;
    }

    const fgIds = impact.impactedFinishedLots.map((f) => f.id);
    const rawIds = impact.impactedRawLots.map((r) => r.id);
    const affectedInvIds = impact.inventoryRecords.map((i) => i.id);
    const affectedShipmentIds = impact.shipmentRecords.map((s) => s.id);

    // 1. Update Finished Goods status to 'Recalled'
    setFinishedLots((prev) =>
      prev.map((fg) => (fgIds.includes(fg.id) ? { ...fg, status: 'Recalled' } : fg))
    );

    // 2. Update Raw Lots status to 'Quarantined'
    setRawLots((prev) =>
      prev.map((raw) => (rawIds.includes(raw.id) ? { ...raw, status: 'Quarantined' } : raw))
    );

    // 3. Update Warehouse Inventory status to 'Quarantined'
    setInventory((prev) =>
      prev.map((inv) => (affectedInvIds.includes(inv.id) ? { ...inv, status: 'Quarantined' } : inv))
    );

    // 4. Update Shipments: In Transit -> 'Quarantine Hold', Delivered -> 'Recall Staged'
    setShipments((prev) =>
      prev.map((s) => {
        if (!affectedShipmentIds.includes(s.id)) return s;
        if (s.status === 'In Transit') return { ...s, status: 'Quarantine Hold' };
        if (s.status === 'Delivered') return { ...s, status: 'Recall Staged' };
        return s;
      })
    );

    // 5. Create Recall Record
    const record: RecallRecord = {
      id: 'REC-' + Math.floor(1000 + Math.random() * 9000),
      initiatedAt: new Date().toISOString(),
      authorizedBy: authorizedBy || 'VP Supply Chain Quality',
      targetLotId: impact.targetLotId,
      targetType: impact.targetType,
      reason: reason || 'Quality anomaly: regulatory quarantine and containment execution.',
      impactedLots: [...fgIds, ...rawIds],
      impactedUnitsTotal: impact.totalAffectedUnits,
      onHandUnits: impact.onHandUnits,
      inTransitUnits: impact.inTransitUnits,
      deliveredUnits: impact.deliveredUnits,
      financialExposureUsd: impact.financialExposureUsd,
      affectedCustomerIds: impact.affectedCustomers.map((c) => c.id),
      quarantinedInventoryIds: affectedInvIds,
      heldShipmentIds: affectedShipmentIds,
      status: 'ACTIVE_RECALL'
    };

    setRecallRecords((prev) => [record, ...prev]);

    // 6. Log Audit Event
    addAuditEvent({
      actionType: 'RECALL_AUTHORIZED',
      user: authorizedBy || 'VP Supply Chain Quality',
      targetId: impact.targetLotId,
      targetType: impact.targetType,
      description: `AUTHORIZED RECALL [${record.id}]: Locked ${impact.onHandUnits.toLocaleString()} on-hand units in WMS, issued carrier holds on ${impact.inTransitUnits.toLocaleString()} units, staged recall notices for ${impact.deliveredUnits.toLocaleString()} delivered units across ${impact.affectedCustomers.length} commercial accounts.`,
      metadata: {
        financialExposure: impact.financialExposureUsd,
        heldShipments: affectedShipmentIds.length,
        quarantinedLots: fgIds
      }
    });

    addToast(
      'Recall Protocol Authorized',
      `Emergency containment initiated for ${impact.targetLotId}. WMS lock applied, carrier holds broadcast.`,
      'error'
    );

    return record;
  };

  // AI Investigation Chat Engine (Simulated Deterministic Logic)
  const sendChatMessage = async (query: string): Promise<void> => {
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query.trim()
    };

    setChatMessages((prev) => [...prev, userMsg]);

    // Simulate realistic asynchronous reasoning delay
    await new Promise((resolve) => setTimeout(resolve, 650));

    const q = query.trim().toUpperCase();
    let replyText = '';
    let suggestedAction: ChatMessage['suggestedAction'];
    let severity: AnomalySeverity = 'Info';
    let highlightEntities: string[] = [];

    if (q.includes('RAW-1042')) {
      severity = 'Info';
      highlightEntities = ['RAW-1042', 'SUP-101', 'PO-8801', 'PO-8804', 'FG-1001', 'FG-2002'];
      replyText = `### Genealogy Analysis: RAW-1042 (Bio-Peptide Matrix 99%)

**Upstream Provenance:**
- **Supplier:** Apex Bio-Chemicals GmbH (Munich, Germany) · *ISO-9001 / GMP Verified*
- **Intake:** 2,500 kg received on Oct 02, 2026.
- **Current Available Stock:** 400 kg at **WH-CHI-1** (Bay-R12). Purity assay confirmed at 99.4%.

**Downstream Consumption (Batch Genealogy):**
1. **PO-8801** (Plant Delta-1): Consumed 800 kg $\\rightarrow$ yielded 12,000 units of **FG-1001** (*NutriShield Oral Suspension*).
2. **PO-8804** (Plant Sigma-4): Consumed 1,300 kg $\\rightarrow$ yielded 25,000 units of **FG-2002** (*VitalPept Fortified Serum*).

**Mass Balance Audit:**
$800\\text{ kg} + 1,300\\text{ kg} + 400\\text{ kg on-hand} = 2,500\\text{ kg}$.
**Verification:** Exact zero-variance mass balance. No integrity defects or unregistered split lots detected on RAW-1042.`;
      suggestedAction = {
        label: 'View RAW-1042 in Genealogy Tree',
        actionType: 'trace',
        payload: 'RAW-1042'
      };
    } else if (q.includes('RAW-9912') || q.includes('MISMATCH') || q.includes('MASS BALANCE') || q.includes('QUANTITY')) {
      severity = 'Critical';
      highlightEntities = ['RAW-9912', 'PO-8815', 'PO-8819', 'SUP-104', 'ANOM-002'];
      replyText = `### CRITICAL AUDIT: Mass Balance Defect on RAW-9912

**Identified Entity:** Raw Lot **RAW-9912** (*Synthetic Solubilizer B-12 Compound*)
**Supplier:** Solis Agro Synthetics S.A. (*Audit Flagged / Expired*)

**Mathematical Discrepancy:**
- **Recorded Intake Mass:** 800.0 kg
- **Allocated to PO-8815 (ImmunoBoost):** 600.0 kg
- **Allocated to PO-8819 (Cellular Defense):** 450.0 kg
- **Total Executed Consumption:** **1,050.0 kg**
- **Discrepancy:** **+250.0 kg ghost mass (+31.25% variance)**

**Root Cause Hypothesis:**
Either unauthorized compounding line dilution with an undocumented solvent occurred, or batch records across Plant Omega-2 were double-booked without physical reconciliation.

**Regulatory Impact:**
Violates 21 CFR 211.186 (Master Production and Control Records). Finished goods **FG-4401** and **FG-5509** fail pharmaceutical release integrity and require immediate quarantine.`;
      suggestedAction = {
        label: 'Stage Recall for RAW-9912',
        actionType: 'navigate',
        payload: 'recall'
      };
    } else if (q.includes('GAP') || q.includes('MISSING') || q.includes('PO-8812') || q.includes('RAW-4040')) {
      severity = 'Critical';
      highlightEntities = ['PO-8812', 'RAW-4040', 'FG-3003', 'ANOM-001'];
      replyText = `### CRITICAL AUDIT: Broken Upstream Link in PO-8812

**Affected Batch Run:** Production Order **PO-8812** (*DermaRestore Complex 100ml*)
**Yield:** 8,500 units of Finished Lot **FG-3003**

**Traceability Break:**
- BOM Input 1: **RAW-2089** (1,500 kg Sorbitol-80) $\\rightarrow$ *Verified from Terra Nutra*
- BOM Input 2: **RAW-4040** (600 kg) $\\rightarrow$ **[RECORD MISSING IN ERP]**

**Audit Finding:**
No certificate of analysis (COA), customs import manifest, or dock intake receipt exists for lot identifier **RAW-4040**. The compounding line proceeded without an authorized barcoded release.

**Exposure:**
FG-3003 has 5,000 units in warehouses (WH-DAL-3, WH-NV-4) and 3,500 units already delivered to **Kaiser Permanente (CUST-905)** via shipment **SHP-8801**.`;
      suggestedAction = {
        label: 'Inspect Anomaly ANOM-001',
        actionType: 'navigate',
        payload: 'anomalies'
      };
    } else if (q.includes('CUST-906') || q.includes('AMERISOURCEBERGEN') || q.includes('SHP-8802') || q.includes('STATUS CONFLICT')) {
      severity = 'Critical';
      highlightEntities = ['SHP-8802', 'CUST-906', 'FG-4401', 'WH-ATL-2', 'ANOM-003'];
      replyText = `### INCIDENT REPORT: Illegal Dispatch of Quarantined Lot

**Incident:** Commercial Shipment **SHP-8802**
**Recipient:** AmerisourceBergen / Cencora Central (CUST-906) · Conshohocken, PA

**Chain of Events:**
1. **Oct 21, 2026:** Finished Goods lot **FG-4401** was quarantined in warehouse **WH-ATL-2** (Cage-09) due to raw material audit issues.
2. **Oct 22, 2026:** Outbound shipment **SHP-8802** (4,000 units) was scanned and released by dock personnel despite the active quarantine lock.
3. **Oct 24, 2026:** Shipment confirmed delivered and integrated into AmerisourceBergen wholesale inventory.

**Immediate Containment Required:**
Transmit an emergency Class I Recall Alert to Marcus Vance (Compliance Officer, +1 800-555-0196) to halt distribution to regional pharmacies.`;
      suggestedAction = {
        label: 'Open Recall Command Center',
        actionType: 'navigate',
        payload: 'recall'
      };
    } else if (q.includes('REPORT') || q.includes('DRAFT') || q.includes('RECALL')) {
      severity = 'Warning';
      highlightEntities = ['FG-4401', 'RAW-9912', 'SHP-8802', 'SHP-8803'];
      replyText = `### DRAFT INCIDENT RESPONSE PROTOCOL: Recall Strategy

**Target Lot:** FG-4401 / RAW-9912
**Risk Classification:** FDA Class II Urgent Recall (Potential adverse health consequence)

**1. Operational Quarantine Plan:**
- **WH-ATL-2:** Lock Bay Cage-09 (5,000 units on hand).
- **Logistics Intercept:** Transmit EDI-214 carrier halt to UPS Healthcare for in-transit shipment **SHP-8803** (5,000 units consigned to Mayo Clinic).
- **Commercial Retrieval:** Issue urgent recall bulletin to AmerisourceBergen for **SHP-8802** (4,000 units delivered).

**2. Financial Impact Estimate:**
- Total product value at wholesale: **$910,000.00** (14,000 units @ $65.00/unit)
- Reverse-logistics and cold-chain retrieval: **$63,000.00**
- Regulatory and legal administration: **$25,000.00**
- **Net Estimated Exposure:** **$998,000.00 USD**

*Recommendation:* Execute authorization step immediately in the Recall Command Center to lock inventory and generate the audit compliance packet.`;
      suggestedAction = {
        label: 'Launch Recall Workflow for FG-4401',
        actionType: 'navigate',
        payload: 'recall'
      };
    } else {
      replyText = `### TraceIQ Investigation Query Analysis

I examined the supply chain graph for **"${query}"**.

**Key Knowledge Graph Summary:**
- **Suppliers Monitored:** 4 active vendors (Apex, Terra Nutra, Pacific Marine, Solis Agro).
- **Critical Anomalies Detected:** 3 unresolved issues (1 broken upstream link, 1 mass balance defect, 1 quarantine dispatch violation).
- **Active Finished Goods Batches:** FG-1001, FG-2002, FG-3003, FG-4401, FG-5509.

**Recommended Investigation Actions:**
- Query *"Trace RAW-1042"* to see a healthy zero-defect pharmaceutical genealogy.
- Query *"Explain the quantity mismatch"* to review the 250 kg ghost mass defect on RAW-9912.
- Query *"Evaluate exposure for customer CUST-906"* to review unreleased inventory shipped into commerce.`;
      suggestedAction = {
        label: 'Identify all traceability gaps',
        actionType: 'trace',
        payload: 'gaps'
      };
    }

    const assistantMsg: ChatMessage = {
      id: 'assistant-' + Date.now(),
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: replyText,
      suggestedAction,
      severity,
      highlightEntities
    };

    setChatMessages((prev) => [...prev, assistantMsg]);
  };

  const clearChat = () => {
    setChatMessages([
      {
        id: 'msg-cleared-' + Date.now(),
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: 'Investigation session cleared. Ready for new supply chain query or batch analysis.'
      }
    ]);
  };

  return (
    <SupplyChainContext.Provider
      value={{
        suppliers,
        rawLots,
        productionOrders,
        finishedLots,
        inventory,
        shipments,
        customers,
        anomalies,
        auditEvents,
        recallRecords,
        chatMessages,
        toasts,
        addToast,
        removeToast,
        resetToDemoData,
        executeRecall,
        updateAnomalyStatus,
        addAuditEvent,
        getTraceabilityPath,
        analyzeRecallImpact,
        sendChatMessage,
        clearChat,
        activeRecallTarget,
        setActiveRecallTarget
      }}
    >
      {children}
    </SupplyChainContext.Provider>
  );
};

export const useSupplyChain = () => {
  const context = useContext(SupplyChainContext);
  if (!context) {
    throw new Error('useSupplyChain must be used within a SupplyChainProvider');
  }
  return context;
};
