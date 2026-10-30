import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DatabaseState,
  STATUS,
  TraceabilityGraphResult,
  GraphEdge,
  LotQuantityValidation,
  MissingInputResult
} from '../types/nexusChain';
import { INITIAL_DATA } from '../data/nexusData';

const STORAGE_KEY = 'traceiq-sc-ledger';

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const generateId = () => {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
};

export const buildTraceabilityGraph = (db: DatabaseState, targetId: string): TraceabilityGraphResult | null => {
  if (!targetId || !targetId.trim()) return null;
  const cleanId = targetId.trim().toUpperCase();

  const impact: {
    suppliers: Set<string>;
    rawLots: Set<string>;
    pos: Set<string>;
    fgLots: Set<string>;
    inventory: Set<string>;
    shipments: Set<string>;
    customers: Set<string>;
    missingLots: Set<string>;
  } = {
    suppliers: new Set(),
    rawLots: new Set(),
    pos: new Set(),
    fgLots: new Set(),
    inventory: new Set(),
    shipments: new Set(),
    customers: new Set(),
    missingLots: new Set()
  };

  const visitedDown = new Set<string>();
  const visitedUp = new Set<string>();

  const traverseDownstream = (lotId: string) => {
    if (visitedDown.has(lotId)) return;
    visitedDown.add(lotId);

    const lot = db.lots.find((l) => l.id === lotId);
    if (!lot) {
      impact.missingLots.add(lotId);
      return;
    }

    if (lot.type === 'RAW') {
      impact.rawLots.add(lotId);
      const relatedPOs = db.productionOrders.filter((po) =>
        po.inputLots.some((il) => il.id === lotId)
      );
      relatedPOs.forEach((po) => {
        impact.pos.add(po.id);
        if (po.outputLot) traverseDownstream(po.outputLot);
      });
      db.inventory.filter((i) => i.lotId === lotId).forEach((i) => impact.inventory.add(i.id));
    } else {
      impact.fgLots.add(lotId);
      db.inventory.filter((i) => i.lotId === lotId).forEach((i) => impact.inventory.add(i.id));
      db.shipments.filter((s) => s.lotId === lotId).forEach((s) => {
        impact.shipments.add(s.id);
        impact.customers.add(s.customerId);
      });
    }
  };

  const traverseUpstream = (lotId: string) => {
    if (visitedUp.has(lotId)) return;
    visitedUp.add(lotId);

    const lot = db.lots.find((l) => l.id === lotId);
    if (!lot) {
      impact.missingLots.add(lotId);
      return;
    }

    if (lot.type === 'FG') {
      impact.fgLots.add(lotId);
      const po = db.productionOrders.find((p) => p.outputLot === lotId);
      if (po) {
        impact.pos.add(po.id);
        po.inputLots.forEach((il) => traverseUpstream(il.id));
      }
    } else if (lot.type === 'RAW') {
      impact.rawLots.add(lotId);
      if (lot.supplierId) impact.suppliers.add(lot.supplierId);
    }
  };

  // 1. Direct match or partial match for Lot
  let startLot = db.lots.find((l) => l.id.toUpperCase() === cleanId);
  // 2. Direct match or partial match for PO
  let startPO = db.productionOrders.find((p) => p.id.toUpperCase() === cleanId);
  // 3. Ghost/missing lot consumed in POs
  const usedAsInputPOs = db.productionOrders.filter((p) =>
    p.inputLots.some((i) => i.id.toUpperCase() === cleanId)
  );

  // 4. Fuzzy fallback search on Lot name or partial ID
  if (!startLot && !startPO && usedAsInputPOs.length === 0) {
    startLot = db.lots.find(
      (l) => l.id.toUpperCase().includes(cleanId) || (l.name && l.name.toUpperCase().includes(cleanId))
    );
  }

  // 5. Fuzzy fallback search on PO product name or ID
  if (!startLot && !startPO && usedAsInputPOs.length === 0) {
    startPO = db.productionOrders.find(
      (p) => p.id.toUpperCase().includes(cleanId) || (p.productName && p.productName.toUpperCase().includes(cleanId))
    );
  }

  // 6. Check Supplier match
  const startSupplier = !startLot && !startPO && usedAsInputPOs.length === 0
    ? db.suppliers.find((s) => s.id.toUpperCase() === cleanId || s.name.toUpperCase().includes(cleanId))
    : null;

  // 7. Check Shipment match
  const startShipment = !startLot && !startPO && usedAsInputPOs.length === 0 && !startSupplier
    ? db.shipments.find((s) => s.id.toUpperCase() === cleanId || (s.tracking && s.tracking.toUpperCase().includes(cleanId)))
    : null;

  // 8. Check Customer match
  const startCustomer = !startLot && !startPO && usedAsInputPOs.length === 0 && !startSupplier && !startShipment
    ? db.customers.find((c) => c.id.toUpperCase() === cleanId || c.name.toUpperCase().includes(cleanId))
    : null;

  // 9. Check Warehouse match
  const startWarehouse = !startLot && !startPO && usedAsInputPOs.length === 0 && !startSupplier && !startShipment && !startCustomer
    ? db.warehouses.find((w) => w.id.toUpperCase() === cleanId || w.name.toUpperCase().includes(cleanId))
    : null;

  // 10. Check "ALL" or full network view
  const isAll = cleanId === 'ALL' || cleanId === 'FULL' || cleanId === 'NETWORK';

  if (!startLot && !startPO && usedAsInputPOs.length === 0 && !startSupplier && !startShipment && !startCustomer && !startWarehouse && !isAll) {
    return null;
  }

  if (isAll) {
    db.lots.forEach((l) => {
      traverseUpstream(l.id);
      traverseDownstream(l.id);
    });
    db.productionOrders.forEach((p) => impact.pos.add(p.id));
    db.inventory.forEach((i) => impact.inventory.add(i.id));
    db.shipments.forEach((s) => {
      impact.shipments.add(s.id);
      impact.customers.add(s.customerId);
    });
  } else if (startSupplier) {
    impact.suppliers.add(startSupplier.id);
    const supplierLots = db.lots.filter((l) => l.supplierId === startSupplier.id);
    supplierLots.forEach((l) => {
      traverseUpstream(l.id);
      traverseDownstream(l.id);
    });
  } else if (startShipment) {
    impact.shipments.add(startShipment.id);
    impact.customers.add(startShipment.customerId);
    traverseUpstream(startShipment.lotId);
    traverseDownstream(startShipment.lotId);
  } else if (startCustomer) {
    impact.customers.add(startCustomer.id);
    const customerShipments = db.shipments.filter((s) => s.customerId === startCustomer.id);
    customerShipments.forEach((s) => {
      impact.shipments.add(s.id);
      traverseUpstream(s.lotId);
      traverseDownstream(s.lotId);
    });
  } else if (startWarehouse) {
    const whInventory = db.inventory.filter((i) => i.warehouseId === startWarehouse.id);
    whInventory.forEach((inv) => {
      impact.inventory.add(inv.id);
      traverseUpstream(inv.lotId);
      traverseDownstream(inv.lotId);
    });
  } else if (usedAsInputPOs.length > 0 && !startLot) {
    impact.missingLots.add(cleanId);
    usedAsInputPOs.forEach((po) => {
      impact.pos.add(po.id);
      if (po.outputLot) traverseDownstream(po.outputLot);
    });
  } else if (startLot) {
    traverseUpstream(startLot.id);
    traverseDownstream(startLot.id);
  } else if (startPO) {
    impact.pos.add(startPO.id);
    startPO.inputLots.forEach((il) => traverseUpstream(il.id));
    if (startPO.outputLot) traverseDownstream(startPO.outputLot);
  }

  const resolvedTarget = startLot?.id || startPO?.id || startSupplier?.id || startShipment?.id || startCustomer?.id || startWarehouse?.id || cleanId;

  // Complete cross-stage connections
  // 1. For every PO included in impact.pos, ensure its inputs are in rawLots/missingLots and its output in fgLots
  impact.pos.forEach((poId) => {
    const po = db.productionOrders.find((p) => p.id === poId);
    if (po) {
      po.inputLots.forEach((il) => {
        const lot = db.lots.find((l) => l.id === il.id);
        if (lot?.type === 'RAW') {
          impact.rawLots.add(il.id);
          if (lot.supplierId) impact.suppliers.add(lot.supplierId);
        } else if (!lot) {
          impact.missingLots.add(il.id);
        }
      });
      if (po.outputLot) {
        impact.fgLots.add(po.outputLot);
      }
    }
  });

  // 2. For every raw lot, ensure supplier and raw inventory are tracked
  impact.rawLots.forEach((rlId) => {
    const rlot = db.lots.find((l) => l.id === rlId);
    if (rlot?.supplierId) impact.suppliers.add(rlot.supplierId);
    db.inventory.filter((i) => i.lotId === rlId).forEach((i) => impact.inventory.add(i.id));
  });

  // 3. For every FG lot, ensure downstream inventory and shipments are captured
  impact.fgLots.forEach((fgId) => {
    db.inventory.filter((i) => i.lotId === fgId).forEach((i) => impact.inventory.add(i.id));
    db.shipments.filter((s) => s.lotId === fgId).forEach((s) => {
      impact.shipments.add(s.id);
      impact.customers.add(s.customerId);
    });
  });

  // 4. For every shipment, ensure customer is captured
  impact.shipments.forEach((shpId) => {
    const s = db.shipments.find((shp) => shp.id === shpId);
    if (s?.customerId) impact.customers.add(s.customerId);
  });

  // Generate directional graph edges
  const edges: GraphEdge[] = [];

  // Edge 1: Supplier -> Raw Lot
  impact.rawLots.forEach((rawId) => {
    const lot = db.lots.find((l) => l.id === rawId);
    if (lot?.supplierId && impact.suppliers.has(lot.supplierId)) {
      edges.push({
        id: `e-${lot.supplierId}-${rawId}`,
        source: lot.supplierId,
        target: rawId,
        sourceType: 'supplier',
        targetType: 'raw',
        label: `${lot.qty} ${lot.uom}`,
        status: lot.status === 'WARNING' || lot.status === 'RECALLED' ? 'CRITICAL' : 'OK'
      });
    }
  });

  // Edge 2: Raw Lot / Missing Lot -> Production Order
  impact.pos.forEach((poId) => {
    const po = db.productionOrders.find((p) => p.id === poId);
    if (po) {
      po.inputLots.forEach((il) => {
        if (impact.rawLots.has(il.id)) {
          const rlot = db.lots.find((l) => l.id === il.id);
          const isRecalled = rlot?.status === 'WARNING' || rlot?.status === 'RECALLED';
          edges.push({
            id: `e-${il.id}-${poId}`,
            source: il.id,
            target: poId,
            sourceType: 'raw',
            targetType: 'po',
            label: `${il.qty} kg`,
            status: isRecalled ? 'CRITICAL' : 'OK'
          });
        } else if (impact.missingLots.has(il.id)) {
          edges.push({
            id: `e-${il.id}-${poId}`,
            source: il.id,
            target: poId,
            sourceType: 'missing',
            targetType: 'po',
            label: `Missing (${il.qty} kg)`,
            status: 'BROKEN',
            isAnomaly: true
          });
        }
      });
    }
  });

  // Edge 3: Production Order -> Finished Good Lot
  impact.pos.forEach((poId) => {
    const po = db.productionOrders.find((p) => p.id === poId);
    if (po && po.outputLot && impact.fgLots.has(po.outputLot)) {
      const fgLot = db.lots.find((l) => l.id === po.outputLot);
      const isCritical = fgLot?.status === 'RECALLED' || fgLot?.status === 'QUARANTINED';
      edges.push({
        id: `e-${poId}-${po.outputLot}`,
        source: poId,
        target: po.outputLot,
        sourceType: 'po',
        targetType: 'fg',
        label: `Yield: ${fgLot?.qty ?? ''} ${fgLot?.uom ?? ''}`.trim(),
        status: isCritical ? 'CRITICAL' : (po.status === 'FLAGGED' ? 'WARNING' : 'OK')
      });
    }
  });

  // Edge 4: Finished Good (or Raw Lot) -> Warehouse Inventory Item
  impact.inventory.forEach((invId) => {
    const inv = db.inventory.find((i) => i.id === invId);
    if (inv) {
      if (impact.fgLots.has(inv.lotId)) {
        edges.push({
          id: `e-${inv.lotId}-${inv.id}`,
          source: inv.lotId,
          target: inv.id,
          sourceType: 'fg',
          targetType: 'inventory',
          label: `${inv.qty} stored`,
          status: inv.status === 'QUARANTINED' || inv.status === 'HOLD' ? 'CRITICAL' : 'OK'
        });
      } else if (impact.rawLots.has(inv.lotId)) {
        edges.push({
          id: `e-${inv.lotId}-${inv.id}`,
          source: inv.lotId,
          target: inv.id,
          sourceType: 'raw',
          targetType: 'inventory',
          label: `${inv.qty} in hold`,
          status: inv.status === 'QUARANTINED' || inv.status === 'HOLD' ? 'CRITICAL' : 'OK'
        });
      }
    }
  });

  // Edge 5: Finished Good -> Shipment
  impact.shipments.forEach((shpId) => {
    const shp = db.shipments.find((s) => s.id === shpId);
    if (shp && impact.fgLots.has(shp.lotId)) {
      const isOverAllocated = shp.lotId === 'FG-4001' && shp.qty > 200;
      const isCritical = shp.status === 'HOLD' || shp.recallStatus === 'NOTIFIED' || shp.recallStatus === 'HELD';
      edges.push({
        id: `e-${shp.lotId}-${shp.id}`,
        source: shp.lotId,
        target: shp.id,
        sourceType: 'fg',
        targetType: 'shipment',
        label: isOverAllocated ? `${shp.qty} (Qty Mismatch!)` : `${shp.qty} dispatched`,
        status: isOverAllocated ? 'WARNING' : (isCritical ? 'CRITICAL' : 'OK'),
        isAnomaly: isOverAllocated
      });
    }
  });

  // Edge 6: Shipment -> Customer
  impact.shipments.forEach((shpId) => {
    const shp = db.shipments.find((s) => s.id === shpId);
    if (shp && impact.customers.has(shp.customerId)) {
      edges.push({
        id: `e-${shp.id}-${shp.customerId}`,
        source: shp.id,
        target: shp.customerId,
        sourceType: 'shipment',
        targetType: 'customer',
        label: shp.carrier ? `${shp.carrier}` : 'Consigned',
        status: shp.recallStatus === 'NOTIFIED' ? 'CRITICAL' : 'OK'
      });
    }
  });

  return {
    targetId: resolvedTarget,
    suppliers: Array.from(impact.suppliers),
    rawLots: Array.from(impact.rawLots),
    pos: Array.from(impact.pos),
    fgLots: Array.from(impact.fgLots),
    inventory: Array.from(impact.inventory),
    shipments: Array.from(impact.shipments),
    customers: Array.from(impact.customers),
    missingLots: Array.from(impact.missingLots),
    edges
  };
};

