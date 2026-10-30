import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Badge } from './Badge';

interface TraceNodeProps {
  id?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  type: 'source' | 'raw' | 'po' | 'fg' | 'dist' | 'customer' | 'missing';
  isTarget?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  status?: string;
  badgeText?: string;
  hasInputConnector?: boolean;
  hasOutputConnector?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const TraceNode: React.FC<TraceNodeProps> = ({
  id,
  title,
  subtitle,
  icon: Icon,
  type,
  isTarget = false,
  isSelected = false,
  isHighlighted = false,
  isDimmed = false,
  status,
  badgeText,
  hasInputConnector = true,
  hasOutputConnector = true,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
  const styles: Record<string, string> = {
    source: 'border-slate-200 bg-white text-slate-800 hover:border-slate-300',
    raw: 'border-indigo-200 bg-white text-slate-800 hover:border-indigo-300',
    po: 'border-blue-200 bg-white text-slate-800 hover:border-blue-300',
    fg: 'border-teal-200 bg-white text-slate-800 hover:border-teal-300',
    dist: 'border-cyan-200 bg-white text-slate-800 hover:border-cyan-300',
    customer: 'border-purple-200 bg-white text-slate-800 hover:border-purple-300',
    missing: 'border-red-300 bg-red-50/90 text-red-900 border-dashed ring-1 ring-red-400/30'
  };

  const iconColors: Record<string, string> = {
    source: 'text-amber-600 bg-amber-50 border-amber-200',
    raw: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    po: 'text-blue-600 bg-blue-50 border-blue-200',
    fg: 'text-teal-600 bg-teal-50 border-teal-200',
    dist: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    customer: 'text-purple-600 bg-purple-50 border-purple-200',
    missing: 'text-red-600 bg-red-100 border-red-200'
  };

  const nodeId = id || title;

  return (
    <div
      id={`node-${nodeId}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative w-72 rounded-2xl border p-4 shadow-xs transition-all duration-200 cursor-pointer select-none ${
        styles[type] || styles.source
      } ${
        isSelected
          ? 'ring-2 ring-blue-600 border-blue-600 bg-blue-50/40 shadow-md scale-[1.02]'
          : isTarget
          ? 'ring-2 ring-blue-500/50 border-blue-500 bg-blue-50/30 shadow-sm'
          : isHighlighted
          ? 'ring-2 ring-indigo-400/50 border-indigo-400 shadow-sm'
          : isDimmed
          ? 'opacity-40 hover:opacity-100'
          : 'hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Input connector port dot (left) */}
      {hasInputConnector && (
        <div
          id={`in-${nodeId}`}
          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-slate-400 shadow-xs z-10 transition-colors group-hover:bg-blue-500"
          title="Input flow connection"
        />
      )}

      {/* Output connector port dot (right) */}
      {hasOutputConnector && (
        <div
          id={`out-${nodeId}`}
          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white bg-blue-500 shadow-xs z-10 transition-colors group-hover:bg-blue-600"
          title="Output flow connection"
        />
      )}

      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border shrink-0 ${iconColors[type] || iconColors.source}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-mono text-xs font-bold tracking-tight text-slate-900 truncate">
            {title}
          </span>
        </div>

        {status && (
          <Badge status={status} size="sm" className="shrink-0">
            {badgeText || status}
          </Badge>
        )}
      </div>

      {/* Subtitle / Descriptive Name */}
      <div className="text-xs font-medium text-slate-600 leading-snug line-clamp-2">
        {subtitle}
      </div>

      {/* Children details (quantities, connections) */}
      {children && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 text-2xs space-y-1 text-slate-500">
          {children}
        </div>
      )}
    </div>
  );
};
