import { AlertTriangle, LoaderCircle, SearchX } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({ label = 'Loading verified records…' }: { label?: string }) {
  return <div className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin text-teal-600" />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="flex-1"><p className="text-sm font-bold">Could not load this data</p><p className="mt-1 text-xs leading-relaxed">{message}</p></div>{retry && <Button variant="secondary" onClick={retry} className="shrink-0">Retry</Button>}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center"><SearchX className="h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{detail}</p></div>;
}
