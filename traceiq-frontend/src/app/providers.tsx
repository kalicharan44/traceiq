import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type Theme = 'light' | 'dark';
interface ThemeContextValue { theme: Theme; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextValue | null>(null);

type NoticeKind = 'success' | 'error' | 'info';
interface Notice {
  id: number;
  title: string;
  message: string;
  kind: NoticeKind;
}
interface NoticeContextValue {
  notify: (title: string, message: string, kind?: NoticeKind) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem('traceiq-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const toggleTheme = useCallback(() => setTheme((current) => current === 'dark' ? 'light' : 'dark'), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('traceiq-theme', theme);
  }, [theme]);
  const dismiss = useCallback((id: number) => setNotices((current) => current.filter((notice) => notice.id !== id)), []);
  const notify = useCallback((title: string, message: string, kind: NoticeKind = 'success') => {
    const id = Date.now() + Math.random();
    setNotices((current) => [...current.slice(-2), { id, title, message, kind }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <NoticeContext.Provider value={value}>
        {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(92vw,390px)] flex-col gap-2">
        {notices.map((notice) => {
          const Icon = notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? TriangleAlert : Info;
          const color = notice.kind === 'error' ? 'text-rose-600' : notice.kind === 'success' ? 'text-emerald-600' : 'text-teal-600';
          return (
            <div key={notice.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{notice.title}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-600">{notice.message}</p></div>
              <button onClick={() => dismiss(notice.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      </NoticeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NoticeContext);
  if (!value) throw new Error('useNotifications must be used inside Providers.');
  return value;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside Providers.');
  return value;
}
