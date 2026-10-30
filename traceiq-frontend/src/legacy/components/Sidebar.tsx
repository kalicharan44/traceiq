import React from 'react';
import {
  LayoutDashboard,
  Share2,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  History,
  Box,
  ChevronRight,
  User,
  RotateCcw,
  ChevronLeft
} from 'lucide-react';
import { useNexus, findMissingInputs, validateLotQuantities } from '../context/NexusContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenResetModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenResetModal
}) => {
  const { activeTab, setActiveTab, db } = useNexus();

  // Compute live counts
  const missingInputs = findMissingInputs(db);
  const overAllocatedLots = db.lots
    .filter((l) => l.type === 'FG')
    .map((l) => validateLotQuantities(db, l.id))
    .filter((r) => r && r.overAllocated);
  const totalAnomalies = missingInputs.length + overAllocatedLots.length;
  const activeRecalls = db.auditEvents.filter((e) => e.action === 'RECALL_EXECUTED').length;

  const navItems = [
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      label: 'Overview',
      badge: null
    },
    {
      id: 'traceability',
      icon: Share2,
      label: 'Lot Genealogy',
      badge: null
    },
    {
      id: 'recall',
      icon: ShieldAlert,
      label: 'Recall Command Center',
      badge: activeRecalls > 0 ? `${activeRecalls} active` : null,
      badgeColor: 'bg-red-50 text-red-700 border-red-200'
    },
    {
      id: 'ai',
      icon: Sparkles,
      label: 'AI Investigation',
      badge: 'Copilot',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200'
    },
    {
      id: 'anomalies',
      icon: AlertTriangle,
      label: 'Anomaly Detection',
      badge: totalAnomalies > 0 ? `${totalAnomalies}` : null,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      id: 'audit',
      icon: History,
      label: 'Audit & Reports',
      badge: null
    }
  ];

  const handleSelect = (id: string) => {
    setActiveTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#1E293B] bg-[#0B1528] text-slate-200 transition-all duration-300 ease-in-out lg:static ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
              <Box className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5 font-mono">
                  TraceIQ
                  <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 text-3xs font-sans font-semibold">
                    Enterprise
                  </span>
                </span>
                <span className="text-3xs text-slate-400 truncate font-medium">
                  Supply Chain Command
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-3xs font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border-l-3 border-blue-300'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-300'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-3xs font-bold ${
                          isActive
                            ? 'bg-white/20 text-white border-white/30'
                            : item.id === 'recall'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : item.id === 'anomalies'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer: User Profile & Reset System Data */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          {!isCollapsed ? (
            <div className="rounded-xl border border-slate-700/60 bg-[#101D36] p-3">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-xs shrink-0">
                  <User className="h-4 w-4 text-blue-300" />
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs font-bold text-white truncate">Dr. E. Vance, CQO</p>
                  <p className="text-3xs text-slate-400 truncate">Quality Assurance</p>
                </div>
              </div>
              <button
                onClick={onOpenResetModal}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B1528] px-2 py-1.5 text-2xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shadow-2xs"
              >
                <RotateCcw className="h-3 w-3" />
                Reset System Data
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenResetModal}
              title="Reset System Data"
              className="w-full flex justify-center items-center py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
