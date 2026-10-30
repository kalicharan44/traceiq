export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase().replaceAll('_', ' ');
  const style = /FAIL|CRITICAL|RECALLED|QUARANTINED|OVER ALLOCATED|INCOMPLETE|BLOCKED/.test(normalized)
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : /PENDING|WARNING|UNDER RECONCILED|FLAGGED|HOLD|ATTENTION/.test(normalized)
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : /PASS|ACTIVE|RELEASED|DELIVERED|COMPLETED|RECONCILED|CLOSED|APPROVED|CLEAR/.test(normalized)
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style}`}>{normalized}</span>;
}

// Compatibility export for the legacy screens while their UI is migrated.
export const StatusIndicator = StatusBadge;
