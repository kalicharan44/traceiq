import { useState } from 'react';
import { ClipboardCheck, Play } from 'lucide-react';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useNotifications } from '../app/providers';
import { useApiQuery } from '../hooks/useApiQuery';
import { qualityApi } from '../services/api/qualityApi';
import type { CorrectiveAction, QualityCheck } from '../types/api';

export function QualityScreen() {
  const { notify } = useNotifications();
  const [entityType, setEntityType] = useState<'LOT' | 'SUPPLIER'>('LOT');
  const [entityId, setEntityId] = useState('FG-7003');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [refresh, setRefresh] = useState(0);
  const checks = useApiQuery((signal) => qualityApi.listChecks(signal), [refresh]);
  const actions = useApiQuery((signal) => qualityApi.correctiveActions(signal), [refresh]);
  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await qualityApi.runCheck(entityType, entityId.trim().toUpperCase(), 'Quality Reviewer', evidenceReference.trim());
      setRefresh((value) => value + 1);
      const kind = result.result === 'PASS' ? 'success' : result.result === 'PENDING' ? 'info' : 'error';
      notify(`Check returned ${result.result}`, result.findings[0]?.message ?? `${entityId} passed the configured quality-v1 rules.`, kind);
    } catch (error) { notify('Quality check failed', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  const closeAction = async (action: CorrectiveAction) => {
    const resolution = window.prompt(`Resolution for ${action.entity_id}`);
    if (!resolution?.trim()) return;
    try {
      await qualityApi.closeCorrectiveAction(action.id, 'Quality Reviewer', resolution.trim());
      setRefresh((value) => value + 1);
      notify('Corrective action closed', `${action.id} has a passing check and a recorded resolution.`);
    } catch (error) { notify('Corrective action remains open', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Deterministic controls</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Quality gates & corrective actions</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Run a versioned backend check, review its evidence, and resolve findings before an eligible workflow transition.</p></div>
    <Panel><PanelHeader title="Run a quality check" subtitle="Current ruleset: quality-v1 · Supplier qualification requires a certificate or evidence reference." /><form onSubmit={run} className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-semibold text-slate-600">Record type<select value={entityType} onChange={(event) => setEntityType(event.target.value as 'LOT' | 'SUPPLIER')} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="LOT">Lot</option><option value="SUPPLIER">Supplier</option></select></label><label className="text-xs font-semibold text-slate-600">Record ID<input value={entityId} onChange={(event) => setEntityId(event.target.value)} required className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-teal-400" /></label><label className="text-xs font-semibold text-slate-600">Evidence reference<input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} placeholder="Certificate or inspection ID" className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-400" /></label><Button type="submit" className="self-end"><Play className="h-4 w-4" />Run deterministic check</Button></form></Panel>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><Panel><PanelHeader title="Recent check runs" subtitle="Each run preserves its rule version, result, and evidence." />{checks.loading && !checks.data ? <div className="p-4"><LoadingState /></div> : checks.error ? <div className="p-4"><ErrorState message={checks.error} retry={checks.reload} /></div> : <div className="p-4"><DataTable<QualityCheck> rows={checks.data ?? []} getKey={(row) => row.id} emptyTitle="No quality checks recorded" emptyDetail="Run a check to evaluate a lot or supplier." columns={[
      { key: 'id', title: 'Check', render: (row) => <span className="font-mono font-bold">{row.id}</span> },
      { key: 'record', title: 'Record', render: (row) => <span><span className="block font-mono font-bold text-slate-900">{row.entity_id}</span><span className="text-[10px] text-slate-500">{row.entity_type} · {row.rule_version}</span></span> },
      { key: 'result', title: 'Result', render: (row) => <StatusBadge status={row.result} /> },
      { key: 'evidence', title: 'Evidence', render: (row) => <span>{row.evidence.length} items · {row.findings.length} findings</span> },
      { key: 'time', title: 'Checked', render: (row) => new Date(row.created_at).toLocaleString() },
    ]} /></div>}</Panel>
    <Panel><PanelHeader title="Corrective actions" subtitle="Resolve the issue, run a new passing check, then document the resolution." />{actions.loading && !actions.data ? <div className="p-4"><LoadingState /></div> : actions.error ? <div className="p-4"><ErrorState message={actions.error} retry={actions.reload} /></div> : <div className="divide-y divide-slate-100">{(actions.data ?? []).length ? (actions.data as CorrectiveAction[]).map((action) => <div key={action.id} className="flex gap-3 p-4"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><ClipboardCheck className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-slate-900">{action.entity_id}</span><StatusBadge status={action.status} /></div><p className="mt-1 text-xs leading-relaxed text-slate-500">{action.description}</p></div>{action.status !== 'CLOSED' && <Button variant="secondary" className="self-start px-2.5 py-1 text-[10px]" onClick={() => closeAction(action)}>Record resolution</Button>}</div>) : <p className="p-5 text-xs text-slate-500">No corrective actions are open.</p>}</div>}</Panel></div>
  </div>;
}