export const validateLotQuantities = (db: DatabaseState, lotId: string): LotQuantityValidation | null => {
  const lot = db.lots.find((item) => item.id === lotId);
  if (!lot) return null;

  const inventory = db.inventory.filter((item) => item.lotId === lotId);
  const shipments = db.shipments.filter((item) => item.lotId === lotId);

  const inventoryQty = inventory.reduce((sum, item) => sum + item.qty, 0);
  const shippedQty = shipments.reduce((sum, item) => sum + item.qty, 0);

  const totalRecorded = inventoryQty + shippedQty;
  const difference = lot.qty - totalRecorded;

  return {
    lotId,
    producedQty: lot.qty,
    uom: lot.uom,
    inventoryQty,
    shippedQty,
    totalRecorded,
    difference,
    overAllocated: difference < 0,
    status: difference < 0 ? 'OVER_ALLOCATED' : difference > 0 ? 'UNDER_RECONCILED' : 'RECONCILED'
  };
};

export const findMissingInputs = (db: DatabaseState): MissingInputResult[] => {
  const knownLotIds = new Set(db.lots.map((lot) => lot.id));
  return db.productionOrders.flatMap((po) =>
    po.inputLots
      .filter((input) => !knownLotIds.has(input.id))
      .map((input) => ({
        productionOrderId: po.id,
        missingLotId: input.id,
        requiredQty: input.qty,
        outputLot: po.outputLot
      }))
  );
};

