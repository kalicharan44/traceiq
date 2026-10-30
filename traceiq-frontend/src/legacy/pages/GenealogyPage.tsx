import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import {
  Search,
  SearchCode,
  Share2,
  Database,
  Activity,
  Package,
  Warehouse,
  Truck,
  Users,
  FileWarning,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Factory,
  Layers,
  ListTree,
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Info
} from 'lucide-react';
import { useNexus, buildTraceabilityGraph } from '../context/NexusContext';
import { TraceNode } from '../components/TraceNode';
import { Badge } from '../components/Badge';
import { TraceabilityGraphResult, GraphEdge } from '../types/nexusChain';

interface PathSegment {
  id: string;
  edge: GraphEdge;
  d: string;
  midX: number;
  midY: number;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'BROKEN';
  isHighlighted: boolean;
  isActive: boolean;
}

export const GenealogyPage: React.FC = () => {
  const { db, addAuditEvent, globalSearchTarget, setGlobalSearchTarget, setActiveTab } = useNexus();
  const [search, setSearch] = useState('RAW-1042');
  const [graph, setGraph] = useState<TraceabilityGraphResult | null>(() => buildTraceabilityGraph(db, 'RAW-1042'));
  const [error, setError] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<any | null>(() => {
    const lot = db.lots.find((l) => l.id === 'RAW-1042');
    return lot ? { ...lot, kind: 'RAW_LOT' } : null;
  });

  // Visual Graph Controls
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CRITICAL' | 'ANOMALIES'>('ALL');
  const [viewMode, setViewMode] = useState<'FLOW' | 'TREE' | 'MATRIX'>('FLOW');
  const [zoomLevel, setZoomLevel] = useState(1);

  // SVG Connector calculation
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [computedPaths, setComputedPaths] = useState<PathSegment[]>([]);

  // Update on global search
  useEffect(() => {
    if (globalSearchTarget) {
      setSearch(globalSearchTarget);
      runTrace(globalSearchTarget);
      setGlobalSearchTarget('');
    } else if (!graph) {
      runTrace('RAW-1042');
    }
  }, [globalSearchTarget]);

  const runTrace = (targetToSearch = search) => {
    setError('');
    const target = (targetToSearch || '').trim().toUpperCase();
    if (!target) {
      setError('Please enter an entity ID (e.g. RAW-1042, FG-3001, PO-2001, or ALL).');
      return;
    }

    const impact = buildTraceabilityGraph(db, target);

    if (!impact) {
      setError(`No supply chain entities matched "${target}". Try a verified ID like RAW-1042, FG-3001, PO-9999, FG-4001, or enter "ALL".`);
      return;
    }

    setGraph(impact);
    setSearch(impact.targetId);
    addAuditEvent('TRACE_EXECUTED', impact.targetId, `Executed bi-directional genealogy trace on ${impact.targetId}`);

    // Select the target as active inspection
    const targetLot = db.lots.find((l) => l.id === impact.targetId);
    const targetPO = db.productionOrders.find((p) => p.id === impact.targetId);
    const targetSup = db.suppliers.find((s) => s.id === impact.targetId);
    const targetShp = db.shipments.find((s) => s.id === impact.targetId);
    const targetCust = db.customers.find((c) => c.id === impact.targetId);

    if (targetLot) {
      const sup = db.suppliers.find((s) => s.id === targetLot.supplierId);
      setSelectedEntity({ ...targetLot, supplierName: sup?.name, kind: targetLot.type === 'RAW' ? 'RAW_LOT' : 'FG_LOT' });
    } else if (targetPO) {
      setSelectedEntity({ ...targetPO, kind: 'PO' });
    } else if (targetSup) {
      setSelectedEntity({ ...targetSup, kind: 'SUPPLIER' });
    } else if (targetShp) {
      const cust = db.customers.find((c) => c.id === targetShp.customerId);
      setSelectedEntity({ ...targetShp, customerName: cust?.name, kind: 'SHIPMENT' });
    } else if (targetCust) {
      setSelectedEntity({ ...targetCust, kind: 'CUSTOMER' });
    } else {
      setSelectedEntity({ id: impact.targetId, kind: 'ENTITY' });
    }
  };

  // Re-calculate SVG cubic Bezier paths whenever the DOM updates
  const calculatePaths = useCallback(() => {
    if (!graph || !graph.edges || !graphContainerRef.current) {
      setComputedPaths([]);
      return;
    }

    const container = graphContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    const visibleEdges = graph.edges.filter((e) => {
      if (filterMode === 'CRITICAL') {
        return e.status === 'CRITICAL' || e.status === 'BROKEN';
      }
      if (filterMode === 'ANOMALIES') {
        return e.isAnomaly || e.status === 'BROKEN' || e.status === 'WARNING';
      }
      return true;
    });

    const paths: PathSegment[] = [];

    visibleEdges.forEach((edge) => {
      // Look for the specific output dot of source and input dot of target
      const sourceEl =
        document.getElementById(`out-${edge.source}`) ||
        document.getElementById(`node-${edge.source}`);
      const targetEl =
        document.getElementById(`in-${edge.target}`) ||
        document.getElementById(`node-${edge.target}`);

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        // Calculate coordinates relative to container (accounting for zoom)
        const x1 = (sRect.left + sRect.width / 2 - containerRect.left + scrollLeft) / zoomLevel;
        const y1 = (sRect.top + sRect.height / 2 - containerRect.top + scrollTop) / zoomLevel;
        const x2 = (tRect.left + tRect.width / 2 - containerRect.left + scrollLeft) / zoomLevel;
        const y2 = (tRect.top + tRect.height / 2 - containerRect.top + scrollTop) / zoomLevel;

        const dx = Math.max(40, (x2 - x1) * 0.5);
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const isConnectedToHover =
          hoveredNodeId === edge.source || hoveredNodeId === edge.target;
        const isConnectedToSelected =
          selectedEntity?.id === edge.source || selectedEntity?.id === edge.target;

        paths.push({
          id: edge.id,
          edge,
          d,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
          status: edge.status,
          isHighlighted: isConnectedToHover,
          isActive: isConnectedToSelected
        });
      }
    });

    setComputedPaths(paths);
  }, [graph, filterMode, zoomLevel, hoveredNodeId, selectedEntity]);

  // Recalculate on mount, update, or resize
  useLayoutEffect(() => {
    // Immediate calculation + delay to ensure card rendering is settled
    calculatePaths();
    const timer = setTimeout(calculatePaths, 80);
    const timer2 = setTimeout(calculatePaths, 250);

    const handleResize = () => calculatePaths();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
    };
  }, [calculatePaths]);

  // Helper to determine if a node is dimmed during hover
  const isNodeDimmed = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    if (hoveredNodeId === nodeId) return false;
    // Check if connected via an edge
    if (!graph?.edges) return false;
    const isDirectlyConnected = graph.edges.some(
      (e) =>
        (e.source === hoveredNodeId && e.target === nodeId) ||
        (e.target === hoveredNodeId && e.source === nodeId)
    );
    return !isDirectlyConnected;
  };

  const isNodeHighlighted = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    if (hoveredNodeId === nodeId) return true;
    if (!graph?.edges) return false;
    return graph.edges.some(
      (e) =>
        (e.source === hoveredNodeId && e.target === nodeId) ||
        (e.target === hoveredNodeId && e.source === nodeId)
    );
  };

  // Find upstream and downstream nodes for the selected entity
  const selectedLineage = React.useMemo(() => {
    if (!selectedEntity || !graph?.edges) return { upstream: [], downstream: [] };
    const entId = selectedEntity.id || selectedEntity.lotId;
    const upstream = graph.edges
      .filter((e) => e.target === entId)
      .map((e) => ({ id: e.source, type: e.sourceType, label: e.label }));
    const downstream = graph.edges
      .filter((e) => e.source === entId)
      .map((e) => ({ id: e.target, type: e.targetType, label: e.label }));
    return { upstream, downstream };
  }, [selectedEntity, graph]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Share2 className="h-5 w-5" />
            </span>
            Lot Genealogy Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            End-to-end multi-echelon trace: Supplier &rarr; Raw Material &rarr; Production Order &rarr; Finished Goods &rarr; Warehouse &rarr; Customer.
          </p>
        </div>

        {/* Quick Example Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-2xs">
          <span className="text-slate-500 mr-1 font-semibold">Presets:</span>
          <button
            onClick={() => {
              setSearch('RAW-1042');
              runTrace('RAW-1042');
            }}
            className={`rounded-lg border px-2.5 py-1 font-mono transition-all ${
              search.toUpperCase() === 'RAW-1042'
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            RAW-1042 (Solvent Recall)
          </button>
          <button
            onClick={() => {
              setSearch('PO-9999');
              runTrace('PO-9999');
            }}
            className={`rounded-lg border px-2.5 py-1 font-mono transition-all ${
              search.toUpperCase() === 'PO-9999'
                ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-2xs ring-1 ring-amber-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            PO-9999 (Broken Link)
          </button>
          <button
            onClick={() => {
              setSearch('FG-3001');
              runTrace('FG-3001');
            }}
            className={`rounded-lg border px-2.5 py-1 font-mono transition-all ${
              search.toUpperCase() === 'FG-3001'
                ? 'border-teal-500 bg-teal-50 text-teal-800 font-bold shadow-2xs ring-1 ring-teal-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            FG-3001 (NutriShield)
          </button>
          <button
            onClick={() => {
              setSearch('FG-4001');
              runTrace('FG-4001');
            }}
            className={`rounded-lg border px-2.5 py-1 font-mono transition-all ${
              search.toUpperCase() === 'FG-4001'
                ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold shadow-2xs ring-1 ring-rose-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            FG-4001 (Over-Allocation)
          </button>
          <button
            onClick={() => {
              setSearch('ALL');
              runTrace('ALL');
            }}
            className={`rounded-lg border px-2.5 py-1 font-mono transition-all ${
              search.toUpperCase() === 'ALL'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 font-bold shadow-2xs ring-1 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ALL (Full Network)
          </button>
        </div>
      </div>

      {/* Search Bar & View Mode Control Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runTrace();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Lot ID (RAW-1042, FG-3001), PO (PO-2001, PO-9999), Supplier (SUP-01), or enter 'ALL'..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-12 pr-4 font-mono text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-xs shrink-0"
          >
            <SearchCode className="h-4 w-4" />
            Trace Graph
          </button>
        </form>

        {/* View Switcher & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-3xs uppercase tracking-wider font-bold mr-1">View:</span>
            <button
              onClick={() => setViewMode('FLOW')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                viewMode === 'FLOW'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              Interactive Flow
            </button>
            <button
              onClick={() => setViewMode('TREE')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                viewMode === 'TREE'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              Hierarchical Tree
            </button>
            <button
              onClick={() => setViewMode('MATRIX')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all ${
                viewMode === 'MATRIX'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Edge Relations ({graph?.edges?.length || 0})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter mode */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-3xs uppercase tracking-wider font-bold mr-1">Filter:</span>
              <button
                onClick={() => setFilterMode('ALL')}
                className={`rounded-lg px-2 py-0.5 text-2xs font-semibold ${
                  filterMode === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Edges
              </button>
              <button
                onClick={() => setFilterMode('CRITICAL')}
                className={`rounded-lg px-2 py-0.5 text-2xs font-semibold ${
                  filterMode === 'CRITICAL'
                    ? 'bg-red-600 text-white'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                Critical / Recalled
              </button>
              <button
                onClick={() => setFilterMode('ANOMALIES')}
                className={`rounded-lg px-2 py-0.5 text-2xs font-semibold ${
                  filterMode === 'ANOMALIES'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Anomalies
              </button>
            </div>

            {/* Zoom Controls */}
            {viewMode === 'FLOW' && (
              <div className="flex items-center border border-slate-200 rounded-lg p-0.5 text-slate-500">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 text-3xs font-mono font-bold text-slate-700">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(1.3, z + 0.1))}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1 hover:bg-slate-100 rounded border-l border-slate-100 ml-0.5"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message with Suggestion Chips */}
      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-medium text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => runTrace('RAW-1042')}
            className="rounded-lg bg-amber-600 text-white font-bold px-3 py-1 text-2xs hover:bg-amber-700 shrink-0"
          >
            Reset to RAW-1042
          </button>
        </div>
      )}

      {/* Current Trace Status Banner */}
      {graph && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">Active Trace Target:</span>
            <span className="font-mono font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {graph.targetId}
            </span>
            <span className="text-3xs text-slate-500">
              ({graph.suppliers.length} Suppliers · {graph.rawLots.length + graph.missingLots.length} Raw Lots · {graph.pos.length} POs · {graph.fgLots.length} Finished Goods · {graph.inventory.length} Warehouses · {graph.shipments.length} Shipments · {graph.customers.length} Customers)
            </span>
          </div>
          <div className="flex items-center gap-3 text-2xs">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3 w-3" />
              Directional Engine Connected
            </span>
            <button
              onClick={() => runTrace('ALL')}
              className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              Show Full Supply Chain &rarr;
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: INTERACTIVE FLOW GRAPH (PRIMARY) */}
      {viewMode === 'FLOW' && graph && (
        <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs overflow-x-auto min-h-[580px]">
          {/* Legend Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100 text-2xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-3xs">Directional Flow:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" />
                <span>Normal Flow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-blue-600 inline-block" />
                <span className="text-blue-700 font-bold">Active Lineage</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-red-600 inline-block" />
                <span className="text-red-700 font-bold">Recalled / Quarantined</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-500 inline-block border-b border-dashed border-amber-600" />
                <span className="text-amber-800 font-bold">Anomaly / Broken BOM</span>
              </div>
            </div>
            <div className="text-3xs text-slate-400 italic">
              Hover over any node to highlight full upstream/downstream causal path
            </div>
          </div>

          <div
            ref={graphContainerRef}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
            className="relative min-w-max transition-transform duration-150"
          >
            {/* SVG Dynamic Overlay for Directional Links */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
              style={{ minHeight: '100%', minWidth: '100%' }}
            >
              <defs>
                {/* Arrowhead Markers */}
                <marker
                  id="arrow-ok"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563EB" />
                </marker>
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#DC2626" />
                </marker>
                <marker
                  id="arrow-warning"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#D97706" />
                </marker>
                <marker
                  id="arrow-broken"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#E11D48" />
                </marker>
              </defs>

              {/* Render Directional Links */}
              {computedPaths.map((path) => {
                const isCrit = path.status === 'CRITICAL';
                const isBroken = path.status === 'BROKEN';
                const isWarn = path.status === 'WARNING';
                const isHighlighted = path.isHighlighted || path.isActive;

                let strokeColor = '#CBD5E1'; // slate-300
                let markerId = 'arrow-ok';
                let strokeWidth = 2;
                let strokeDasharray = 'none';

                if (isBroken) {
                  strokeColor = '#E11D48'; // rose-600
                  markerId = 'arrow-broken';
                  strokeWidth = 2.5;
                  strokeDasharray = '5 4';
                } else if (isCrit) {
                  strokeColor = '#DC2626'; // red-600
                  markerId = 'arrow-critical';
                  strokeWidth = isHighlighted ? 3.5 : 2.5;
                  if (isHighlighted) strokeDasharray = '6 3';
                } else if (isWarn) {
                  strokeColor = '#D97706'; // amber-600
                  markerId = 'arrow-warning';
                  strokeWidth = 2.5;
                } else if (isHighlighted) {
                  strokeColor = '#2563EB'; // blue-600
                  markerId = 'arrow-active';
                  strokeWidth = 3;
                }

                return (
                  <g key={path.id} className="transition-all duration-150">
                    {/* Shadow / Glow line for active paths */}
                    {isHighlighted && (
                      <path
                        d={path.d}
                        fill="none"
                        stroke={isCrit ? '#FECACA' : '#BFDBFE'}
                        strokeWidth={strokeWidth + 5}
                        strokeLinecap="round"
                        opacity={0.6}
                      />
                    )}

                    {/* Main connector curve with directional arrow marker */}
                    <path
                      d={path.d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      markerEnd={`url(#${markerId})`}
                      strokeLinecap="round"
                    />

                    {/* Label badge on curve midpoint */}
                    {path.edge.label && (
                      <g
                        transform={`translate(${path.midX}, ${path.midY})`}
                        className="pointer-events-auto cursor-default"
                      >
                        <rect
                          x={-path.edge.label.length * 3.5 - 6}
                          y={-10}
                          width={path.edge.label.length * 7 + 12}
                          height={18}
                          rx={9}
                          fill={isCrit ? '#FEF2F2' : isBroken ? '#FFF1F2' : isWarn ? '#FFFBEB' : '#F8FAFC'}
                          stroke={isCrit ? '#FCA5A5' : isBroken ? '#FDA4AF' : isWarn ? '#FDE68A' : '#E2E8F0'}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill={isCrit ? '#991B1B' : isBroken ? '#9F1239' : isWarn ? '#92400E' : '#475569'}
                        >
                          {path.edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Stage Columns Grid with Generous Spacing for Curves */}
            <div className="flex items-start gap-14 lg:gap-16 relative z-20">
              {/* STAGE 1: SUPPLIERS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Factory className="h-3.5 w-3.5 text-amber-600" />
                    1. Suppliers
                  </span>
                  <span className="rounded bg-amber-50 text-amber-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.suppliers.length}
                  </span>
                </div>

                {graph.suppliers.map((supId) => {
                  const sup = db.suppliers.find((s) => s.id === supId);
                  const isSel = selectedEntity?.id === supId;
                  const isTgt = supId === graph.targetId;

                  return (
                    <div key={supId} className="relative group">
                      <TraceNode
                        id={supId}
                        title={supId}
                        subtitle={sup?.name || 'Verified Chemical Vendor'}
                        icon={Factory}
                        type="source"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(supId)}
                        isDimmed={isNodeDimmed(supId)}
                        hasInputConnector={false}
                        hasOutputConnector={true}
                        badgeText={sup?.category ? 'Tier 1' : undefined}
                        status="OK"
                        onClick={() => setSelectedEntity({ ...sup, kind: 'SUPPLIER' })}
                        onMouseEnter={() => setHoveredNodeId(supId)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Origin:</span>
                          <span className="font-semibold text-slate-800">{sup?.country || 'USA'}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Audit Risk Score:</span>
                          <span className="font-bold text-emerald-700">{sup?.riskScore ?? 12}/100</span>
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(supId);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace this supplier"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.suppliers.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No direct suppliers</div>
                )}
              </div>

              {/* STAGE 2: RAW MATERIALS & INGREDIENTS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-indigo-600" />
                    2. Raw Materials
                  </span>
                  <span className="rounded bg-indigo-50 text-indigo-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.rawLots.length + graph.missingLots.length}
                  </span>
                </div>

                {/* Missing Lot Nodes (Critical BOM Anomaly) */}
                {graph.missingLots.map((ml) => {
                  const isSel = selectedEntity?.id === ml;
                  const isTgt = ml === graph.targetId;

                  return (
                    <div key={ml} className="relative group">
                      <TraceNode
                        id={ml}
                        title={ml}
                        subtitle="MISSING INTAKE / COA RECORD"
                        icon={FileWarning}
                        type="missing"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(ml)}
                        isDimmed={isNodeDimmed(ml)}
                        hasInputConnector={false}
                        hasOutputConnector={true}
                        status="CRITICAL"
                        onClick={() => setSelectedEntity({ id: ml, isMissing: true, kind: 'MISSING_LOT' })}
                        onMouseEnter={() => setHoveredNodeId(ml)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <span className="text-red-700 font-bold block leading-relaxed">
                          ⚠️ Broken BOM Link: No intake inspection or supplier manifest exists.
                        </span>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(ml);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-red-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-red-700 z-30"
                        title="Trace this missing lot"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {/* Verified Raw Lots */}
                {graph.rawLots.map((id) => {
                  const lot = db.lots.find((l) => l.id === id);
                  const sup = db.suppliers.find((s) => s.id === lot?.supplierId);
                  const isSel = selectedEntity?.id === id;
                  const isTgt = id === graph.targetId;

                  return (
                    <div key={id} className="relative group">
                      <TraceNode
                        id={id}
                        title={id}
                        subtitle={lot?.name || 'Raw Ingredient Batch'}
                        icon={Database}
                        type="raw"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(id)}
                        isDimmed={isNodeDimmed(id)}
                        hasInputConnector={true}
                        hasOutputConnector={true}
                        status={lot?.status}
                        onClick={() => setSelectedEntity({ ...lot, supplierName: sup?.name, kind: 'RAW_LOT' })}
                        onMouseEnter={() => setHoveredNodeId(id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Vendor:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">{sup?.name || lot?.supplierId || 'Vendor'}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Intake Volume:</span>
                          <span className="font-mono font-bold text-indigo-700">
                            {lot?.qty} {lot?.uom}
                          </span>
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(id);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace this raw lot"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.rawLots.length === 0 && graph.missingLots.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No raw materials</div>
                )}
              </div>

              {/* STAGE 3: MANUFACTURING ORDERS (POs) */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                    3. Manufacturing (POs)
                  </span>
                  <span className="rounded bg-blue-50 text-blue-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.pos.length}
                  </span>
                </div>

                {graph.pos.map((id) => {
                  const po = db.productionOrders.find((p) => p.id === id);
                  const isSel = selectedEntity?.id === id;
                  const isTgt = id === graph.targetId;

                  return (
                    <div key={id} className="relative group">
                      <TraceNode
                        id={id}
                        title={id}
                        subtitle={po?.productName || 'Batch Compounding Run'}
                        icon={Activity}
                        type="po"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(id)}
                        isDimmed={isNodeDimmed(id)}
                        hasInputConnector={true}
                        hasOutputConnector={true}
                        status={po?.status}
                        onClick={() => setSelectedEntity({ ...po, kind: 'PO' })}
                        onMouseEnter={() => setHoveredNodeId(id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="text-slate-600">
                          <span className="text-slate-500 font-semibold">Inputs:</span>{' '}
                          <span className="font-mono font-bold text-slate-800">
                            {po?.inputLots.map((il) => `${il.id} (${il.qty}kg)`).join(', ') || 'None'}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          <span className="text-slate-500 font-semibold">Yield Lot:</span>{' '}
                          <span className="font-mono font-extrabold text-blue-700">{po?.outputLot}</span>
                        </div>
                        <div className="text-3xs text-slate-400 truncate">
                          Facility: {po?.facility || 'Plant Delta'}
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(id);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace this PO"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.pos.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No manufacturing runs</div>
                )}
              </div>

              {/* STAGE 4: FINISHED GOODS LOTS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-teal-600" />
                    4. Finished Goods
                  </span>
                  <span className="rounded bg-teal-50 text-teal-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.fgLots.length}
                  </span>
                </div>

                {graph.fgLots.map((id) => {
                  const lot = db.lots.find((l) => l.id === id);
                  const isSel = selectedEntity?.id === id;
                  const isTgt = id === graph.targetId;

                  return (
                    <div key={id} className="relative group">
                      <TraceNode
                        id={id}
                        title={id}
                        subtitle={lot?.name || 'Finished Drug Product'}
                        icon={Package}
                        type="fg"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(id)}
                        isDimmed={isNodeDimmed(id)}
                        hasInputConnector={true}
                        hasOutputConnector={true}
                        status={lot?.status}
                        onClick={() => setSelectedEntity({ ...lot, kind: 'FG_LOT' })}
                        onMouseEnter={() => setHoveredNodeId(id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Produced Yield:</span>
                          <span className="font-mono font-bold text-teal-700">
                            {lot?.qty.toLocaleString()} {lot?.uom}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Release Status:</span>
                          <span className="font-semibold text-slate-800">{lot?.status}</span>
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(id);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace this finished good"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.fgLots.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No finished goods lots</div>
                )}
              </div>

              {/* STAGE 5: WAREHOUSES & HUBS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5 text-cyan-600" />
                    5. Warehouse Stock
                  </span>
                  <span className="rounded bg-cyan-50 text-cyan-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.inventory.length}
                  </span>
                </div>

                {graph.inventory.map((id) => {
                  const inv = db.inventory.find((i) => i.id === id);
                  if (!inv) return null;
                  const wh = db.warehouses.find((w) => w.id === inv.warehouseId);
                  const uom = db.lots.find((l) => l.id === inv.lotId)?.uom || 'units';
                  const isSel = selectedEntity?.id === id;

                  return (
                    <div key={id} className="relative group">
                      <TraceNode
                        id={id}
                        title={inv.warehouseId}
                        subtitle={wh?.name || inv.warehouseId}
                        icon={Warehouse}
                        type="dist"
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(id)}
                        isDimmed={isNodeDimmed(id)}
                        hasInputConnector={true}
                        hasOutputConnector={false}
                        status={inv.status}
                        badgeText={inv.bay || 'General'}
                        onClick={() => setSelectedEntity({ ...inv, warehouseName: wh?.name, kind: 'INVENTORY' })}
                        onMouseEnter={() => setHoveredNodeId(id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Stored Lot:</span>
                          <span className="font-mono font-bold text-cyan-700">{inv.lotId}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Stock On Hand:</span>
                          <span className="font-mono text-slate-800 font-bold">
                            {inv.qty.toLocaleString()} {uom}
                          </span>
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(inv.lotId);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace stored lot"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.inventory.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No warehouse inventory</div>
                )}
              </div>

              {/* STAGE 6: DISPATCHED SHIPMENTS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-purple-600" />
                    6. Logistics / Shipments
                  </span>
                  <span className="rounded bg-purple-50 text-purple-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.shipments.length}
                  </span>
                </div>

                {graph.shipments.map((id) => {
                  const shp = db.shipments.find((s) => s.id === id);
                  if (!shp) return null;
                  const cust = db.customers.find((c) => c.id === shp.customerId);
                  const uom = db.lots.find((l) => l.id === shp.lotId)?.uom || 'units';
                  const isSel = selectedEntity?.id === id;

                  return (
                    <div key={id} className="relative group">
                      <TraceNode
                        id={id}
                        title={id}
                        subtitle={cust?.name || 'Commercial Consignee'}
                        icon={Truck}
                        type="customer"
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(id)}
                        isDimmed={isNodeDimmed(id)}
                        hasInputConnector={true}
                        hasOutputConnector={true}
                        status={shp.status}
                        badgeText={shp.recallStatus || shp.status}
                        onClick={() => setSelectedEntity({ ...shp, customerName: cust?.name, kind: 'SHIPMENT' })}
                        onMouseEnter={() => setHoveredNodeId(id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-mono font-bold text-purple-700">{shp.qty.toLocaleString()} {uom}</span>
                          <span className="text-3xs uppercase font-mono text-slate-500 font-bold">{shp.lotId}</span>
                        </div>
                        <div className="text-3xs text-slate-500 truncate">
                          Carrier: {shp.carrier || 'Logistics'} · {shp.tracking || ''}
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(shp.lotId);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace shipped lot"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.shipments.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No commercial shipments</div>
                )}
              </div>

              {/* STAGE 7: CONSIGNEES & CUSTOMERS */}
              <div className="flex flex-col gap-4 w-72 shrink-0">
                <div className="text-slate-600 font-bold text-2xs tracking-widest uppercase flex items-center justify-between px-2 border-b border-slate-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-violet-600" />
                    7. Consignees & Customers
                  </span>
                  <span className="rounded bg-violet-50 text-violet-700 font-mono px-1.5 py-0.2 text-3xs font-bold">
                    {graph.customers.length}
                  </span>
                </div>

                {graph.customers.map((custId) => {
                  const cust = db.customers.find((c) => c.id === custId);
                  const isSel = selectedEntity?.id === custId;
                  const isTgt = custId === graph.targetId;

                  return (
                    <div key={custId} className="relative group">
                      <TraceNode
                        id={custId}
                        title={custId}
                        subtitle={cust?.name || 'Healthcare Facility'}
                        icon={Users}
                        type="customer"
                        isTarget={isTgt}
                        isSelected={isSel}
                        isHighlighted={isNodeHighlighted(custId)}
                        isDimmed={isNodeDimmed(custId)}
                        hasInputConnector={true}
                        hasOutputConnector={false}
                        badgeText={cust?.tier || 'Customer'}
                        status="OK"
                        onClick={() => setSelectedEntity({ ...cust, kind: 'CUSTOMER' })}
                        onMouseEnter={() => setHoveredNodeId(custId)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <div className="flex justify-between items-center text-slate-600">
                          <span>Location:</span>
                          <span className="font-semibold text-slate-800">{cust?.location || 'USA'}</span>
                        </div>
                        <div className="text-3xs text-slate-500 truncate">
                          Contact: {cust?.contact || 'QA Lead'}
                        </div>
                      </TraceNode>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTrace(custId);
                        }}
                        className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-blue-600 text-white px-2 py-0.5 text-3xs font-bold shadow-2xs hover:bg-blue-700 z-30"
                        title="Trace customer"
                      >
                        Trace
                      </button>
                    </div>
                  );
                })}

                {graph.customers.length === 0 && (
                  <div className="text-slate-400 text-xs italic py-6 px-2">No destination customers</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: HIERARCHICAL TREE VIEW */}
      {viewMode === 'TREE' && graph && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Hierarchical Bill of Materials & Downstream Blast Radius
              </h3>
              <p className="text-xs text-slate-500">
                Nested lineage tree for root target <span className="font-mono font-bold text-blue-700">{graph.targetId}</span>
              </p>
            </div>
            <button
              onClick={() => runTrace('ALL')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Reset to Full Chain
            </button>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {/* Suppliers */}
            {graph.suppliers.map((supId) => {
              const sup = db.suppliers.find((s) => s.id === supId);
              const lots = graph.rawLots.filter((rlId) => {
                const l = db.lots.find((lot) => lot.id === rlId);
                return l?.supplierId === supId;
              });

              return (
                <div key={supId} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Factory className="h-4 w-4 text-amber-600" />
                    <span>{supId} — {sup?.name}</span>
                    <Badge status="OK" size="sm">{sup?.country}</Badge>
                  </div>

                  {/* Lots from this supplier */}
                  <div className="ml-6 pl-4 border-l-2 border-indigo-200 space-y-3">
                    {lots.map((lotId) => {
                      const lot = db.lots.find((l) => l.id === lotId);
                      const pos = graph.pos.filter((poId) => {
                        const po = db.productionOrders.find((p) => p.id === poId);
                        return po?.inputLots.some((il) => il.id === lotId);
                      });

                      return (
                        <div key={lotId} className="space-y-2">
                          <div className="flex items-center gap-2 text-indigo-900 font-bold">
                            <Database className="h-3.5 w-3.5 text-indigo-600" />
                            <span>{lotId} ({lot?.qty} {lot?.uom})</span>
                            <Badge status={lot?.status || 'OK'} size="sm">{lot?.status}</Badge>
                          </div>

                          {/* POs consuming this lot */}
                          <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-3">
                            {pos.map((poId) => {
                              const po = db.productionOrders.find((p) => p.id === poId);
                              const fg = db.lots.find((l) => l.id === po?.outputLot);
                              const shipments = graph.shipments.filter((sId) => {
                                const s = db.shipments.find((shp) => shp.id === sId);
                                return s?.lotId === fg?.id;
                              });

                              return (
                                <div key={poId} className="space-y-2">
                                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                                    <span>{poId} &rarr; Yield: {fg?.id} ({fg?.qty} units)</span>
                                    <Badge status={po?.status || 'COMPLETED'} size="sm">{po?.status}</Badge>
                                  </div>

                                  {/* Shipments & Customers */}
                                  <div className="ml-6 pl-4 border-l-2 border-purple-200 space-y-1.5 text-2xs">
                                    {shipments.map((shpId) => {
                                      const shp = db.shipments.find((s) => s.id === shpId);
                                      const cust = db.customers.find((c) => c.id === shp?.customerId);
                                      return (
                                        <div key={shpId} className="flex items-center gap-2 text-slate-700">
                                          <Truck className="h-3 w-3 text-purple-600" />
                                          <span className="font-bold">{shpId}:</span>
                                          <span>{shp?.qty} units dispatched to</span>
                                          <span className="font-extrabold text-violet-700">{cust?.name} ({cust?.id})</span>
                                          <Badge status={shp?.recallStatus || shp?.status || 'OK'} size="sm">
                                            {shp?.recallStatus || shp?.status}
                                          </Badge>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: EDGE RELATIONS MATRIX */}
      {viewMode === 'MATRIX' && graph && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Directional Relationship Ledger ({graph.edges?.length || 0} links)
              </h3>
              <p className="text-xs text-slate-500">
                Direct directional node-to-node connectivity in the active graph
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-bold">Filter:</span>
              <Badge status="OK" size="sm">Healthy: {graph.edges?.filter((e) => e.status === 'OK').length || 0}</Badge>
              <Badge status="CRITICAL" size="sm">Critical: {graph.edges?.filter((e) => e.status === 'CRITICAL' || e.status === 'BROKEN').length || 0}</Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-3xs font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Edge ID</th>
                  <th className="py-2.5 px-3">Source Node</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Target Node</th>
                  <th className="py-2.5 px-3">Flow Volume / Label</th>
                  <th className="py-2.5 px-3">Link Health</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {graph.edges?.map((edge) => (
                  <tr
                    key={edge.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      edge.status === 'CRITICAL' ? 'bg-red-50/30' : edge.status === 'BROKEN' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-400 text-3xs font-mono">{edge.id}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <span className="capitalize text-slate-400 font-sans text-3xs mr-1">[{edge.sourceType}]</span>
                      {edge.source}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <span className="capitalize text-slate-400 font-sans text-3xs mr-1">[{edge.targetType}]</span>
                      {edge.target}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {edge.label || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge status={edge.status} size="sm">{edge.status}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => runTrace(edge.source)}
                        className="text-2xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Trace &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Entity Inspection Drawer */}
      {selectedEntity && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 text-2xs font-mono font-bold">
                {selectedEntity.kind || 'ENTITY'}
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-mono">
                  {selectedEntity.id || selectedEntity.lotId}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedEntity.name || selectedEntity.productName || selectedEntity.warehouseName || selectedEntity.customerName || ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => runTrace(selectedEntity.id || selectedEntity.lotId)}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
              >
                <SearchCode className="h-3.5 w-3.5" />
                Re-Center Trace on {selectedEntity.id || selectedEntity.lotId}
              </button>
              <button
                onClick={() => {
                  setGlobalSearchTarget(selectedEntity.id || selectedEntity.lotId);
                  setActiveTab('recall');
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors shadow-2xs"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Launch Recall
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask Copilot
              </button>
            </div>
          </div>

          {/* Upstream and Downstream Quick Chips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/60 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Direct Upstream Parents ({selectedLineage.upstream.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedLineage.upstream.length > 0 ? (
                  selectedLineage.upstream.map((up) => (
                    <button
                      key={up.id}
                      onClick={() => runTrace(up.id)}
                      className="inline-flex items-center gap-1 font-mono text-2xs bg-white border border-slate-200 hover:border-blue-400 px-2 py-0.5 rounded text-slate-700 hover:text-blue-700 transition-colors"
                    >
                      <span className="text-3xs text-slate-400 capitalize">{up.type}:</span>
                      <span className="font-bold">{up.id}</span>
                      {up.label && <span className="text-slate-400 text-3xs">({up.label})</span>}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 italic text-2xs">Root origin / No upstream parents in trace</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Direct Downstream Destinations ({selectedLineage.downstream.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedLineage.downstream.length > 0 ? (
                  selectedLineage.downstream.map((down) => (
                    <button
                      key={down.id}
                      onClick={() => runTrace(down.id)}
                      className="inline-flex items-center gap-1 font-mono text-2xs bg-white border border-slate-200 hover:border-blue-400 px-2 py-0.5 rounded text-slate-700 hover:text-blue-700 transition-colors"
                    >
                      <span className="text-3xs text-slate-400 capitalize">{down.type}:</span>
                      <span className="font-bold">{down.id}</span>
                      {down.label && <span className="text-slate-400 text-3xs">({down.label})</span>}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 italic text-2xs">Terminal node / No downstream entities in trace</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold">Current Status</span>
              <div className="mt-1">
                <Badge status={selectedEntity.status || 'OK'}>{selectedEntity.status || 'OK'}</Badge>
              </div>
            </div>
            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold">Quantity / Volume</span>
              <p className="mt-1 font-mono text-slate-800 font-extrabold text-sm">
                {selectedEntity.qty ? `${selectedEntity.qty.toLocaleString()} ${selectedEntity.uom || 'units'}` : 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold">Location / Hub</span>
              <p className="mt-1 text-slate-700 font-medium truncate">
                {selectedEntity.facility || selectedEntity.warehouseName || selectedEntity.supplierName || selectedEntity.location || 'Global Network'}
              </p>
            </div>
            <div>
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-bold">Traceability Health</span>
              <p className={`mt-1 font-bold ${selectedEntity.isMissing ? 'text-red-700' : 'text-emerald-700'}`}>
                {selectedEntity.isMissing ? '⚠️ Broken BOM Link' : 'Bi-directional Pedigree Active'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
