import { FileClock } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { useApiQuery } from '../hooks/useApiQuery';
import { auditApi } from '../services/api/auditApi';
import type { AuditEvent } from '../types/api';

export function AuditLogScreen() {
  const events = useApiQuery((signal) => auditApi.list('', signal), []);
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Governance record</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Audit history</h2><p className="mt-2 text-sm text-slate-500">Recorded workflow changes, checks, approvals, containment, and evidence corrections.</p></div><Panel><PanelHeader title="Append-only event history" subtitle="Newest records first · actor, action, entity, and evidence details are preserved." action={<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600"><FileClock className="h-3.5 w-3.5" />{events.data?.length ?? 0} events</span>} />{events.loading && !events.data ? <div className="p-4"><LoadingState /></div> : events.error ? <div className="p-4"><ErrorState message={events.error} retry={events.reload} /></div> : <div className="p-4"><DataTable<AuditEvent> rows={events.data ?? []} getKey={(row) => row.id} emptyTitle="No audit events yet" emptyDetail="New checks and workflow transitions will be recorded here." columns={[
    { key: 'time', title: 'Timestamp', render: (row) => new Date(row.created_at).toLocaleString() },
    { key: 'event', title: 'Event', render: (row) => <span><span className="block font-bold text-slate-900">{row.action.replaceAll('_', ' ')}</span><span className="text-[10px] text-slate-500">{row.description}</span></span> },
    { key: 'entity', title: 'Entity', render: (row) => <span><span className="block font-mono font-bold">{row.entity_id}</span><span className="text-[10px] text-slate-500">{row.entity_type}</span></span> },
    { key: 'actor', title: 'Actor', render: (row) => row.actor },
    { key: 'evidence', title: 'Details', render: (row) => <details><summary className="cursor-pointer text-teal-700">View payload</summary><pre className="mt-2 max-w-[280px] overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[9px] text-slate-600">{JSON.stringify(row.details, null, 2)}</pre></details> },
  ]} /></div>}</Panel></div>;
}
