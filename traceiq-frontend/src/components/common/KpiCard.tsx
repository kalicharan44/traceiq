import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label?: string;
  title?: string;
  value: string | number;
  detail?: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: 'rose' | 'emerald' | 'amber' | 'teal';
  badge?: { label?: string; value?: string; color?: string };
  onClick?: () => void;
}

export function KpiCard({ label, title, value, detail, subtitle, icon: Icon, tone = 'teal', badge, onClick }: KpiCardProps) {
  const tones = {
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  const content = <><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">{label ?? title}</p><p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{value}</p></div><span className={`shrink-0 rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></span></div><div className="mt-2 flex min-h-8 items-start justify-between gap-2"><p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">{detail ?? subtitle}</p>{badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${badge.color ?? 'bg-slate-100 text-slate-600'}`}>{badge.value ?? badge.label}</span>}</div></>;
  const className = `min-h-[142px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-5 ${onClick ? 'cursor-pointer transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500' : ''}`;
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}
