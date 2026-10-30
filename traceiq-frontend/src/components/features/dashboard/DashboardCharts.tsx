import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../../app/providers';
import { EmptyState } from '../../common/PageState';
import { Panel, PanelHeader } from '../../common/Panel';
import type { DashboardExecutiveSummary } from '../../../types/api';

const formatNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const inventoryColors = ['#27bea9', '#e6a84d'];

function chartDate(value: string, period: DashboardExecutiveSummary['period']) {
  const date = new Date(value);
  return period === 'today'
    ? date.toLocaleTimeString([], { hour: 'numeric', timeZone: 'UTC' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type TooltipEntry = { name?: string; value?: number | string; color?: string; payload?: { name?: string } };

function HoverTooltip({ active, payload, label, period, colors }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  period?: DashboardExecutiveSummary['period'];
  colors: { panel: string; border: string; text: string; muted: string };
}) {
  if (!active || !payload?.length) return null;
  return <div style={{ backgroundColor: colors.panel, borderColor: colors.border, color: colors.text }} className="min-w-40 rounded-xl border px-3 py-2.5 shadow-xl">
    {label !== undefined && <p style={{ color: colors.muted }} className="mb-2 text-[10px] font-semibold">{period ? chartDate(String(label), period) : label}</p>}
    <div className="space-y-1.5">{payload.map((item, index) => <p key={`${item.name ?? item.payload?.name ?? 'value'}-${index}`} className="flex items-center justify-between gap-4 text-[10px]">
      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? '#27bea9' }} />{item.name ?? item.payload?.name ?? 'Count'}</span>
      <b className="tabular-nums">{formatNumber.format(Number(item.value ?? 0))}</b>
    </p>)}</div>
  </div>;
}

function ChartFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <Panel className="group min-w-0 overflow-hidden border-slate-200/90 transition duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg">
    <PanelHeader title={title} subtitle={subtitle} />
    {children}
  </Panel>;
}

function EmptyChart({ detail }: { detail: string }) {
  return <div className="flex h-full items-center justify-center px-5 text-center"><EmptyState title="No data for this view" detail={detail} /></div>;
}

