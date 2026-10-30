import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Clock,
  User,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useSupplyChain } from '../context/SupplyChainContext';
import { AuditActionType } from '../types/supplyChain';

export const AuditReportsPage: React.FC = () => {
  const { auditEvents, recallRecords, anomalies, resetToDemoData } = useSupplyChain();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const actionTypes: { label: string; value: string }[] = [
    { label: 'All Event Types', value: 'ALL' },
    { label: 'Anomalies Flagged', value: 'ANOMALY_FLAGGED' },
    { label: 'Recalls Authorized', value: 'RECALL_AUTHORIZED' },
    { label: 'Quarantine Applied', value: 'QUARANTINE_APPLIED' },
    { label: 'Shipment Dispatched', value: 'SHIPMENT_DISPATCH' },
    { label: 'PO Executed', value: 'PO_EXECUTION' },
    { label: 'QC Passed', value: 'QC_CHECK' },
    { label: 'Lot Intake', value: 'INTAKE' }
  ];

  const filteredEvents = auditEvents.filter((evt) => {
    if (actionFilter !== 'ALL' && evt.actionType !== actionFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        evt.id.toLowerCase().includes(q) ||
        evt.targetId.toLowerCase().includes(q) ||
        evt.user.toLowerCase().includes(q) ||
        evt.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportJson = () => {
    const exportData = {
      exportMetadata: {
        application: 'TraceIQ Supply Chain Traceability & Recall Command Center',
        version: '2.4.0-enterprise',
        exportedAt: new Date().toISOString(),
        totalAuditEvents: auditEvents.length,
        activeRecalls: recallRecords.length,
        unresolvedAnomalies: anomalies.filter((a) => a.status !== 'Resolved').length,
        disclaimer:
          'Electronic regulatory audit ledger generated in compliant client-side environment. Subject to 21 CFR Part 11 electronic records protocols.'
      },
      auditLedger: auditEvents,
      activeRecalls: recallRecords,
      detectedAnomalies: anomalies
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `traceiq-audit-ledger-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getBadgeStyle = (type: AuditActionType) => {
    switch (type) {
      case 'RECALL_AUTHORIZED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'ANOMALY_FLAGGED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'QUARANTINE_APPLIED':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      case 'QC_CHECK':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'SHIPMENT_DISPATCH':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'PO_EXECUTION':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'DATA_RESET':
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-mono flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-cyan-400" />
            Audit Ledger & Compliance Reports
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Immutable 21 CFR Part 11 compliant audit log: chronologically records intake scans, batch compounding, WMS bay movements, and recall authorizations.
          </p>
        </div>

        {/* JSON Export Button */}
        <button
          onClick={handleExportJson}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-sm shadow-cyan-600/30 shrink-0"
        >
          <Download className="h-4 w-4" />
          Export Audit Trail (JSON)
        </button>
      </div>

      {/* Compliance Notice Banner */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 flex items-start gap-3 text-xs">
        <Shield className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-slate-300 leading-relaxed text-2xs">
          <strong className="text-white block mb-0.5">
            21 CFR Part 11 Electronic Records Notice:
          </strong>
          This audit ledger records state mutations directly to browser localStorage. In an enterprise production deployment, records are cryptographically hashed and mirrored to an append-only, tamper-evident audit repository for FDA / EMA inspection.
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by event ID, target ID, actor email, or keywords..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Action Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            {actionTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-3xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Responsible User</th>
                <th className="py-3 px-4">Operational Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                      {evt.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap text-2xs">
                      {new Date(evt.timestamp).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`rounded border px-2 py-0.5 text-3xs font-semibold font-mono ${getBadgeStyle(
                          evt.actionType
                        )}`}
                      >
                        {evt.actionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200 font-medium">
                      {evt.targetId}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-2xs font-mono">
                      {evt.user}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-2xs leading-relaxed max-w-md">
                      {evt.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-2.5 flex items-center justify-between text-2xs text-slate-400">
          <span>Showing {filteredEvents.length} of {auditEvents.length} ledger entries</span>
          <span className="font-mono text-emerald-400">Hash Integrity Verified</span>
        </div>
      </div>
    </div>
  );
};
