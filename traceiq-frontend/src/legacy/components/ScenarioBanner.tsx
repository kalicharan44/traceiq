import React, { useState } from 'react';
import { Sparkles, ShieldAlert, AlertTriangle, GitBranch, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useNexus } from '../context/NexusContext';

export const ScenarioBanner: React.FC = () => {
  const { setActiveTab, setGlobalSearchTarget } = useNexus();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleLaunchScenario = (tab: string, targetId: string) => {
    setGlobalSearchTarget(targetId);
    setActiveTab(tab);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Interactive Test Scenarios
              <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider">
                1-Click Preset
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Select a scenario to verify bidirectional lot tracing, atomic recall quarantine, and anomaly alerts.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
        >
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 pt-3.5 border-t border-slate-100">
          {/* Scenario 1: Recall Simulation on RAW-1042 */}
          <div
            onClick={() => handleLaunchScenario('recall', 'RAW-1042')}
            className="cursor-pointer rounded-xl border border-red-200/90 bg-gradient-to-b from-red-50/70 to-white p-4 hover:border-red-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-red-700 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-600 text-white shadow-2xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </span>
                Scenario 1: Recall RAW-1042
              </span>
              <ArrowRight className="h-4 w-4 text-red-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-2xs text-slate-600 line-clamp-2 leading-relaxed">
              Defective solvent in PO-2001 & PO-2002. Traces downstream to FG-3001 & FG-3002, halts active transit SHP-002, and locks warehouse stock.
            </p>
            <div className="mt-2.5 pt-2 border-t border-red-100 text-3xs font-mono text-red-800 font-bold flex items-center justify-between">
              <span>Target: RAW-1042</span>
              <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">4-Step Wizard →</span>
            </div>
          </div>

          {/* Scenario 2: Broken Traceability Link */}
          <div
            onClick={() => handleLaunchScenario('traceability', 'PO-9999')}
            className="cursor-pointer rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-50/70 to-white p-4 hover:border-amber-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-amber-800 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-white shadow-2xs">
                  <GitBranch className="h-3.5 w-3.5" />
                </span>
                Scenario 2: Broken Link
              </span>
              <ArrowRight className="h-4 w-4 text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-2xs text-slate-600 line-clamp-2 leading-relaxed">
              PO-9999 consumes ghost lot <code className="font-mono font-bold text-amber-900 bg-amber-100 px-1 py-0.2 rounded">RAW-MISSING</code> without ERP intake scan. Displays broken link in genealogy.
            </p>
            <div className="mt-2.5 pt-2 border-t border-amber-100 text-3xs font-mono text-amber-900 font-bold flex items-center justify-between">
              <span>Target: PO-9999</span>
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Genealogy Map →</span>
            </div>
          </div>

          {/* Scenario 3: Quantity Over-Allocation */}
          <div
            onClick={() => handleLaunchScenario('anomalies', 'FG-4001')}
            className="cursor-pointer rounded-xl border border-blue-200/90 bg-gradient-to-b from-blue-50/70 to-white p-4 hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-extrabold text-blue-800 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                Scenario 3: Over-Allocation
              </span>
              <ArrowRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-2xs text-slate-600 line-clamp-2 leading-relaxed">
              FG-4001 yielded 200 units, but SHP-003 delivered 500 units to Gamma Healthcare (+300 units ghost quantity / mass balance error).
            </p>
            <div className="mt-2.5 pt-2 border-t border-blue-100 text-3xs font-mono text-blue-900 font-bold flex items-center justify-between">
              <span>Target: FG-4001</span>
              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Mass Balance →</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
