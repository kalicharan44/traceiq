import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, CircleHelp, ClipboardCheck, ExternalLink, FileCheck2, Filter, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { navigate } from '../app/routes';
import { Button } from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { documentsApi } from '../services/api/documentsApi';
import type { ValidationFinding, ValidationRun } from '../types/api';

const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const stamp = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function completionGuide(finding: ValidationFinding) {
  const documentEvidence = finding.evidence.find((entry) => typeof entry.document_id === 'string');
  const documentId = typeof documentEvidence?.document_id === 'string' ? documentEvidence.document_id : '';
  const filename = typeof documentEvidence?.filename === 'string' ? documentEvidence.filename : '';

  if (documentId) {
    const detailByRule: Record<string, string> = {
      'DOC-COA-001': 'Open the certificate in Document Intelligence. Check the lot number printed in the PDF, link the document to that lot, then run the check again.',
      'DOC-LINK-001': 'Open the source document in Document Intelligence and add its supplier, lot, shipment, order, or other known business-record link. Then run the check again.',
      'DOC-REQ-001': 'Open the document in Document Intelligence and compare each required field with the source. Correct missing or incorrect values during review, then run the check again.',
      'DOC-TEXT-001': 'Open the document in Document Intelligence to inspect the source. Upload a readable copy or retry extraction, then run the check again.',
    };
    return {
      location: 'Document Intelligence',
      record: filename || documentId,
      detail: detailByRule[finding.rule_id] ?? 'Open the source document, follow the recommended action, and run the check again.',
      path: `/documents?q=${encodeURIComponent(documentId)}`,
      button: 'Open source document',
    };
  }

  const lotEvidence = finding.evidence.find((entry) => entry.entity_type === 'LOT' && typeof entry.entity_id === 'string');
  if (typeof lotEvidence?.entity_id === 'string') {
    return {
      location: 'Traceability',
      record: lotEvidence.entity_id,
      detail: 'Open the lot record to inspect its linked source data. Correct the underlying record, then run the applicable quality or validation check again.',
      path: `/traceability?lot=${encodeURIComponent(lotEvidence.entity_id)}`,
      button: 'Open lot record',
    };
  }

  const supplierEvidence = finding.evidence.find((entry) => entry.entity_type === 'SUPPLIER' && typeof entry.entity_id === 'string');
  if (typeof supplierEvidence?.entity_id === 'string') {
    return {
      location: 'Supplier Master',
      record: supplierEvidence.entity_id,
      detail: 'Open the supplier profile and update the qualification evidence or source data, then run the supplier check again.',
      path: '/suppliers',
      button: 'Open supplier master',
    };
  }

  return null;
}

