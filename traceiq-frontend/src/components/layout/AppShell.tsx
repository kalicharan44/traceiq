import { useState } from 'react';
import { usePathname } from '../../app/routes';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppShell({ children, onSearch }: { children: React.ReactNode; onSearch: () => void }) {
  const location = usePathname();
  const pathname = location.split('?')[0];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleNavigation = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setSidebarCollapsed((value) => !value);
    else setMobileOpen((value) => !value);
  };
  return <div className="min-h-screen bg-slate-50 text-slate-800"><Sidebar pathname={pathname} mobileOpen={mobileOpen} collapsed={sidebarCollapsed} onClose={() => setMobileOpen(false)} /><div className={`flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ${sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[264px]'}`}><Header onOpenMenu={toggleNavigation} sidebarCollapsed={sidebarCollapsed} onSearch={onSearch} showBack={pathname !== '/dashboard'} /><main className="flex-1 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-[1440px]">{children}</div></main><footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-[10px] text-slate-400">TraceIQ · Supply-chain intelligence platform</footer></div></div>;
}
