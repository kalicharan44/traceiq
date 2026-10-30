import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  SearchCode,
  ArrowRight,
  ArrowLeft,
  Lock,
  Package,
  Truck,
  Building,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Download,
  Info,
  FileSpreadsheet,
  Mail,
  Warehouse as WarehouseIcon,
  ShieldCheck,
  Check,
  Clock,
  Layers,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import {
  useNexus,
  buildTraceabilityGraph,
  validateLotQuantities
} from '../context/NexusContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { STATUS } from '../types/nexusChain';

export const RecallPage: React.FC = () => {
  const {
    db,
    executeRecallAtomically,
    acknowledgeCustomerRecall,
    globalSearchTarget,
    setGlobalSearchTarget,
    setActiveTab
  } = useNexus();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [targetLot, setTargetLot] = useState('RAW-1042');
  const [reconciliationTab, setReconciliationTab] = useState<'all' | 'validation' | 'lots' | 'stock' | 'customers' | 'balance'>('all');
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    isDanger?: boolean;
    isAlert?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({ isOpen: false });

  useEffect(() => {
    if (globalSearchTarget) {
      setTargetLot(globalSearchTarget);
      setStep(2);
      setGlobalSearchTarget('');
    }
  }, [globalSearchTarget]);

  const handleGoBack = () => {
    if (step === 4) {
      setStep(3);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    } else {
      setActiveTab('dashboard');
    }
  };

  // Listen for Backspace keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleGoBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  const impact = useMemo(() => {
    if (!targetLot.trim()) return null;
    return buildTraceabilityGraph(db, targetLot.trim().toUpperCase());
  }, [targetLot, db]);

  // Validation Step: Cross-reference Recall's Affected Inventory State with Master Registry
  const validationStep = useMemo(() => {
    if (!impact) return null;

    // Cross-reference each affected finished goods lot
    const fgLotDetails = impact.fgLots.map((lotId) => {
      const masterLot = db.lots.find((l) => l.id === lotId);
      const masterProducedQty = masterLot?.qty || 0;
      const uom = masterLot?.uom || 'units';

      // Physical warehouse inventory records in WMS
      const whRecords = db.inventory.filter((inv) => inv.lotId === lotId);
      const warehouseQty = whRecords.reduce((sum, item) => sum + item.qty, 0);

      // In-transit / intercepted freight carrier records
      const inTransitRecords = db.shipments.filter(
        (s) => s.lotId === lotId && (s.status === STATUS.IN_TRANSIT || s.status === STATUS.HOLD)
      );
      const inTransitQty = inTransitRecords.reduce((sum, s) => sum + s.qty, 0);

      // Delivered shipments to commercial consignees
      const deliveredRecords = db.shipments.filter(
        (s) => s.lotId === lotId && s.status === STATUS.DELIVERED
      );
      const deliveredQty = deliveredRecords.reduce((sum, s) => sum + s.qty, 0);

      // Expected sum of warehouse and in-transit records
      const expectedSumWarehouseInTransit = warehouseQty + inTransitQty;
      // Discrepancy between master recalled units and expected sum of warehouse + in-transit records
      const deltaQuarantine = masterProducedQty - expectedSumWarehouseInTransit;
      const hasQuarantineDiscrepancy = deltaQuarantine !== 0;

      // Total recorded units (including delivered)
      const totalRecorded = warehouseQty + inTransitQty + deliveredQty;
      const totalVariance = masterProducedQty - totalRecorded;
      const isOverAllocated = totalVariance < 0;

      return {
        lotId,
        productName: masterLot?.name || 'Finished Product Lot',
        uom,
        masterProducedQty,
        warehouseQty,
        whCount: whRecords.length,
        inTransitQty,
        inTransitCount: inTransitRecords.length,
        deliveredQty,
        deliveredCount: deliveredRecords.length,
        expectedSumWarehouseInTransit,
        deltaQuarantine,
        hasQuarantineDiscrepancy,
        totalRecorded,
        totalVariance,
        isOverAllocated
      };
    });

    const totalRecalledUnits = fgLotDetails.reduce((sum, item) => sum + item.masterProducedQty, 0);
    const totalWarehouseRecords = fgLotDetails.reduce((sum, item) => sum + item.warehouseQty, 0);
    const totalInTransitRecords = fgLotDetails.reduce((sum, item) => sum + item.inTransitQty, 0);
    const totalExpectedSum = totalWarehouseRecords + totalInTransitRecords;
    const totalDeliveredUnits = fgLotDetails.reduce((sum, item) => sum + item.deliveredQty, 0);
    const totalRecordedUnits = totalExpectedSum + totalDeliveredUnits;

    // Discrepancy indicator flag: true if total recalled units do not match expected sum of warehouse + in-transit records
    const totalDiscrepancyDelta = totalRecalledUnits - totalExpectedSum;
    const hasQuantityDiscrepancy = totalDiscrepancyDelta !== 0 || fgLotDetails.some((l) => l.hasQuarantineDiscrepancy);

    return {
      fgLotDetails,
      totalRecalledUnits,
      totalWarehouseRecords,
      totalInTransitRecords,
      totalExpectedSum,
      totalDeliveredUnits,
      totalRecordedUnits,
      totalDiscrepancyDelta,
      hasQuantityDiscrepancy
    };
  }, [impact, db]);

  const calculateExposure = () => {
    if (!impact) return { fgQtyAtRisk: 0, fgQtyDelivered: 0, customers: 0, financialExposure: 0 };

    const fgInvQty = impact.inventory
      .map((id) => db.inventory.find((i) => i.id === id))
      .filter((i) => db.lots.find((l) => l.id === i?.lotId)?.type === 'FG')
      .reduce((sum, i) => sum + (i?.qty || 0), 0);

    const inTransitQty = impact.shipments
      .map((id) => db.shipments.find((s) => s.id === id))
      .filter((s) => s?.status === STATUS.IN_TRANSIT)
      .reduce((sum, s) => sum + (s?.qty || 0), 0);

    const deliveredQty = impact.shipments
      .map((id) => db.shipments.find((s) => s.id === id))
      .filter((s) => s?.status === STATUS.DELIVERED)
      .reduce((sum, s) => sum + (s?.qty || 0), 0);

    return {
      fgQtyAtRisk: fgInvQty + inTransitQty,
      fgQtyDelivered: deliveredQty,
      customers: impact.customers.length,
      financialExposure: (fgInvQty + inTransitQty + deliveredQty) * 125
    };
  };

  const exposure = calculateExposure();

  const simulateRecall = () => {
    if (!targetLot.trim()) return;
    const cleanTarget = targetLot.trim().toUpperCase();
    const testImpact = buildTraceabilityGraph(db, cleanTarget);

    if (!testImpact) {
      setModalConfig({
        isOpen: true,
        title: 'Lot Not Found',
        message: `Lot identifier "${cleanTarget}" was not found in the database. Please verify the ID or choose an example like RAW-1042.`,
        isAlert: true,
        onConfirm: () => setModalConfig({ isOpen: false }),
        confirmText: 'Acknowledge'
      });
      return;
    }

    setTargetLot(cleanTarget);
    setStep(2);
  };

  const handleExecuteRequest = () => {
    const isAlreadyExecuted = db.auditEvents.some(
      (e) => e.action === 'RECALL_EXECUTED' && e.target === targetLot
    );

    if (isAlreadyExecuted) {
      setModalConfig({
        isOpen: true,
        title: 'Duplicate Execution Prevented',
        message: 'A quarantine recall has already been executed for this lot scope. The affected inventory is already locked in WMS.',
        isAlert: true,
        onConfirm: () => {
          setModalConfig({ isOpen: false });
          setStep(4);
        },
        confirmText: 'View Report'
      });
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Authorize Quarantine Protocol',
      message:
        'Are you sure you want to execute quarantine protocols on all downstream lots?\n\nThis will lock warehouse inventory against dispatch, place active in-transit shipments on hold, and flag delivered shipments for customer notification.',
      isDanger: true,
      onConfirm: () => {
        setModalConfig({ isOpen: false });
        if (impact) {
          executeRecallAtomically(targetLot, impact, exposure);
        }
        setStep(4);
      },
      onCancel: () => setModalConfig({ isOpen: false }),
      confirmText: 'Authorize & Execute',
      cancelText: 'Cancel'
    });
  };

  const downloadReport = () => {
    if (!impact) return;

    const affectedLotsList = [
      ...impact.rawLots.map((id) => {
        const lot = db.lots.find((l) => l.id === id);
        const sup = db.suppliers.find((s) => s.id === lot?.supplierId);
        return {
          lotId: id,
          type: 'RAW_MATERIAL',
          name: lot?.name || 'Raw Material Lot',
          status: lot?.status || 'UNKNOWN',
          quantity: `${lot?.qty || 0} ${lot?.uom || 'kg'}`,
          supplierOrFacility: sup?.name || 'Approved Supplier'
        };
      }),
      ...impact.fgLots.map((id) => {
        const lot = db.lots.find((l) => l.id === id);
        const po = db.productionOrders.find((p) => p.outputLot === id);
        return {
          lotId: id,
          type: 'FINISHED_GOOD',
          name: lot?.name || 'Finished Product Lot',
          status: lot?.status || 'UNKNOWN',
          quantity: `${lot?.qty || 0} ${lot?.uom || 'units'}`,
          supplierOrFacility: po?.facility || po?.id || 'Manufacturing Facility'
        };
      })
    ];

    const warehouseQuarantineList = impact.inventory.map((invId) => {
      const inv = db.inventory.find((i) => i.id === invId);
      const wh = db.warehouses.find((w) => w.id === inv?.warehouseId);
      const lot = db.lots.find((l) => l.id === inv?.lotId);
      return {
        inventoryId: invId,
        lotId: inv?.lotId,
        productName: lot?.name,
        warehouseId: inv?.warehouseId,
        warehouseName: wh?.name || inv?.warehouseId,
        location: wh?.location,
        bay: inv?.bay || 'General Storage',
        quarantinedQty: inv?.qty,
        uom: lot?.uom || 'units',
        electronicLockStatus: inv?.status === STATUS.QUARANTINED ? 'QUARANTINED_LOCKED' : inv?.status
      };
    });

    const inTransitHoldsList = impact.shipments
      .map((shpId) => db.shipments.find((s) => s.id === shpId))
      .filter((s) => s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT)
      .map((shp) => ({
        shipmentId: shp?.id,
        lotId: shp?.lotId,
        carrier: shp?.carrier || 'Designated Freight Carrier',
        trackingNumber: shp?.tracking || 'N/A',
        heldQuantity: shp?.qty,
        dispatchStatus: shp?.status,
        interceptDate: shp?.date
      }));

    const customerActionsList = impact.shipments
      .map((shpId) => db.shipments.find((s) => s.id === shpId))
      .filter((s) => s?.status === STATUS.DELIVERED)
      .map((shp) => {
        const cust = db.customers.find((c) => c.id === shp?.customerId);
        return {
          shipmentId: shp?.id,
          customerId: cust?.id,
          customerName: cust?.name,
          contact: cust?.contact,
          email: cust?.email,
          tier: cust?.tier,
          facilityLocation: cust?.location,
          deliveredLot: shp?.lotId,
          deliveredQuantity: shp?.qty,
          deliveryDate: shp?.date,
          recallNotificationStatus: shp?.recallStatus || 'NOTIFIED',
          notificationTimestamp: shp?.notificationTimestamp || new Date().toISOString(),
          actionRequired: 'Quarantine stock at customer warehouse; submit electronic destruction / RMA affidavit.'
        };
      });

    const reportData = {
      reconciliationReport: {
        targetLot,
        generatedAt: new Date().toISOString(),
        governanceStandard: 'FDA 21 CFR Part 11 & EU Annex 11 Regulatory Compliance',
        quarantineStatus: db.auditEvents.some((e) => e.action === 'RECALL_EXECUTED' && e.target === targetLot)
          ? 'ACTIVE_QUARANTINE_ENFORCED'
          : 'PRE_EXECUTION_STAGED',
        exposureSummary: exposure,
        affectedLots: affectedLotsList,
        quarantinedStock: {
          warehouseQuarantine: warehouseQuarantineList,
          inTransitFreightHolds: inTransitHoldsList
        },
        pendingCustomerActions: customerActionsList,
        masterRegistryValidation: {
          validationStatus: validationStep?.hasQuantityDiscrepancy ? 'QUANTITY_DISCREPANCY_DETECTED' : 'VERIFIED_BALANCED',
          hasQuantityDiscrepancy: validationStep?.hasQuantityDiscrepancy,
          totalRecalledUnits: validationStep?.totalRecalledUnits,
          totalWarehouseRecords: validationStep?.totalWarehouseRecords,
          totalInTransitRecords: validationStep?.totalInTransitRecords,
          expectedSumWarehouseInTransit: validationStep?.totalExpectedSum,
          totalDiscrepancyDelta: validationStep?.totalDiscrepancyDelta,
          consigneeInMarketUnits: validationStep?.totalDeliveredUnits,
          lotBreakdown: validationStep?.fgLotDetails
        },
        quantityReconciliation: impact.fgLots.map((id) => validateLotQuantities(db, id))
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `reconciliation-report-${targetLot}-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadCsvReport = () => {
    if (!impact) return;

    const rows: string[] = [
      '# TRACEIQ RECONCILIATION REPORT',
      `# Target Lot: ${targetLot}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Governance: FDA 21 CFR Part 11 Electronic Record`,
      '',
      'SECTION 0: MASTER REGISTRY CROSS-REFERENCE VALIDATION',
      `Validation Status,${validationStep?.hasQuantityDiscrepancy ? 'QUANTITY_DISCREPANCY_DETECTED' : 'VERIFIED_BALANCED'}`,
      `Total Recalled Units (Master),${validationStep?.totalRecalledUnits || 0}`,
      `Warehouse Records,${validationStep?.totalWarehouseRecords || 0}`,
      `In-Transit Records,${validationStep?.totalInTransitRecords || 0}`,
      `Expected Sum (Warehouse + In-Transit),${validationStep?.totalExpectedSum || 0}`,
      `Variance Delta,${validationStep?.totalDiscrepancyDelta || 0}`,
      `Consignee In-Market Units,${validationStep?.totalDeliveredUnits || 0}`,
      '',
      'Lot ID,Product Name,Master Registry Qty,Warehouse Quarantined,In-Transit Freight,Expected Sum,Variance,Discrepancy Status'
    ];

    validationStep?.fgLotDetails.forEach((lot) => {
      rows.push(`${lot.lotId},"${lot.productName}",${lot.masterProducedQty},${lot.warehouseQty},${lot.inTransitQty},${lot.expectedSumWarehouseInTransit},${lot.deltaQuarantine},${lot.hasQuarantineDiscrepancy ? 'QUANTITY_DISCREPANCY' : 'VERIFIED_MATCH'}`);
    });

    rows.push('', 'SECTION 1: AFFECTED LOTS');
    rows.push('Lot ID,Lot Type,Product Name,Quantity,Source/Supplier,Status');

    impact.rawLots.forEach((id) => {
      const lot = db.lots.find((l) => l.id === id);
      const sup = db.suppliers.find((s) => s.id === lot?.supplierId);
      rows.push(`${id},RAW_MATERIAL,"${lot?.name || ''}",${lot?.qty || 0} ${lot?.uom || 'kg'},"${sup?.name || ''}",${lot?.status}`);
    });

    impact.fgLots.forEach((id) => {
      const lot = db.lots.find((l) => l.id === id);
      const po = db.productionOrders.find((p) => p.outputLot === id);
      rows.push(`${id},FINISHED_GOOD,"${lot?.name || ''}",${lot?.qty || 0} ${lot?.uom || 'units'},"${po?.facility || po?.id || ''}",${lot?.status}`);
    });

    rows.push('', 'SECTION 2: QUARANTINED STOCK & IN-TRANSIT HOLDS');
    rows.push('Type,Record ID,Lot ID,Warehouse / Carrier,Bay / Tracking,Quantity,Status');

    impact.inventory.forEach((invId) => {
      const inv = db.inventory.find((i) => i.id === invId);
      const wh = db.warehouses.find((w) => w.id === inv?.warehouseId);
      rows.push(`Warehouse Stock,${invId},${inv?.lotId},"${wh?.name || inv?.warehouseId}",${inv?.bay || ''},${inv?.qty},${inv?.status}`);
    });

    impact.shipments
      .map((id) => db.shipments.find((s) => s.id === id))
      .filter((s) => s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT)
      .forEach((shp) => {
        rows.push(`Freight Hold,${shp?.id},${shp?.lotId},"${shp?.carrier || ''}",${shp?.tracking || ''},${shp?.qty},${shp?.status}`);
      });

    rows.push('', 'SECTION 3: PENDING CUSTOMER ACTIONS');
    rows.push('Shipment ID,Customer Name,Contact,Email,Lot ID,Delivered Qty,Delivery Date,Recall Status,Action Required');

    impact.shipments
      .map((id) => db.shipments.find((s) => s.id === id))
      .filter((s) => s?.status === STATUS.DELIVERED)
      .forEach((shp) => {
        const cust = db.customers.find((c) => c.id === shp?.customerId);
        rows.push(`${shp?.id},"${cust?.name || ''}","${cust?.contact || ''}",${cust?.email || ''},${shp?.lotId},${shp?.qty},${shp?.date},${shp?.recallStatus || 'NOTIFIED'},"Quarantine stock on-site & return RMA"`);
      });

    rows.push('', 'SECTION 4: QUANTITY & MASS BALANCE RECONCILIATION');
    rows.push('Lot ID,Produced Qty,Warehouse Stock,Shipped Qty,Total Accounted,Variance,Status');

    impact.fgLots.forEach((id) => {
      const rec = validateLotQuantities(db, id);
      if (rec) {
        rows.push(`${rec.lotId},${rec.producedQty},${rec.inventoryQty},${rec.shippedQty},${rec.totalRecorded},${rec.difference},${rec.status}`);
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `reconciliation-report-${targetLot}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const stepLabels = [
    { num: 1, label: 'Identify Incident', sub: 'Target lot verification' },
    { num: 2, label: 'Analyze Impact', sub: 'Downstream exposure' },
    { num: 3, label: 'Authorize Action', sub: 'Quarantine execution' },
    { num: 4, label: 'Reconciliation Report', sub: 'Quantity report & holds' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <Modal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title || ''}
        message={modalConfig.message || ''}
        isDanger={modalConfig.isDanger}
        isAlert={modalConfig.isAlert}
        onConfirm={modalConfig.onConfirm || (() => setModalConfig({ isOpen: false }))}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            Recall Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Standard Operating Procedure (SOP-801): 4-step containment, exposure calculation, and quarantine lock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Backspace / Previous Page Navigation Button */}
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs active:scale-[0.98] group"
            title="Go back to previous page or step (Shortcut: Backspace)"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
            <span>{step === 1 ? 'Back to Overview' : `Back to Step ${step - 1}`}</span>
            <kbd className="hidden sm:inline-block rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-3xs font-mono text-slate-500">
              ⌫ Backspace
            </kbd>
          </button>

          {step > 1 && (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              title="Reset simulation to Step 1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4-Step Stepper Progress Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stepLabels.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            const isAccessible = s.num === 1 || Boolean(impact);

            return (
              <div
                key={s.num}
                onClick={() => {
                  if (isAccessible) {
                    setStep(s.num as any);
                  }
                }}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-1 ring-blue-500/20'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/40 cursor-pointer hover:border-emerald-300'
                    : isAccessible
                    ? 'border-slate-200 bg-white cursor-pointer hover:border-blue-300 hover:bg-slate-50'
                    : 'border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isAccessible
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : s.num}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{s.label}</h4>
                  <p className="text-3xs text-slate-500 truncate">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: IDENTIFY INCIDENT */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs animate-in fade-in zoom-in-95">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mb-5">
            <SearchCode className="h-7 w-7" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Step 1: Identify Suspect Material
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Enter the suspect lot number to calculate downstream production, warehouse inventory, and customer exposure without altering operational data.
          </p>

          <div className="mt-8 text-left space-y-3">
            <label className="text-2xs font-bold uppercase tracking-wider text-slate-600 block">
              Suspect Lot Identifier
            </label>
            <div className="relative">
              <input
                type="text"
                value={targetLot}
                onChange={(e) => setTargetLot(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && simulateRecall()}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 py-3.5 px-4 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                placeholder="e.g. RAW-1042"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded bg-white px-2 py-0.5 text-3xs font-mono font-bold text-slate-500 border border-slate-200 shadow-2xs">
                LOT ID
              </span>
            </div>

            {/* Examples */}
            <div className="flex flex-wrap gap-2 pt-1 text-2xs">
              <span className="text-slate-500 text-3xs uppercase font-semibold self-center">Example:</span>
              <button
                type="button"
                onClick={() => setTargetLot('RAW-1042')}
                className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800 font-mono font-medium hover:bg-amber-100"
              >
                RAW-1042 (Defective Solvent)
              </button>
              <button
                type="button"
                onClick={() => setTargetLot('FG-3001')}
                className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-800 font-mono font-medium hover:bg-teal-100"
              >
                FG-3001 (NutriShield)
              </button>
            </div>
          </div>

          <button
            onClick={simulateRecall}
            className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-xs"
          >
            <SearchCode className="h-4 w-4" />
            Calculate Downstream Exposure Impact
          </button>
        </div>
      )}

      {/* STEP 2: ANALYZE IMPACT */}
      {step === 2 && impact && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Target Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-3xs uppercase tracking-wider font-semibold text-slate-400">
                Suspect Target Scope
              </span>
              <h3 className="font-mono text-base font-bold text-slate-900 mt-0.5">
                {targetLot.toUpperCase()}
              </h3>
            </div>
            <button
              onClick={() => {
                setGlobalSearchTarget(targetLot);
                setActiveTab('traceability');
              }}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Inspect in Lot Genealogy →
            </button>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 border-t-4 border-t-red-600 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">
                Actionable Units (At Risk)
              </span>
              <p className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {exposure.fgQtyAtRisk.toLocaleString()}
              </p>
              <p className="mt-1 text-3xs text-red-600 font-medium">
                Warehouse inventory + in-transit freight
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 border-t-4 border-t-amber-500 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">
                Delivered Units
              </span>
              <p className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {exposure.fgQtyDelivered.toLocaleString()}
              </p>
              <p className="mt-1 text-3xs text-amber-700 font-medium">
                Requires formal customer recall notices
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 border-t-4 border-t-blue-500 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">
                Affected Customers
              </span>
              <p className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {exposure.customers}
              </p>
              <p className="mt-1 text-3xs text-blue-700 font-medium">
                Commercial healthcare & retail accounts
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 border-t-4 border-t-slate-700 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">
                Est. Financial Exposure
              </span>
              <p className="mt-2 text-3xl font-bold font-mono text-slate-900">
                ${exposure.financialExposure.toLocaleString()}
              </p>
              <p className="mt-1 text-3xs text-slate-500 font-medium">
                Estimated @ $125/unit standard valuation
              </p>
            </div>
          </div>

          {/* Clean Tables for Production Orders & Shipments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Affected Production Orders */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-3">
                Affected Production Orders ({impact.pos.length})
              </h3>
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {impact.pos.map((poId) => {
                  const po = db.productionOrders.find((p) => p.id === poId);
                  return (
                    <div
                      key={poId}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">{poId}</span>
                        <span className="text-slate-500 text-2xs block mt-0.5">
                          Output: <strong className="text-blue-700 font-mono">{po?.outputLot}</strong> ({po?.productName})
                        </span>
                      </div>
                      <Badge status="WARNING" size="sm">Contaminated</Badge>
                    </div>
                  );
                })}
                {impact.pos.length === 0 && (
                  <p className="text-slate-400 text-xs italic py-4">No production orders impacted.</p>
                )}
              </div>
            </div>

            {/* Affected Shipments */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3 mb-3">
                Exposed Customer Shipments ({impact.shipments.length})
              </h3>
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {impact.shipments.map((shpId) => {
                  const shp = db.shipments.find((s) => s.id === shpId);
                  const cust = db.customers.find((c) => c.id === shp?.customerId);
                  return (
                    <div
                      key={shpId}
                      className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50/40 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{cust?.name}</span>
                        <span className="text-slate-500 text-2xs block mt-0.5 font-mono">
                          Shipment {shpId} · {shp?.qty} units ({shp?.carrier})
                        </span>
                      </div>
                      <Badge status={shp?.status || 'OK'} size="sm">{shp?.status}</Badge>
                    </div>
                  );
                })}
                {impact.shipments.length === 0 && (
                  <p className="text-slate-400 text-xs italic py-4">No customer shipments impacted.</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
            >
              Review Action Plan
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: AUTHORIZE ACTION */}
      {step === 3 && impact && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 max-w-2xl mx-auto shadow-xs space-y-6 animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 shrink-0">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Step 3: Executive Quarantine Authorization
              </h2>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Authorizing containment will atomically update the database. Affected warehouse inventory will transition to <strong className="text-red-700 bg-red-50 px-1 py-0.5 rounded font-mono border border-red-200">QUARANTINED</strong>, preventing dispatch. Active transit shipments will update to <strong className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded font-mono border border-amber-200">HOLD</strong>.
              </p>
            </div>
          </div>

          {/* Action Plan Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-xs space-y-3">
            <div className="text-slate-400 border-b border-slate-200 pb-2 text-3xs font-sans uppercase font-bold tracking-wider">
              Action Plan Execution Summary
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Target Defect Lot:</span>
              <span className="text-red-700 font-bold">{targetLot.toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Downstream Lots to Lock:</span>
              <span className="text-slate-900 font-bold">{impact.fgLots.length} finished goods</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Warehouse Inventory Locations:</span>
              <span className="text-slate-900 font-bold">{impact.inventory.length} bays</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Customer Notices Required:</span>
              <span className="text-slate-900 font-bold">{impact.customers.length} commercial accounts</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              Back to Review
            </button>
            <button
              onClick={handleExecuteRequest}
              className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white hover:bg-red-700 shadow-xs"
            >
              AUTHORIZE & EXECUTE
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: COMPREHENSIVE RECONCILIATION REPORT */}
      {step === 4 && impact && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          {/* Quick Header Bar with Backspace Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200 shadow-xs">
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:border-slate-400 transition-all shadow-2xs group"
              title="Go back to previous step (Shortcut: Backspace)"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Authorization (Step 3)</span>
              <kbd className="hidden sm:inline-block rounded bg-white border border-slate-300 px-1.5 py-0.5 text-3xs font-mono text-slate-600 shadow-2xs">
                ⌫ Backspace
              </kbd>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Reconciliation Report</span>
              <span>·</span>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
              >
                Exit to Overview →
              </button>
            </div>
          </div>

          {/* Action Notification Toast */}
          {actionToast && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                {actionToast}
              </span>
              <button
                onClick={() => setActionToast(null)}
                className="text-emerald-700 hover:text-emerald-900 text-2xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Top Outcome / Quarantine Banner */}
          {db.auditEvents.some((e) => e.action === 'RECALL_EXECUTED' && e.target === targetLot) ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold shrink-0 shadow-sm">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-3xs font-extrabold uppercase px-2 py-0.5">
                      Protocol Active
                    </span>
                    <h3 className="text-base font-bold text-emerald-950 tracking-tight">
                      Quarantine Protocol Executed Successfully
                    </h3>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Affected warehouse stock is electronically locked against dispatch in WMS. In-transit shipments are intercepted on hold, and customer quarantine notices are dispatched.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs"
                  title="Download complete JSON audit bundle"
                >
                  <Download className="h-4 w-4" />
                  JSON Report
                </button>
                <button
                  onClick={downloadCsvReport}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-xs"
                  title="Export multi-section CSV report"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV Export
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold shrink-0 shadow-sm">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="rounded-full bg-blue-100 text-blue-800 text-3xs font-extrabold uppercase px-2 py-0.5">
                      Pre-Quarantine Preview
                    </span>
                    <h3 className="text-base font-bold text-blue-950 tracking-tight">
                      Live Quantity Reconciliation & Hold Staging Preview
                    </h3>
                  </div>
                  <p className="text-xs text-blue-800">
                    Physical inventory vs dispatch records calculated. You can authorize quarantine now or review data points below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExecuteRequest}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors shadow-xs"
                >
                  <Lock className="h-4 w-4" />
                  Authorize Quarantine Now
                </button>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors shadow-2xs"
                >
                  <Download className="h-4 w-4" />
                  JSON
                </button>
                <button
                  onClick={downloadCsvReport}
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors shadow-2xs"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </button>
              </div>
            </div>
          )}

          {/* 5 Summary Reconciliation Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">Affected Batches</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">
                {impact.rawLots.length + impact.fgLots.length} <span className="text-xs font-sans text-slate-500 font-normal">lots</span>
              </p>
              <span className="text-3xs text-slate-400 mt-1 block">
                {impact.rawLots.length} Raw · {impact.fgLots.length} Finished
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">Quarantined Stock</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">
                {impact.inventory.reduce((sum, id) => sum + (db.inventory.find((i) => i.id === id)?.qty || 0), 0).toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
              </p>
              <span className="text-3xs text-red-600 mt-1 block font-semibold">
                Across {impact.inventory.length} warehouse bays
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">In-Transit Intercepts</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">
                {impact.shipments
                  .map((id) => db.shipments.find((s) => s.id === id))
                  .filter((s) => s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT)
                  .reduce((sum, s) => sum + (s?.qty || 0), 0).toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
              </p>
              <span className="text-3xs text-amber-600 mt-1 block font-semibold">
                {impact.shipments.filter((id) => {
                  const s = db.shipments.find((shp) => shp.id === id);
                  return s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT;
                }).length} carrier holds
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">Pending Customer Actions</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-1">
                {impact.customers.length} <span className="text-xs font-sans text-slate-500 font-normal">accounts</span>
              </p>
              <span className="text-3xs text-blue-600 mt-1 block font-semibold">
                {impact.shipments.filter((id) => db.shipments.find((s) => s.id === id)?.status === STATUS.DELIVERED).length} consignee notices
              </span>
            </div>

            {/* Validation Step Summary Card */}
            <div className={`rounded-2xl border p-4 shadow-xs ${
              validationStep?.hasQuantityDiscrepancy
                ? 'border-amber-300 bg-amber-50/50'
                : 'border-emerald-200 bg-emerald-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">Registry Cross-Check</span>
                {validationStep?.hasQuantityDiscrepancy ? (
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <p className={`text-sm sm:text-base font-extrabold mt-1 tracking-tight ${
                validationStep?.hasQuantityDiscrepancy ? 'text-red-700' : 'text-emerald-800'
              }`}>
                {validationStep?.hasQuantityDiscrepancy ? 'Quantity Discrepancy' : 'Verified Balanced'}
              </p>
              <span className={`text-3xs font-semibold mt-1 block font-mono ${
                validationStep?.hasQuantityDiscrepancy ? 'text-amber-800 font-bold' : 'text-emerald-700'
              }`}>
                {validationStep?.hasQuantityDiscrepancy
                  ? `${Math.abs(validationStep.totalDiscrepancyDelta).toLocaleString()} units variance`
                  : '0 Delta · 100% Reconciled'}
              </span>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
            <button
              onClick={() => setReconciliationTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                reconciliationTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setReconciliationTab('validation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                reconciliationTab === 'validation'
                  ? 'bg-blue-600 text-white'
                  : validationStep?.hasQuantityDiscrepancy
                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Registry Validation</span>
              {validationStep?.hasQuantityDiscrepancy ? (
                <span className="rounded bg-red-600 text-white px-1.5 py-0.2 text-3xs font-extrabold">
                  ⚠️ Discrepancy
                </span>
              ) : (
                <span className="rounded bg-emerald-600 text-white px-1.5 py-0.2 text-3xs font-extrabold">
                  ✓ Verified
                </span>
              )}
            </button>
            <button
              onClick={() => setReconciliationTab('lots')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                reconciliationTab === 'lots'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Affected Lots ({impact.rawLots.length + impact.fgLots.length})
            </button>
            <button
              onClick={() => setReconciliationTab('stock')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                reconciliationTab === 'stock'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Quarantined Stock ({impact.inventory.length} bays)
            </button>
            <button
              onClick={() => setReconciliationTab('customers')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                reconciliationTab === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Pending Customer Actions ({impact.customers.length})
            </button>
            <button
              onClick={() => setReconciliationTab('balance')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                reconciliationTab === 'balance'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Quantity & Material Balance
            </button>
          </div>

          {/* SECTION 0: MASTER REGISTRY CROSS-REFERENCE VALIDATION STEP */}
          {(reconciliationTab === 'all' || reconciliationTab === 'validation') && validationStep && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-0">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded bg-indigo-100 text-indigo-800 text-3xs font-extrabold uppercase px-2 py-0.5 font-mono">
                      Validation Step
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      Master Registry Cross-Reference Audit
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Cross-referencing recall's Affected Inventory state against Master Registry baseline quantities.
                  </p>
                </div>

                {/* Prominent Quantity Discrepancy Indicator Badge */}
                {validationStep.hasQuantityDiscrepancy ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse shrink-0" />
                    <div>
                      <span className="text-3xs uppercase font-extrabold tracking-wider block text-amber-700">Audit Finding</span>
                      <span className="text-xs font-black tracking-tight text-red-700">Quantity Discrepancy</span>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-2xs">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-3xs uppercase font-extrabold tracking-wider block text-emerald-700">Audit Finding</span>
                      <span className="text-xs font-black tracking-tight text-emerald-800">Master Registry Verified</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity Discrepancy Indicator Banner if Discrepancy Exists */}
              {validationStep.hasQuantityDiscrepancy ? (
                <div className="p-5 bg-gradient-to-r from-amber-50/90 via-red-50/40 to-amber-50/90 border-b border-amber-200">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white font-bold shrink-0 shadow-xs mt-0.5">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-600 text-white text-3xs font-black uppercase px-2.5 py-0.5 shadow-2xs flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                          Quantity Discrepancy
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {Math.abs(validationStep.totalDiscrepancyDelta).toLocaleString()} units variance between Master Registry and Expected Records
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Total recalled volume recorded in the Master Registry (<strong className="text-slate-900 font-mono">{validationStep.totalRecalledUnits.toLocaleString()} units</strong>) does not equal the expected sum of warehouse inventory (<strong className="text-slate-900 font-mono">{validationStep.totalWarehouseRecords.toLocaleString()} units</strong>) and in-transit records (<strong className="text-slate-900 font-mono">{validationStep.totalInTransitRecords.toLocaleString()} units</strong>).
                        {validationStep.totalDeliveredUnits > 0 && (
                          <span className="block mt-1 text-slate-600">
                            <strong>Root Cause Breakdown:</strong> <strong className="font-mono text-blue-700">{validationStep.totalDeliveredUnits.toLocaleString()} units</strong> have already been released into commercial customer accounts, creating an internal hold delta requiring consignee quarantine affidavits.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Visual Quantity Comparison Bar */}
                  <div className="mt-4 pt-3.5 border-t border-amber-200/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white/90 rounded-xl p-3 border border-amber-200 shadow-2xs">
                      <span className="text-3xs uppercase font-bold text-slate-500 block">Master Registry Total</span>
                      <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                        {validationStep.totalRecalledUnits.toLocaleString()} <span className="text-3xs font-sans text-slate-500 font-normal">units</span>
                      </p>
                    </div>
                    <div className="bg-white/90 rounded-xl p-3 border border-amber-200 shadow-2xs">
                      <span className="text-3xs uppercase font-bold text-slate-500 block">Expected Sum (Whse + Transit)</span>
                      <p className="text-base font-extrabold text-amber-900 font-mono mt-0.5">
                        {validationStep.totalExpectedSum.toLocaleString()} <span className="text-3xs font-sans text-slate-500 font-normal">units</span>
                      </p>
                    </div>
                    <div className="bg-white/90 rounded-xl p-3 border border-amber-200 shadow-2xs">
                      <span className="text-3xs uppercase font-bold text-slate-500 block">Discrepancy Delta</span>
                      <p className="text-base font-extrabold text-red-700 font-mono mt-0.5">
                        {validationStep.totalDiscrepancyDelta > 0 ? `-${validationStep.totalDiscrepancyDelta.toLocaleString()}` : `+${Math.abs(validationStep.totalDiscrepancyDelta).toLocaleString()}`} <span className="text-3xs font-sans text-slate-500 font-normal">units</span>
                      </p>
                    </div>
                    <div className="bg-white/90 rounded-xl p-3 border border-amber-200 shadow-2xs">
                      <span className="text-3xs uppercase font-bold text-slate-500 block">Customer In-Market Units</span>
                      <p className="text-base font-extrabold text-blue-700 font-mono mt-0.5">
                        {validationStep.totalDeliveredUnits.toLocaleString()} <span className="text-3xs font-sans text-slate-500 font-normal">units</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-900">
                    <strong>100% Balanced:</strong> Total recalled units in the Master Registry exactly match the expected sum of warehouse stock and in-transit freight records. Zero unverified variance detected.
                  </p>
                </div>
              )}

              {/* Lot-by-Lot Cross-Reference Verification Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-5">Finished Good Lot</th>
                      <th className="py-3 px-5">Master Registry Qty</th>
                      <th className="py-3 px-5">Warehouse Quarantined</th>
                      <th className="py-3 px-5">In-Transit Freight Holds</th>
                      <th className="py-3 px-5">Expected Sum (Whse + Transit)</th>
                      <th className="py-3 px-5">Variance</th>
                      <th className="py-3 px-5">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {validationStep.fgLotDetails.map((lot) => (
                      <tr key={lot.lotId} className={lot.hasQuarantineDiscrepancy ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/60'}>
                        <td className="py-3 px-5 font-sans">
                          <span className="font-bold text-slate-900 font-mono text-xs block">{lot.lotId}</span>
                          <span className="text-3xs text-slate-500">{lot.productName}</span>
                        </td>
                        <td className="py-3 px-5 text-slate-900 font-bold">
                          {lot.masterProducedQty.toLocaleString()} {lot.uom}
                        </td>
                        <td className="py-3 px-5 text-slate-700">
                          {lot.warehouseQty.toLocaleString()} {lot.uom}
                        </td>
                        <td className="py-3 px-5 text-slate-700">
                          {lot.inTransitQty.toLocaleString()} {lot.uom}
                        </td>
                        <td className="py-3 px-5 text-slate-900 font-bold">
                          {lot.expectedSumWarehouseInTransit.toLocaleString()} {lot.uom}
                        </td>
                        <td className="py-3 px-5 font-sans">
                          {lot.deltaQuarantine !== 0 ? (
                            <span className="text-red-700 font-bold">
                              {lot.deltaQuarantine > 0 ? `-${lot.deltaQuarantine.toLocaleString()}` : `+${Math.abs(lot.deltaQuarantine).toLocaleString()}`} {lot.uom}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold">0 {lot.uom} (Match)</span>
                          )}
                        </td>
                        <td className="py-3 px-5 font-sans">
                          {lot.hasQuarantineDiscrepancy ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-3xs font-extrabold border border-amber-300">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Quantity Discrepancy
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-3xs font-extrabold border border-emerald-300">
                              <Check className="h-3 w-3 text-emerald-600" />
                              Registry Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 1: AFFECTED LOTS LEDGER */}
          {(reconciliationTab === 'all' || reconciliationTab === 'lots') && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    1. Affected Lots Ledger
                  </h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Implicated raw material intake batches and downstream compounding runs.
                  </p>
                </div>
                <span className="text-3xs font-mono font-bold text-slate-500">
                  Target: {targetLot.toUpperCase()}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-5">Lot ID</th>
                      <th className="py-3 px-5">Category</th>
                      <th className="py-3 px-5">Product Description</th>
                      <th className="py-3 px-5">Source / PO Facility</th>
                      <th className="py-3 px-5">Batch Volume</th>
                      <th className="py-3 px-5">Quarantine Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {/* Raw Lots */}
                    {impact.rawLots.map((id) => {
                      const lot = db.lots.find((l) => l.id === id);
                      const sup = db.suppliers.find((s) => s.id === lot?.supplierId);
                      const isTarget = id === targetLot.toUpperCase();
                      return (
                        <tr key={id} className={isTarget ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
                          <td className="py-3 px-5">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              {id}
                              {isTarget && (
                                <span className="rounded bg-red-600 text-white text-3xs px-1.5 py-0.2 font-sans font-extrabold">
                                  TARGET DEFECT
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-5 font-sans">
                            <span className="rounded bg-slate-100 text-slate-700 text-3xs px-2 py-0.5 font-bold">
                              Raw Material
                            </span>
                          </td>
                          <td className="py-3 px-5 font-sans text-slate-700 font-medium">
                            {lot?.name || 'Raw Material Lot'}
                          </td>
                          <td className="py-3 px-5 font-sans text-slate-600 text-2xs">
                            {sup?.name || 'Approved Supplier'} ({sup?.country || 'Origin'})
                          </td>
                          <td className="py-3 px-5 text-slate-800 font-semibold">
                            {lot?.qty.toLocaleString()} {lot?.uom}
                          </td>
                          <td className="py-3 px-5 font-sans">
                            <Badge status={lot?.status === STATUS.QUARANTINED ? 'CRITICAL' : lot?.status === STATUS.WARNING ? 'WARNING' : 'OK'} size="sm">
                              {lot?.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Finished Goods Lots */}
                    {impact.fgLots.map((id) => {
                      const lot = db.lots.find((l) => l.id === id);
                      const po = db.productionOrders.find((p) => p.outputLot === id);
                      return (
                        <tr key={id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-5 font-bold text-slate-900">
                            {id}
                          </td>
                          <td className="py-3 px-5 font-sans">
                            <span className="rounded bg-blue-50 text-blue-700 text-3xs px-2 py-0.5 font-bold border border-blue-200">
                              Finished Product
                            </span>
                          </td>
                          <td className="py-3 px-5 font-sans text-slate-700 font-medium">
                            {lot?.name || 'Finished Product Lot'}
                          </td>
                          <td className="py-3 px-5 font-sans text-slate-600 text-2xs">
                            {po?.facility || 'Plant Delta (Austin, TX)'} · <span className="font-mono font-semibold">{po?.id}</span>
                          </td>
                          <td className="py-3 px-5 text-slate-800 font-semibold">
                            {lot?.qty.toLocaleString()} {lot?.uom}
                          </td>
                          <td className="py-3 px-5 font-sans">
                            <Badge status={lot?.status === STATUS.QUARANTINED ? 'CRITICAL' : 'OK'} size="sm">
                              {lot?.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 2: QUARANTINED STOCK & IN-TRANSIT HOLDS */}
          {(reconciliationTab === 'all' || reconciliationTab === 'stock') && (
            <div className="space-y-4">
              {/* Warehouse Inventory Quarantine Table */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <WarehouseIcon className="h-4 w-4 text-emerald-600" />
                      2. Physical Warehouse Stock Quarantined
                    </h3>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      On-hand inventory electronically flagged with WMS dispatch locks.
                    </p>
                  </div>
                  <Badge status="OK" size="sm">
                    {impact.inventory.length} Warehouse Locations
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-5">Inventory ID</th>
                        <th className="py-3 px-5">Warehouse Facility</th>
                        <th className="py-3 px-5">Bay / Vault Location</th>
                        <th className="py-3 px-5">Implicated Lot</th>
                        <th className="py-3 px-5">Quarantined Qty</th>
                        <th className="py-3 px-5">WMS Lock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {impact.inventory.map((invId) => {
                        const inv = db.inventory.find((i) => i.id === invId);
                        const wh = db.warehouses.find((w) => w.id === inv?.warehouseId);
                        const lot = db.lots.find((l) => l.id === inv?.lotId);
                        const isQuarantined = inv?.status === STATUS.QUARANTINED;

                        return (
                          <tr key={invId} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {invId}
                            </td>
                            <td className="py-3 px-5 font-sans">
                              <span className="font-bold text-slate-800 block text-xs">{wh?.name || inv?.warehouseId}</span>
                              <span className="text-3xs text-slate-400">{wh?.location || 'Regional Depot'}</span>
                            </td>
                            <td className="py-3 px-5 font-sans">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
                                {inv?.bay || 'General Storage'}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span className="font-bold text-slate-900 block">{inv?.lotId}</span>
                              <span className="text-3xs text-slate-500 font-sans">{lot?.name}</span>
                            </td>
                            <td className="py-3 px-5 text-slate-900 font-bold">
                              {inv?.qty.toLocaleString()} {lot?.uom || 'units'}
                            </td>
                            <td className="py-3 px-5 font-sans">
                              {isQuarantined ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 text-red-800 text-3xs font-extrabold px-2.5 py-0.5 border border-red-200">
                                  <Lock className="h-3 w-3" />
                                  QUARANTINED / WMS LOCKED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 text-3xs font-extrabold px-2.5 py-0.5 border border-amber-200">
                                  STAGED FOR LOCK
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* In-Transit Holds Table */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-amber-600" />
                      In-Transit Freight Interceptions
                    </h3>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      Shipments in freight network placed on mandatory hold with carrier.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-5">Shipment ID</th>
                        <th className="py-3 px-5">Implicated Lot</th>
                        <th className="py-3 px-5">Freight Carrier</th>
                        <th className="py-3 px-5">Tracking Number</th>
                        <th className="py-3 px-5">Quantity on Hold</th>
                        <th className="py-3 px-5">Transit Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {impact.shipments
                        .map((shpId) => db.shipments.find((s) => s.id === shpId))
                        .filter((s) => s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT)
                        .map((shp) => (
                          <tr key={shp?.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {shp?.id}
                            </td>
                            <td className="py-3 px-5">
                              {shp?.lotId}
                            </td>
                            <td className="py-3 px-5 font-sans text-slate-700 font-medium">
                              {shp?.carrier || 'DHL TempAssure Express'}
                            </td>
                            <td className="py-3 px-5 text-blue-700 font-semibold">
                              {shp?.tracking || 'N/A'}
                            </td>
                            <td className="py-3 px-5 text-slate-900 font-bold">
                              {shp?.qty.toLocaleString()} units
                            </td>
                            <td className="py-3 px-5 font-sans">
                              {shp?.status === STATUS.HOLD ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 text-3xs font-extrabold px-2.5 py-0.5 border border-red-200">
                                  <Lock className="h-3 w-3" />
                                  HOLD / INTERCEPTED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-3xs font-extrabold px-2.5 py-0.5 border border-amber-200">
                                  IN-TRANSIT (PENDING HOLD)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {impact.shipments.filter((id) => {
                        const s = db.shipments.find((shp) => shp.id === id);
                        return s?.status === STATUS.HOLD || s?.status === STATUS.IN_TRANSIT;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic font-sans">
                            No in-transit freight shipments identified for this recall scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: PENDING CUSTOMER ACTIONS & CONSIGNEES */}
          {(reconciliationTab === 'all' || reconciliationTab === 'customers') && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    3. Pending Customer Actions & Commercial Consignees
                  </h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Finished product released into commerce requiring consignee quarantine affidavits and RMA return.
                  </p>
                </div>
                <span className="text-3xs font-bold text-slate-500 font-mono">
                  SLA: 24h Mandatory Acknowledgment
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-5">Consignee Account</th>
                      <th className="py-3 px-5">Primary Contact</th>
                      <th className="py-3 px-5">Delivered Lot & Qty</th>
                      <th className="py-3 px-5">Delivery Date</th>
                      <th className="py-3 px-5">Recall Status</th>
                      <th className="py-3 px-5">Regulatory Mandate</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {impact.shipments
                      .map((id) => db.shipments.find((s) => s.id === id))
                      .filter((s) => s?.status === STATUS.DELIVERED)
                      .map((shp) => {
                        const cust = db.customers.find((c) => c.id === shp?.customerId);
                        const isAcknowledged = shp?.recallStatus === 'ACKNOWLEDGED';

                        return (
                          <tr key={shp?.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-5">
                              <span className="font-bold text-slate-900 block text-xs">{cust?.name || shp?.customerId}</span>
                              <span className="text-3xs text-slate-400">{cust?.tier || 'Commercial Account'}</span>
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="font-medium text-slate-800 block text-2xs">{cust?.contact || 'Quality Officer'}</span>
                              <span className="text-3xs text-blue-600 font-mono">{cust?.email || 'qa@client.org'}</span>
                            </td>
                            <td className="py-3.5 px-5 font-mono">
                              <span className="font-bold text-slate-900">{shp?.lotId}</span>
                              <span className="text-3xs text-slate-500 block font-sans">
                                <strong>{shp?.qty.toLocaleString()}</strong> units
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-slate-600 text-2xs font-mono">
                              {shp?.date}
                            </td>
                            <td className="py-3.5 px-5">
                              {isAcknowledged ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-3xs font-extrabold px-2.5 py-0.5 border border-emerald-200">
                                  <ShieldCheck className="h-3 w-3" />
                                  ACKNOWLEDGED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-3xs font-extrabold px-2.5 py-0.5 border border-amber-200 animate-pulse">
                                  <Clock className="h-3 w-3" />
                                  NOTIFIED (PENDING)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-2xs text-slate-600 max-w-xs truncate" title="Quarantine stock on-site; confirm quarantine affidavit; return units under RMA-7701.">
                              Quarantine stock on-site; return RMA-7701
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {isAcknowledged ? (
                                <span className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                  <Check className="h-3 w-3" />
                                  Affidavit on File
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (shp?.id) {
                                      acknowledgeCustomerRecall(shp.id);
                                      setActionToast(`Customer response acknowledged: ${cust?.name} submitted quarantine affidavit.`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-2xs font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Confirm Affidavit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {impact.shipments.filter((id) => db.shipments.find((s) => s.id === id)?.status === STATUS.DELIVERED).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                          No commercial shipments have been delivered into commerce for this lot.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: QUANTITY & MATERIAL BALANCE RECONCILIATION */}
          {(reconciliationTab === 'all' || reconciliationTab === 'balance') && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Package className="h-4 w-4" />
                    </span>
                    4. Quantity Reconciliation & Material Balance Report
                  </h3>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Mathematical verification: <code className="font-mono text-slate-700 font-semibold">Produced Quantity</code> vs <code className="font-mono text-slate-700 font-semibold">(Warehouse Quarantined + Dispatched Shipments)</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    status={
                      db.auditEvents.some((e) => e.action === 'RECALL_EXECUTED' && e.target === targetLot)
                        ? 'OK'
                        : 'INFO'
                    }
                    size="sm"
                  >
                    {db.auditEvents.some((e) => e.action === 'RECALL_EXECUTED' && e.target === targetLot)
                      ? 'Quarantined State'
                      : 'Live Active State'}
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-5">Finished Good Lot</th>
                      <th className="py-3.5 px-5">Produced Qty</th>
                      <th className="py-3.5 px-5">Recorded Total</th>
                      <th className="py-3.5 px-5">Unreconciled Variance</th>
                      <th className="py-3.5 px-5">Reconciliation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {impact.fgLots.map((lotId) => {
                      const rec = validateLotQuantities(db, lotId);
                      if (!rec) return null;

                      return (
                        <tr key={lotId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900 block text-xs">{rec.lotId}</span>
                            <span className="text-3xs text-slate-500 font-sans">
                              {db.lots.find((l) => l.id === lotId)?.name || 'Finished Product'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-800 font-semibold">
                            {rec.producedQty.toLocaleString()} {rec.uom}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="font-bold text-slate-900">{rec.totalRecorded.toLocaleString()} {rec.uom}</span>
                            <div className="text-3xs text-slate-500 font-sans flex items-center gap-2 mt-0.5">
                              <span>Warehouse: <strong>{rec.inventoryQty}</strong></span>
                              <span>·</span>
                              <span>Shipped: <strong>{rec.shippedQty}</strong></span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 font-sans">
                            {rec.difference !== 0 ? (
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                rec.overAllocated ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200' : 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200'
                              }`}>
                                <AlertCircle className="h-3.5 w-3.5" />
                                {Math.abs(rec.difference)} {rec.uom} {rec.overAllocated ? 'over-allocated' : 'unreconciled'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle className="h-3.5 w-3.5" />
                                0 {rec.uom} (100% Reconciled)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 font-sans">
                            <Badge status={rec.status === 'RECONCILED' ? 'OK' : 'WARNING'} size="sm">
                              {rec.status.replace('_', ' ')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {impact.fgLots.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic font-sans">
                          No finished goods impacted by this incident.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Explanatory Footer */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-2xs text-slate-500 gap-2">
                <span>
                  Quantity validation formula: <code className="font-mono text-slate-700 font-bold">Difference = Produced - (Inventory + Shipped)</code>
                </span>
                <button
                  onClick={() => {
                    setGlobalSearchTarget('FG-4001');
                    setActiveTab('anomalies');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold"
                >
                  Inspect FG-4001 Over-Allocation Defect →
                </button>
              </div>
            </div>
          )}

          {/* Step 4 Navigation Bar with Backspace Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleGoBack}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-2xs group"
                title="Go back to previous step (Shortcut: Backspace)"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Authorization (Step 3)</span>
                <kbd className="hidden sm:inline-block rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-3xs font-mono text-slate-500">
                  ⌫ Backspace
                </kbd>
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Start New Recall Simulation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