export function DashboardCharts({ summary }: { summary: DashboardExecutiveSummary }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const colors = {
    grid: dark ? '#25413c' : '#e6eeeb',
    axis: dark ? '#a4b9b3' : '#71807c',
    panel: dark ? '#0c1917' : '#ffffff',
    border: dark ? '#29413d' : '#dce7e3',
    text: dark ? '#e1ece8' : '#142722',
    muted: dark ? '#a4b9b3' : '#71807c',
  };

  const pipeline = [
    { name: 'Verified', value: summary.document_processing.verified, color: '#27bea9' },
    { name: 'Review', value: summary.document_processing.review_required, color: '#e6a84d' },
    { name: 'Queued', value: summary.document_processing.queued, color: '#0f766e' },
    { name: 'Processing', value: summary.document_processing.processing, color: '#5fcbbb' },
    { name: 'Failed', value: summary.document_processing.failed, color: '#e57783' },
  ];
  const inventory = [
    { name: 'Available positions', value: summary.kpis.inventory.available_positions, color: inventoryColors[0] },
    { name: 'Blocked positions', value: summary.kpis.inventory.blocked_positions, color: inventoryColors[1] },
  ];
  const inventoryTotal = inventory.reduce((sum, item) => sum + item.value, 0);
  const recallWork = [
    { name: 'Active recalls', value: summary.recall_readiness.active_recalls, color: '#e57783' },
    { name: 'Customer acknowledgements', value: summary.recall_readiness.awaiting_customer_acknowledgement, color: '#e6a84d' },
    { name: 'Closure blockers', value: summary.recall_readiness.unresolved_closure_blockers, color: '#0f766e' },
  ];
  const hasActivity = summary.series.some((point) => point.documents_processed > 0 || point.checks_passed > 0);
  const hasPipeline = pipeline.some((item) => item.value > 0);
  const hasInventory = inventoryTotal > 0;
  const hasRecallWork = recallWork.some((item) => item.value > 0);

  return <section aria-label="Supply chain charts" className="grid min-w-0 gap-4 xl:grid-cols-2">
    <ChartFrame title="Operational throughput" subtitle="Documents processed and quality checks passed">
      <div className="flex h-[260px] items-center px-3 pb-3 pt-2 sm:px-5">
        {hasActivity ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.series} margin={{ top: 14, right: 10, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="operations-docs-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27bea9" stopOpacity={dark ? 0.3 : 0.2} /><stop offset="95%" stopColor="#27bea9" stopOpacity={0.01} /></linearGradient>
            <linearGradient id="operations-checks-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={dark ? 0.24 : 0.14} /><stop offset="95%" stopColor="#0f766e" stopOpacity={0.01} /></linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="bucket_start" tickFormatter={(value) => chartDate(String(value), summary.period)} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} width={38} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<HoverTooltip period={summary.period} colors={colors} />} />
          <Area type="monotone" dataKey="documents_processed" name="Documents processed" stroke="#27bea9" strokeWidth={2.5} fill="url(#operations-docs-fill)" activeDot={{ r: 5, strokeWidth: 2, stroke: colors.panel }} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="checks_passed" name="Checks passed" stroke="#0f766e" strokeWidth={2.5} fill="url(#operations-checks-fill)" activeDot={{ r: 5, strokeWidth: 2, stroke: colors.panel }} dot={false} isAnimationActive={false} />
        </AreaChart></ResponsiveContainer> : <EmptyChart detail="Document processing and quality-check events will appear here when recorded." />}
      </div>
      <div className="flex gap-5 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-teal-500" />Documents processed</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-teal-400" />Checks passed</span><span className="ml-auto hidden text-slate-400 sm:block">{summary.period.toUpperCase()} · UTC</span></div>
    </ChartFrame>

    <ChartFrame title="Document pipeline" subtitle="Current documents by processing state">
      <div className="h-[260px] px-3 pb-3 pt-2 sm:px-5">
        {hasPipeline ? <ResponsiveContainer width="100%" height="100%"><BarChart data={pipeline} layout="vertical" margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={84} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<HoverTooltip colors={colors} />} />
          <Bar dataKey="value" name="Documents" radius={[0, 5, 5, 0]} barSize={17} isAnimationActive={false}>
            {pipeline.map((item) => <Cell key={item.name} fill={item.color} />)}
            <LabelList dataKey="value" position="right" fill={colors.axis} fontSize={9} formatter={(value) => formatNumber.format(Number(value ?? 0))} />
          </Bar>
        </BarChart></ResponsiveContainer> : <EmptyChart detail="Uploaded documents will be grouped by their processing state." />}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">{formatNumber.format(summary.document_processing.total)} documents in the current snapshot</div>
    </ChartFrame>

    <ChartFrame title="Inventory posture" subtitle="Stock positions available versus held">
      <div className="grid min-h-[260px] grid-cols-2 items-center gap-2 px-4 py-2 sm:px-8">
        <div className="relative h-[220px] min-w-0">
          {hasInventory ? <ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={inventory} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="88%" paddingAngle={3} stroke="none" isAnimationActive={false}>
              {inventory.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip content={<HoverTooltip colors={colors} />} />
          </PieChart></ResponsiveContainer> : <EmptyChart detail="Inventory position totals are not available yet." />}
          {hasInventory && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold tabular-nums text-slate-900">{formatNumber.format(inventoryTotal)}</span><span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">positions</span></div>}
        </div>
        <div className="space-y-4">
          {inventory.map((item) => <div key={item.name} className="flex items-start gap-2.5"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span><span className="block text-[10px] text-slate-500">{item.name}</span><span className="mt-0.5 block text-base font-bold tabular-nums text-slate-900">{formatNumber.format(item.value)}</span></span></div>)}
          {summary.kpis.inventory.at_risk_lots > 0 && <p className="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-amber-700">{formatNumber.format(summary.kpis.inventory.at_risk_lots)} lots flagged for quality review or containment</p>}
        </div>
      </div>
    </ChartFrame>

    <ChartFrame title="Recall response" subtitle="Open cases and outstanding follow-up work">
      <div className="h-[260px] px-3 pb-3 pt-2 sm:px-5">
        {hasRecallWork ? <ResponsiveContainer width="100%" height="100%"><BarChart data={recallWork} layout="vertical" margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 5" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={142} tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<HoverTooltip colors={colors} />} />
          <Bar dataKey="value" name="Open items" radius={[0, 5, 5, 0]} barSize={20} isAnimationActive={false}>
            {recallWork.map((item) => <Cell key={item.name} fill={item.color} />)}
            <LabelList dataKey="value" position="right" fill={colors.axis} fontSize={9} formatter={(value) => formatNumber.format(Number(value ?? 0))} />
          </Bar>
        </BarChart></ResponsiveContainer> : <EmptyChart detail="Recall cases and required follow-up will appear here when recorded." />}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">Recovery quantities remain in their original units in the recall workspace.</div>
    </ChartFrame>
  </section>;
}
