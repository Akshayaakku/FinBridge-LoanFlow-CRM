import React, { useEffect } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const STATUS_STYLE_MAP: Record<string, string> = {
  // Lead & General
  New: 'bg-blue-50/80 text-blue-700 ring-blue-200/80',
  Contacted: 'bg-slate-100/90 text-slate-700 ring-slate-200/90',
  Interested: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  'Not Interested': 'bg-rose-50/85 text-rose-700 ring-rose-200/80',
  'Callback Requested': 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  Qualified: 'bg-indigo-50/85 text-indigo-700 ring-indigo-200/80',
  Converted: 'bg-emerald-50 text-emerald-800 ring-emerald-300/80',
  Lost: 'bg-slate-100 text-slate-500 ring-slate-200/80',
  // Priority
  High: 'bg-rose-50/85 text-rose-700 ring-rose-200/80',
  Medium: 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  Low: 'bg-slate-100/80 text-slate-600 ring-slate-200/80',
  // Account / Bank / Scheme
  active: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  // Call statuses
  Connected: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  'Not Connected': 'bg-slate-100 text-slate-600 ring-slate-200/80',
  Busy: 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  'No Answer': 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  'Wrong Number': 'bg-rose-50/85 text-rose-700 ring-rose-200/80',
  // Follow-ups
  pending: 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  completed: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-200/80',
  // Documents
  Pending: 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  Verified: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  Rejected: 'bg-rose-50/85 text-rose-700 ring-rose-200/80',
  'Re-upload Required': 'bg-orange-50/85 text-orange-800 ring-orange-200/80',
  // Loan Applications
  'Lead Interested': 'bg-blue-50/85 text-blue-700 ring-blue-200/80',
  'Documents Pending': 'bg-amber-50/85 text-amber-800 ring-amber-200/80',
  'Documents Submitted': 'bg-sky-50/85 text-sky-700 ring-sky-200/80',
  'Under Bank Review': 'bg-indigo-50/85 text-indigo-700 ring-indigo-200/80',
  'Additional Documents Required': 'bg-orange-50/85 text-orange-800 ring-orange-200/80',
  Approved: 'bg-emerald-50/85 text-emerald-700 ring-emerald-200/80',
  Disbursed: 'bg-emerald-100/90 text-emerald-900 ring-emerald-300/80',
  Closed: 'bg-slate-100 text-slate-600 ring-slate-200/80',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const pillStyle = STATUS_STYLE_MAP[status] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const label =
    status === 'active'
      ? 'Active'
      : status === 'inactive'
      ? 'Inactive'
      : status === 'pending'
      ? 'Pending'
      : status === 'completed'
      ? 'Completed'
      : status === 'cancelled'
      ? 'Cancelled'
      : status;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md ring-1 ring-inset whitespace-nowrap shrink-0 leading-4',
        pillStyle,
        className
      )}
    >
      {label}
    </span>
  );
}

const MONOGRAM_TONES = [
  'bg-slate-100 text-slate-700 ring-slate-200/80',
  'bg-blue-50 text-blue-700 ring-blue-200/70',
  'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
  'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  'bg-amber-50 text-amber-800 ring-amber-200/70',
];

export function EntityMonogram({
  name,
  size = 'sm',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const clean = (name || 'FB').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : clean.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % MONOGRAM_TONES.length;
  }
  const tone = MONOGRAM_TONES[Math.abs(hash) % MONOGRAM_TONES.length];

  const sizeCls =
    size === 'xs'
      ? 'w-6 h-6 text-[10px] rounded-md'
      : size === 'md'
      ? 'w-9 h-9 text-xs rounded-lg'
      : 'w-7 h-7 text-[11px] rounded-lg';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center font-display font-semibold ring-1 ring-inset shrink-0 select-none',
        sizeCls,
        tone,
        className
      )}
    >
      {initials}
    </span>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200/95 rounded-xl px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.10)] text-xs min-w-[140px]">
      {label !== undefined && label !== '' && (
        <p className="font-display font-semibold text-slate-900 pb-1.5 mb-1.5 border-b border-slate-100">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span
                className="w-2 h-2 rounded-[2px] shrink-0"
                style={{ backgroundColor: entry.color || '#2563EB' }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  subtext,
  icon,
  tone = 'default',
  progressPct,
  onClick,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  progressPct?: number;
  onClick?: () => void;
}) {
  const iconTone =
    tone === 'primary'
      ? 'bg-blue-50/90 text-blue-600 ring-1 ring-inset ring-blue-200/70'
      : tone === 'success'
      ? 'bg-emerald-50/90 text-emerald-600 ring-1 ring-inset ring-emerald-200/70'
      : tone === 'warning'
      ? 'bg-amber-50/90 text-amber-700 ring-1 ring-inset ring-amber-200/70'
      : tone === 'danger'
      ? 'bg-rose-50/90 text-rose-600 ring-1 ring-inset ring-rose-200/70'
      : 'bg-slate-100/90 text-slate-600 ring-1 ring-inset ring-slate-200/80';

  const progressColor =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'warning'
      ? 'bg-amber-500'
      : tone === 'danger'
      ? 'bg-rose-600'
      : 'bg-blue-600';

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'bg-white border border-slate-200/85 rounded-xl p-4 text-left transition-all duration-150 w-full shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
        onClick &&
          'hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:-translate-y-[1px] cursor-pointer group'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-slate-500 truncate group-hover:text-slate-700 transition-colors">
              {label}
            </p>
            {onClick && (
              <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
            )}
          </div>
          <p className="text-2xl font-bold font-display text-slate-900 mt-1.5 tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        {icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconTone)}>
            {icon}
          </div>
        )}
      </div>
      {typeof progressPct === 'number' && (
        <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', progressColor)}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}
      {subtext && <p className="text-[11px] text-slate-500 mt-2 truncate tabular-nums">{subtext}</p>}
    </Tag>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'crm-anim-fade bg-white border border-slate-200/90 rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.18)] w-full max-h-[90vh] flex flex-col overflow-hidden',
          maxWidth
        )}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200/90 bg-slate-50/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold font-display text-slate-900 truncate tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="crm-anim-drawer bg-white border-l border-slate-200/90 w-full max-w-2xl h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200/90 bg-slate-50/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold font-display text-slate-900 truncate tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="crm-btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50',
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (next: number) => void;
}) {
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/90 bg-slate-50/40 text-xs text-slate-600">
      <span className="tabular-nums">
        Showing <strong className="text-slate-900">{start}</strong>–<strong className="text-slate-900">{end}</strong> of{' '}
        <strong className="text-slate-900">{totalItems}</strong> records
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <span className="px-2.5 tabular-nums font-medium text-slate-800">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200/85 rounded-xl p-10 text-center flex flex-col items-center justify-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="w-12 h-12 rounded-xl bg-slate-100/90 text-slate-500 ring-1 ring-slate-200/80 flex items-center justify-center mb-3.5">
        {icon}
      </div>
      <h4 className="text-sm font-semibold font-display text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
