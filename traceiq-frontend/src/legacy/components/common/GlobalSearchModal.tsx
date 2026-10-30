import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Layers, Box, Truck, AlertTriangle, Building, ArrowRight } from 'lucide-react';
import { useSupplyChain } from '../../context/SupplyChainContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, targetLot?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { rawLots, productionOrders, finishedLots, shipments, customers, anomalies } = useSupplyChain();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search results
  const rawResults = rawLots.filter(
    (r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q)
  );
  const poResults = productionOrders.filter(
    (p) => p.id.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q) || p.facility.toLowerCase().includes(q)
  );
  const fgResults = finishedLots.filter(
    (f) => f.id.toLowerCase().includes(q) || f.productName.toLowerCase().includes(q) || f.sku.toLowerCase().includes(q)
  );
  const shipmentResults = shipments.filter(
    (s) => s.id.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q) || s.trackingNumber.toLowerCase().includes(q)
  );
  const customerResults = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  );
  const anomalyResults = anomalies.filter(
    (a) => a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.affectedEntityId.toLowerCase().includes(q)
  );

  const hasResults =
    rawResults.length > 0 ||
    poResults.length > 0 ||
    fgResults.length > 0 ||
    shipmentResults.length > 0 ||
    customerResults.length > 0 ||
    anomalyResults.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-cyan-950/50">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lot ID (RAW-1042, FG-4401), PO-8812, shipment, customer, or anomaly..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-200 mr-2 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="rounded bg-slate-800 px-2 py-0.5 text-2xs font-mono text-slate-400">ESC</span>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {!query && (
            <div className="py-6 text-center text-xs text-slate-400">
              <p className="font-medium text-slate-300">Quick Search Shortcuts</p>
              <p className="mt-1 text-slate-500">
                Type an identifier like <span className="font-mono text-cyan-400">RAW-1042</span>, <span className="font-mono text-cyan-400">FG-4401</span>, or <span className="font-mono text-cyan-400">PO-8812</span> to jump straight into genealogy or recall impact.
              </p>
            </div>
          )}

          {query && !hasResults && (
            <div className="py-8 text-center text-xs text-slate-400">
              No entities or records match &ldquo;{query}&rdquo;.
            </div>
          )}

          {/* Anomalies Match */}
          {anomalyResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> Quality Anomalies ({anomalyResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {anomalyResults.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onNavigate('anomalies');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-rose-300">{a.id}</span>
                        <span className="text-slate-200">{a.title}</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        Target: {a.affectedEntityId} · Severity: {a.severity}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Finished Goods */}
          {fgResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Box className="h-3 w-3" /> Finished Goods Batches ({fgResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {fgResults.map((fg) => (
                  <button
                    key={fg.id}
                    onClick={() => {
                      onNavigate('genealogy', fg.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-cyan-300">{fg.id}</span>
                        <span className="text-slate-200">{fg.productName}</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        Batch Qty: {fg.totalQuantity.toLocaleString()} units · Status: {fg.status}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Raw Materials */}
          {rawResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Layers className="h-3 w-3" /> Raw Material Lots ({rawResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {rawResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onNavigate('genealogy', r.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-emerald-300">{r.id}</span>
                        <span className="text-slate-200">{r.name}</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        Supplier: {r.supplierName} · Avail: {r.availableQuantity} {r.unit}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Production Orders */}
          {poResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Box className="h-3 w-3" /> Production Orders ({poResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {poResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onNavigate('genealogy', p.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-purple-300">{p.id}</span>
                        <span className="text-slate-200">{p.productName}</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        Facility: {p.facility} · Status: {p.status}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customers & Shipments */}
          {customerResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Building className="h-3 w-3" /> Commercial Customers ({customerResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onNavigate('recall');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-amber-300">{c.id}</span>
                        <span className="text-slate-200">{c.name}</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        {c.accountType} · {c.regulatoryContactLevel}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {shipmentResults.length > 0 && (
            <div>
              <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Truck className="h-3 w-3" /> Shipments ({shipmentResults.length})
              </div>
              <div className="space-y-1 mt-1">
                {shipmentResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onNavigate('genealogy', s.finishedGoodsLotId);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800/70 transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-blue-300">{s.id}</span>
                        <span className="text-slate-200">{s.carrier} ({s.trackingNumber})</span>
                      </div>
                      <div className="text-2xs text-slate-400 mt-0.5">
                        To: {s.customerName} · Qty: {s.quantity.toLocaleString()} units · {s.status}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 bg-slate-950/70 px-4 py-2 flex items-center justify-between text-2xs text-slate-500">
          <span>Search index covers raw lots, batch runs, shipments, customers, and active alerts</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
};
