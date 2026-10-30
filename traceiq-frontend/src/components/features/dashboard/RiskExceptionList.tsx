import { AlertOctagon, ArrowUpRight, Boxes, CircleCheck, ClipboardCheck, FileClock, GitBranch, ShieldAlert } from 'lucide-react';
import { navigate } from '../../../app/routes';
import { EmptyState } from '../../common/PageState';
import { Panel, PanelHeader } from '../../common/Panel';
import { StatusBadge } from '../../common/StatusBadge';
import type { DashboardRisk } from '../../../types/api';

function riskIcon(id: string) {
  if (id.includes('findings')) return AlertOctagon;
  if (id.includes('quality')) return ClipboardCheck;
  if (id.includes('inventory')) return Boxes;
  if (id.includes('genealogy')) return GitBranch;
  if (id.includes('documents')) return FileClock;
  return ShieldAlert;
}

export function RiskExceptionList({ items, demo = false }: { items: DashboardRisk[]; demo?: boolean }) {
  const activeCount = items.filter((item) => item.count > 0).length;
  const activeItems = items.filter((item) => item.count > 0).slice(0, 4);
  return <Panel className="min-w-0 overflow-hidden"><PanelHeader title="Risk & exceptions" subtitle={demo ? 'Illustrative sample conditions' : 'Current conditions requiring review or containment'} action={<span className="rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-bold text-rose-700">{activeCount > activeItems.length ? `${activeItems.length} of ${activeCount} active` : `${activeCount} active`}</span>} />
    {activeItems.length ? <div className="divide-y divide-slate-100">{activeItems.map((item) => {
      const Icon = item.count > 0 ? riskIcon(item.id) : CircleCheck;
      const activeTone = item.count > 0;
      return <button key={item.id} disabled={demo} onClick={() => navigate(item.route)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 disabled:cursor-default disabled:hover:bg-transparent sm:px-5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activeTone ? item.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-slate-900">{item.title}</span><span className="mt-0.5 block text-[9px] leading-relaxed text-slate-500">{item.detail}</span></span>
        <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-lg font-bold tabular-nums text-slate-900">{item.count.toLocaleString()}</span><StatusBadge status={activeTone ? item.severity : 'CLEAR'} /></span>
        {!demo && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-teal-600" />}
      </button>;
    })}</div> : <div className="p-4"><EmptyState title="No risk signals available" detail="Risk items appear as the API records exception and disposition states." /></div>}
  </Panel>;
}
