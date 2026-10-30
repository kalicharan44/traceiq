import { useState } from 'react';
import { Boxes, Link2Off, Plus, Send, Truck } from 'lucide-react';
import { useNotifications } from '../app/providers';
import { Button } from '../components/common/Button';
import { DataTable } from '../components/common/DataTable';
import { ErrorState, LoadingState } from '../components/common/PageState';
import { Panel, PanelHeader } from '../components/common/Panel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import { inventoryApi } from '../services/api/inventoryApi';
import type { InventoryRow, ShipmentRow } from '../types/api';

export function InventoryScreen() {
  const { notify } = useNotifications();
  const [refresh, setRefresh] = useState(0);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [receipt, setReceipt] = useState({ id: '', lot_id: '', warehouse_id: 'WH-CHI-1', warehouse_name: 'Chicago Hub', quantity: 0, unit: 'units', bay: 'A-01' });
  const [dispatch, setDispatch] = useState({ id: '', lot_id: '', customer_id: '', quantity: 0, unit: 'units', destination: '', carrier: 'TraceIQ Logistics', tracking_number: '' });
  const stock = useApiQuery((signal) => inventoryApi.list('', signal), [refresh]);
  const shipmentList = useApiQuery((signal) => inventoryApi.shipments('', signal), [refresh]);
  const [customerInputs, setCustomerInputs] = useState<Record<string, string>>({});
  const repair = async (shipment: ShipmentRow) => {
    const customerId = customerInputs[shipment.id]?.trim().toUpperCase();
    if (!customerId) return;
    try {
      await inventoryApi.repairShipmentCustomer(shipment.id, customerId, 'Data Steward');
      notify('Recipient link corrected', `${shipment.id} now links to ${customerId}.`);
      setRefresh((value) => value + 1);
    } catch (error) { notify('Could not correct recipient', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  const recordReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    try { const result = await inventoryApi.receive({ ...receipt, id: receipt.id.trim().toUpperCase(), lot_id: receipt.lot_id.trim().toUpperCase() }); notify('Inventory received', `${result.quantity} ${result.unit} of ${result.lot_id} recorded at ${result.warehouse_name}.`); setReceiptOpen(false); setRefresh((value) => value + 1); }
    catch (error) { notify('Receipt rejected', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  const dispatchShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    try { const result = await inventoryApi.dispatch({ ...dispatch, id: dispatch.id.trim().toUpperCase(), lot_id: dispatch.lot_id.trim().toUpperCase(), customer_id: dispatch.customer_id.trim().toUpperCase() }); notify('Shipment dispatched', `${result.id} is now in transit.`); setDispatchOpen(false); setRefresh((value) => value + 1); }
    catch (error) { notify('Shipment rejected', error instanceof Error ? error.message : 'Request failed', 'error'); }
  };
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Distribution ledger</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Inventory & shipments</h2><p className="mt-2 text-sm text-slate-500">Review warehouse stock, shipment status, and recipient links from backend records.</p></div>
    <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setReceiptOpen((open) => !open)}><Plus className="h-4 w-4" />Receive approved lot</Button><Button variant="secondary" onClick={() => setDispatchOpen((open) => !open)}><Send className="h-4 w-4" />Dispatch shipment</Button></div>
    {receiptOpen && <Panel><PanelHeader title="Inventory receipt" subtitle="Only quality-approved lots can enter available inventory." /><form onSubmit={recordReceipt} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><input required value={receipt.id} onChange={(event) => setReceipt((current) => ({ ...current, id: event.target.value }))} placeholder="Receipt ID" className="h-9 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={receipt.lot_id} onChange={(event) => setReceipt((current) => ({ ...current, lot_id: event.target.value }))} placeholder="Approved lot ID" className="h-9 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={receipt.warehouse_id} onChange={(event) => setReceipt((current) => ({ ...current, warehouse_id: event.target.value }))} placeholder="Warehouse ID" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input required value={receipt.warehouse_name} onChange={(event) => setReceipt((current) => ({ ...current, warehouse_name: event.target.value }))} placeholder="Warehouse name" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input required type="number" min="0.01" step="0.01" value={receipt.quantity || ''} onChange={(event) => setReceipt((current) => ({ ...current, quantity: Number(event.target.value) }))} placeholder="Quantity" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input required value={receipt.unit} onChange={(event) => setReceipt((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input value={receipt.bay} onChange={(event) => setReceipt((current) => ({ ...current, bay: event.target.value }))} placeholder="Bay" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><Button type="submit" className="h-9">Record receipt</Button></form></Panel>}
    {dispatchOpen && <Panel><PanelHeader title="Dispatch shipment" subtitle="Requires released finished lot, qualified recipient, and sufficient available stock." /><form onSubmit={dispatchShipment} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><input required value={dispatch.id} onChange={(event) => setDispatch((current) => ({ ...current, id: event.target.value }))} placeholder="Shipment ID" className="h-9 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={dispatch.lot_id} onChange={(event) => setDispatch((current) => ({ ...current, lot_id: event.target.value }))} placeholder="Released finished lot" className="h-9 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={dispatch.customer_id} onChange={(event) => setDispatch((current) => ({ ...current, customer_id: event.target.value }))} placeholder="Customer ID" className="h-9 rounded-lg border border-slate-200 px-3 font-mono text-xs" /><input required value={dispatch.destination} onChange={(event) => setDispatch((current) => ({ ...current, destination: event.target.value }))} placeholder="Destination" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input required type="number" min="0.01" step="0.01" value={dispatch.quantity || ''} onChange={(event) => setDispatch((current) => ({ ...current, quantity: Number(event.target.value) }))} placeholder="Quantity" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input required value={dispatch.unit} onChange={(event) => setDispatch((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><input value={dispatch.tracking_number} onChange={(event) => setDispatch((current) => ({ ...current, tracking_number: event.target.value }))} placeholder="Tracking number" className="h-9 rounded-lg border border-slate-200 px-3 text-xs" /><Button type="submit" className="h-9">Dispatch</Button></form></Panel>}
    <div className="grid gap-5 xl:grid-cols-2"><Panel><PanelHeader title="Warehouse inventory" subtitle={`${stock.data?.length ?? 0} balances in this result`} />{stock.loading && !stock.data ? <div className="p-4"><LoadingState /></div> : stock.error ? <div className="p-4"><ErrorState message={stock.error} retry={stock.reload} /></div> : <div className="p-4"><DataTable<InventoryRow> rows={stock.data ?? []} getKey={(row) => row.id} columns={[
      { key: 'lot', title: 'Lot', render: (row) => <span className="font-mono font-bold">{row.lot_id}</span> },
      { key: 'warehouse', title: 'Warehouse', render: (row) => <span><span className="block font-semibold">{row.warehouse_name}</span><span className="text-[10px] text-slate-500">{row.warehouse_id} · {row.bay}</span></span> },
      { key: 'qty', title: 'Quantity', render: (row) => `${row.quantity.toLocaleString()} ${row.unit}` },
      { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ]} /></div>}</Panel>
      <Panel><PanelHeader title="Shipment movements" subtitle={`${shipmentList.data?.length ?? 0} shipment and in-transit records`} />{shipmentList.loading && !shipmentList.data ? <div className="p-4"><LoadingState /></div> : shipmentList.error ? <div className="p-4"><ErrorState message={shipmentList.error} retry={shipmentList.reload} /></div> : <div className="p-4"><DataTable<ShipmentRow> rows={shipmentList.data ?? []} getKey={(row) => row.id} columns={[
        { key: 'shipment', title: 'Shipment', render: (row) => <span><span className="block font-mono font-bold">{row.id}</span><span className="text-[10px] text-slate-500">{row.tracking_number}</span></span> },
        { key: 'lot', title: 'Finished lot', render: (row) => <span className="font-mono">{row.lot_id}</span> },
        { key: 'qty', title: 'Quantity', render: (row) => `${row.quantity.toLocaleString()} ${row.unit}` },
        { key: 'status', title: 'State', render: (row) => <StatusBadge status={row.status} /> },
      ]} /></div>}
        {shipmentList.data?.some((row) => !row.customer_id) && <div className="border-t border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-amber-900"><Link2Off className="h-4 w-4" />Incomplete recipient links</div><p className="mt-1 text-[11px] text-amber-800">Correcting a recipient is audited and updates future downstream traces.</p><div className="mt-3 space-y-2">{shipmentList.data.filter((row) => !row.customer_id).map((row) => <div key={row.id} className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] font-bold">{row.id}</span><input value={customerInputs[row.id] ?? ''} onChange={(event) => setCustomerInputs((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Customer ID" className="h-8 w-32 rounded-md border border-amber-300 bg-white px-2 font-mono text-xs outline-none" /><Button onClick={() => repair(row)} className="px-2.5 py-1 text-[10px]">Repair link</Button></div>)}</div></div>}
      </Panel>
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-xs font-bold text-slate-800"><Boxes className="h-4 w-4 text-teal-600" />Ledger state</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Recall activation changes affected available balances to quarantine within one backend transaction.</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-xs font-bold text-slate-800"><Truck className="h-4 w-4 text-amber-600" />Shipment state</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Affected in-transit shipments move to recall hold; delivered quantities remain in the reconciliation scope.</p></div></div>
  </div>;
}