export function ValidationScreen() {
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get('status') ?? '');
  const [severity, setSeverity] = useState(() => new URLSearchParams(window.location.search).get('severity') ?? '');
  const [activeFinding, setActiveFinding] = useState(() => new URLSearchParams(window.location.search).get('finding') ?? '');
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackFindingId, setFeedbackFindingId] = useState('');
  const detailsRef = useRef<HTMLDivElement>(null);
  const findings = useApiQuery((signal) => documentsApi.findings({ status: status || undefined, severity: severity || undefined, limit: 100 }, signal), [status, severity]);
  const runs = useApiQuery((signal) => documentsApi.runs({ limit: 100 }, signal), []);
  const selected = findings.data?.items.find((item) => item.id === activeFinding) ?? null;
  const selectedGuide = selected ? completionGuide(selected) : null;

  useEffect(() => {
    if (!activeFinding || window.innerWidth >= 1536) return;
    window.requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [activeFinding]);
  const counts = useMemo(() => {
    const all = findings.data?.items ?? [];
    return {
      open: all.filter((item) => !['PASS', 'RESOLVED'].includes(item.status)).length,
      failed: all.filter((item) => item.status === 'FAIL').length,
      incomplete: all.filter((item) => item.status === 'INCOMPLETE').length,
      blocking: all.filter((item) => item.blocks_transition && !['PASS', 'RESOLVED'].includes(item.status)).length,
    };
  }, [findings.data]);

  async function resolve(item: ValidationFinding) {
    const resolution = resolutions[item.id]?.trim();
    if (!resolution || resolution.length < 3) return;
    setResolving(item.id); setFeedback(''); setFeedbackFindingId(item.id);
    try {
      await documentsApi.resolveFinding(item.id, { resolved_by: 'TraceIQ Operator', resolution });
      setFeedback('Resolution recorded. Run the applicable check again to confirm the underlying evidence now passes.');
      findings.reload(); runs.reload();
      if (status && status !== 'RESOLVED') {
        setStatus('');
        const params = new URLSearchParams(window.location.search);
        params.delete('status');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
      }
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Resolution could not be recorded.'); }
    finally { setResolving(''); }
  }

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600"><ShieldCheck className="h-3.5 w-3.5" /> Governance / Validation</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Validation center</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Review persisted, versioned check runs and findings. A resolved finding records corrective action; only a new check can verify the result.</p></div><Button variant="secondary" onClick={() => { findings.reload(); runs.reload(); }}><RefreshCw className="h-4 w-4" />Refresh records</Button></header>
    {feedback && feedbackFindingId !== activeFinding && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-medium text-teal-900"><span>{feedback}</span><button aria-label="Dismiss message" onClick={() => { setFeedback(''); setFeedbackFindingId(''); }}><X className="h-4 w-4" /></button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<ClipboardCheck className="h-4 w-4" />} label="Open findings" value={counts.open} color="text-teal-700 bg-teal-50" detail="Current filtered result set" />
      <Metric icon={<AlertCircle className="h-4 w-4" />} label="Failed checks" value={counts.failed} color="text-rose-700 bg-rose-50" detail="Rule returned a failing result" />
      <Metric icon={<CircleHelp className="h-4 w-4" />} label="Incomplete" value={counts.incomplete} color="text-amber-700 bg-amber-50" detail="Required evidence is missing" />
      <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Blocking gates" value={counts.blocking} color="text-violet-700 bg-violet-50" detail="Require action before transition" />
    </div>
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.75fr)]">
      <Panel className="min-w-0 overflow-hidden"><PanelHeader title="Findings queue" subtitle="Each finding retains its rule version, evidence, expected value, and actual value." action={<div className="flex items-center gap-2"><Filter className="h-3.5 w-3.5 text-slate-400" /><select aria-label="Filter findings by status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none"><option value="">All statuses</option>{['FAIL', 'INCOMPLETE', 'WARNING', 'PASS', 'RESOLVED', 'PENDING'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select><select aria-label="Filter findings by severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none"><option value="">All severities</option>{['CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></div>} />
        {findings.loading && !findings.data ? <div className="p-4"><LoadingState label="Loading validation findings…" /></div> : findings.error ? <div className="p-4"><ErrorState message={findings.error} retry={findings.reload} /></div> : findings.data?.items.length ? <div className="divide-y divide-slate-100">{findings.data.items.map((item) => <button key={item.id} onClick={() => setActiveFinding(item.id)} className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50 ${activeFinding === item.id ? 'bg-teal-50/60' : ''}`}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.status === 'FAIL' ? 'bg-rose-50 text-rose-600' : item.status === 'INCOMPLETE' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{item.status === 'PASS' || item.status === 'RESOLVED' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-900">{item.title}</span><StatusBadge status={item.status} /><StatusBadge status={item.severity} /></span><span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{item.suggested_action || 'Review the evidence and determine the corrective action.'}</span><span className="mt-1.5 block font-mono text-[9px] text-slate-400">Rule {item.rule_id} · v{item.rule_version} · Run {item.run_id}</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" /></button>)}</div> : <div className="p-4"><EmptyState title="No findings for these filters" detail="Run checks from Document Intelligence or a supported supply chain record to create a validation run." /></div>}
      </Panel>

      <div ref={detailsRef} id="finding-details" className="scroll-mt-24 space-y-4">
        <Panel className="overflow-hidden"><PanelHeader title="Finding details" subtitle={selected ? `Created ${stamp(selected.created_at)}` : 'Select a finding to inspect its evidence'} action={selected && <StatusBadge status={selected.status} />} />
          {selected ? <div className="space-y-4 p-4"><div><p className="text-sm font-bold text-slate-900">{selected.title}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={selected.severity} /><span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">Rule {selected.rule_id} · v{selected.rule_version}</span>{selected.blocks_transition && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">Blocks transition</span>}</div></div>
            <ValueBlock label="Expected" value={selected.expected} /><ValueBlock label="Actual" value={selected.actual} />
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">Recommended action</p>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-900">{selected.suggested_action || 'Review the source record and determine the corrective action.'}</p>
              {selectedGuide ? <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/80 p-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{['PASS', 'RESOLVED'].includes(selected.status) ? 'Source record' : 'Where to complete'}</p>
                <p className="mt-1 text-xs font-bold text-slate-900">{selectedGuide.location}<span className="font-normal text-slate-500"> · {selectedGuide.record}</span></p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-600">{['PASS', 'RESOLVED'].includes(selected.status) ? 'This finding is complete. Open the related record to inspect its source evidence.' : selectedGuide.detail}</p>
                <Button variant="secondary" onClick={() => navigate(selectedGuide.path)} className="mt-3 w-full justify-center">
                  {selectedGuide.button}<ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div> : <p className="mt-2 text-[10px] leading-relaxed text-slate-600">Use the evidence and record details below to locate the source workflow, then run a new check after correcting it.</p>}
            </div>
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence</p>{selected.evidence.length ? <div className="space-y-2">{selected.evidence.map((entry, index) => <pre key={index} className="overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[9px] leading-relaxed text-slate-600">{JSON.stringify(entry, null, 2)}</pre>)}</div> : <p className="rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500">No evidence payload was attached to this finding.</p>}</div>
            {feedback && feedbackFindingId === selected.id && <div role="status" className={`rounded-lg border p-3 text-xs leading-relaxed ${feedback.startsWith('Resolution recorded') ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{feedback}</div>}
            {selected.resolution ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-800">Resolution recorded by {selected.resolved_by}</p><p className="mt-1 text-xs text-emerald-900">{selected.resolution}</p><p className="mt-1 text-[9px] text-emerald-700">{selected.resolved_at ? stamp(selected.resolved_at) : ''}</p></div> : !['PASS', 'RESOLVED'].includes(selected.status) && <div className="space-y-2 border-t border-slate-100 pt-3"><label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500" htmlFor="resolution-note">Corrective action / resolution</label><textarea id="resolution-note" aria-describedby="resolution-help" value={resolutions[selected.id] ?? ''} onChange={(event) => setResolutions((current) => ({ ...current, [selected.id]: event.target.value }))} rows={3} placeholder="Describe the action taken or evidence added…" className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-teal-500" /><Button disabled={(resolutions[selected.id]?.trim().length ?? 0) < 3 || resolving === selected.id} onClick={() => void resolve(selected)} className="w-full">{resolving === selected.id ? 'Saving resolution…' : 'Record resolution'}<ArrowRight className="h-3.5 w-3.5" /></Button><p id="resolution-help" className="text-[9px] leading-relaxed text-slate-500">Enter at least 3 characters to enable this button. Recording the action does not change the check result; run the check again after correcting the source record.</p></div>}</div> : <div className="p-4"><EmptyState title="No finding selected" detail="Choose an item from the queue to inspect expected values and source evidence." /></div>}
        </Panel>
        <Panel className="overflow-hidden"><PanelHeader title="Workflow rule" subtitle="How gate outcomes move through review" action={<FileCheck2 className="h-4 w-4 text-teal-600" />} /><div className="space-y-2 p-4">{[['Business event', 'Select the active rule version and authorized records.'], ['Deterministic check', 'Persist PASS, FAIL, INCOMPLETE, or WARNING with evidence.'], ['Correct & retest', 'Record corrective action, then run the check again.'], ['Workflow gate', 'Permit the next state only when all required gates pass.']].map(([title, detail], index) => <div key={title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700">{index + 1}</span><div><p className="text-[10px] font-bold text-slate-800">{title}</p><p className="text-[9px] leading-relaxed text-slate-500">{detail}</p></div></div>)}</div></Panel>
      </div>
    </div>

    <Panel className="overflow-hidden"><PanelHeader title="Recent check runs" subtitle="Immutable snapshots of entity, result counts, actor, and run time" action={<span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><ClipboardCheck className="h-3.5 w-3.5" />{runs.data?.total ?? 0} runs</span>} />
      {runs.loading && !runs.data ? <div className="p-4"><LoadingState label="Loading check history…" /></div> : runs.error ? <div className="p-4"><ErrorState message={runs.error} retry={runs.reload} /></div> : runs.data?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr>{['Run', 'Entity', 'Result', 'Passed', 'Failed', 'Incomplete', 'Warnings', 'Actor / time'].map((head) => <th key={head} className="px-4 py-2.5 font-bold">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{runs.data.items.map((run: ValidationRun) => <tr key={run.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono text-[10px] font-bold text-slate-700">{run.id}</td><td className="px-4 py-3"><span className="block font-bold text-slate-800">{run.entity_id}</span><span className="text-[9px] text-slate-500">{pretty(run.entity_type)}</span></td><td className="px-4 py-3"><StatusBadge status={run.status} /></td><td className="px-4 py-3 text-emerald-700">{run.passed_count}</td><td className="px-4 py-3 text-rose-700">{run.failed_count}</td><td className="px-4 py-3 text-amber-700">{run.incomplete_count}</td><td className="px-4 py-3 text-amber-700">{run.warning_count}</td><td className="px-4 py-3"><span className="block text-slate-700">{run.run_by}</span><span className="text-[9px] text-slate-500">{stamp(run.created_at)}</span></td></tr>)}</tbody></table></div> : <div className="p-4"><EmptyState title="No validation runs yet" detail="Verified documents and supported lots or suppliers can be checked using registered deterministic rules." /></div>}
    </Panel>
  </div>;
}

function Metric({ icon, label, value, color, detail }: { icon: React.ReactNode; label: string; value: number; color: string; detail: string }) {
  return <Panel className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-xl font-bold text-slate-900">{value}</p><p className="truncate text-[9px] text-slate-500">{detail}</p></div></Panel>;
}

function ValueBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[9px] leading-relaxed text-slate-600">{value ? JSON.stringify(value, null, 2) : 'Not specified'}</pre></div>;
}
