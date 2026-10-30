import React, { useState } from 'react';
import {
  Users,
  Layers,
  Box,
  AlertOctagon,
  ArrowRight,
  GitBranch,
  ShieldAlert,
  Search,
  ExternalLink,
  Clock,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { useSupplyChain } from '../context/SupplyChainContext';
import { KpiCard } from '../components/common/KpiCard';
import { StatusIndicator } from '../components/common/StatusBadge';

interface OverviewPageProps {
  onNavigate: (page: string, targetLot?: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const {
    suppliers,
    rawLots,
    finishedLots,
    inventory,
    anomalies,
    auditEvents,
    recallRecords
  } = useSupplyChain();

  const [inventoryMetricView, setInventoryMetricView] = useState<'both' | 'finished' | 'raw'>('both');

  // Compute exact metrics
  const activeSuppliersCount = suppliers.filter((s) => s.status === 'Active').length;
  const underAuditSuppliersCount = suppliers.filter((s) => s.status === 'Under Audit').length;
  
  const registeredRawLotsCount = rawLots.length;
  
  const finishedOnHandUnits = inventory
    .filter((i) => i.itemType === 'FINISHED')
    .reduce((sum, i) => sum + i.quantity, 0);

  const rawOnHandKg = inventory
    .filter((i) => i.itemType === 'RAW')
    .reduce((sum, i) => sum + i.quantity, 0);

  const unresolvedAnomalies = anomalies.filter((a) => a.status !== 'Resolved');
  const activeRecalls = recallRecords.filter((r) => r.status === 'ACTIVE_RECALL');

  // Prepare warehouse inventory chart data
  // Separate finished goods units and raw material kg cleanly
  const warehouseMap: Record<string, { name: string; shortName: string; finishedUnits: number; rawKg: number; quarantinedUnits: number }> = {
    'WH-CHI-1': { name: 'Central Midwest (Chicago)', shortName: 'Chicago Hub', finishedUnits: 0, rawKg: 0, quarantinedUnits: 0 },
    'WH-ATL-2': { name: 'Southeast DC (Atlanta)', shortName: 'Atlanta Center', finishedUnits: 0, rawKg: 0, quarantinedUnits: 0 },
    'WH-DAL-3': { name: 'Southwest Terminal (Dallas)', shortName: 'Dallas Cross-Dock', finishedUnits: 0, rawKg: 0, quarantinedUnits: 0 },
    'WH-NV-4': { name: 'Western Mountain Depot (Reno)', shortName: 'Reno Depot', finishedUnits: 0, rawKg: 0, quarantinedUnits: 0 }
  };

  inventory.forEach((item) => {
    if (warehouseMap[item.warehouseId]) {
      if (item.itemType === 'FINISHED') {
        warehouseMap[item.warehouseId].finishedUnits += item.quantity;
        if (item.status === 'Quarantined') {
          warehouseMap[item.warehouseId].quarantinedUnits += item.quantity;
        }
      } else if (item.itemType === 'RAW') {
        warehouseMap[item.warehouseId].rawKg += item.quantity;
      }
    }
  });

  const chartData = Object.values(warehouseMap);

  return (
    <div className="space-y-8">
      {/* Top Banner & Status Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-mono">
            Supply Chain Overview
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time multi-echelon network telemetry: raw materials intake, cGMP production runs, and commercial fulfillment.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('genealogy', 'RAW-1042')}
            className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
            Trace a Lot
          </button>
          <button
            onClick={() => onNavigate('anomalies')}
            className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <AlertOctagon className="h-3.5 w-3.5 text-amber-400" />
            Investigate Anomalies
          </button>
          <button
            onClick={() => onNavigate('recall', 'RAW-9912')}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors shadow-sm"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            Simulate a Recall
          </button>
        </div>
      </div>

      {/* Network Health Status Strip */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${unresolvedAnomalies.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <div>
              <span className="text-xs font-semibold text-slate-200">
                Network Status:{' '}
                {unresolvedAnomalies.length > 0
                  ? '3 Operational Discrepancies Require Action'
                  : 'Operational Integrity Verified'}
              </span>
              <p className="text-2xs text-slate-400 mt-0.5">
                {activeRecalls.length > 0
                  ? `${activeRecalls.length} active quarantine recall protocol currently executing.`
                  : 'No unauthorized recalls executed. 3 synthetic anomalies ready for inspection.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Audit Ledger: <strong className="text-slate-200 font-mono">{auditEvents.length} events</strong></span>
            <span>Active Carriers: <strong className="text-slate-200 font-mono">4 verified</strong></span>
          </div>
        </div>
      </div>

      {/* 4 Polished KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Active Suppliers"
          value={activeSuppliersCount}
          subtitle={`${underAuditSuppliersCount} vendor currently under ISO audit`}
          icon={Users}
          badge={{
            text: `${suppliers.length} Total Vendors`,
            variant: underAuditSuppliersCount > 0 ? 'amber' : 'emerald'
          }}
          onClick={() => onNavigate('genealogy', 'SUP-101')}
        />
        <KpiCard
          title="Registered Raw Lots"
          value={registeredRawLotsCount}
          subtitle={`${rawOnHandKg.toLocaleString()} kg active material on hand`}
          icon={Layers}
          badge={{
            text: '1 Missing BOM Link',
            variant: 'rose'
          }}
          onClick={() => onNavigate('genealogy', 'RAW-1042')}
        />
        <KpiCard
          title="Finished Goods On Hand"
          value={finishedOnHandUnits.toLocaleString()}
          subtitle="Distributed across 4 regional warehouse nodes"
          icon={Box}
          badge={{
            text: '5 SKUs Tracked',
            variant: 'cyan'
          }}
          onClick={() => onNavigate('genealogy', 'FG-2002')}
        />
        <KpiCard
          title="Open Quality Incidents"
          value={unresolvedAnomalies.length}
          subtitle={
            activeRecalls.length > 0
              ? `${activeRecalls.length} containment recall authorized`
              : 'Uncontained ERP anomalies detected'
          }
          icon={AlertOctagon}
          badge={{
            text: unresolvedAnomalies.length > 0 ? 'Action Required' : 'All Clear',
            variant: unresolvedAnomalies.length > 0 ? 'rose' : 'emerald'
          }}
          onClick={() => onNavigate('anomalies')}
        />
      </div>

      {/* Supply Chain Inventory Visualization */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-cyan-400" />
              Regional Warehouse Inventory Distribution
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative stock levels: Commercial finished goods (units) vs bulk chemical excipients (kg)
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              onClick={() => setInventoryMetricView('both')}
              className={`rounded px-2.5 py-1 text-2xs font-medium transition-colors ${
                inventoryMetricView === 'both'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dual Scale
            </button>
            <button
              onClick={() => setInventoryMetricView('finished')}
              className={`rounded px-2.5 py-1 text-2xs font-medium transition-colors ${
                inventoryMetricView === 'finished'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Finished Goods (Units)
            </button>
            <button
              onClick={() => setInventoryMetricView('raw')}
              className={`rounded px-2.5 py-1 text-2xs font-medium transition-colors ${
                inventoryMetricView === 'raw'
                  ? 'bg-slate-800 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw Materials (kg)
            </button>
          </div>
        </div>

        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="shortName"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl text-xs backdrop-blur-md">
                        <p className="font-semibold text-slate-200 border-b border-slate-800 pb-1 mb-2 font-mono">
                          {label}
                        </p>
                        {payload.map((entry, index) => (
                          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}:
                            </span>
                            <span className="font-mono font-medium text-slate-100">
                              {Number(entry.value).toLocaleString()}{' '}
                              {entry.dataKey === 'rawKg' ? 'kg' : 'units'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }}
                iconType="circle"
              />
              {(inventoryMetricView === 'both' || inventoryMetricView === 'finished') && (
                <Bar
                  dataKey="finishedUnits"
                  name="Finished Units (On Hand)"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              )}
              {(inventoryMetricView === 'both' || inventoryMetricView === 'finished') && (
                <Bar
                  dataKey="quarantinedUnits"
                  name="Quarantined FG Units"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {(inventoryMetricView === 'both' || inventoryMetricView === 'raw') && (
                <Bar
                  dataKey="rawKg"
                  name="Raw Ingredients (kg)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-2xs text-slate-400">
          <span>*Note: Raw material kilograms and finished dosage units are graphed distinctly to prevent unit conflation.</span>
          <span className="font-mono text-cyan-400">4 Warehouses Active</span>
        </div>
      </div>

      {/* Grid: Incident Monitoring & Recent Activity Timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Incident Monitoring Panel */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-400" />
                Active Integrity Incidents
              </h2>
              <button
                onClick={() => onNavigate('anomalies')}
                className="text-2xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                View all ({anomalies.length})
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {anomalies.map((anom) => (
                <div
                  key={anom.id}
                  onClick={() => onNavigate('anomalies')}
                  className="cursor-pointer rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-150 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-rose-400">
                        {anom.id}
                      </span>
                      <span className="text-slate-600">·</span>
                      <StatusIndicator status={anom.severity} size="sm" />
                    </div>
                    <span className="font-mono text-2xs text-slate-400 group-hover:text-cyan-400">
                      Entity: {anom.affectedEntityId}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs font-medium text-slate-200">
                    {anom.title}
                  </h3>
                  <p className="mt-1 text-2xs text-slate-400 line-clamp-2 leading-relaxed">
                    {anom.observedBehavior}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-2xs text-slate-400">
            <span>Automated checks run on every batch scan</span>
            <button
              onClick={() => onNavigate('ai-investigation')}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Analyze with AI Copilot →
            </button>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" />
                Recent Supply Chain Audit Events
              </h2>
              <button
                onClick={() => onNavigate('audit')}
                className="text-2xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Full Audit Log
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {auditEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="relative pl-5 before:absolute before:left-1 before:top-2 before:bottom-0 before:w-px before:bg-slate-800">
                  <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full border border-slate-900 bg-cyan-400" />
                  <div className="flex items-baseline justify-between text-2xs">
                    <span className="font-mono font-medium text-slate-300">
                      {evt.actionType}
                    </span>
                    <span className="text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-300 leading-snug">
                    {evt.description}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-3xs text-slate-400">
                    <span>Target: <strong className="font-mono text-slate-300">{evt.targetId}</strong></span>
                    <span>·</span>
                    <span>By: {evt.user}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 text-2xs text-slate-400 flex items-center justify-between">
            <span>Audit trail stored in local state</span>
            <span className="font-mono text-emerald-400">Ledger Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
