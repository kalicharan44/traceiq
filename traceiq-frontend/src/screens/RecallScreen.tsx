import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Download, LockKeyhole, RotateCcw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useNotifications } from '../app/providers';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { recallsApi } from '../services/api/recallsApi';
import type { RecallAction, RecallImpact, RecallRecord } from '../types/api';

export function RecallScreen() {
  const { notify } = useNotifications();
  const [targetInput, setTargetInput] = useState('RAW-1042');
  const [target, setTarget] = useState('RAW-1042');
  const [refresh, setRefresh] = useState(0);
  const [activeRecall, setActiveRecall] = useState<RecallRecord | null>(null);
  const [reason, setReason] = useState('Supplier reported potential contamination in incoming material.');
  const [approver, setApprover] = useState('Quality Director');
  const [approvalNote, setApprovalNote] = useState('I reviewed the verified impact scope and approve recall activation.');
  const [reconciliation, setReconciliation] = useState({ quarantined_units: 0, held_or_delivered_units: 0, returned_units: 0, destroyed_units: 0, documented_other_units: 0 });
  const impactQuery = useApiQuery((signal) => recallsApi.impact(target, signal), [target]);
  const recallsQuery = useApiQuery((signal) => recallsApi.list(signal), [refresh]);
  const impact = impactQuery.data as RecallImpact | null;

  useEffect(() => {
    if (!activeRecall && recallsQuery.data?.length) {
      const active = recallsQuery.data.find((row) => row.status === 'ACTIVE');
      if (active) setActiveRecall(active);
    }
  }, [activeRecall, recallsQuery.data]);

  const refreshRecall = async (recallId: string) => {
    const current = await recallsApi.get(recallId);
    setActiveRecall(current);
    setRefresh((value) => value + 1);
    return current;
  };

  useEffect(() => {
    if (!activeRecall || !impact) return;
    setReconciliation((current) => ({
      ...current,
      quarantined_units: impact.on_hand_units,
      held_or_delivered_units: impact.in_transit_units + impact.delivered_units,
    }));
  }, [activeRecall?.id, impact?.target_lot_id, impact?.on_hand_units, impact?.in_transit_units, impact?.delivered_units]);

  const accountedUnits = useMemo(() => Object.values(reconciliation).reduce((sum, value) => sum + Number(value || 0), 0), [reconciliation]);
  const loadImpact = (event: React.FormEvent) => { event.preventDefault(); if (targetInput.trim()) { setTarget(targetInput.trim().toUpperCase()); setActiveRecall(null); } };

  const approveRecall = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!impact) return;
    try {
      const result = await recallsApi.approveAndActivate({ target_lot_id: target, reason, authorized_by: approver, approval_note: approvalNote });
      setActiveRecall(result);
      setRefresh((value) => value + 1);
      notify('Recall activated', `${result.id} is active. Available inventory was quarantined and in-transit shipments were held.`);
    } catch (error) { notify('Recall could not be activated', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };

  const completeAction = async (action: RecallAction) => {
    if (!activeRecall) return;
    try {
      await recallsApi.completeAction(activeRecall.id, action.id, 'Recall Coordinator');
      await refreshRecall(activeRecall.id);
      notify('Action recorded', `${action.action_type.replaceAll('_', ' ').toLowerCase()} marked complete.`);
    } catch (error) { notify('Action update failed', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };

  const saveReconciliation = async () => {
    if (!activeRecall) return;
    try {
      const result = await recallsApi.reconcile(activeRecall.id, { ...reconciliation, recorded_by: 'Recall Coordinator' });
      await refreshRecall(activeRecall.id);
      notify(result.matches_scope ? 'Quantities reconciled' : 'Quantity variance remains', `${result.accounted_units.toLocaleString()} of ${result.expected_units.toLocaleString()} affected units accounted for.`, result.matches_scope ? 'success' : 'error');
    } catch (error) { notify('Reconciliation failed', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };

  const closeRecall = async () => {
    if (!activeRecall) return;
    try {
      const closed = await recallsApi.close(activeRecall.id, 'Quality Director');
      setActiveRecall(closed);
      setRefresh((value) => value + 1);
      notify('Recall closed', `${closed.id} passed its closure checks.`);
    } catch (error) { notify('Recall remains open', error instanceof Error ? error.message : 'Review the closure blockers.', 'error'); await refreshRecall(activeRecall.id); }
  };

  const downloadReport = async () => {
    if (!activeRecall) return;
    try {
      const report = await recallsApi.report(activeRecall.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `traceiq-${activeRecall.id}-report.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { notify('Report unavailable', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };

  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Investigation → approval → containment → reconciliation</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Recall command center</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Review a deterministic impact simulation first. A named human approver is required before the backend changes stock or shipment state.</p></div>
    <Panel><PanelHeader title="1 · Simulate impact" subtitle="Enter a source lot to calculate downstream finished lots, inventory, shipments, customers, and gaps." /><form onSubmit={loadImpact} className="flex flex-col gap-3 p-4 sm:flex-row"><input value={targetInput} onChange={(event) => setTargetInput(event.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-teal-400" aria-label="Target lot ID" /><Button type="submit"><RotateCcw className="h-4 w-4" />Calculate impact</Button></form></Panel>
    {impactQuery.loading && <LoadingState label="Calculating recall scope from backend records…" />}
    {impactQuery.error && <ErrorState message={impactQuery.error} retry={impactQuery.reload} />}
    {impact && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ['Affected finished units', impact.affected_units.toLocaleString()], ['Finished lots', impact.finished_lots.length], ['Stock on hand', impact.on_hand_units.toLocaleString()], ['Shipments', impact.shipment_ids.length], ['Customers', impact.customer_ids.length],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-950">{value}</p></div>)}</div>
      {impact.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-xs font-bold text-amber-900"><TriangleAlert className="h-4 w-4" />Review before any decision</p><ul className="mt-2 space-y-1">{impact.warnings.map((warning) => <li key={warning} className="text-xs leading-relaxed text-amber-800">{warning}</li>)}</ul></div>}
      <Panel><PanelHeader title="2 · Human approval required" subtitle={`Estimated exposure $${impact.financial_exposure_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} · ${impact.in_transit_units.toLocaleString()} in transit · ${impact.delivered_units.toLocaleString()} delivered`} />{activeRecall?.status === 'ACTIVE' && activeRecall.target_lot_id === target ? <div className="flex items-start gap-3 p-5"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><LockKeyhole className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-900">{activeRecall.id} is active</p><p className="mt-1 text-xs text-slate-500">Approved by {activeRecall.authorized_by} · {activeRecall.affected_units.toLocaleString()} affected units are in the recall scope.</p></div><StatusBadge status={activeRecall.status} /></div> : activeRecall?.status === 'CLOSED' ? <div className="flex items-center gap-3 p-5"><Check className="h-5 w-5 text-emerald-600" /><p className="text-sm font-bold text-slate-900">{activeRecall.id} is closed.</p><StatusBadge status={activeRecall.status} /></div> : <form onSubmit={approveRecall} className="grid gap-3 p-5 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Incident reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={4} rows={3} className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-teal-400" /></label><div className="space-y-3"><label className="block text-xs font-semibold text-slate-600">Approving person<input value={approver} onChange={(event) => setApprover(event.target.value)} required minLength={2} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-400" /></label><label className="block text-xs font-semibold text-slate-600">Approval rationale<textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} required minLength={3} rows={2} className="mt-1 block w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-teal-400" /></label><Button type="submit" variant="danger"><ShieldAlert className="h-4 w-4" />Approve & activate recall</Button></div></form>}</Panel>
      {activeRecall && activeRecall.target_lot_id === target && <>
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <Panel><PanelHeader title="3 · Containment and response actions" subtitle="Quarantine and shipment holds are applied during activation. Record customer notification and recovery work here." />{activeRecall.actions?.length ? <div className="p-4"><DataTable<RecallAction> rows={activeRecall.actions} getKey={(action) => action.id} columns={[
            { key: 'action', title: 'Action', render: (action) => <span><span className="block font-bold text-slate-900">{action.action_type.replaceAll('_', ' ')}</span><span className="mt-1 block max-w-sm text-[10px] leading-relaxed text-slate-500">{action.description}</span></span> },
            { key: 'entity', title: 'Record', render: (action) => <span className="font-mono">{action.entity_id ?? '—'}</span> },
            { key: 'status', title: 'Status', render: (action) => <StatusBadge status={action.status} /> },
            { key: 'complete', title: '', render: (action) => action.status === 'PENDING' && activeRecall.status === 'ACTIVE' ? <Button variant="secondary" className="px-2 py-1 text-[10px]" onClick={() => completeAction(action)}><Check className="h-3 w-3" />Complete</Button> : null },
          ]} /></div> : <p className="p-5 text-xs text-slate-500">No actions have been created.</p>}</Panel>
          <Panel><PanelHeader title="4 · Quantity reconciliation" subtitle={`Account for all ${activeRecall.affected_units.toLocaleString()} affected finished units.`} /><div className="space-y-3 p-5">{([
            ['quarantined_units', 'Quarantined stock'], ['held_or_delivered_units', 'Held or delivered shipments'], ['returned_units', 'Returned units'], ['destroyed_units', 'Destroyed units'], ['documented_other_units', 'Other documented disposition'],
          ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">{label}<input type="number" min="0" step="0.01" value={reconciliation[key]} onChange={(event) => setReconciliation((current) => ({ ...current, [key]: Number(event.target.value) }))} className="h-9 w-32 rounded-lg border border-slate-200 px-2 text-right font-mono text-xs outline-none focus:border-teal-400" /></label>)}<div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="font-bold text-slate-700">Accounted / expected</span><span className={`font-mono font-bold ${Math.abs(accountedUnits - activeRecall.affected_units) < 0.001 ? 'text-emerald-700' : 'text-rose-700'}`}>{accountedUnits.toLocaleString()} / {activeRecall.affected_units.toLocaleString()}</span></div><Button className="w-full" onClick={saveReconciliation}>Save reconciliation</Button><div className="rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">The reconciliation is recorded as an operator attestation and checked against the affected scope. This prototype does not send customer notifications.</div></div></Panel>
        </div>
        <Panel><PanelHeader title="Closure gate" subtitle="Open blockers are recalculated by the backend. Incomplete links, available affected stock, in-transit shipments without holds, and pending actions block closure." action={<Button variant="secondary" onClick={downloadReport}><Download className="h-4 w-4" />Download report</Button>} /><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="space-y-2">{(activeRecall.closure_blockers ?? []).length ? activeRecall.closure_blockers?.map((blocker) => <p key={blocker} className="flex items-start gap-2 text-xs text-amber-800"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{blocker}</p>) : <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><Check className="h-4 w-4" />All configured closure checks pass.</p>}</div><Button variant="danger" disabled={activeRecall.status !== 'ACTIVE' || Boolean(activeRecall.closure_blockers?.length)} onClick={closeRecall}>Authorize closure <ArrowRight className="h-4 w-4" /></Button></div></Panel>
      </>}
      {recallsQuery.data && recallsQuery.data.length > 0 && <Panel><PanelHeader title="Recall history" subtitle="Choose an existing case to review its recorded actions and reconciliation." /><div className="flex flex-wrap gap-2 p-4">{recallsQuery.data.map((item) => <Button key={item.id} variant={activeRecall?.id === item.id ? 'primary' : 'secondary'} className="text-xs" onClick={async () => { setTarget(item.target_lot_id); setTargetInput(item.target_lot_id); setActiveRecall(await recallsApi.get(item.id)); }}>{item.id} · {item.target_lot_id} · {item.status}</Button>)}</div></Panel>}
    </>}
  </div>;
}
