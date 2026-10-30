import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useSupplyChain } from '../context/SupplyChainContext';
import { StatusIndicator } from '../components/common/StatusBadge';
import { Anomaly, AnomalyStatus } from '../types/supplyChain';

interface AnomalyDetectionPageProps {
  onNavigate: (page: string, targetLot?: string) => void;
}

export const AnomalyDetectionPage: React.FC<AnomalyDetectionPageProps> = ({ onNavigate }) => {
  const { anomalies, updateAnomalyStatus, rawLots, finishedLots } = useSupplyChain();
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'Critical' | 'Warning'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Unresolved' | 'Investigating' | 'Resolved'>('ALL');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(anomalies[0] || null);

  const criticalCount = anomalies.filter((a) => a.severity === 'Critical' && a.status !== 'Resolved').length;
  const investigatingCount = anomalies.filter((a) => a.status === 'Investigating').length;
  const resolvedCount = anomalies.filter((a) => a.status === 'Resolved').length;

  const verifiedChecks = [
    {
      check: 'BOM Mass Balance Validation',
      target: 'RAW-1042',
      status: 'Passed (0.00% Variance)',
      details: 'Intake 2,500 kg matches consumption across PO-8801 and PO-8804.'
    },
    {
      check: 'Cold Chain Stability Log',
      target: 'FG-2002',
      status: 'Passed (2-8°C Continuous)',
      details: 'Vault-C01 temperature verified within ±0.2°C limits over 14 days.'
    },
    {
      check: 'Supplier Certificate of Analysis',
      target: 'RAW-2089',
      status: 'Passed (Ph.Eur Purity 98.7%)',
      details: 'Terra Nutra Botanicals COA cryptographically validated with digital seal.'
    }
  ];

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-mono flex items-center gap-2">
            <AlertOctagon className="h-6 w-6 text-rose-500" />
            Quality Anomaly Engine
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Autonomous multi-point verification engine: audits bill-of-materials integrity, physical mass balance, and WMS custody rules.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-2xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-slate-300 font-medium">{criticalCount} Critical Unresolved</span>
          </div>
        </div>
      </div>

      {/* Verification Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wider text-rose-300">
            <span>Critical Integrity Flags</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            {criticalCount}
          </p>
          <p className="mt-1 text-2xs text-rose-200/80">
            Requires immediate quarantine authorization or trace inspection
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wider text-amber-300">
            <span>Active Investigations</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            {investigatingCount}
          </p>
          <p className="mt-1 text-2xs text-amber-200/80">
            Under QA laboratory evaluation or supplier audit response
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wider text-emerald-300">
            <span>Verified Healthy Checks</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white font-mono">
            {verifiedChecks.length + resolvedCount}
          </p>
          <p className="mt-1 text-2xs text-emerald-200/80">
            Zero-variance mass balance and verified cold-chain logs
          </p>
        </div>
      </div>

      {/* Main Split Layout: Anomalies List & Detailed Inspection Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Anomaly Entries (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Filter Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-2xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Detected Anomalies ({filteredAnomalies.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterStatus(filterStatus === 'ALL' ? 'Unresolved' : 'ALL')}
                className={`rounded border px-2 py-0.5 transition-colors ${
                  filterStatus === 'Unresolved'
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                {filterStatus === 'Unresolved' ? 'Unresolved Only' : 'Show All'}
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredAnomalies.map((anom) => {
              const isSelected = selectedAnomaly?.id === anom.id;

              return (
                <div
                  key={anom.id}
                  onClick={() => setSelectedAnomaly(anom)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 ${
                    isSelected
                      ? 'border-rose-500/60 bg-slate-900/90 shadow-lg shadow-rose-950/20'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-400">
                      {anom.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider ${
                        anom.status === 'Resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : anom.status === 'Investigating'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {anom.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-xs font-semibold text-slate-100">
                    {anom.title}
                  </h3>

                  <p className="mt-1 text-2xs text-slate-400 line-clamp-2">
                    {anom.observedBehavior}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-3xs text-slate-400 font-mono">
                    <span>Target: <strong className="text-cyan-300">{anom.affectedEntityId}</strong></span>
                    <span>Type: {anom.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Anomaly Inspector & Action Center (7 cols) */}
        <div className="lg:col-span-7">
          {selectedAnomaly ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-6 backdrop-blur-md space-y-6">
              {/* Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-rose-400">
                      {selectedAnomaly.id}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 text-3xs font-bold uppercase">
                      {selectedAnomaly.severity} Severity
                    </span>
                  </div>
                  <h2 className="mt-1 text-sm font-bold text-white">
                    {selectedAnomaly.title}
                  </h2>
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
                  <button
                    onClick={() => updateAnomalyStatus(selectedAnomaly.id, 'Unresolved')}
                    className={`rounded px-2.5 py-1 text-3xs font-medium transition-colors ${
                      selectedAnomaly.status === 'Unresolved'
                        ? 'bg-rose-500/20 text-rose-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Unresolved
                  </button>
                  <button
                    onClick={() => updateAnomalyStatus(selectedAnomaly.id, 'Investigating')}
                    className={`rounded px-2.5 py-1 text-3xs font-medium transition-colors ${
                      selectedAnomaly.status === 'Investigating'
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Investigating
                  </button>
                  <button
                    onClick={() => updateAnomalyStatus(selectedAnomaly.id, 'Resolved')}
                    className={`rounded px-2.5 py-1 text-3xs font-medium transition-colors ${
                      selectedAnomaly.status === 'Resolved'
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Resolved
                  </button>
                </div>
              </div>

              {/* Behavior Comparison Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3.5 space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Expected Specification
                  </span>
                  <p className="text-slate-300 text-2xs leading-relaxed">
                    {selectedAnomaly.expectedBehavior}
                  </p>
                </div>

                <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-3.5 space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Observed Violation
                  </span>
                  <p className="text-slate-300 text-2xs leading-relaxed">
                    {selectedAnomaly.observedBehavior}
                  </p>
                </div>
              </div>

              {/* Root Cause & Risk */}
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-3xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Engineering Root Cause Analysis
                  </h4>
                  <p className="text-slate-300 bg-slate-950/70 rounded-lg p-3 border border-slate-800 leading-relaxed text-2xs">
                    {selectedAnomaly.rootCause}
                  </p>
                </div>

                <div>
                  <h4 className="text-3xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Downstream Risk & Regulatory Exposure
                  </h4>
                  <p className="text-rose-200/90 bg-rose-950/20 rounded-lg p-3 border border-rose-500/20 leading-relaxed text-2xs">
                    {selectedAnomaly.riskSummary}
                  </p>
                </div>
              </div>

              {/* Contextual Actions */}
              <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('genealogy', selectedAnomaly.affectedEntityId)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
                    Trace {selectedAnomaly.affectedEntityId} in Genealogy
                  </button>
                  <button
                    onClick={() => onNavigate('ai-investigation')}
                    className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3.5 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/20 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ask Copilot
                  </button>
                </div>

                <button
                  onClick={() => onNavigate('recall', selectedAnomaly.affectedEntityId)}
                  className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-all shadow-sm shadow-rose-950/50"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Open Recall Workflow
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400">
              Select an anomaly from the list to view forensic analysis.
            </div>
          )}
        </div>
      </div>

      {/* Verified Safe Baseline Checks Section */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4" />
          Autonomous Quality Control Baseline Verifications (Passed)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {verifiedChecks.map((v, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center justify-between text-2xs">
                <span className="font-mono text-cyan-300 font-bold">{v.target}</span>
                <span className="text-emerald-400 font-semibold">{v.status}</span>
              </div>
              <h4 className="mt-1 font-medium text-slate-200">{v.check}</h4>
              <p className="mt-0.5 text-3xs text-slate-400 leading-snug">{v.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
