import { lazy, Suspense, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/common/Button';
import { usePathname, navigate } from './routes';
import { LoadingState } from '../components/common/PageState';

const DashboardScreen = lazy(() => import('../screens/DashboardScreen').then((module) => ({ default: module.DashboardScreen })));
const SuppliersScreen = lazy(() => import('../screens/SuppliersScreen').then((module) => ({ default: module.SuppliersScreen })));
const TraceabilityScreen = lazy(() => import('../screens/TraceabilityScreen').then((module) => ({ default: module.TraceabilityScreen })));
const QualityScreen = lazy(() => import('../screens/QualityScreen').then((module) => ({ default: module.QualityScreen })));
const InventoryScreen = lazy(() => import('../screens/InventoryScreen').then((module) => ({ default: module.InventoryScreen })));
const RecallScreen = lazy(() => import('../screens/RecallScreen').then((module) => ({ default: module.RecallScreen })));
const AiInvestigationScreen = lazy(() => import('../screens/AiInvestigationScreen').then((module) => ({ default: module.AiInvestigationScreen })));
const AnomaliesScreen = lazy(() => import('../screens/AnomaliesScreen').then((module) => ({ default: module.AnomaliesScreen })));
const AuditLogScreen = lazy(() => import('../screens/AuditLogScreen').then((module) => ({ default: module.AuditLogScreen })));
const ReportsScreen = lazy(() => import('../screens/ReportsScreen').then((module) => ({ default: module.ReportsScreen })));
const DocumentsScreen = lazy(() => import('../screens/DocumentsScreen').then((module) => ({ default: module.DocumentsScreen })));
const ValidationScreen = lazy(() => import('../screens/ValidationScreen').then((module) => ({ default: module.ValidationScreen })));

function ScreenForPath({ path }: { path: string }) {
  switch (path) {
    case '/suppliers': return <SuppliersScreen />;
    case '/traceability': return <TraceabilityScreen />;
    case '/quality': return <QualityScreen />;
    case '/inventory': return <InventoryScreen />;
    case '/recalls': return <RecallScreen />;
    case '/ai-investigation': return <AiInvestigationScreen />;
    case '/anomalies': return <AnomaliesScreen />;
    case '/audit-log': return <AuditLogScreen />;
    case '/reports': return <ReportsScreen />;
    case '/documents': return <DocumentsScreen />;
    case '/validation': return <ValidationScreen />;
    case '/dashboard':
    default: return <DashboardScreen />;
  }
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    navigate(`/traceability?lot=${encodeURIComponent(value.trim().toUpperCase())}`);
    onClose();
  };
  return <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 px-4 pt-[15vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><form onSubmit={submit} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"><div className="flex items-center gap-3"><Search className="h-5 w-5 text-teal-600" /><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Search a lot, for example RAW-1042" className="h-11 min-w-0 flex-1 text-sm outline-none" /><button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close search"><X className="h-4 w-4" /></button></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><p className="text-[10px] text-slate-500">Search opens the verified traceability view.</p><Button type="submit" disabled={!value.trim()} className="py-1.5">Trace record</Button></div></form></div>;
}

export default function AppContent() {
  const location = usePathname();
  const pathname = location.split('?')[0];
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (window.location.pathname === '/') navigate('/dashboard');
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !editing && !event.metaKey && !event.ctrlKey) { event.preventDefault(); setSearchOpen(true); }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return <><AppShell onSearch={() => setSearchOpen(true)}><Suspense fallback={<LoadingState label="Opening workspace…" />}><ScreenForPath key={location} path={pathname} /></Suspense></AppShell>{searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}</>;
}
