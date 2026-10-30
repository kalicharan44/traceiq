import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { navigate } from '../app/routes';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { anomaliesApi } from '../services/api/anomaliesApi';
import type { Anomaly } from '../types/api';

export function AnomaliesScreen() {
  const [filter, setFilter] = useState('');
  const anomalies = useApiQuery((signal) => anomaliesApi.list(signal), []);
  const rows = (anomalies.data ?? []).filter((row) => !filter || `${row.type} ${row.entity_id} ${row.title}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Rules engine findings</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Anomalies & evidence gaps</h2><p className="mt-2 text-sm text-slate-500">Deterministic findings from lot relationships, shipment recipients, and quantity accounting.</p></div><Panel><PanelHeader title={`${rows.length} findings`} subtitle="Review each finding at its source record before taking action." action={<div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter findings" className="h-9 w-48 rounded-lg border border-slate-200 pl-9 pr-2 text-xs outline-none focus:border-teal-400" /></div>} />{anomalies.loading && !anomalies.data ? <div className="p-4"><LoadingState /></div> : anomalies.error ? <div className="p-4"><ErrorState message={anomalies.error} retry={anomalies.reload} /></div> : <div className="p-4"><DataTable<Anomaly> rows={rows} getKey={(row) => row.id} emptyTitle="No findings match" emptyDetail="No deterministic anomaly matched this filter." columns={[
    { key: 'finding', title: 'Finding', render: (row) => <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><span className="block font-bold text-slate-900">{row.title}</span><span className="mt-1 block max-w-xl leading-relaxed text-slate-500">{row.description}</span></span></div> },
    { key: 'type', title: 'Rule', render: (row) => <span className="font-mono text-[10px]">{row.type}</span> },
    { key: 'entity', title: 'Affected record', render: (row) => <span className="font-mono font-bold">{row.entity_id}</span> },
    { key: 'severity', title: 'Severity', render: (row) => <StatusBadge status={row.severity} /> },
    { key: 'action', title: 'Inspect', render: (row) => <Button variant="secondary" className="px-2 py-1 text-[10px]" onClick={() => navigate(`/traceability?lot=${encodeURIComponent(row.entity_id)}`)}>Trace record</Button> },
  ]} /></div>}</Panel></div>;
}
