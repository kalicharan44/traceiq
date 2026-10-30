import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  X,
  Layers,
  Box,
  Truck,
  User,
  ArrowLeft
} from 'lucide-react';
import { useNexus, findMissingInputs, validateLotQuantities } from '../context/NexusContext';
import { Badge } from './Badge';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenResetModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenResetModal }) => {
  const { activeTab, setActiveTab, setGlobalSearchTarget, db } = useNexus();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Supply Chain Overview', subtitle: 'Monitor inventory, traceability, quality incidents, and recall activity' },
    traceability: { title: 'Lot Genealogy', subtitle: 'Multi-echelon graph tracing & provenance audit' },
    recall: { title: 'Recall Command Center', subtitle: '4-step containment, exposure calculation & quarantine lock' },
    ai: { title: 'AI Investigation', subtitle: 'Natural language investigation assistant & automated incident drafting' },
    anomalies: { title: 'Anomaly Detection', subtitle: 'Planted test defects, mass balance divergence & orphan links' },
    audit: { title: 'Audit & Reports', subtitle: 'Compliance event ledger & JSON export report' }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (targetToSearch: string) => {
    if (!targetToSearch.trim()) return;
    setGlobalSearchTarget(targetToSearch.trim().toUpperCase());
    setActiveTab('traceability');
    setSearchTerm('');
    setShowDropdown(false);
  };

  // Autocomplete matching
  const q = searchTerm.trim().toLowerCase();
  const matchingLots = q ? db.lots.filter((l) => l.id.toLowerCase().includes(q) || (l.name && l.name.toLowerCase().includes(q))) : [];
  const matchingPOs = q ? db.productionOrders.filter((p) => p.id.toLowerCase().includes(q) || (p.productName && p.productName.toLowerCase().includes(q))) : [];

  const missingInputs = findMissingInputs(db);
  const overAllocatedLots = db.lots
    .filter((l) => l.type === 'FG')
    .map((l) => validateLotQuantities(db, l.id))
    .filter((r) => r && r.overAllocated);
  const totalAlerts = missingInputs.length + overAllocatedLots.length;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8 shadow-2xs">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {activeTab !== 'dashboard' && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs mr-1"
            title="Go back to Overview (Backspace)"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div>
          <div className="flex items-center gap-1.5 text-2xs text-slate-400">
            <span>TraceIQ</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-slate-700">{titles[activeTab]?.title}</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight hidden sm:block">
            {titles[activeTab]?.title}
          </h2>
        </div>
      </div>

      {/* Middle: Clean Autocomplete Search Input */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xs sm:max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchSubmit(searchTerm);
              }
            }}
            placeholder="Search lot ID (RAW-1042, FG-3001) or PO..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none font-mono transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown in Light Theme */}
        {showDropdown && searchTerm.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-xl border border-slate-200 bg-white shadow-xl p-2 z-50 max-h-72 overflow-y-auto space-y-1">
            {matchingLots.length === 0 && matchingPOs.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching entities found. Press Enter to search.
              </div>
            ) : (
              <>
                {matchingLots.map((lot) => (
                  <button
                    key={lot.id}
                    onClick={() => handleSearchSubmit(lot.id)}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{lot.id}</span>
                        <span className="text-3xs text-slate-500 block truncate max-w-[200px]">{lot.name || lot.type}</span>
                      </div>
                    </div>
                    <Badge status={lot.status} size="sm">{lot.status}</Badge>
                  </button>
                ))}

                {matchingPOs.map((po) => (
                  <button
                    key={po.id}
                    onClick={() => handleSearchSubmit(po.id)}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Box className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900">{po.id}</span>
                        <span className="text-3xs text-slate-500 block truncate max-w-[200px]">{po.productName || po.outputLot}</span>
                      </div>
                    </div>
                    <span className="text-3xs text-slate-500 font-mono">Output: {po.outputLot}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right: Live Environment Indicator & Notifications */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-2xs font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE ENVIRONMENT</span>
          <button
            onClick={onOpenResetModal}
            className="ml-1 text-emerald-700 hover:text-emerald-900 transition-colors flex items-center gap-1 text-3xs font-medium"
            title="Reset dataset"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        {/* Notifications Tray */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Quality Incidents"
          >
            <Bell className="h-4 w-4" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-3xs font-bold text-white shadow-xs">
                {totalAlerts}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Quality Alert Signals ({totalAlerts})
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-3xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {missingInputs.map((mi, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setActiveTab('anomalies');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl border border-red-200 bg-red-50/70 cursor-pointer hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-3xs font-bold text-red-700 font-mono">
                      <span>MISSING LOT IN {mi.productionOrderId}</span>
                      <span>CRITICAL</span>
                    </div>
                    <p className="text-2xs text-slate-700 mt-1">
                      Consumes unregistered lot <code className="font-mono text-red-700 font-semibold">{mi.missingLotId}</code>.
                    </p>
                  </div>
                ))}

                {overAllocatedLots.map((oa, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setActiveTab('anomalies');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 cursor-pointer hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-3xs font-bold text-amber-800 font-mono">
                      <span>OVER-ALLOCATION: {oa?.lotId}</span>
                      <span>+{Math.abs(oa?.difference || 0)} units</span>
                    </div>
                    <p className="text-2xs text-slate-700 mt-1">
                      Shipments exceeded produced quantity.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">
          EV
        </div>
      </div>
    </header>
  );
};
