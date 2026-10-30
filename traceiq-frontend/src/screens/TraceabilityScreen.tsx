import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Factory, GitBranch, Plus, Search, TriangleAlert } from 'lucide-react';
import { useNotifications } from '../app/providers';
import { useApiQuery } from '../hooks/useApiQuery';
import { traceabilityApi } from '../services/api/traceabilityApi';
import { lotsApi } from '../services/api/lotsApi';
import { productionApi } from '../services/api/productionApi';
import type { QuantityFinding, TraceabilityResult } from '../types/api';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { TraceGraph } from '../components/features/traceability/TraceGraph';
import { EmptyState } from '../components/common/PageState';
import { documentsApi } from '../services/api/documentsApi';
import type { DocumentDetail } from '../types/api';

export function TraceabilityScreen() {
  const { notify } = useNotifications();
  const [input, setInput] = useState(() => new URLSearchParams(window.location.search).get('lot') ?? '');
  const [target, setTarget] = useState(() => new URLSearchParams(window.location.search).get('lot') ?? '');
  const [evidence, setEvidence] = useState<DocumentDetail | null>(null);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [intake, setIntake] = useState({ id: '', name: '', supplier_id: '', quantity: 0, unit: 'kg' });
  const [production, setProduction] = useState({ id: '', product_id: 'PROD-001', facility: 'Chicago Plant', input_lot_id: '', input_quantity: 0, input_unit: 'kg', output_lot_id: '', output_name: '', output_quantity: 0 });
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('lot');
    if (initial) { setInput(initial); setTarget(initial); }
  }, []);
  const query = useApiQuery((signal) => target ? traceabilityApi.getTraceabilityGraph(target, signal) : Promise.resolve(null), [target]);
  const result = query.data as TraceabilityResult | null;
  const search = (event: React.FormEvent) => { event.preventDefault(); if (input.trim()) setTarget(input.trim().toUpperCase()); };
  const uploadEvidence = async (file?: File) => {
    if (!file) return;
    setEvidenceError(''); setEvidenceBusy(true);
    try {
      const result = await documentsApi.uploadBatch([file], 'AUTO');
      if (!result.documents[0]) throw new Error(result.errors[0]?.detail ?? 'The document was not accepted.');
      let document = result.documents[0];
      await documentsApi.process(document.id);
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        const detail = await documentsApi.detail(document.id);
        if (detail.status === 'REVIEW_REQUIRED' || detail.status === 'FAILED') { setEvidence(detail); break; }
      }
      if (!evidence) {
        const detail = await documentsApi.detail(document.id);
        setEvidence(detail);
      }
    } catch (error) { setEvidenceError(error instanceof Error ? error.message : 'Evidence could not be processed.'); }
    finally { setEvidenceBusy(false); }
  };
  const reviewEvidence = async (decision: 'VERIFIED' | 'REJECTED') => {
    if (!evidence?.latest_extraction) return;
    setEvidenceBusy(true); setEvidenceError('');
    try {
      const fields = Object.fromEntries(evidence.latest_extraction.fields.map((field) => [field.field_name, editedValues[field.field_name] ?? (field.value == null ? '' : String(field.value))]));
      await documentsApi.review(evidence.id, { decision, reviewer: 'TraceIQ Operator', note: 'Reviewed candidate fields against source evidence.', reviewed_fields: fields });
      if (decision === 'VERIFIED') {
        const lotId = (editedValues.output_lot_id ?? editedValues.finished_lot_id ?? editedValues.lot_identifier ?? editedValues.material_lot_id ?? editedValues.input_lot_id ?? '').trim();
        if (lotId) await documentsApi.link(evidence.id, { entity_type: 'LOT', entity_id: lotId.toUpperCase(), relationship: 'SUPPORTING_EVIDENCE', created_by: 'TraceIQ Operator' });
        setTarget(lotId.toUpperCase()); setInput(lotId.toUpperCase());
      }
      setEvidence(await documentsApi.detail(evidence.id));
      notify(decision === 'VERIFIED' ? 'Evidence reviewed' : 'Candidates rejected', decision === 'VERIFIED' ? 'Confirmed fields are saved; only links to existing lots are added to the trace.' : 'Unconfirmed candidates were not linked to trace records.', decision === 'VERIFIED' ? 'success' : 'info');
    } catch (error) { setEvidenceError(error instanceof Error ? error.message : 'Review could not be saved.'); }
    finally { setEvidenceBusy(false); }
  };
  const createIntake = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const lot = await lotsApi.create({ ...intake, id: intake.id.trim().toUpperCase(), supplier_id: intake.supplier_id.trim().toUpperCase(), lot_type: 'RAW' });
      setIntakeOpen(false); setTarget(lot.id); setInput(lot.id); notify('Raw lot received', `${lot.id} is recorded and waiting for quality approval.`);
    } catch (error) { notify('Lot intake failed', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  const createProduction = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const order = await productionApi.create({ id: production.id.trim().toUpperCase(), product_id: production.product_id.trim().toUpperCase(), facility: production.facility, input_lots: [{ lot_id: production.input_lot_id.trim().toUpperCase(), quantity: production.input_quantity, unit: production.input_unit }], output_lots: [{ lot_id: production.output_lot_id.trim().toUpperCase(), name: production.output_name, quantity: production.output_quantity, unit: 'units' }] });
      const output = order.output_lots[0]; setProductionOpen(false); setTarget(output); setInput(output); notify('Production genealogy recorded', `${order.id} created ${output} in pending-quality state.`);
    } catch (error) { notify('Production order rejected', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };

  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Genealogy explorer</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Trace a material or finished lot</h2><p className="mt-2 text-sm text-slate-500">Follow verified relationships upstream to suppliers and downstream to products, inventory, shipments, and customers.</p></div>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setIntakeOpen((open) => !open)}><Plus className="h-4 w-4" />Receive raw material</Button><Button variant="secondary" onClick={() => setProductionOpen((open) => !open)}><Factory className="h-4 w-4" />Record production order</Button></div>
    {intakeOpen && <Panel><PanelHeader title="Raw-material intake" subtitle="New material remains pending until a deterministic quality check passes." /><form onSubmit={createIntake} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5"><input required value={intake.id} onChange={(event) => setIntake((current) => ({ ...current, id: event.target.value }))} placeholder="Lot ID" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={intake.name} onChange={(event) => setIntake((current) => ({ ...current, name: event.target.value }))} placeholder="Material name" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><input required value={intake.supplier_id} onChange={(event) => setIntake((current) => ({ ...current, supplier_id: event.target.value }))} placeholder="Qualified supplier ID" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required type="number" min="0.01" step="0.01" value={intake.quantity || ''} onChange={(event) => setIntake((current) => ({ ...current, quantity: Number(event.target.value) }))} placeholder="Quantity" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><Button type="submit" className="h-10">Record intake</Button></form></Panel>}
    {productionOpen && <Panel><PanelHeader title="Production order & bill of materials" subtitle="Only approved, traceable raw-material inputs are accepted. Output lots begin in pending-quality state." /><form onSubmit={createProduction} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><input required value={production.id} onChange={(event) => setProduction((current) => ({ ...current, id: event.target.value }))} placeholder="Production order ID" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={production.product_id} onChange={(event) => setProduction((current) => ({ ...current, product_id: event.target.value }))} placeholder="Product ID" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={production.input_lot_id} onChange={(event) => setProduction((current) => ({ ...current, input_lot_id: event.target.value }))} placeholder="Approved input lot" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required type="number" min="0.01" step="0.01" value={production.input_quantity || ''} onChange={(event) => setProduction((current) => ({ ...current, input_quantity: Number(event.target.value) }))} placeholder="Input quantity (kg)" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><input required value={production.output_lot_id} onChange={(event) => setProduction((current) => ({ ...current, output_lot_id: event.target.value }))} placeholder="Finished lot ID" className="h-10 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={production.output_name} onChange={(event) => setProduction((current) => ({ ...current, output_name: event.target.value }))} placeholder="Output name" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><input required type="number" min="0.01" step="0.01" value={production.output_quantity || ''} onChange={(event) => setProduction((current) => ({ ...current, output_quantity: Number(event.target.value) }))} placeholder="Output quantity (units)" className="h-10 rounded-lg border border-slate-200 px-3 text-xs" /><Button type="submit" className="h-10">Save production links</Button></form></Panel>}
    <Panel><div className="flex flex-col gap-3 p-4 sm:flex-row"><form onSubmit={search} className="flex min-w-0 flex-1 gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter an existing lot ID" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100" /></div><Button type="submit" className="h-11"><Search className="h-4 w-4" />Trace lot</Button></form><label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-teal-200 bg-white px-4 text-xs font-semibold text-teal-800 hover:bg-teal-50">Upload evidence<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.csv,.xlsx" className="hidden" onChange={(event) => { void uploadEvidence(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-1 text-teal-700"><ArrowUpFromLine className="h-3 w-3" />Upstream</span><span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700"><ArrowDownToLine className="h-3 w-3" />Downstream</span></div></div></Panel>

    {!target && <Panel><PanelHeader title="Start with a verified lot or supporting evidence" subtitle="Search an existing lot ID, or upload a document to review candidate supply-chain fields." /><div className="flex flex-wrap gap-3 p-4"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Upload evidence<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.csv,.xlsx" className="hidden" onChange={(event) => { void uploadEvidence(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><span className="self-center text-xs text-slate-500">PDF, image, DOCX, CSV, or XLSX · originals remain private</span></div></Panel>}
    {evidenceBusy && <LoadingState label="Uploading or processing evidence…" />}
    {evidenceError && <ErrorState message={evidenceError} />}
    {evidence && <Panel><PanelHeader title={`Evidence review · ${evidence.filename}`} subtitle={`Document ${evidence.id} · ${evidence.status} · candidate values are not verified business records`} /><div className="space-y-3 p-4">{evidence.status === 'FAILED' && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{evidence.processing_error ?? 'Extraction failed. You can upload another document or use manual lot intake.'}</p>}{evidence.latest_extraction?.warnings.map((warning) => <p key={warning} className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{warning}</p>)}{evidence.latest_extraction?.fields.map((field, index) => <label key={`${field.field_name}-${index}`} className="block rounded-lg border border-slate-200 p-3"><span className="text-xs font-bold text-slate-700">{field.field_name} <span className="font-normal text-slate-500">· {field.method} · {field.confidence == null ? 'confidence unavailable' : `${Math.round(field.confidence * 100)}%`}</span></span><input className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={editedValues[field.field_name] ?? (field.value == null ? '' : String(field.value))} onChange={(event) => setEditedValues((current) => ({ ...current, [field.field_name]: event.target.value }))} /><span className="mt-1 block text-[10px] text-slate-500">{field.source_reference ?? 'Source location unavailable'}{field.page_number ? ` · page ${field.page_number}` : ''} · “{field.source_snippet}”</span></label>)}{evidence.status === 'REVIEW_REQUIRED' && <div className="flex gap-2"><Button onClick={() => void reviewEvidence('VERIFIED')}>Confirm and link existing lot</Button><Button variant="secondary" onClick={() => void reviewEvidence('REJECTED')}>Reject candidates</Button></div>}{evidence.status === 'VERIFIED' && <p className="text-xs font-semibold text-emerald-700">Verified evidence. Linked records: {evidence.links.map((link) => `${link.entity_type} ${link.entity_id}`).join(', ') || 'none'}</p>}</div></Panel>}
    {target && query.loading && <LoadingState label={`Tracing ${target} through verified records…`} />}
    {target && query.error && <div><EmptyState title={`No verified trace found for ${target}`} detail={`${query.error} Search another lot, upload supporting evidence, or record a lot using manual intake. No demo records are shown in a live trace.`} /><button className="mt-2 text-xs font-semibold text-teal-700 underline" onClick={query.reload}>Retry trace</button></div>}
    {result && !query.loading && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Suppliers', result.suppliers.length], ['Raw lots', result.raw_lots.length], ['Production orders', result.production_orders.length], ['Finished lots', result.finished_lots.length], ['Customers', result.customer_ids.length],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}
      </div>
      {result.missing_links.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="text-xs font-bold text-amber-900">Traceability evidence is incomplete</p><ul className="mt-2 space-y-1">{result.missing_links.map((item) => <li key={item} className="text-xs leading-relaxed text-amber-800">{item}</li>)}</ul></div></div></div>}
      <Panel><PanelHeader title={`Network graph · ${result.target_id}`} subtitle="Drag nodes, pan, zoom, and use the minimap to inspect the connected supply chain." action={<span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"><GitBranch className="h-3 w-3" />{result.nodes.length} records</span>} /><TraceGraph result={result} /></Panel>
      <Panel><PanelHeader title="Quantity validation" subtitle="Finished-lot stock plus recorded shipments compared with produced quantity." /><div className="p-4"><DataTable<QuantityFinding> rows={result.quantity_findings} getKey={(row) => row.lot_id} emptyTitle="No finished lots in this trace" columns={[
        { key: 'lot', title: 'Finished lot', render: (row) => <span className="font-mono font-bold text-slate-800">{row.lot_id}</span> },
        { key: 'produced', title: 'Produced', render: (row) => `${row.produced_quantity.toLocaleString()} ${row.unit}` },
        { key: 'inventory', title: 'On hand', render: (row) => `${row.inventory_quantity.toLocaleString()} ${row.unit}` },
        { key: 'shipped', title: 'Shipped', render: (row) => `${row.shipped_quantity.toLocaleString()} ${row.unit}` },
        { key: 'difference', title: 'Difference', render: (row) => `${row.difference.toLocaleString()} ${row.unit}` },
        { key: 'status', title: 'Result', render: (row) => <StatusBadge status={row.status} /> },
      ]} /></div></Panel>
    </>}
  </div>;
}
