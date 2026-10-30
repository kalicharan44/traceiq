import { useSyncExternalStore } from 'react';

export const appRoutes = [
  { path: '/dashboard', label: 'Overview', title: 'Supply Chain Overview', group: 'Workspace' },
  { path: '/suppliers', label: 'Suppliers', title: 'Supplier Network', group: 'Supply Chain' },
  { path: '/traceability', label: 'Traceability', title: 'Lot Genealogy', group: 'Supply Chain' },
  { path: '/quality', label: 'Quality', title: 'Quality Gates', group: 'Operations' },
  { path: '/inventory', label: 'Inventory & Shipments', title: 'Inventory & Distribution', group: 'Operations' },
  { path: '/recalls', label: 'Recall Command Center', title: 'Recall Command Center', group: 'Response' },
  { path: '/ai-investigation', label: 'AI Investigation', title: 'AI Investigation', group: 'Response' },
  { path: '/anomalies', label: 'Anomalies', title: 'Anomaly Detection', group: 'Governance' },
  { path: '/audit-log', label: 'Audit Log', title: 'Audit & Reports', group: 'Governance' },
  { path: '/reports', label: 'Reports', title: 'Recall Reports', group: 'Governance' },
  { path: '/documents', label: 'Document Intelligence', title: 'Document Intelligence', group: 'Intelligence' },
  { path: '/validation', label: 'Validation Center', title: 'Validation Center', group: 'Intelligence' },
] as const;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
};
const getSnapshot = () => `${window.location.pathname}${window.location.search}`;

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  listeners.forEach((listener) => listener());
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  if (window.location.pathname !== '/dashboard') navigate('/dashboard');
}

export function usePathname() {
  return useSyncExternalStore(subscribe, getSnapshot, () => '/dashboard');
}

export function getRoute(path: string) {
  const pathname = path.split('?')[0];
  return appRoutes.find((route) => route.path === pathname) ?? appRoutes[0];
}
