import { Activity, AlertOctagon, Bot, Boxes, ClipboardCheck, FileBarChart, FileClock, Files, GitBranch, LayoutDashboard, ShieldAlert, Users, Workflow } from 'lucide-react';
import { appRoutes, navigate } from '../../app/routes';

const icons = [LayoutDashboard, Users, GitBranch, ClipboardCheck, Boxes, ShieldAlert, Bot, AlertOctagon, FileClock, FileBarChart, Files, Workflow];
const sectionOrder = ['Workspace', 'Supply Chain', 'Operations', 'Response', 'Governance', 'Intelligence'];

export function Sidebar({ pathname, mobileOpen, collapsed, onClose }: { pathname: string; mobileOpen: boolean; collapsed: boolean; onClose: () => void }) {
  return <>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-[width,transform] duration-200 lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex h-[var(--tq-app-bar-height)] shrink-0 items-center gap-3 border-b border-slate-800 px-5 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"><Activity className="h-5 w-5" /></div><div className={collapsed ? 'lg:hidden' : ''}><p className="text-sm font-bold tracking-wide text-white">TRACE<span className="text-teal-400">IQ</span></p><p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Supply chain command</p></div></div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
        {sectionOrder.map((section) => {
          const items = appRoutes.map((route, index) => ({ ...route, Icon: icons[index] })).filter((item) => item.group === section);
          if (!items.length) return null;
          return <div key={section} className="mb-5"><p className={`mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${collapsed ? 'lg:hidden' : ''}`}>{section}</p><div className="space-y-1">{items.map(({ path, label, Icon }) => {
            const active = pathname === path;
            return <button key={path} title={collapsed ? label : undefined} aria-label={label} onClick={() => { navigate(path); onClose(); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${active ? 'bg-teal-600 text-white shadow-md shadow-teal-950/30' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}><Icon className="h-4 w-4 shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>{label}</span>{path === '/recalls' && !collapsed && <span className="ml-auto rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">LIVE</span>}</button>;
          })}</div></div>;
        })}
      </nav>
      <div className="border-t border-slate-800 p-4"><div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-3 ${collapsed ? 'lg:hidden' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deterministic core</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Trace, quality, and recall decisions are governed by backend records and rules.</p></div></div>
    </aside>
  </>;
}
