import {
  AlertTriangle,
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  CheckCheck,
  FileCheck2,
  GitBranch,
  Radio,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCrmData } from '../../context/CrmDataContext';
import { cn, formatDateTime } from '../../lib/utils';
import type { CrmNotification, NotificationCategory } from '../../types/crm';

type FilterTab = 'all' | 'unread' | 'leads' | 'followups' | 'docs';

export function NotificationCenter({
  scope,
  staffEmail,
  onNavigate,
  variant = 'light',
}: {
  scope: 'admin' | 'staff';
  staffEmail?: string;
  onNavigate?: (targetTab: string) => void;
  variant?: 'light' | 'dark';
}) {
  const {
    notifications,
    realtimeConnected,
    browserPushEnabled,
    toggleBrowserPush,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useCrmData();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const scopedNotifications = useMemo(() => {
    if (scope === 'admin') {
      return notifications.filter((n) => n.targetRole === 'admin');
    }
    const target = (staffEmail || '').toLowerCase();
    return notifications.filter((n) => n.targetRole === 'staff' && n.targetEmail.toLowerCase() === target);
  }, [notifications, scope, staffEmail]);

  const unreadCount = useMemo(
    () => scopedNotifications.filter((n) => !n.read).length,
    [scopedNotifications]
  );

  const visibleNotifications = useMemo(() => {
    return scopedNotifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'leads') return n.category === 'lead_assigned' || n.category === 'lead_attention';
      if (filter === 'followups') return n.category === 'follow_up_upcoming';
      if (filter === 'docs') return n.category === 'doc_update' || n.category === 'application_update';
      return true;
    });
  }, [scopedNotifications, filter]);

  const resolveDestinationTab = (n: CrmNotification): string => {
    if (scope === 'admin') {
      if (n.category === 'lead_attention' && n.entityType === 'lead') return 'distribution';
      if (n.category === 'lead_assigned') return 'leads';
      if (n.category === 'follow_up_upcoming' || n.entityType === 'follow_up') return 'followups';
      if (n.category === 'doc_update' || n.entityType === 'customer_document') return 'documents';
      if (n.category === 'application_update' || n.entityType === 'loan_application') return 'applications';
      return 'leads';
    }
    if (n.category === 'lead_assigned' || n.entityType === 'lead') return 'leads';
    if (n.category === 'follow_up_upcoming' || n.entityType === 'follow_up') return 'followups';
    if (n.category === 'doc_update' || n.entityType === 'customer_document') return 'documents';
    if (n.category === 'application_update' || n.entityType === 'loan_application') return 'applications';
    return 'leads';
  };

  const renderCategoryIcon = (cat: NotificationCategory, severity: CrmNotification['severity']) => {
    const tone =
      severity === 'urgent'
        ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
        : severity === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
        : severity === 'success'
        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
        : 'bg-blue-50 text-blue-600 ring-1 ring-blue-100';

    const Icon =
      cat === 'lead_attention'
        ? AlertTriangle
        : cat === 'lead_assigned'
        ? scope === 'admin'
          ? GitBranch
          : Users
        : cat === 'follow_up_upcoming'
        ? CalendarClock
        : cat === 'doc_update'
        ? FileCheck2
        : Building2;

    return (
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tone)}>
        <Icon className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open notifications"
        aria-expanded={open}
        className={cn(
          'relative min-h-[38px] min-w-[38px] p-2 rounded-lg border transition-colors flex items-center justify-center',
          variant === 'dark'
            ? 'border-slate-700/80 bg-slate-800/90 text-slate-200 hover:bg-slate-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums shadow-sm ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="crm-anim-fade fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-14 sm:top-auto sm:mt-2 sm:w-[400px] bg-white border border-slate-200/90 rounded-2xl shadow-[0_18px_40px_rgba(15,23,42,0.14)] overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200/90 flex items-center justify-between gap-2 bg-slate-50/75">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold font-display text-slate-900">Notifications</h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                    realtimeConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <Radio className="w-2.5 h-2.5" />
                  {realtimeConnected ? 'Live' : 'Syncing'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                {unreadCount} unread · {scopedNotifications.length} total
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleBrowserPush}
                title={browserPushEnabled ? 'Desktop alerts active' : 'Enable browser alerts'}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  browserPushEnabled ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                )}
              >
                <BellRing className="w-4 h-4" />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllNotificationsAsRead(scopedNotifications)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1 overflow-x-auto bg-white">
            {(
              [
                ['all', 'All'],
                ['unread', `Unread (${unreadCount})`],
                ['leads', 'Leads'],
                ['followups', 'Follow-ups'],
                ['docs', 'KYC & Apps'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors',
                  filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Notification Stream */}
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto divide-y divide-slate-100">
            {visibleNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700">No notifications in this view</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  New lead assignments, follow-ups, and KYC updates appear here instantly.
                </p>
              </div>
            ) : (
              visibleNotifications.slice(0, 35).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) void markNotificationAsRead(n.id);
                    if (onNavigate) onNavigate(resolveDestinationTab(n));
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
                    !n.read && 'bg-blue-50/40'
                  )}
                >
                  {renderCategoryIcon(n.category, n.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs leading-snug', !n.read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-[2px] bg-blue-600 shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {n.actorName} · {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
