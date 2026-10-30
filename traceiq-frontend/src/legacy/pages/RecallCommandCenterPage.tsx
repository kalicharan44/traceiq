import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Truck,
  Building,
  Warehouse,
  FileSpreadsheet,
  AlertOctagon,
  DollarSign,
  Download,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { useSupplyChain, ImpactAnalysisResult } from '../context/SupplyChainContext';
import { StatusIndicator } from '../components/common/StatusBadge';
import { RecallRecord } from '../types/supplyChain';

interface RecallCommandCenterPageProps {
  initialTarget?: string | null;
  onNavigate: (page: string, targetLot?: string) => void;
}

export const RecallCommandCenterPage: React.FC<RecallCommandCenterPageProps> = ({
  initialTarget,
  onNavigate
}) => {
  const {
    analyzeRecallImpact,
    executeRecall,
    recallRecords,
    activeRecallTarget,
    setActiveRecallTarget
  } = useSupplyChain();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [targetInput, setTargetInput] = useState<string>(
    initialTarget || activeRecallTarget || 'RAW-9912'
  );
  const [impactData, setImpactData] = useState<ImpactAnalysisResult | null>(null);
  const [authorizedBy, setAuthorizedBy] = useState<string>('Dr. E. Vance (Chief Quality Officer)');
  const [reason, setReason] = useState<string>(
    'Critical Mass Balance Defect: Ghost quantity adulteration flag detected on constituent lot.'
  );
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [lastExecutedRecord, setLastExecutedRecord] = useState<RecallRecord | null>(null);

  useEffect(() => {
    if (initialTarget) {
      setTargetInput(initialTarget);
      const res = analyzeRecallImpact(initialTarget);
      setImpactData(res);
      if (res.isValid) {
        setCurrentStep(2);
      }
    } else {
      const res = analyzeRecallImpact('RAW-9912');
      setImpactData(res);
    }
  }, [initialTarget]);

  const handleRunAnalysis = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetInput.trim()) return;

    const res = analyzeRecallImpact(targetInput.trim());
    setImpactData(res);
    if (res.isValid) {
      setCurrentStep(2);
    }
  };

  const handleConfirmAuthorization = () => {
    if (!impactData || !impactData.isValid) return;

    const record = executeRecall(impactData.targetLotId, authorizedBy, reason);
    if (record) {
      setLastExecutedRecord(record);
      setShowConfirmModal(false);
      setCurrentStep(4);
      // Refresh impact data to reflect recalled status
      const updated = analyzeRecallImpact(impactData.targetLotId);
      setImpactData(updated);
    }
  };

  const steps = [
    { number: 1, title: 'Identify Incident', subtitle: 'Target lot verification' },
    { number: 2, title: 'Analyze Impact', subtitle: 'Downstream exposure' },
    { number: 3, title: 'Authorize Action', subtitle: 'WMS lock & quarantine' },
    { number: 4, title: 'Reconciliation', subtitle: 'Ledger report & holds' }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-mono flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            Recall Command Center
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Standard Operating Procedure (SOP-801): 4-step rapid containment, automated warehouse quarantine, and carrier halt execution.
          </p>
        </div>

        {/* Simulation Disclaimer */}
        <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-2xs text-slate-400">
          Local synthetic simulation · No live external freight APIs called
        </div>
      </div>

      {/* 4-Step Stepper Bar */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map((step) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            const isPending = currentStep < step.number;

            return (
              <div
                key={step.number}
                onClick={() => {
                  if (isCompleted || (step.number === 1) || (step.number === 2 && impactData?.isValid)) {
                    setCurrentStep(step.number as any);
                  }
                }}
                className={`relative flex items-center gap-3 rounded-lg border p-3 transition-all ${
                  isCurrent
                    ? 'border-cyan-500/60 bg-cyan-950/20 shadow-md shadow-cyan-950/30'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-950/10 cursor-pointer hover:border-emerald-500/50'
                    : 'border-slate-800/60 bg-slate-950/40 opacity-60'
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurrent
                      ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/50'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200 truncate">
                    {step.title}
                  </h4>
                  <p className="text-3xs text-slate-400 truncate">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: IDENTIFY INCIDENT */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Step 1: Identify Target Lot or Batch Run
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Input the suspect raw chemical lot, formulation production order, or finished commercial goods lot.
            </p>
          </div>

          <form onSubmit={handleRunAnalysis} className="max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Lot / Batch Identifier
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="e.g. RAW-9912, RAW-1042, FG-4401, PO-8815..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/90 py-2.5 pl-10 pr-4 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              {impactData && !impactData.isValid && (
                <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {impactData.errorMessage}
                </p>
              )}
            </div>

            {/* Supported Examples Pills */}
            <div className="space-y-1.5">
              <span className="text-2xs font-medium text-slate-400">
                Recommended Test Scenarios:
              </span>
              <div className="flex flex-wrap gap-2 text-2xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput('RAW-9912');
                    const res = analyzeRecallImpact('RAW-9912');
                    setImpactData(res);
                  }}
                  className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300 hover:bg-amber-500/20"
                >
                  RAW-9912 (Over-Allocated B-12)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput('FG-4401');
                    const res = analyzeRecallImpact('FG-4401');
                    setImpactData(res);
                  }}
                  className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20"
                >
                  FG-4401 (ImmunoBoost 500mg)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput('RAW-1042');
                    const res = analyzeRecallImpact('RAW-1042');
                    setImpactData(res);
                  }}
                  className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-300 hover:bg-cyan-500/20"
                >
                  RAW-1042 (Normal Peptide)
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-sm shadow-cyan-600/30"
              >
                Run Downstream Impact Analysis
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: ANALYZE IMPACT */}
      {currentStep === 2 && impactData && impactData.isValid && (
        <div className="space-y-6">
          {/* Target Banner */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">
                Target Entity Under Assessment
              </span>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2 mt-0.5">
                {impactData.targetLotId} — {impactData.targetName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-2xs text-slate-300 hover:bg-slate-700"
              >
                <ArrowLeft className="h-3 w-3" />
                Change Target
              </button>
              <button
                onClick={() => onNavigate('genealogy', impactData.targetLotId)}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-2xs font-medium text-cyan-300 hover:bg-cyan-500/20"
              >
                Inspect in Genealogy
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Already Recalled Warning */}
          {impactData.alreadyRecalled && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-500/15 p-4 flex items-center gap-3">
              <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0" />
              <div className="flex-1 text-xs">
                <span className="font-semibold text-rose-200">
                  Target Already Recalled: Active Quarantine Protocol in Place
                </span>
                <p className="text-2xs text-rose-300/80 mt-0.5">
                  Warehouse locks and shipment holds are already registered in the ledger. Duplicate authorization is blocked.
                </p>
              </div>
            </div>
          )}

          {/* High-Level Impact Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">
                On-Hand Units
              </span>
              <p className="mt-1 text-xl font-bold text-emerald-400 font-mono">
                {impactData.onHandUnits.toLocaleString()}
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">In regional warehouses</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">
                In-Transit Units
              </span>
              <p className="mt-1 text-xl font-bold text-amber-400 font-mono">
                {impactData.inTransitUnits.toLocaleString()}
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Carrier holdable now</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">
                Delivered Units
              </span>
              <p className="mt-1 text-xl font-bold text-rose-400 font-mono">
                {impactData.deliveredUnits.toLocaleString()}
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Commercial retrieval required</p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
              <span className="text-3xs font-semibold uppercase tracking-wider text-slate-400">
                Est. Financial Exposure
              </span>
              <p className="mt-1 text-xl font-bold text-white font-mono">
                ${impactData.financialExposureUsd.toLocaleString()}
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Wholesale + reverse logistics</p>
            </div>
          </div>

          {/* Exposure Assumptions Explanation */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
            <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Financial Exposure Calculation Assumptions:
            </h4>
            <ul className="space-y-1 text-2xs text-slate-400 list-disc list-inside">
              {impactData.exposureAssumptions.map((assump, idx) => (
                <li key={idx}>{assump}</li>
              ))}
            </ul>
          </div>

          {/* Affected Shipments Table */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                <Truck className="h-4 w-4 text-cyan-400" />
                Affected Commercial Shipments ({impactData.shipmentRecords.length})
              </h3>
              <span className="text-2xs text-slate-400">
                Includes both active freight and delivered inventory
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-3xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Shipment ID</th>
                    <th className="py-2.5 px-4">Carrier & Tracking</th>
                    <th className="py-2.5 px-4">Customer Destination</th>
                    <th className="py-2.5 px-4 text-right">Units</th>
                    <th className="py-2.5 px-4">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {impactData.shipmentRecords.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-cyan-300">{s.id}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-300">
                        {s.carrier} ({s.trackingNumber})
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-300">
                        {s.customerName} ({s.destinationCity}, {s.destinationState})
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-100 font-bold">
                        {s.quantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <StatusIndicator status={s.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Navigation Footer */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              disabled={impactData.alreadyRecalled}
              onClick={() => setCurrentStep(3)}
              className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-semibold text-white transition-all shadow-md ${
                impactData.alreadyRecalled
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
              }`}
            >
              Proceed to Authorization
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: AUTHORIZE ACTION */}
      {currentStep === 3 && impactData && impactData.isValid && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-400" />
              Step 3: Executive Containment Authorization
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Review and sign off on the emergency quarantine execution plan. This applies electronic locks across WMS bays and carrier dispatch.
            </p>
          </div>

          {/* Quarantine Action Plan Summary */}
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Automated Containment Execution Protocol:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-2xs text-slate-300">
              <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <span className="font-semibold text-white block mb-1">
                  1. Warehouse (WMS) Lock:
                </span>
                Lock <strong className="font-mono text-emerald-300">{impactData.inventoryRecords.length} inventory locations</strong> ({impactData.onHandUnits.toLocaleString()} units) in WH-ATL-2 and WH-CHI-1.
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <span className="font-semibold text-white block mb-1">
                  2. Active Carrier Halt:
                </span>
                Issue EDI freight holds to UPS and DHL for <strong className="font-mono text-amber-300">{impactData.inTransitUnits.toLocaleString()} units</strong> in transit.
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <span className="font-semibold text-white block mb-1">
                  3. Commercial Retrieval:
                </span>
                Stage Class II recall notification packets for <strong className="font-mono text-rose-300">{impactData.affectedCustomers.length} distributor accounts</strong> ({impactData.deliveredUnits.toLocaleString()} delivered units).
              </div>
            </div>
          </div>

          {/* Signoff Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Authorizing Official (Title / Name)
              </label>
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Regulatory Justification / Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Impact
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-lg shadow-rose-950/60"
            >
              <ShieldAlert className="h-4 w-4" />
              Authorize Immediate Containment & Quarantine
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: RECONCILIATION REPORT */}
      {currentStep === 4 && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
          <div className="border-b border-slate-800 pb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-3xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Containment Protocol Executed
              </span>
              <h2 className="text-base font-bold text-white font-mono mt-0.5">
                Incident Reconciliation & Audit Ledger Record
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('audit')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-cyan-400" />
                View in Audit Ledger
              </button>
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Recall Incident
              </button>
            </div>
          </div>

          {/* Outcome Breakdown Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <span className="text-3xs uppercase tracking-wider text-slate-400">
                Status in Ledger
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-rose-400">
                ACTIVE RECALL
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">WMS Lock Broadcasted</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <span className="text-3xs uppercase tracking-wider text-slate-400">
                Quarantined Warehouse Stock
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-emerald-400">
                {impactData?.onHandUnits.toLocaleString()} units
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Electronically secured</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <span className="text-3xs uppercase tracking-wider text-slate-400">
                In-Transit Freight Holds
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-amber-400">
                {impactData?.inTransitUnits.toLocaleString()} units
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Carrier stop-orders active</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <span className="text-3xs uppercase tracking-wider text-slate-400">
                Commercial Retrieval Staged
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-rose-400">
                {impactData?.deliveredUnits.toLocaleString()} units
              </p>
              <p className="text-3xs text-slate-400 mt-0.5">Customer outreach pending</p>
            </div>
          </div>

          {/* Reconciliation Table */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Itemized Quarantine Reconciliation List:
            </h4>
            <div className="divide-y divide-slate-800/60 text-xs">
              {impactData?.inventoryRecords.map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-emerald-300">{inv.id}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-200">{inv.warehouseName}</span>
                    <span className="text-3xs text-slate-400 ml-2">({inv.bayLocation})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-300">{inv.quantity.toLocaleString()} {inv.unit}</span>
                    <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 text-3xs font-semibold">
                      QUARANTINED
                    </span>
                  </div>
                </div>
              ))}

              {impactData?.shipmentRecords.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-cyan-300">{s.id}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-200">{s.carrier} ({s.customerName})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-300">{s.quantity.toLocaleString()} units</span>
                    <span
                      className={`rounded px-2 py-0.5 text-3xs font-semibold border ${
                        s.status === 'In Transit' || s.status === 'Quarantine Hold'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {s.status === 'In Transit' || s.status === 'Quarantine Hold' ? 'FREIGHT HOLD' : 'RETRIEVAL STAGED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && impactData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-xl border border-rose-500/50 bg-slate-900 p-6 shadow-2xl shadow-rose-950/50 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Confirm Emergency Quarantine Execution
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are authorizing immediate recall protocol for target{' '}
              <strong className="font-mono text-cyan-300">{impactData.targetLotId}</strong>.
            </p>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-2xs space-y-1.5 text-slate-300">
              <div>• Total Compromised Units: <strong>{impactData.totalAffectedUnits.toLocaleString()} units</strong></div>
              <div>• Financial Exposure: <strong>${impactData.financialExposureUsd.toLocaleString()} USD</strong></div>
              <div>• Affected Distributors: <strong>{impactData.affectedCustomers.length} accounts</strong></div>
            </div>

            <p className="text-2xs text-slate-400">
              This action will immediately lock warehouse bays in the WMS, register audit records, and flag shipments for freight halts.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAuthorization}
                className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-950/60"
              >
                Confirm Authorization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
