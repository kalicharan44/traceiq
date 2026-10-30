import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useNotifications } from '../app/providers';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { recallsApi } from '../services/api/recallsApi';
import type { RecallRecord } from '../types/api';

export function ReportsScreen() {
  const { notify } = useNotifications();
  const recalls = useApiQuery((signal) => recallsApi.list(signal), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const download = async (row: RecallRecord) => {
    setBusyId(row.id);
    try {
      const report = await recallsApi.report(row.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `traceiq-${row.id}-report.json`; anchor.click(); URL.revokeObjectURL(url);
      notify('Report downloaded', `Audit-linked JSON report for ${row.id} is ready.`);
    } catch (error) { notify('Report could not be generated', error instanceof Error ? error.message : 'Request failed', 'error'); }
    finally { setBusyId(null); }
  };
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Evidence-linked exports</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Reports</h2><p className="mt-2 text-sm text-slate-500">Generate recall reports containing the case, reconciliation, action history, and related audit events.</p></div><Panel><PanelHeader title="Recall case reports" subtitle="Reports are built from persisted backend records, not browser-only state." />{recalls.loading && !recalls.data ? <div className="p-4"><LoadingState /></div> : recalls.error ? <div className="p-4"><ErrorState message={recalls.error} retry={recalls.reload} /></div> : <div className="p-4"><DataTable<RecallRecord> rows={recalls.data ?? []} getKey={(row) => row.id} emptyTitle="No recall cases to report" emptyDetail="A report becomes available after a recall simulation is approved and activated." columns={[
    { key: 'case', title: 'Recall case', render: (row) => <span><span className="block font-mono font-bold text-slate-900">{row.id}</span><span className="text-[10px] text-slate-500">Target {row.target_lot_id}</span></span> },
    { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'units', title: 'Affected units', render: (row) => row.affected_units.toLocaleString() },
    { key: 'approved', title: 'Approved by', render: (row) => row.authorized_by },
    { key: 'download', title: 'Export', render: (row) => <Button variant="secondary" className="px-2.5 py-1.5 text-[10px]" disabled={busyId === row.id} onClick={() => download(row)}><Download className="h-3.5 w-3.5" />{busyId === row.id ? 'Preparing…' : 'JSON report'}</Button> },
  ]} /></div>}</Panel><div className="rounded-xl border border-teal-100 bg-teal-50 p-4"><p className="flex items-center gap-2 text-xs font-bold text-teal-900"><FileText className="h-4 w-4" />Report integrity</p><p className="mt-1 text-xs leading-relaxed text-teal-800">Exports include the recorded recall snapshot and linked audit events. This prototype does not claim cryptographic tamper-proof storage.</p></div></div>;
}
