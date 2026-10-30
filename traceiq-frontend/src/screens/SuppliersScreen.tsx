import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Building2,
  ClipboardCheck,
  Globe2,
  Layers3,
  MapPin,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useNotifications } from '../app/providers';
import { navigate } from '../app/routes';
import { Button } from '../components/common/Button';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { suppliersApi } from '../services/api/suppliersApi';
import type { Lot, Supplier } from '../types/api';

type SupplierTab = 'details' | 'hierarchy';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatQuantity(lots: Lot[]) {
  const totals = new Map<string, number>();
  for (const lot of lots) totals.set(lot.unit, (totals.get(lot.unit) ?? 0) + lot.quantity);
  return [...totals.entries()].map(([unit, quantity]) => `${number.format(quantity)} ${unit}`).join(' · ');
}

function SupplierInfo({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
    <span className="mt-0.5 rounded-lg bg-white p-2 text-teal-700 shadow-sm"><Icon className="h-4 w-4" /></span>
    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{value || 'Not provided'}</p></div>
  </div>;
}

function SupplierDirectoryRow({ supplier, selected, onSelect }: { supplier: Supplier; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${selected ? 'border-teal-200 bg-teal-50 shadow-sm' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'}`}>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-teal-700'}`}><Building2 className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{supplier.name}</span><span className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500"><span className="font-mono">{supplier.id}</span><span>·</span><span className="truncate">{supplier.country || 'Country not set'}</span></span></span>
    <span className={`h-2 w-2 shrink-0 rounded-full ${supplier.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-400'}`} title={supplier.status.replaceAll('_', ' ').toLowerCase()} />
  </button>;
}

export function SuppliersScreen() {
  const { notify } = useNotifications();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', country: '' });
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [tab, setTab] = useState<SupplierTab>('details');

  const suppliers = useApiQuery((signal) => suppliersApi.list(query, signal), [query, version]);
  const supplierRows = suppliers.data ?? [];

  useEffect(() => {
    if (!suppliers.data) return;
    if (pendingSelection && suppliers.data.some((supplier) => supplier.id === pendingSelection)) {
      setSelectedId(pendingSelection);
      setPendingSelection(null);
      return;
    }
    if (!suppliers.data.some((supplier) => supplier.id === selectedId)) setSelectedId(suppliers.data[0]?.id ?? '');
  }, [suppliers.data, selectedId, pendingSelection]);

  const selectedSupplier = supplierRows.find((supplier) => supplier.id === selectedId) ?? null;
  const lots = useApiQuery((signal) => selectedSupplier ? suppliersApi.lots(selectedSupplier.id, signal) : Promise.resolve([]), [selectedSupplier?.id]);
  const rawLots = lots.data ?? [];
  const atRiskLots = useMemo(() => rawLots.filter((lot) => ['QUARANTINED', 'FLAGGED', 'HOLD', 'RECALLED'].includes(lot.status)).length, [rawLots]);
  const quantitySummary = useMemo(() => formatQuantity(rawLots), [rawLots]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      const supplier = await suppliersApi.create({ ...form, id: form.id.trim().toUpperCase(), name: form.name.trim(), country: form.country.trim() || 'Unknown' });
      setSearch('');
      setQuery('');
      setForm({ id: '', name: '', country: '' });
      setShowForm(false);
      setPendingSelection(supplier.id);
      setVersion((current) => current + 1);
      notify('Supplier registered', `${supplier.name} is awaiting qualification.`);
    } catch (error) {
      notify('Supplier registration failed', error instanceof Error ? error.message : 'Request failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(search.trim());
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700"><Layers3 className="h-3.5 w-3.5" /> Supply chain · master data</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Supplier master</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">Review source qualification, risk and the raw-material lots connected to each supplier.</p>
      </div>
      <Button onClick={() => setShowForm((open) => !open)} className="shrink-0"><Plus className="h-4 w-4" />{showForm ? 'Close form' : 'Register supplier'}</Button>
    </header>

    {showForm && <Panel className="overflow-hidden border-teal-100 shadow-md shadow-teal-950/5">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-teal-50 px-5 py-4"><span className="rounded-lg bg-white p-2 text-teal-700 shadow-sm"><Building2 className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Register a supplier</h3><p className="mt-1 text-xs text-slate-500">Create the supplier record. Qualification is completed through the quality workflow.</p></div></div>
      <form onSubmit={create} className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr_auto] xl:items-end">
        <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier ID</span><input required minLength={2} maxLength={40} value={form.id} onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))} placeholder="SUP-0042" className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Supplier name</span><input required minLength={2} maxLength={180} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Company or source name" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Country</span><input maxLength={100} value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="Country" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
        <Button type="submit" disabled={creating} className="h-10">{creating ? 'Registering…' : 'Create record'}</Button>
      </form>
    </Panel>}

    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Supplier directory</h3><p className="mt-1 text-[11px] text-slate-500">{suppliers.loading && !suppliers.data ? 'Loading records…' : `${supplierRows.length} supplier${supplierRows.length === 1 ? '' : 's'} shown`}</p></div><span className="rounded-lg bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{supplierRows.length}</span></div>
          <form onSubmit={submitSearch} className="mt-4 flex gap-2">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find supplier" aria-label="Find supplier" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-teal-400 focus:bg-white" /></div>
            <Button type="submit" variant="secondary" className="h-9 px-3 py-1.5">Search</Button>
          </form>
        </div>
        {suppliers.loading && !suppliers.data ? <div className="p-5"><LoadingState /></div> : suppliers.error ? <div className="p-4"><ErrorState message={suppliers.error} retry={suppliers.reload} /></div> : supplierRows.length ? <div className="max-h-[650px] space-y-1 overflow-y-auto p-2.5">{supplierRows.map((supplier) => <SupplierDirectoryRow key={supplier.id} supplier={supplier} selected={supplier.id === selectedId} onSelect={() => { setSelectedId(supplier.id); setTab('details'); }} />)}</div> : <div className="px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><PackageSearch className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-slate-800">No suppliers found</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Try another search, or register a supplier record.</p></div>}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3"><p className="text-[10px] leading-relaxed text-slate-500">Supplier qualification and status are governed by the quality workflow.</p></div>
      </Panel>

      {!selectedSupplier ? <Panel className="flex min-h-[420px] items-center justify-center p-8 text-center"><div className="max-w-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Building2 className="h-6 w-6" /></span><h3 className="mt-4 text-lg font-bold text-slate-900">Choose a supplier</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">Select a record from the directory to review its profile, risk and linked material lots.</p></div></Panel> : <section className="min-w-0 space-y-4">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex min-w-0 items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-900/15"><Building2 className="h-6 w-6" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xl font-bold tracking-tight text-slate-950">{selectedSupplier.name}</h3><StatusBadge status={selectedSupplier.status} /></div><p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="font-mono font-semibold text-slate-600">{selectedSupplier.id}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedSupplier.country || 'Country not set'}</span></p></div></div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"><ShieldCheck className={`h-4 w-4 ${selectedSupplier.risk_score >= 70 ? 'text-rose-600' : selectedSupplier.risk_score >= 40 ? 'text-amber-600' : 'text-teal-700'}`} /><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Risk score</p><p className={`text-sm font-bold ${selectedSupplier.risk_score >= 70 ? 'text-rose-700' : selectedSupplier.risk_score >= 40 ? 'text-amber-700' : 'text-teal-800'}`}>{selectedSupplier.risk_score}<span className="ml-1 text-[10px] font-medium text-slate-400">/ 100</span></p></div></div>
          </div>
          <div className="flex gap-1 border-t border-slate-100 px-4 sm:px-5" role="tablist" aria-label="Supplier information">
            <button type="button" role="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')} className={`relative px-3 py-3 text-xs font-semibold transition ${tab === 'details' ? 'text-teal-800 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-teal-600' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-2"><ClipboardCheck className="h-3.5 w-3.5" />Details</span></button>
            <button type="button" role="tab" aria-selected={tab === 'hierarchy'} onClick={() => setTab('hierarchy')} className={`relative px-3 py-3 text-xs font-semibold transition ${tab === 'hierarchy' ? 'text-teal-800 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-teal-600' : 'text-slate-500 hover:text-slate-800'}`}><span className="inline-flex items-center gap-2"><Boxes className="h-3.5 w-3.5" />Lot hierarchy <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{rawLots.length}</span></span></button>
          </div>
        </Panel>

        {tab === 'details' ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.8fr)]">
          <Panel className="p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Supplier profile</h3><p className="mt-1 text-xs text-slate-500">Core master data available for this source.</p></div><span className="rounded-lg bg-teal-50 p-2 text-teal-700"><Building2 className="h-4 w-4" /></span></div><div className="grid gap-3 sm:grid-cols-2"><SupplierInfo icon={Building2} label="Supplier name" value={selectedSupplier.name} /><SupplierInfo icon={Layers3} label="Supplier ID" value={selectedSupplier.id} /><SupplierInfo icon={Globe2} label="Country / region" value={selectedSupplier.country} /><SupplierInfo icon={ShieldCheck} label="Qualification status" value={selectedSupplier.status.replaceAll('_', ' ')} /></div></Panel>
          <Panel className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Source snapshot</h3><p className="mt-1 text-xs text-slate-500">Raw-material activity linked to this supplier.</p></div><span className="rounded-lg bg-slate-50 p-2 text-slate-500"><Activity className="h-4 w-4" /></span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Material lots</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{lots.loading ? '—' : number.format(rawLots.length)}</p><p className="mt-1 text-[10px] text-slate-500">linked raw lots</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">At-risk lots</p><p className={`mt-2 text-2xl font-bold tracking-tight ${atRiskLots ? 'text-amber-700' : 'text-slate-900'}`}>{lots.loading ? '—' : number.format(atRiskLots)}</p><p className="mt-1 text-[10px] text-slate-500">hold or exception status</p></div></div><div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"><span className="text-xs font-medium text-slate-600">Tracked quantity</span><span className="text-right text-xs font-bold text-slate-900">{lots.loading ? 'Loading…' : quantitySummary || 'No linked lots'}</span></div>{lots.error && <p className="mt-3 text-xs text-rose-600">Lot data could not be loaded: {lots.error}</p>}<button type="button" onClick={() => setTab('hierarchy')} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900">Explore lot hierarchy <ArrowUpRight className="h-3.5 w-3.5" /></button></Panel>
        </div> : <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-sm font-bold text-slate-900">Supplier lot hierarchy</h3><p className="mt-1 text-xs text-slate-500">Trace this source into its registered raw-material lots.</p></div><div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500"><Boxes className="h-3.5 w-3.5 text-teal-700" />{lots.loading ? 'Loading lots…' : `${rawLots.length} linked material lot${rawLots.length === 1 ? '' : 's'}`}</div></div>
          <div className="p-5 sm:p-6">
            <div className="relative rounded-2xl border border-teal-100 bg-teal-50 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-teal-700">Upstream supplier</p><p className="mt-1 truncate text-sm font-bold text-slate-900">{selectedSupplier.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{selectedSupplier.id} · {selectedSupplier.country || 'Country not set'}</p></div><StatusBadge status={selectedSupplier.status} /></div></div>
            <div className="my-3 ml-9 h-6 border-l-2 border-dashed border-teal-200" aria-hidden="true" />
            {lots.loading ? <LoadingState /> : lots.error ? <ErrorState message={lots.error} retry={lots.reload} /> : rawLots.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center"><PackageSearch className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No raw lots linked yet</p><p className="mt-1 text-xs text-slate-500">Material lot links will appear here when supplier intake records are created.</p></div> : <div className="space-y-2.5">{rawLots.map((lot) => <div key={lot.id} className="group relative flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 pl-5 transition hover:border-teal-200 hover:bg-teal-50 hover:shadow-sm sm:gap-4 sm:pl-6"><span className="absolute -left-[1px] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-500 shadow-sm" /><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-teal-100 group-hover:text-teal-800"><Boxes className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900">{lot.name}</p><StatusBadge status={lot.status} /></div><p className="mt-1 font-mono text-[10px] text-slate-500">{lot.id}</p></div><div className="min-w-[100px] text-left sm:text-right"><p className="text-sm font-bold text-slate-800">{number.format(lot.quantity)} <span className="text-[10px] font-semibold text-slate-500">{lot.unit}</span></p><p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">lot quantity</p></div><Button variant="secondary" className="ml-auto px-3 py-2 text-[11px]" onClick={() => navigate(`/traceability?lot=${encodeURIComponent(lot.id)}`)}>Trace lot <ArrowUpRight className="h-3.5 w-3.5" /></Button></div>)}</div>}
          </div>
        </Panel>}
      </section>}
    </div>
  </div>;
}

