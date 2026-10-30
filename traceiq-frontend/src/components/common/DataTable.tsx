import type { ReactNode } from 'react';
import { EmptyState } from './PageState';

export interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ rows, columns, getKey, emptyTitle = 'No records found', emptyDetail = 'Try a different search or filter.' }: { rows: T[]; columns: Column<T>[]; getKey: (row: T) => string; emptyTitle?: string; emptyDetail?: string }) {
  if (!rows.length) return <EmptyState title={emptyTitle} detail={emptyDetail} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[680px] border-collapse text-left text-sm"><thead><tr className="bg-slate-50">{columns.map((column) => <th key={column.key} className={`whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${column.className ?? ''}`}>{column.title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={getKey(row)} className="hover:bg-slate-50/80">{columns.map((column) => <td key={column.key} className={`px-4 py-3.5 text-xs text-slate-700 ${column.className ?? ''}`}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
