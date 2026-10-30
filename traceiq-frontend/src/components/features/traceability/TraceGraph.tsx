import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TraceabilityResult } from '../../../types/api';

const columnFor: Record<string, number> = {
  supplier: 0,
  raw_lot: 1,
  production_order: 2,
  finished_lot: 3,
  inventory: 4,
  shipment: 4,
  customer: 5,
  missing: 2,
};

const nodeTone: Record<string, string> = {
  supplier: '#f0fdfa',
  raw_lot: '#f0fdfa',
  production_order: '#f8fafc',
  finished_lot: '#ecfdf5',
  inventory: '#fefce8',
  shipment: '#fff7ed',
  customer: '#ccfbf1',
  missing: '#fff1f2',
};

export function TraceGraph({ result }: { result: TraceabilityResult }) {
  const { nodes, edges } = useMemo(() => {
    const rows = new Map<number, number>();
    const mappedNodes: Node[] = result.nodes.map((item) => {
      const col = columnFor[item.type] ?? 2;
      const row = rows.get(col) ?? 0;
      rows.set(col, row + 1);
      return {
        id: item.id,
        position: { x: col * 245, y: row * 112 },
        data: { label: <div className="max-w-[205px]"><div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.type.replaceAll('_', ' ')}</div><div className="mt-1 truncate text-xs font-bold text-slate-900">{item.label}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">{item.status && <span>{item.status.replaceAll('_', ' ')}</span>}{item.quantity !== null && item.quantity !== undefined && <span>{item.quantity.toLocaleString()} {item.unit}</span>}</div></div> },
        style: { width: 220, borderRadius: 12, border: item.type === 'missing' ? '1px solid #fda4af' : '1px solid #cbd5e1', background: nodeTone[item.type] ?? '#fff', padding: 12, boxShadow: '0 3px 10px rgba(15,23,42,.06)' },
      };
    });
    const mappedEdges: Edge[] = result.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, type: 'smoothstep', animated: false, style: { stroke: edge.status === 'BROKEN' ? '#e11d48' : '#94a3b8', strokeWidth: 1.5 }, labelStyle: { fill: '#64748b', fontSize: 9 }, labelBgStyle: { fill: '#fff', fillOpacity: 0.9 } }));
    return { nodes: mappedNodes, edges: mappedEdges };
  }, [result]);

  return <div className="h-[520px] w-full rounded-b-2xl bg-slate-50" aria-label="Interactive upstream and downstream lot genealogy graph"><ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} maxZoom={1.6} nodesDraggable nodesConnectable={false} proOptions={{ hideAttribution: true }}><Background color="#cbd5e1" gap={20} /><MiniMap pannable zoomable nodeColor={(node) => nodeTone[String(node.type)] ?? '#e2e8f0'} /><Controls /></ReactFlow></div>;
}
