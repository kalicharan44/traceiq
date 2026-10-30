import { useState } from 'react';
import { Bot, Sparkles, TriangleAlert } from 'lucide-react';
import { useNotifications } from '../app/providers';
import { Button } from '../components/common/Button';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { aiApi, type AiInvestigationAnswer } from '../services/api/aiApi';
import { traceabilityApi } from '../services/api/traceabilityApi';

export function AiInvestigationScreen() {
  const { notify } = useNotifications();
  const [targetInput, setTargetInput] = useState('RAW-1042');
  const [target, setTarget] = useState('RAW-1042');
  const [question, setQuestion] = useState('Summarize the verified downstream impact and identify evidence gaps.');
  const [answer, setAnswer] = useState<AiInvestigationAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const trace = useApiQuery((signal) => traceabilityApi.getTraceabilityGraph(target, signal), [target]);
  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    setTarget(targetInput.trim().toUpperCase());
    setBusy(true); setAnswer(null);
    try {
      const result = await aiApi.investigate(targetInput.trim().toUpperCase(), question);
      setAnswer(result);
    } catch (error) { notify('Investigation request failed', error instanceof Error ? error.message : 'Request failed', 'error'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Evidence-grounded assistance</p><h2 className="mt-1 text-2xl font-bold text-slate-950">AI investigation workspace</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">The backend sends a limited set of verified records and deterministic findings to Gemini. AI explanations are advisory and cannot change scope or approve actions.</p></div>
    <Panel><PanelHeader title="Ask about a trace" subtitle="Choose a lot, ask an investigative question, and review the evidence used in the response." /><form onSubmit={ask} className="space-y-3 p-5"><div className="grid gap-3 sm:grid-cols-[220px_1fr]"><label className="text-xs font-semibold text-slate-600">Target lot<input value={targetInput} onChange={(event) => setTargetInput(event.target.value)} required className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-violet-400" /></label><label className="text-xs font-semibold text-slate-600">Question<input value={question} onChange={(event) => setQuestion(event.target.value)} required minLength={3} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-400" /></label></div><Button type="submit" disabled={busy}><Sparkles className="h-4 w-4" />{busy ? 'Reviewing evidence…' : 'Generate evidence summary'}</Button></form></Panel>
    {trace.loading && <LoadingState label="Loading verified trace evidence…" />}{trace.error && <ErrorState message={trace.error} retry={trace.reload} />}
    {trace.data && <Panel><PanelHeader title="Verified evidence supplied to the investigation" subtitle={`Target ${trace.data.target_id} · ${trace.data.finished_lots.length} finished lots · ${trace.data.shipment_ids.length} shipments · ${trace.data.customer_ids.length} linked customers`} /><div className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Deterministic trace</p><div className="mt-2 flex flex-wrap gap-1.5">{trace.data.finished_lots.slice(0, 8).map((id) => <span key={id} className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10px] text-emerald-800">{id}</span>)}</div></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Known gaps</p>{trace.data.missing_links.length ? <ul className="mt-2 space-y-1">{trace.data.missing_links.slice(0, 6).map((gap) => <li key={gap} className="flex gap-1.5 text-[10px] leading-relaxed text-amber-800"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />{gap}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">No missing links found in this trace.</p>}</div></div></Panel>}
    {busy && <LoadingState label="Generating a structured explanation…" />}
    {answer && <Panel><PanelHeader title="Investigation response" subtitle="Generated from the evidence shown above; review the uncertainties before acting." action={<StatusBadge status={answer.generated_by_ai ? 'AI GENERATED' : 'AI UNAVAILABLE'} />} /><div className="space-y-5 p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Bot className="h-5 w-5" /></span><p className="text-sm leading-relaxed text-slate-700">{answer.summary}</p></div><div className="grid gap-4 md:grid-cols-3">{[['Evidence references', answer.evidence], ['Uncertainties', answer.uncertainties], ['Suggested next steps', answer.suggested_next_steps]].map(([title, items]) => <div key={String(title)} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold text-slate-900">{title}</p><ul className="mt-2 space-y-2">{(items as string[]).length ? (items as string[]).map((item) => <li key={item} className="text-xs leading-relaxed text-slate-600">• {item}</li>) : <li className="text-xs text-slate-400">None provided.</li>}</ul></div>)}</div><p className="rounded-lg bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">AI output is advisory. Recall scope, quality outcomes, and authorization remain controlled by backend rules and human review.</p></div></Panel>}
  </div>;
}