export interface NexusContextType {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearchTarget: string;
  setGlobalSearchTarget: (target: string) => void;
  resetSystemData: () => void;
  resetDemo: () => void;
  addAuditEvent: (action: string, target: string, details: string) => void;
  executeRecallAtomically: (
    targetLot: string,
    impact: TraceabilityGraphResult,
    exposure: { fgQtyAtRisk: number; fgQtyDelivered: number; customers: number; financialExposure: number }
  ) => void;
  acknowledgeCustomerRecall: (shipmentId: string, notes?: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

const NexusContext = createContext<NexusContextType | null>(null);

export const NexusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalSearchTarget, setGlobalSearchTarget] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [db, setDb] = useState<DatabaseState>(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : deepClone(INITIAL_DATA);
    } catch {
      return deepClone(INITIAL_DATA);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [db]);

  const addAuditEvent = (action: string, target: string, details: string) => {
    setDb((prev) => ({
      ...prev,
      auditEvents: [
        {
          id: generateId(),
          timestamp: new Date().toISOString(),
          actor: 'Admin User (QA Lead)',
          action,
          target,
          details
        },
        ...prev.auditEvents
      ]
    }));
  };

  const resetSystemData = () => {
    const fresh = deepClone(INITIAL_DATA);
    fresh.auditEvents.unshift({
      id: generateId(),
      timestamp: new Date().toISOString(),
      actor: 'Admin User (QA Lead)',
      action: 'DATA_RESET',
      target: 'ALL_DATA',
      details: 'Restored baseline synthetic supply chain dataset.'
    });
    setDb(fresh);
    setActiveTab('dashboard');
  };

