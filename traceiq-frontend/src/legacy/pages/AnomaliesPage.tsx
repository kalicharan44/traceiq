import React from 'react';
import {
  AlertTriangle,
  FileWarning,
  Activity,
  ArrowRight,
  GitBranch,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Package,
  Layers
} from 'lucide-react';
import { useNexus, findMissingInputs, validateLotQuantities } from '../context/NexusContext';
import { Badge } from '../components/Badge';

export const AnomaliesPage: React.FC = () => {
  const { db, setActiveTab, setGlobalSearchTarget } = useNexus();

  const missingInputs = findMissingInputs(db);
  const fgLots = db.lots.filter((l) => l.type === 'FG');
  const overAllocatedLots = fgLots
    .map((l) => validateLotQuantities(db, l.id))
    .filter((r) => r && r.overAllocated);

  const totalAnomalies = missingInputs.length + overAllocatedLots.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Title & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            Anomaly Detection
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Review quality discrepancies seeded into the test dataset to verify reconciliation and traceability algorithms.
          </p>
        </div>

        <Badge status={totalAnomalies > 0 ? 'WARNING' : 'OK'} size="md">
          {totalAnomalies} Detected Issues
        </Badge>
      </div>

      {/* Clean List of Anomalies */}
      <div className="space-y-4">
        {/* ANOMALY 1: BROKEN TRACEABILITY LINK */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200">
                <FileWarning className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Broken Traceability Link: Unregistered Input Lot
                </h3>
                <span className="text-2xs text-slate-500 font-mono">
                  Affected Entity: Production Order PO-9999 · Yields FG-4001
                </span>
              </div>
            </div>
            <Badge status="CRITICAL" size="sm">Traceability Broken</Badge>
          </div>

          {/* Expected vs Observed in clean light panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1">
              <span className="font-bold text-emerald-800 text-3xs uppercase tracking-wider block">
                Expected Behavior
              </span>
              <p className="text-slate-700 leading-relaxed">
                All production order inputs must trace to registered raw material lots with valid supplier intake and certificate of analysis (COA) records.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-1">
              <span className="font-bold text-red-800 text-3xs uppercase tracking-wider block">
                Observed Behavior
              </span>
              <p className="text-slate-700 leading-relaxed">
                PO-9999 consumed 100 kg of lot <code className="font-mono font-bold text-red-700 bg-red-100/70 px-1 py-0.5 rounded">RAW-MISSING</code>, which does not exist in the ERP database.
              </p>
            </div>
          </div>

          <p className="text-2xs text-slate-500">
            <strong>Regulatory Standard:</strong> 21 CFR Part 211.186 (Master Production and Control Records).
          </p>

          {/* Contextual Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setGlobalSearchTarget('PO-9999');
                setActiveTab('traceability');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <GitBranch className="h-4 w-4 text-blue-600" />
              Trace Entity in Lot Genealogy
            </button>

            <button
              onClick={() => {
                setGlobalSearchTarget('FG-4001');
                setActiveTab('recall');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <ShieldAlert className="h-4 w-4" />
              Review Recall Impact for FG-4001
            </button>
          </div>
        </div>

        {/* ANOMALY 2: QUANTITY OVER-ALLOCATION */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Quantity Discrepancy: Commercial Over-Allocation
                </h3>
                <span className="text-2xs text-slate-500 font-mono">
                  Affected Entity: Finished Good FG-4001 · Shipment SHP-003
                </span>
              </div>
            </div>
            <Badge status="WARNING" size="sm">Quantity Mismatch</Badge>
          </div>

          {/* Expected vs Observed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1">
              <span className="font-bold text-emerald-800 text-3xs uppercase tracking-wider block">
                Expected Behavior
              </span>
              <p className="text-slate-700 leading-relaxed">
                The total recorded inventory plus shipped units cannot exceed the produced quantity recorded at manufacturing completion.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1">
              <span className="font-bold text-amber-800 text-3xs uppercase tracking-wider block">
                Observed Behavior
              </span>
              <p className="text-slate-700 leading-relaxed">
                FG-4001 produced 200 units on PO-9999, but shipment <code className="font-mono font-bold text-amber-800 bg-amber-100/70 px-1 py-0.5 rounded">SHP-003</code> delivered 500 units to Gamma Healthcare (+300 units discrepancy).
              </p>
            </div>
          </div>

          <p className="text-2xs text-slate-500">
            <strong>Root Cause:</strong> Reconciles to line split or manual barcode override during outbound shipping.
          </p>

          {/* Contextual Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setGlobalSearchTarget('FG-4001');
                setActiveTab('traceability');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <GitBranch className="h-4 w-4 text-blue-600" />
              Trace Distribution History
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Analyze with AI Investigator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
