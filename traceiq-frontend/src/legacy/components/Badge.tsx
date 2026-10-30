import React from 'react';
import { STATUS, LotStatus } from '../types/nexusChain';

interface BadgeProps {
  children?: React.ReactNode;
  status: LotStatus | 'CRITICAL' | 'INFO' | 'VIOLET' | 'DEFAULT' | string;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, status, className = '', size = 'md' }) => {
  const styles: Record<string, string> = {
    [STATUS.OK]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    [STATUS.WARNING]: 'bg-amber-50 text-amber-700 border-amber-200',
    [STATUS.QUARANTINED]: 'bg-red-50 text-red-700 border-red-200 font-medium',
    [STATUS.RECALLED]: 'bg-red-50 text-red-700 border-red-200 font-medium',
    [STATUS.HOLD]: 'bg-orange-50 text-orange-700 border-orange-200 font-medium',
    [STATUS.DELIVERED]: 'bg-blue-50 text-blue-700 border-blue-200',
    [STATUS.IN_TRANSIT]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    CRITICAL: 'bg-red-50 text-red-700 border-red-200 font-semibold',
    INFO: 'bg-blue-50 text-blue-700 border-blue-200',
    VIOLET: 'bg-violet-50 text-violet-700 border-violet-200',
    DEFAULT: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-3xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-wide whitespace-nowrap ${sizeClasses} ${
        styles[status] || styles.DEFAULT
      } ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />
      {children || status}
    </span>
  );
};