  const resetDemo = resetSystemData;

  const executeRecallAtomically = (
    targetLot: string,
    impact: TraceabilityGraphResult,
    exposure: { fgQtyAtRisk: number; fgQtyDelivered: number; customers: number; financialExposure: number }
  ) => {
    setDb((prev) => {
      const nextDb = deepClone(prev);

      // 1. Quarantine impacted lots
      impact.rawLots.concat(impact.fgLots).forEach((lotId) => {
        const lot = nextDb.lots.find((l) => l.id === lotId);
        if (lot) lot.status = STATUS.QUARANTINED;
      });

      // 2. Quarantine inventory
      impact.inventory.forEach((invId) => {
        const inv = nextDb.inventory.find((i) => i.id === invId);
        if (inv) inv.status = STATUS.QUARANTINED;
      });

      // 3. Halt shipments
      impact.shipments.forEach((shpId) => {
        const shp = nextDb.shipments.find((s) => s.id === shpId);
        if (shp) {
          if (shp.status === STATUS.IN_TRANSIT) {
            shp.status = STATUS.HOLD;
          } else if (shp.status === STATUS.DELIVERED && !shp.recallStatus) {
            shp.recallStatus = 'NOTIFIED';
            shp.notificationTimestamp = new Date().toISOString();
          }
        }
      });

      // 4. Log audit event
      nextDb.auditEvents.unshift({
        id: generateId(),
        timestamp: new Date().toISOString(),
        actor: 'Admin User (QA Lead)',
        action: 'RECALL_EXECUTED',
        target: targetLot,
        details: `Quarantined ${exposure.fgQtyAtRisk.toLocaleString()} units across ${impact.inventory.length} warehouse locations and placed holds on in-transit shipments.`
      });

      return nextDb;
    });
  };

