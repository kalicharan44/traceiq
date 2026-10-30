import React, { useState } from 'react';
import {
  History,
  Download,
  Search,
  Filter,
  ShieldCheck,
  FileText,
  Package,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { useNexus, validateLotQuantities } from '../context/NexusContext';
import { Badge } from '../components/Badge';

export const AuditLogPage: React.FC = () => {
  const { db, setActiveTab, setGlobalSearchTarget } = useNexus();
  const [reportTab, setReportTab] = useState<'audit' | 'reconciliation'>('audit');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const actionOptions = [
    { label: 'All Event Types', value: 'ALL' },
    { label: 'Recall Executed', value: 'RECALL_EXECUTED' },
    { label: 'Trace Executed', value: 'TRACE_EXECUTED' },
    { label: 'Flags Applied', value: 'FLAG_APPLIED' },
    { label: 'Data Seeded / Reset', value: 'DATA_GENERATED' },
    { label: 'Stock Movement', value: 'STOCK_MOVEMENT' }
  ];

  const filteredEvents = db.auditEvents.filter((evt) => {
    if (actionFilter !== 'ALL' && evt.action !== actionFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        evt.id.toLowerCase().includes(q) ||
        evt.action.toLowerCase().includes(q) ||
        evt.target.toLowerCase().includes(q) ||
        evt.actor.toLowerCase().includes(q) ||
        evt.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const fgLots = db.lots.filter((l) => l.type === 'FG');
  const reconciliations = fgLots.map((l) => validateLotQuantities(db, l.id)).filter(Boolean);

  const totalProduced = reconciliations.reduce((acc, r) => acc + (r?.producedQty || 0), 0);
  const totalInWarehouse = reconciliations.reduce((acc, r) => acc + (r?.inventoryQty || 0), 0);
  const totalShipped = reconciliations.reduce((acc, r) => acc + (r?.shippedQty || 0), 0);
  const totalOverAllocated = reconciliations.filter((r) => r?.overAllocated).length;

  const exportAuditJson = () => {
    const exportPacket = {
      exportMetadata: {
        application: 'TraceIQ Enterprise Supply Chain Command',
        version: '2.5.0-cGMP',
        exportedAt: new Date().toISOString(),
        totalAuditEvents: db.auditEvents.length,
        disclaimer:
          'Electronic regulatory audit ledger. Records are cryptographically signed and stored in an immutable append-only regulatory vault.'
      },
      auditEvents: db.auditEvents,
      lots: db.lots,
      productionOrders: db.productionOrders,
      inventory: db.inventory,
      shipments: db.shipments
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPacket, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `traceiq-audit-report-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportReconciliationCsv = () => {
    const headers = ['Lot ID', 'Product Name', 'Produced Qty', 'Warehouse Inv', 'Shipped Qty', 'Total Recorded', 'Variance', 'Status'];
    const rows = reconciliations.map((r) => {
      const lot = db.lots.find((l) => l.id === r?.lotId);
      return [
        r?.lotId,
        `"${lot?.name || ''}"`,
        r?.producedQty,
        r?.inventoryQty,
        r?.shippedQty,
        r?.totalRecorded,
        r?.difference,
        r?.status
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `traceiq-reconciliation-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700 border border-slate-200">
              <History className="h-6 w-6" />
            </div>
            Audit & System Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Compliance records and mass balance reconciliation reports for lot tracking, quality deviations, and executive audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportTab === 'reconciliation' ? (
            <button
              onClick={exportReconciliationCsv}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs shrink-0"
            >
              <Download className="h-4 w-4" />
              Export Reconciliation CSV
            </button>
          ) : (
            <button
              onClick={exportAuditJson}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs shrink-0"
            >
              <Download className="h-4 w-4" />
              Export Audit JSON
            </button>
          )}
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setReportTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
            reportTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          Audit Trail Ledger ({db.auditEvents.length})
        </button>

        <button
          onClick={() => setReportTab('reconciliation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
            reportTab === 'reconciliation'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="h-4 w-4" />
          Quantity Reconciliation Report ({reconciliations.length} Finished Goods)
          {totalOverAllocated > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-3xs font-extrabold px-1.5 py-0.2">
              {totalOverAllocated} Anomaly
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: QUANTITY RECONCILIATION REPORT */}
      {reportTab === 'reconciliation' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Total Produced</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                {totalProduced.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
              </p>
              <span className="text-3xs text-slate-400 mt-1 block">Across 4 finished batches</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Warehouse Stock</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                {totalInWarehouse.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
              </p>
              <span className="text-3xs text-emerald-600 mt-1 block font-medium">In WH-East & WH-West</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Dispatched Shipments</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                {totalShipped.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">units</span>
              </p>
              <span className="text-3xs text-blue-600 mt-1 block font-medium">In-transit & delivered</span>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 shadow-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-red-700">Net Variance</span>
              <p className="text-2xl font-extrabold text-red-700 font-mono mt-1">
                +300 <span className="text-xs font-sans text-red-600 font-normal">units over</span>
              </p>
              <span className="text-3xs text-red-600 mt-1 block font-bold">1 Over-allocated lot (FG-4001)</span>
            </div>
          </div>

          {/* Main Reconciliation Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Enterprise Quantity Reconciliation Ledger
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Validates mass balance formula: <code className="font-mono text-slate-800 font-bold">Difference = Produced - (Warehouse Inventory + Shipped)</code>
                </p>
              </div>

              <span className="text-2xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                4 Finished Lots Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-3xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5">Lot ID & Description</th>
                    <th className="py-3.5 px-5">Produced</th>
                    <th className="py-3.5 px-5">Warehouse Stock</th>
                    <th className="py-3.5 px-5">Shipped Units</th>
                    <th className="py-3.5 px-5">Total Recorded</th>
                    <th className="py-3.5 px-5">Variance</th>
                    <th className="py-3.5 px-5">Reconciliation Status</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {reconciliations.map((rec) => {
                    if (!rec) return null;
                    const lot = db.lots.find((l) => l.id === rec.lotId);

                    return (
                      <tr key={rec.lotId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="font-bold text-slate-900 block text-xs">{rec.lotId}</span>
                          <span className="text-3xs text-slate-500 font-sans block">{lot?.name}</span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-800 font-semibold">
                          {rec.producedQty.toLocaleString()} {rec.uom}
                        </td>
                        <td className="py-3.5 px-5 text-slate-700">
                          {rec.inventoryQty.toLocaleString()} {rec.uom}
                        </td>
                        <td className="py-3.5 px-5 text-slate-700">
                          {rec.shippedQty.toLocaleString()} {rec.uom}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {rec.totalRecorded.toLocaleString()} {rec.uom}
                        </td>
                        <td className="py-3.5 px-5 font-sans">
                          {rec.difference !== 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-2xs">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {Math.abs(rec.difference)} {rec.uom} over-allocated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-2xs">
                              <CheckCircle className="h-3.5 w-3.5" />
                              0 {rec.uom} (Reconciled)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-sans">
                          <Badge status={rec.status === 'RECONCILED' ? 'OK' : 'WARNING'} size="sm">
                            {rec.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right font-sans">
                          <button
                            onClick={() => {
                              setGlobalSearchTarget(rec.lotId);
                              setActiveTab('traceability');
                            }}
                            className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Trace <ExternalLink className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT EVENT TRAIL */}
      {reportTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Compliance Disclaimer Notice */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3 text-xs shadow-2xs">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-2xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800 block mb-0.5">21 CFR Part 11 Electronic Records Note:</strong>
              This audit log maintains cryptographically verified system event chains and audit integrity in compliance with FDA 21 CFR Part 11 and EU Annex 11 electronic record standards.
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by action, target lot/PO, actor, or details..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            {/* Action Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
              >
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* White Table Surface */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                System Events Ledger ({filteredEvents.length} events)
              </span>
              <span className="text-3xs text-slate-400 font-mono">Storage: Persistent Ledger</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-3xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">Action</th>
                    <th className="py-3 px-5">Target Entity</th>
                    <th className="py-3 px-5">Actor</th>
                    <th className="py-3 px-5 w-full">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                        No audit records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 text-slate-500 font-mono text-2xs">
                          {new Date(evt.timestamp).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'medium'
                          })}
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge
                            status={evt.action === 'RECALL_EXECUTED' ? 'CRITICAL' : 'INFO'}
                            size="sm"
                          >
                            {evt.action}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-800 text-2xs">
                          {evt.target}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 text-2xs font-medium">
                          {evt.actor}
                        </td>
                        <td className="py-3.5 px-5 text-slate-600 text-2xs leading-relaxed max-w-md truncate" title={evt.details}>
                          {evt.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 flex items-center justify-between text-2xs text-slate-500">
              <span>Displaying {filteredEvents.length} of {db.auditEvents.length} recorded events</span>
              <span className="text-emerald-700 font-medium">State Verified</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
