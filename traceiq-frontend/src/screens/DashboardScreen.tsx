import { lazy, Suspense, useEffect, useState } from 'react';
import { AlertOctagon, Boxes, ClipboardCheck, RefreshCw, Users, Workflow } from 'lucide-react';
import { navigate } from '../app/routes';
import { ActivityFeed } from '../components/features/dashboard/ActivityFeed';
import { RiskExceptionList } from '../components/features/dashboard/RiskExceptionList';
import { Button } from '../components/common/Button';
import { KpiCard } from '../components/common/KpiCard';
import { ErrorState } from '../components/common/PageState';
import { useApiQuery } from '../hooks/useApiQuery';
import { dashboardApi } from '../services/api/dashboardApi';
import { createDemoDashboard } from '../data/demo/dashboard';
import type { DashboardPeriod } from '../types/api';

const DashboardCharts = lazy(() => import('../components/features/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardCharts })));

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const dataSourceButton = 'rounded-md px-3 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';
const activeDataSourceButton = 'bg-teal-700 text-white shadow-sm';
const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

function DashboardSkeleton() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading executive dashboard">
    <div className="h-10 w-80 max-w-[80vw] animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
    <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}</div>
    <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[340px] animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}</div>
  </div>;
}

export function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [dataSource, setDataSource] = useState<'demo' | 'live'>('live');
  const summary = useApiQuery((signal) => dashboardApi.executive(period, signal), [period]);
  useEffect(() => {
    if (dataSource !== 'live') return;
    const timer = window.setInterval(summary.reload, 30_000);
    return () => window.clearInterval(timer);
  }, [dataSource, summary.reload]);
  const data = dataSource === 'demo' ? createDemoDashboard(period) : summary.data;

  if (dataSource === 'live' && summary.loading && !summary.data) return <DashboardSkeleton />;
  if (dataSource === 'live' && summary.error && !summary.data) return <ErrorState message={summary.error} retry={summary.reload} />;
  if (!data) return null;

  const updated = new Date(data.generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  return <div className="space-y-5 sm:space-y-6">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700"><Workflow className="h-3.5 w-3.5" />Traceability · quality · recall</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Supply Chain Overview</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">Follow materials from approved suppliers through production, quality checks, inventory and recall response.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Dashboard data source" className="inline-flex h-10 rounded-lg border border-slate-200 bg-white p-1">
          <button type="button" aria-pressed={dataSource === 'live'} onClick={() => setDataSource('live')} className={`${dataSourceButton} ${dataSource === 'live' ? activeDataSourceButton : 'text-slate-500 hover:bg-slate-50'}`}>Live data</button>
          <button type="button" aria-pressed={dataSource === 'demo'} onClick={() => setDataSource('demo')} className={`${dataSourceButton} ${dataSource === 'demo' ? activeDataSourceButton : 'text-slate-500 hover:bg-slate-50'}`}>Demo</button>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-500">
          <span>Date range</span>
          <select aria-label="Dashboard date range" value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="bg-transparent text-xs font-bold text-slate-700 outline-none">
            {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {dataSource === 'live' && <Button variant="secondary" onClick={() => summary.reload()} disabled={summary.loading} className="h-10">{summary.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Refresh</Button>}
      </div>
    </header>

    {dataSource === 'demo'
      ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-bold text-amber-900">Demo preview · illustrative sample data, not live operational records.</div>
      : <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[10px] text-teal-800"><span className="font-bold">Live dashboard · values from persisted TraceIQ records.</span><span>Updated {updated}</span></div>}

    {dataSource === 'live' && summary.error && <ErrorState message={`Refresh failed; showing the last loaded snapshot. ${summary.error}`} retry={summary.reload} />}

    <section aria-label="Executive key performance indicators" className="grid gap-4 md:grid-cols-3">
      <KpiCard label="Suppliers" value={number.format(data.kpis.suppliers.total)} detail={`${number.format(data.kpis.suppliers.active)} active supplier records`} icon={Users} tone="teal" onClick={dataSource === 'live' ? () => navigate('/suppliers') : undefined} />
      <KpiCard label="Tracked lots" value={number.format(data.kpis.material_lots.total)} detail={`${data.kpis.material_lots.pending_inspection} awaiting inspection · ${data.kpis.material_lots.on_hold} on hold`} icon={Boxes} tone={data.kpis.material_lots.on_hold ? 'amber' : 'teal'} onClick={dataSource === 'live' ? () => navigate('/traceability') : undefined} />
      <KpiCard label="Open findings" value={number.format(data.kpis.quality.open_findings)} detail={`${data.kpis.quality.critical_failures} critical validation failures`} icon={data.kpis.quality.critical_failures ? AlertOctagon : ClipboardCheck} tone={data.kpis.quality.critical_failures ? 'rose' : 'teal'} onClick={dataSource === 'live' ? () => navigate('/validation') : undefined} />
    </section>

    <Suspense fallback={<div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} aria-label="Loading dashboard chart" className="h-[340px] animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}</div>}>
      <DashboardCharts summary={data} />
    </Suspense>

    <section aria-label="Operational activity and risk" className="grid gap-4 xl:grid-cols-2">
      <ActivityFeed items={data.activities} demo={dataSource === 'demo'} />
      <RiskExceptionList items={data.risks} demo={dataSource === 'demo'} />
    </section>

    <div className="flex items-start gap-2 rounded-xl border border-teal-900/10 bg-teal-50 px-4 py-3 text-[10px] leading-relaxed text-slate-600"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span>{dataSource === 'demo' ? 'Demo values are for UI preview only and never update backend records.' : 'Dashboard indicators reflect persisted TraceIQ records.'} Recall scope and workflow approvals remain grounded in deterministic backend rules and authorized human decisions.</span></div>
  </div>;
}