  const acknowledgeCustomerRecall = (shipmentId: string, notes?: string) => {
    setDb((prev) => {
      const nextDb = deepClone(prev);
      const shp = nextDb.shipments.find((s) => s.id === shipmentId);
      if (shp) {
        shp.recallStatus = 'ACKNOWLEDGED';
        const customer = nextDb.customers.find((c) => c.id === shp.customerId);
        nextDb.auditEvents.unshift({
          id: generateId(),
          timestamp: new Date().toISOString(),
          actor: 'Admin User (QA Lead)',
          action: 'CUSTOMER_ACKNOWLEDGMENT_LOGGED',
          target: `${shp.id} (${shp.lotId})`,
          details: `Consignee ${customer?.name || shp.customerId} acknowledged recall protocol for ${shp.qty.toLocaleString()} units. ${notes || 'Quarantine affidavit confirmed on file.'}`
        });
      }
      return nextDb;
    });
  };

  return (
    <NexusContext.Provider
      value={{
        db,
        setDb,
        activeTab,
        setActiveTab,
        globalSearchTarget,
        setGlobalSearchTarget,
        resetSystemData,
        resetDemo,
        addAuditEvent,
        executeRecallAtomically,
        acknowledgeCustomerRecall,
        theme,
        setTheme
      }}
    >
      {children}
    </NexusContext.Provider>
  );
};

export const useNexus = () => {
  const context = useContext(NexusContext);
  if (!context) throw new Error('useNexus must be used within NexusProvider');
  return context;
};
