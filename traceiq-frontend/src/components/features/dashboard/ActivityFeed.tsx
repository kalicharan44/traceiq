import { useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, Boxes, ClipboardCheck, FileText, GitBranch, Truck, UserRound, Workflow } from 'lucide-react';
import { navigate } from '../../../app/routes';
import { EmptyState } from '../../common/PageState';
import { Panel, PanelHeader } from '../../common/Panel';
import { StatusBadge } from '../../common/StatusBadge';
import type { DashboardActivity } from '../../../types/api';

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}

function activityIcon(row: DashboardActivity) {
  const kind = `${row.entity_type} ${row.action}`.toUpperCase();
  if (kind.includes('DOCUMENT')) return FileText;
  if (kind.includes('SHIPMENT') || kind.includes('DELIVERY')) return Truck;
  if (kind.includes('INVENTORY') || kind.includes('RECEIPT')) return Boxes;
  if (kind.includes('QUALITY') || kind.includes('VALIDATION') || kind.includes('CORRECTIVE')) return ClipboardCheck;
  if (kind.includes('RECALL')) return AlertTriangle;
  if (kind.includes('PRODUCTION') || kind.includes('LOT')) return GitBranch;
  if (kind.includes('SUPPLIER')) return UserRound;
  return Workflow;
}

export function ActivityFeed({ items, demo = false }: { items: DashboardActivity[]; demo?: boolean }) {
  const recentItems = useMemo(() => items.slice(0, 4), [items]);
  return <Panel className="min-w-0 overflow-hidden"><PanelHeader title="Operational activity" subtitle={demo ? 'Illustrative sample timeline' : 'Recent changes recorded by the backend audit log'} action={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">{recentItems.length} recent</span>} />
    {recentItems.length ? <div className="divide-y divide-slate-100">{recentItems.map((item) => {
      const Icon = activityIcon(item);
      return <button key={item.id} disabled={demo} onClick={() => navigate(item.route)} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 disabled:cursor-default disabled:hover:bg-transparent sm:px-5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold text-slate-900">{item.title}</span><StatusBadge status={item.status} /></span><span className="mt-1 block line-clamp-1 text-[10px] leading-relaxed text-slate-500">{item.description}</span><span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-400"><span className="font-mono font-semibold text-slate-500">{item.entity_id}</span><span>·</span><span>{relativeTime(item.created_at)}</span><span>·</span><span>{item.entity_type.replaceAll('_', ' ').toLowerCase()}</span></span></span>
        {!demo && <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-teal-600" />}
      </button>;
    })}</div> : <div className="p-4"><EmptyState title="No operational activity yet" detail="New records, reviews, checks, and workflow changes will appear here when recorded." /></div>}
  </Panel>;
}
