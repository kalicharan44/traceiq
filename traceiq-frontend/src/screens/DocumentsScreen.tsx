import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, Check, CheckCircle2, ChevronDown, Clock3, FileCheck2, FileText, Filter, Link2, LoaderCircle, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, Upload, XCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { documentsApi, type UploadProgress } from '../services/api/documentsApi';
import type { DocumentField, DocumentRecord, ValidationFinding, ValidationRun } from '../types/api';

const categories = ['AUTO', 'PURCHASE_ORDER', 'SUPPLIER_INVOICE', 'GOODS_RECEIPT_NOTE', 'DELIVERY_CHALLAN', 'PACKING_LIST', 'CERTIFICATE_OF_ANALYSIS', 'MATERIAL_INSPECTION_REPORT', 'BATCH_MANUFACTURING_RECORD', 'SHIPMENT_RECORD', 'PROOF_OF_DELIVERY', 'CUSTOMER_COMPLAINT', 'RECALL_NOTICE', 'OTHER'];
const statusOptions = ['', 'UPLOADED', 'QUEUED', 'EXTRACTING', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED', 'REJECTED'];
const dateTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const sizeLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const duplicateDocumentId = (detail: string) => detail.match(/already stored as\s+(DOC-[A-Z0-9-]+)/i)?.[1] ?? '';

function FieldRow({ field, value, editable, onChange }: { field: DocumentField; value: unknown; editable: boolean; onChange: (value: string) => void }) {
  const shown = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return <label className="block rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
    <span className="flex items-center justify-between gap-3"><span className="text-[11px] font-bold text-slate-700">{pretty(field.field_name)}</span><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{field.confidence === null ? 'Unscored' : `${Math.round(field.confidence * 100)}% confidence`}</span></span>
    <input aria-label={pretty(field.field_name)} disabled={!editable} value={shown} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 disabled:cursor-not-allowed disabled:opacity-70" placeholder="No value extracted" />
    <span className="mt-1 block truncate text-[9px] text-slate-500">{field.source_reference ?? 'Source unavailable'}{field.page_number ? ` · page ${field.page_number}` : ''} · {field.method}</span>
  </label>;
}

export function DocumentsScreen() {
  const [searchText, setSearchText] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(window.location.search).get('status') ?? '');
  const [category, setCategory] = useState('AUTO');
  const [uploadMode, setUploadMode] = useState<'bulk' | 'single'>('bulk');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [reopenedReviewId, setReopenedReviewId] = useState('');
  const [focusDetailsAfterSelection, setFocusDetailsAfterSelection] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});
  const [reviewNote, setReviewNote] = useState('');
  const [linkType, setLinkType] = useState('LOT');
  const [linkId, setLinkId] = useState('');
  const detailPanelsRef = useRef<HTMLDivElement>(null);

  const docs = useApiQuery((signal) => documentsApi.list({ q: search, status: statusFilter || undefined, limit: 100 }, signal), [search, statusFilter]);
  const selected = useMemo(() => docs.data?.items.find((item) => item.id === selectedId) ?? docs.data?.items[0] ?? null, [docs.data, selectedId]);
  const detail = useApiQuery((signal) => selected ? documentsApi.detail(selected.id, signal) : Promise.resolve(null), [selected?.id]);
  const processing = useApiQuery((signal) => selected ? documentsApi.processingStatus(selected.id, signal) : Promise.resolve(null), [selected?.id]);
  const runs = useApiQuery((signal) => selected ? documentsApi.runs({ entity_type: 'DOCUMENT', entity_id: selected.id, limit: 10 }, signal) : Promise.resolve({ items: [], total: 0, offset: 0, limit: 10 }), [selected?.id]);
  const currentDetail = detail.data?.id === selected?.id ? detail.data : null;
  const currentProcessing = processing.data?.document_id === selected?.id ? processing.data : null;
  const latestRun = runs.data?.items.find((run) => run.entity_id === selected?.id) ?? null;
  const findings = useApiQuery((signal) => latestRun ? documentsApi.findings({ run_id: latestRun.id, limit: 20 }, signal) : Promise.resolve({ items: [], total: 0, offset: 0, limit: 20 }), [latestRun?.id]);
  const latestFindings = findings.data?.items.filter((finding) => finding.run_id === latestRun?.id) ?? [];

  useEffect(() => {
    if (!selected || !['QUEUED', 'EXTRACTING', 'EXTRACTED'].includes(selected.status)) return;
    const timer = window.setInterval(() => { docs.reload(); detail.reload(); processing.reload(); }, 1400);
    return () => window.clearInterval(timer);
  }, [selected?.id, selected?.status, docs.reload, detail.reload, processing.reload]);

  useEffect(() => {
    setEditedFields({});
    setReviewNote('');
    setLinkId('');
    setReopenedReviewId('');
  }, [selected?.id]);

  useEffect(() => {
    if (!focusDetailsAfterSelection || !selectedId || selected?.id !== selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      detailPanelsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFocusDetailsAfterSelection(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusDetailsAfterSelection, selected?.id, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function upload(files: FileList | File[]) {
    if (!files.length) return;
    setUploadError(''); setUploadProgress({ loaded: 0, total: 0, percent: 0 });
    try {
      const result = await documentsApi.uploadBatch(Array.from(files), category, setUploadProgress);
      setPendingFiles([]);
      const duplicate = result.errors.find((item) => duplicateDocumentId(item.detail));
      const existingDocumentId = duplicate ? duplicateDocumentId(duplicate.detail) : '';
      const otherErrors = result.errors.filter((item) => !duplicateDocumentId(item.detail));

      if (existingDocumentId || result.documents[0]) {
        const targetId = existingDocumentId || result.documents[0].id;
        setSearchText('');
        setSearch('');
        setStatusFilter('');
        window.history.replaceState({}, '', window.location.pathname);
        setSelectedId(targetId);
        setFocusDetailsAfterSelection(true);
      }

      if (existingDocumentId) {
        setToast(`Matching file already exists. Opened document ${existingDocumentId} below so you can inspect its details and review status.`);
      } else {
        setToast(`${result.uploaded} document${result.uploaded === 1 ? '' : 's'} added to the private review queue${result.rejected ? ` · ${result.rejected} rejected` : ''}.`);
      }
      setUploadError(otherErrors.length ? otherErrors.map((item) => `${item.filename}: ${item.detail}`).join(' ') : '');
      docs.reload();
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'The upload could not be completed.'); }
    finally { setUploadProgress(null); }
  }

  function queueFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setUploadError('');
    if (uploadMode === 'single') {
      setPendingFiles(incoming.slice(0, 1));
      if (incoming.length > 1) setUploadError('Single document mode accepts one file. The first file was added to the queue.');
      return;
    }
    setPendingFiles((current) => {
      const combined = [...current, ...incoming];
      const seen = new Set<string>();
      return combined.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); queueFiles(event.dataTransfer.files);
  }

  async function processSelected() {
    if (!selected) return;
    setBusy('process'); setUploadError('');
    try { await documentsApi.process(selected.id); docs.reload(); detail.reload(); processing.reload(); setToast('Extraction started. The source remains unverified until a reviewer approves it.'); }
    catch (error) { setUploadError(error instanceof Error ? error.message : 'Could not start extraction.'); }
    finally { setBusy(''); }
  }

  async function saveReview(decision: 'VERIFIED' | 'REJECTED') {
    if (!selected) return;
    setBusy(decision); setUploadError('');
    const initial = Object.fromEntries((currentDetail?.latest_extraction?.fields ?? []).map((field) => [field.field_name, field.value]));
    try {
      await documentsApi.review(selected.id, { decision, reviewer: 'TraceIQ Operator', note: reviewNote, reviewed_fields: { ...initial, ...editedFields } });
      setReopenedReviewId('');
      setToast(decision === 'VERIFIED' ? 'Review saved. The verified record is ready for deterministic checks.' : 'Document rejected. The review decision is in the audit trail.');
      setStatusFilter('');
      docs.reload(); detail.reload(); processing.reload();
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Review could not be saved.'); }
    finally { setBusy(''); }
  }

  async function reopenReview() {
    if (!selected || selected.status !== 'VERIFIED') return;
    setBusy('reopen'); setUploadError('');
    try {
      await documentsApi.reopenReview(selected.id, {
        reopened_by: 'TraceIQ Operator',
        reason: 'Reviewer requested a second look at the extracted fields.',
      });
      setReopenedReviewId(selected.id);
      setEditedFields({});
      setReviewNote('');
      setStatusFilter('');
      docs.reload(); detail.reload(); processing.reload();
      setToast('Review reopened. Inspect the extracted fields, then choose Reject or Verify extraction.');
    } catch (error) { setUploadError(error instanceof Error ? error.message : 'Could not reopen this review.'); }
    finally { setBusy(''); }
  }

  async function createLink() {
    if (!selected || linkId.trim().length < 2) return;
    setBusy('link'); setUploadError('');
    try { await documentsApi.link(selected.id, { entity_type: linkType, entity_id: linkId.trim(), relationship: 'SUPPORTING_EVIDENCE', created_by: 'TraceIQ Operator' }); setLinkId(''); detail.reload(); setToast(`Evidence linked to ${linkType.toLowerCase().replace('_', ' ')} ${linkId.trim().toUpperCase()}.`); }
    catch (error) { setUploadError(error instanceof Error ? error.message : 'Could not link this document.'); }
    finally { setBusy(''); }
  }

  async function runChecks() {
    if (!selected) return;
    setBusy('checks'); setUploadError('');
    try { await documentsApi.runChecks(selected.id); runs.reload(); setToast('A new versioned validation run was recorded.'); }
    catch (error) { setUploadError(error instanceof Error ? error.message : 'Validation run failed.'); }
    finally { setBusy(''); }
  }

  const extraction = currentDetail?.latest_extraction;
  const processable = selected && ['UPLOADED', 'FAILED', 'REJECTED'].includes(selected.status);
  const reviewable = selected?.status === 'REVIEW_REQUIRED' || reopenedReviewId === selected?.id;
  const previewable = selected && ['pdf', 'png', 'jpg', 'jpeg'].includes(selected.file_type.toLowerCase());
  const passed = latestRun?.passed_count ?? 0;
  const totalCheckCount = latestRun ? passed + latestRun.failed_count + latestRun.incomplete_count + latestRun.warning_count : 0;

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600"><Sparkles className="h-3.5 w-3.5" /> Intelligent automation <span className="text-slate-400">/</span> Document intelligence</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Document intake & review</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Add supply-chain records, inspect extracted values, and verify evidence before it enters a workflow.</p></div>
      <div className="flex flex-wrap items-center gap-2"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" /><select aria-label="Filter documents by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="max-w-40 bg-transparent text-xs text-slate-700 outline-none">{statusOptions.map((item) => <option key={item} value={item}>{item ? pretty(item) : 'All statuses'}</option>)}</select><ChevronDown className="h-3 w-3" /></label><form onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); }} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search className="h-3.5 w-3.5 text-slate-400" /><input aria-label="Search documents" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Find a document…" className="w-36 bg-transparent text-xs outline-none sm:w-48" /></form><Button variant="secondary" onClick={() => docs.reload()} className="h-10"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button></div>
    </header>

    <Panel className={`overflow-hidden transition ${dragging ? 'border-teal-500 ring-2 ring-teal-500/20' : ''}`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Upload className="h-5 w-5" /></div><div><h2 className="text-sm font-bold text-slate-900">Secure document intake</h2><p className="mt-0.5 text-xs text-slate-500">Files stay private and receive a checksum on arrival.</p></div></div>
        <div role="tablist" aria-label="Upload mode" className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 sm:min-w-[260px]">
          <button id="bulk-upload-tab" type="button" role="tab" aria-controls="upload-dropzone" aria-selected={uploadMode === 'bulk'} onClick={() => { setUploadMode('bulk'); setUploadError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${uploadMode === 'bulk' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulk upload</button>
          <button id="single-upload-tab" type="button" role="tab" aria-controls="upload-dropzone" aria-selected={uploadMode === 'single'} onClick={() => { setUploadMode('single'); setPendingFiles((current) => current.slice(0, 1)); setUploadError(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${uploadMode === 'single' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Single document</button>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
        <div>
          <label className="mb-2 block text-[11px] font-bold text-slate-700" htmlFor="document-category">Document category</label>
          <select id="document-category" aria-label="Document category" value={category} onChange={(event) => setCategory(event.target.value)} className="mb-4 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 sm:max-w-sm">{categories.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
          <div id="upload-dropzone" role="tabpanel" aria-labelledby={uploadMode === 'bulk' ? 'bulk-upload-tab' : 'single-upload-tab'} aria-label="File drop zone" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition sm:min-h-[240px] ${dragging ? 'border-teal-500 bg-teal-50' : 'border-teal-200 bg-teal-50/40 hover:border-teal-400 hover:bg-teal-50/70'}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm"><Upload className="h-5 w-5" /></div>
            <p className="mt-4 text-sm font-bold text-slate-800">Drag and drop {uploadMode === 'bulk' ? 'your files' : 'a document'} here</p>
            <p className="mt-1 text-xs text-slate-500">or choose {uploadMode === 'bulk' ? 'files' : 'a file'} from your device</p>
            <label className="mt-4 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white transition hover:bg-teal-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2"><Upload className="h-3.5 w-3.5" />Browse {uploadMode === 'bulk' ? 'files' : 'file'}<input type="file" multiple={uploadMode === 'bulk'} accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) queueFiles(event.target.files); event.target.value = ''; }} /></label>
            <p className="mt-3 text-[10px] text-slate-500">PDF, PNG, JPG, DOCX, XLSX or CSV · up to 15 MB per file</p>
          </div>
        </div>

        <aside className="flex flex-col rounded-2xl bg-slate-50 p-4 sm:p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-700" /><h3 className="text-xs font-bold text-slate-800">Upload workflow</h3></div>
          <ol className="mt-4 space-y-4">
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">1</span><span><b className="block text-[11px] text-slate-700">Choose a category</b><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">Classify the source record before it enters the review queue.</span></span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">2</span><span><b className="block text-[11px] text-slate-700">Upload privately</b><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">TraceIQ stores the original and detects checksum duplicates.</span></span></li>
            <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">3</span><span><b className="block text-[11px] text-slate-700">Review before use</b><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">Extracted values need a human decision before validation.</span></span></li>
          </ol>
          <div className="mt-auto pt-5"><div className="rounded-xl border border-teal-100 bg-white px-3 py-2.5"><p className="text-[10px] font-bold text-teal-800">Supported formats</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">PDF · Images · Word · Excel · CSV</p></div></div>
        </aside>
      </div>

      {pendingFiles.length > 0 && <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-bold text-slate-800">Ready to upload <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-800">{pendingFiles.length}</span></h3><button type="button" onClick={() => setPendingFiles([])} className="text-[10px] font-semibold text-slate-500 hover:text-rose-700">Clear selection</button></div>
        <div className="max-h-44 space-y-2 overflow-y-auto">{pendingFiles.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-slate-700">{file.name}</span><span className="text-[9px] text-slate-500">{sizeLabel(file.size)} · {file.name.split('.').pop()?.toUpperCase() ?? 'FILE'}</span></span><button type="button" onClick={() => setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`} className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><XCircle className="h-4 w-4" /></button></div>)}</div>
      </div>}

      {(uploadProgress || uploadError) && <div className="border-t border-slate-100 px-4 py-3 sm:px-5">{uploadProgress && <div className="flex items-center gap-3 text-xs text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin text-teal-600" /><span>Uploading documents…</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${uploadProgress.percent}%` }} /></div><span>{uploadProgress.percent}%</span></div>}{uploadError && <p role="alert" className="mt-1 text-xs font-medium text-rose-700">{uploadError}</p>}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-5"><p className="text-[10px] text-slate-500">Original files remain private; extracted data stays unverified until reviewed.</p><Button onClick={() => void upload(pendingFiles)} disabled={!pendingFiles.length || !!uploadProgress} className="min-w-36">{uploadProgress ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload {pendingFiles.length || ''} {pendingFiles.length === 1 ? 'document' : 'documents'}</Button></div>
    </Panel>

    <div ref={detailPanelsRef} className="grid scroll-mt-20 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.16fr)_minmax(340px,0.9fr)_minmax(280px,0.72fr)]">
      <Panel className="min-w-0 overflow-hidden">
        <PanelHeader title={selected?.filename ?? 'Source document'} subtitle={selected ? `${pretty(selected.category)} · ${sizeLabel(selected.size_bytes)} · ${selected.id}` : 'Select a document to review'} action={selected && <a href={documentsApi.contentUrl(selected.id, true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><ArrowDownToLine className="h-3.5 w-3.5" />Download</a>} />
        <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2"><span className="rounded-md bg-teal-50 px-2.5 py-1.5 text-[10px] font-bold text-teal-700">Source document</span><span className="ml-auto"><StatusBadge status={selected?.status ?? 'NO DOCUMENT'} /></span></div>
        <div className="min-h-[370px] bg-slate-100 p-3 sm:min-h-[520px] sm:p-4">
          {!selected ? <EmptyState title="No documents in this queue" detail="Drop files above or choose files to begin a traceable review." /> : detail.loading && !currentDetail ? <LoadingState label="Loading private source…" /> : previewable ? <iframe title={`Preview of ${selected.filename}`} src={documentsApi.contentUrl(selected.id)} className="h-[470px] w-full rounded-lg border border-slate-200 bg-white sm:h-[600px]" /> : extraction?.extracted_text ? <pre className="h-[470px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-5 font-mono text-xs leading-6 text-slate-700 sm:h-[600px]">{extraction.extracted_text}</pre> : <div className="flex h-[470px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center sm:h-[600px]"><FileText className="h-9 w-9 text-slate-300" /><p className="mt-4 text-sm font-bold text-slate-700">Source preview is preparing</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">Start extraction to create a searchable text preview, or download the private original.</p></div>}
        </div>
      </Panel>

      <Panel className="min-w-0 overflow-hidden">
        <PanelHeader title="Extracted data" subtitle={extraction ? `${extraction.fields.length} candidate fields · ${extraction.extractor_version}` : 'Field extraction requires an explicit processing step'} action={extraction && <span className="rounded-full bg-teal-50 px-2 py-1 text-[9px] font-bold text-teal-700">{extraction.schema_version}</span>} />
        <div className="max-h-[650px] space-y-3 overflow-y-auto p-4">
          {detail.loading && !currentDetail ? <LoadingState label="Loading extraction…" /> : detail.error ? <ErrorState message={detail.error} retry={detail.reload} /> : !selected ? <EmptyState title="Choose a source file" detail="Extracted values and provenance will appear here." /> : !extraction ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><FileCheck2 className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-800">No extraction yet</p><p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">Run the deterministic file readers first. Candidate values remain unverified until a reviewer acts.</p>{processable && <Button onClick={() => void processSelected()} disabled={!!busy} className="mt-4">{busy === 'process' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Start extraction</Button>}{selected.status === 'QUEUED' || selected.status === 'EXTRACTING' ? <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-teal-700"><LoaderCircle className="h-4 w-4 animate-spin" />Extraction in progress…</p> : null}{selected.processing_error && <p className="mt-3 text-xs text-rose-700">{selected.processing_error}</p>}</div> : <>
            {extraction.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-[11px] font-bold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" />Review warnings</p><ul className="mt-1.5 list-disc space-y-1 pl-5 text-[10px] leading-relaxed text-amber-800">{extraction.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div>}
            {processable && <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] leading-relaxed text-amber-900">This file can be processed again. Previous values remain visible for reference.</p><Button variant="secondary" onClick={() => void processSelected()} disabled={!!busy} className="shrink-0 px-2.5 py-1.5 text-[10px]">{busy === 'process' ? 'Queueing…' : 'Retry extraction'}</Button></div>}
            {extraction.fields.length ? <div className="space-y-2">{extraction.fields.map((field, index) => <FieldRow key={`${field.field_name}-${index}`} field={field} value={editedFields[field.field_name] ?? field.value} editable={!!reviewable} onChange={(value) => setEditedFields((current) => ({ ...current, [field.field_name]: value }))} />)}</div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No structured fields were detected. Inspect the extracted source text before recording a decision.</div>}
            {selected.status === 'VERIFIED' && reopenedReviewId !== selected.id && <div className="rounded-lg border border-teal-200 bg-teal-50 p-3"><p className="text-[10px] leading-relaxed text-teal-900">This extraction has a saved verification. Reopen it to record a new review decision; the existing decision stays in the activity history.</p><Button variant="secondary" onClick={() => void reopenReview()} disabled={!!busy} className="mt-2 border-teal-300 text-teal-800 hover:bg-teal-100">{busy === 'reopen' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}{busy === 'reopen' ? 'Reopening…' : 'Reopen review'}</Button></div>}
            <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Review note</span><textarea aria-label="Review note" aria-describedby={!reviewable ? 'review-state-hint' : undefined} disabled={!reviewable} value={reviewable ? reviewNote : currentDetail?.latest_review?.note ?? ''} onChange={(event) => setReviewNote(event.target.value)} rows={2} placeholder="Optional reviewer note…" className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:opacity-70" /></label>
            <div className="grid grid-cols-2 gap-2"><Button variant="secondary" disabled={!reviewable || !!busy} onClick={() => void saveReview('REJECTED')} className="border-rose-200 text-rose-700"><XCircle className="h-4 w-4" />Reject</Button><Button disabled={!reviewable || !!busy} onClick={() => void saveReview('VERIFIED')} className="bg-teal-600 hover:bg-teal-700"><ShieldCheck className="h-4 w-4" />{busy === 'VERIFIED' ? 'Saving…' : 'Verify extraction'}</Button></div>
            {!reviewable && <p id="review-state-hint" role="note" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600">{selected.status === 'VERIFIED' ? <>This document was verified{currentDetail?.latest_review?.reviewer ? <> by <b>{currentDetail.latest_review.reviewer}</b></> : ''}. Its last saved note is shown above. Use <b>Reopen review</b> to enable a new decision.</> : selected.status === 'REJECTED' ? <>This document was rejected. Choose <b>Retry extraction</b> above to create a fresh review step; Reject and Verify unlock when the new extraction reaches Review Required.</> : <>Review actions unlock when the document status is <b>Review Required</b>. Current status: <b>{pretty(selected.status)}</b>.</>}</p>}
          </>}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel className="overflow-hidden"><PanelHeader title="Validation checks" subtitle="Deterministic rules with a recorded version" action={<span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{totalCheckCount || '—'} checks</span>} />
          <div className="p-4">{latestRun ? <><div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-teal-500 text-center"><span className="text-sm font-bold text-slate-900">{passed}/{totalCheckCount}</span><span className="text-[8px] font-bold uppercase text-slate-500">Pass</span></div><div className="min-w-0 flex-1"><StatusBadge status={latestRun.status} /><p className="mt-1 truncate text-[9px] text-slate-500">Run {latestRun.id}</p><p className="text-[9px] text-slate-500">{dateTime(latestRun.created_at)}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-center">{[['Passed', latestRun.passed_count, 'text-emerald-600'], ['Warnings', latestRun.warning_count, 'text-amber-600'], ['Failed', latestRun.failed_count + latestRun.incomplete_count, 'text-rose-600']].map(([label, count, color]) => <div key={String(label)} className="rounded-lg border border-slate-100 p-2"><p className={`text-lg font-bold ${color}`}>{count}</p><p className="text-[9px] text-slate-500">{label}</p></div>)}</div>{latestFindings.map((finding) => <FindingSummary key={finding.id} finding={finding} />)}</> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-xs font-bold text-slate-700">No validation run yet</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Verify this document before running checks against its linked records.</p></div>}
            <Button variant="secondary" disabled={!selected || selected.status !== 'VERIFIED' || !!busy} onClick={() => void runChecks()} className="mt-3 w-full">{busy === 'checks' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}Run checks</Button>
          </div>
        </Panel>
        <Panel className="overflow-hidden"><PanelHeader title="Evidence links" subtitle="Attach source evidence to a known supply chain record" action={<Link2 className="h-4 w-4 text-slate-400" />} /><div className="space-y-3 p-4">
          {currentDetail?.links?.length ? <div className="space-y-1.5">{currentDetail.links.map((link) => <div key={link.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2"><span className="text-[10px] font-bold text-slate-600">{pretty(link.entity_type)}</span><span className="font-mono text-[10px] font-semibold text-slate-800">{link.entity_id}</span></div>)}</div> : <p className="text-[10px] text-slate-500">No business record linked.</p>}
          <div className="flex gap-2"><select aria-label="Link entity type" value={linkType} onChange={(event) => setLinkType(event.target.value)} className="h-9 w-[42%] rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none">{['SUPPLIER', 'LOT', 'PRODUCT', 'PRODUCTION_ORDER', 'SHIPMENT', 'CUSTOMER', 'RECALL'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select><input aria-label="Link entity id" value={linkId} onChange={(event) => setLinkId(event.target.value)} placeholder="Record ID" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-[10px] outline-none focus:border-teal-500" /><Button aria-label="Link document" disabled={!selected || linkId.trim().length < 2 || !!busy} onClick={() => void createLink()} className="h-9 w-9 px-0"><Link2 className="h-4 w-4" /></Button></div>
        </div></Panel>
        <Panel className="overflow-hidden"><PanelHeader title="Activity timeline" subtitle="Source processing events and decisions" action={<Clock3 className="h-4 w-4 text-slate-400" />} /><div className="space-y-0 p-4">{currentProcessing?.events?.length ? currentProcessing.events.slice().reverse().map((event, index) => <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0"><div className="relative flex w-4 shrink-0 justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-teal-500 ring-4 ring-teal-500/10' : 'bg-slate-300'}`} />{index < currentProcessing.events.length - 1 && <span className="absolute top-4 h-full w-px bg-slate-200" />}</div><div className="min-w-0"><p className="text-[10px] font-bold text-slate-800">{event.message}</p><p className="mt-1 text-[9px] text-slate-500">{dateTime(event.created_at)} · {event.actor}</p></div></div>) : <p className="text-[10px] text-slate-500">No recorded activity yet.</p>}</div></Panel>
      </div>
    </div>

    <Panel className="overflow-hidden"><PanelHeader title="Recent documents" subtitle="Choose a source to inspect its extraction, evidence, and review state." action={<span className="text-[10px] font-semibold text-slate-500">{docs.data?.total ?? 0} records</span>} />
      {docs.loading && !docs.data ? <div className="p-4"><LoadingState label="Loading document registry…" /></div> : docs.error ? <div className="p-4"><ErrorState message={docs.error} retry={docs.reload} /></div> : docs.data?.items.length ? <div className="grid divide-y divide-slate-100 md:grid-cols-2 2xl:grid-cols-3 2xl:divide-y-0">{docs.data.items.map((document: DocumentRecord) => <button key={document.id} onClick={() => setSelectedId(document.id)} className={`flex min-w-0 items-center gap-3 p-3 text-left transition hover:bg-slate-50 ${selected?.id === document.id ? 'bg-teal-50/70' : ''}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected?.id === document.id ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{document.filename}</span><span className="mt-0.5 block truncate text-[9px] text-slate-500">{pretty(document.category)} · {sizeLabel(document.size_bytes)} · {dateTime(document.created_at)}</span></span><StatusBadge status={document.status} /></button>)}</div> : <div className="p-4"><EmptyState title="Nothing matches this filter" detail="Change the status or search, or add a new file above." /></div>}
    </Panel>
    {toast && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification" className="ml-1 text-slate-400"><XCircle className="h-4 w-4" /></button></div>}
  </div>;
}

function FindingSummary({ finding }: { finding: ValidationFinding }) {
  const color = finding.status === 'FAIL' ? 'border-rose-200 bg-rose-50 text-rose-800' : finding.status === 'INCOMPLETE' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700';
  return <div className={`mt-2 rounded-lg border p-2.5 ${color}`}><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold">{finding.title}</p><StatusBadge status={finding.status} /></div><p className="mt-1 text-[9px] leading-relaxed opacity-80">{finding.suggested_action}</p></div>;
}
