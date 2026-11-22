import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  Archive,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  GitBranch,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import {
  archiveLead,
  assignLeadsToEmployee,
  completeFollowUp,
  createEmployee,
  createFollowUp,
  createLead,
  createLoanApplication,
  deleteBank,
  deleteLoanScheme,
  exportLeadsFile,
  fetchDocumentBlob,
  reassignFollowUp,
  recordCallLog,
  roundRobinDistributeLeads,
  saveBank,
  saveLoanScheme,
  scoreLeadsWithAI,
  setEmployeeDailyTarget,
  updateDuplicateRule,
  updateEmployee,
  updateLead,
  updateLoanApplicationStatus,
  uploadCustomerDocument,
  verifyCustomerDocument,
} from '../../services/crmService';
import { resolveEffectiveLeadScore, type ComputedLeadScore } from '../../lib/leadScoring';
import {
  cn,
  downloadTextFile,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  getDateKey,
  getTodayKey,
} from '../../lib/utils';
import {
  bankFormSchema,
  CALL_STATUSES,
  callLogFormSchema,
  DOCUMENT_TYPES,
  employeeFormSchema,
  EMPLOYMENT_TYPES,
  followUpFormSchema,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  leadFormSchema,
  LOAN_APPLICATION_STATUSES,
  LOAN_TYPES,
  loanApplicationFormSchema,
  schemeFormSchema,
  type Bank,
  type CallLog,
  type CallStatus,
  type CustomerDocument,
  type DocumentStatus,
  type DocumentType,
  type DuplicateRule,
  type Employee,
  type FollowUp,
  type Lead,
  type LoanApplication,
  type LoanApplicationStatus,
  type LoanScheme,
} from '../../types/crm';
import type { AdminTab } from '../admin/AdminLayout';
import { LeadScoreBadge, LeadScoreBreakdownCard } from '../ui/LeadScoreBadge';
import { NotificationCenter } from '../ui/NotificationCenter';
import { FinBridgeLogo } from '../ui/FinBridgeLogo';
import { ChartTooltip, ConfirmDialog, EntityMonogram, StatusBadge } from '../ui/Primitives';

const MODULE_META: Array<{ id: AdminTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'leads', label: 'Lead Management', shortLabel: 'Leads', icon: Users },
  { id: 'distribution', label: 'Lead Distribution', shortLabel: 'Distribute', icon: GitBranch },
  { id: 'employees', label: 'Employees', shortLabel: 'Team', icon: UserCheck },
  { id: 'calls', label: 'Call Logs', shortLabel: 'Calls', icon: PhoneCall },
  { id: 'followups', label: 'Follow-ups', shortLabel: 'Follow-ups', icon: CalendarClock },
  { id: 'documents', label: 'Documents & KYC', shortLabel: 'KYC Docs', icon: FileCheck2 },
  { id: 'banks', label: 'Banks & Schemes', shortLabel: 'Banks', icon: Landmark },
  { id: 'applications', label: 'Loan Applications', shortLabel: 'Apps', icon: Building2 },
  { id: 'reports', label: 'Reports & Analytics', shortLabel: 'Reports', icon: BarChart3 },
];

function MobileSheet({
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 crm-anim-sheet">
        <div className="sm:hidden pt-2.5 flex justify-center shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
        <div className="pt-2 sm:pt-3.5 pb-3 px-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold tracking-tight text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function MobileAdminApp() {
  const { userProfile, role, setPortalMode, signOut } = useAuth();
  const {
    leads,
    employees,
    leadAssignments,
    callLogs,
    followUps,
    documents,
    banks,
    schemes,
    applications,
    statusHistory,
    activityLogs,
    settings,
    notify,
  } = useCrmData();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const currentModule = MODULE_META.find((m) => m.id === activeTab) || MODULE_META[0];
  const primaryBottomTabs: AdminTab[] = ['dashboard', 'leads', 'calls', 'applications'];

  if (role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col">
      {/* Compact Sticky Top App Bar */}
      <header className="sticky top-0 z-30 h-14 bg-[#0B1220]/95 backdrop-blur-md text-white px-3 sm:px-5 flex items-center justify-between gap-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open all modules"
            className="min-h-[44px] min-w-[44px] -ml-1 flex items-center justify-center rounded-xl text-slate-200 hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <FinBridgeLogo size="sm" variant="dark" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <p className="text-[11px] text-blue-300 font-medium leading-none">FinBridge Mobile Admin</p>
            <h1 className="font-display text-sm font-bold tracking-tight text-white truncate mt-0.5">
              {currentModule.label}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <NotificationCenter
            scope="admin"
            variant="dark"
            onNavigate={(tab) => setActiveTab(tab as AdminTab)}
          />
          <button
            type="button"
            onClick={() => setPortalMode('admin')}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs font-medium text-slate-100 hover:bg-white/15 transition-colors whitespace-nowrap"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-5 pt-4 pb-24 space-y-4">
        {activeTab === 'dashboard' && <MobileDashboard onNavigate={setActiveTab} />}
        {activeTab === 'leads' && (
          <MobileLeads
            actor={actor}
            leads={leads}
            employees={employees}
            banks={banks}
            callLogs={callLogs}
            followUps={followUps}
            documents={documents}
            settings={settings}
            notify={notify}
          />
        )}
        {activeTab === 'distribution' && (
          <MobileDistribution
            actor={actor}
            leads={leads}
            employees={employees}
            leadAssignments={leadAssignments}
            notify={notify}
          />
        )}
        {activeTab === 'employees' && (
          <MobileEmployees actor={actor} employees={employees} leads={leads} callLogs={callLogs} notify={notify} />
        )}
        {activeTab === 'calls' && (
          <MobileCalls actor={actor} leads={leads} employees={employees} callLogs={callLogs} notify={notify} />
        )}
        {activeTab === 'followups' && (
          <MobileFollowUps actor={actor} leads={leads} employees={employees} followUps={followUps} notify={notify} />
        )}
        {activeTab === 'documents' && (
          <MobileDocuments actor={actor} leads={leads} employees={employees} documents={documents} notify={notify} />
        )}
        {activeTab === 'banks' && (
          <MobileBanks actor={actor} banks={banks} schemes={schemes} notify={notify} />
        )}
        {activeTab === 'applications' && (
          <MobileApplications
            actor={actor}
            applications={applications}
            leads={leads}
            employees={employees}
            banks={banks}
            schemes={schemes}
            statusHistory={statusHistory}
            notify={notify}
          />
        )}
        {activeTab === 'reports' && (
          <MobileReports
            leads={leads}
            employees={employees}
            callLogs={callLogs}
            applications={applications}
            activityLogs={activityLogs}
          />
        )}
      </main>

      {/* Fixed Thumb-Friendly Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 flex items-center justify-around shadow-[0_-2px_10px_rgba(15,23,42,0.03)]">
        {primaryBottomTabs.map((tabId) => {
          const item = MODULE_META.find((m) => m.id === tabId)!;
          const Icon = item.icon;
          const active = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={cn(
                'relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
                active ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {active && <span className="absolute top-0 w-6 h-[2.5px] rounded-full bg-blue-600" aria-hidden="true" />}
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{item.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
            !primaryBottomTabs.includes(activeTab) ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {!primaryBottomTabs.includes(activeTab) && (
            <span className="absolute top-0 w-6 h-[2.5px] rounded-full bg-blue-600" aria-hidden="true" />
          )}
          <Menu className="w-5 h-5" />
          <span className="text-[11px] font-medium">Modules</span>
        </button>
      </nav>

      {/* All 10 Admin Modules + Workspace Switcher Sheet */}
      <MobileSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Admin Modules"
        subtitle={`Signed in as ${userProfile?.fullName || 'Administrator'}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {MODULE_META.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    'min-h-[54px] flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors',
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-white' : 'text-blue-600')} />
                  <span className="text-xs font-semibold leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setPortalMode('admin');
              }}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
            >
              <Monitor className="w-4 h-4 text-blue-600" />
              Desktop Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setPortalMode('staff');
              }}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800"
            >
              <Users className="w-4 h-4 text-emerald-600" />
              Staff View
            </button>
          </div>
        </div>
      </MobileSheet>
    </div>
  );
}

// ==================== 1. MOBILE DASHBOARD ====================
function MobileDashboard({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { leads, employees, callLogs, followUps, applications, activityLogs } = useCrmData();
  const todayKey = getTodayKey();

  const metrics = useMemo(() => {
    const activeLeads = leads.filter((l) => !l.isArchived);
    const activeStaff = employees.filter((e) => e.role === 'staff' && e.status === 'active');
    const callsToday = callLogs.filter((c) => getDateKey(c.callTime) === todayKey).length;
    const dailyTarget = activeStaff.reduce((s, e) => s + (e.dailyCallTarget || 0), 0);
    const unassigned = activeLeads.filter((l) => !l.assignedEmployeeId).length;
    const followUpsDue = followUps.filter((f) => f.status === 'pending' && getDateKey(f.scheduledAt) <= todayKey).length;
    const inProcessing = applications.filter((a) =>
      ['Lead Interested', 'Documents Pending', 'Documents Submitted', 'Under Bank Review', 'Additional Documents Required'].includes(
        a.status
      )
    ).length;
    const disbursed = applications
      .filter((a) => a.status === 'Disbursed')
      .reduce((s, a) => s + (a.disbursedAmount || a.loanAmount || 0), 0);

    return {
      totalLeads: activeLeads.length,
      unassigned,
      staffCount: activeStaff.length,
      callsToday,
      dailyTarget,
      followUpsDue,
      inProcessing,
      disbursed,
      interested: activeLeads.filter((l) => ['Interested', 'Qualified', 'Converted'].includes(l.status)).length,
    };
  }, [leads, employees, callLogs, followUps, applications, todayKey]);

  const callTrend = useMemo(() => {
    const out: Array<{ day: string; total: number; connected: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      const dayCalls = callLogs.filter((c) => getDateKey(c.callTime) === key);
      out.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        total: dayCalls.length,
        connected: dayCalls.filter((c) => ['Connected', 'Interested', 'Callback Requested'].includes(c.status)).length,
      });
    }
    return out;
  }, [callLogs]);

  const targetPct = metrics.dailyTarget > 0 ? Math.min(100, Math.round((metrics.callsToday / metrics.dailyTarget) * 100)) : 0;

  return (
    <div className="space-y-4 crm-anim-fade">
      {/* Responsive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('leads')}
          className="crm-card p-3.5 text-left hover:border-slate-300 hover:shadow-md transition-all"
        >
          <p className="text-xs text-slate-500">Total Leads</p>
          <p className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">{metrics.totalLeads}</p>
          <p className="text-[11px] text-amber-700 mt-1 tabular-nums">{metrics.unassigned} unassigned</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('calls')}
          className="crm-card p-3.5 text-left hover:border-slate-300 hover:shadow-md transition-all"
        >
          <p className="text-xs text-slate-500">Calls Today</p>
          <p className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">
            {metrics.callsToday} / {metrics.dailyTarget}
          </p>
          <p className="text-[11px] text-blue-600 mt-1 tabular-nums">{targetPct}% of target</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('followups')}
          className="crm-card p-3.5 text-left hover:border-slate-300 hover:shadow-md transition-all"
        >
          <p className="text-xs text-slate-500">Follow-ups Due</p>
          <p className="font-display text-xl font-bold text-slate-900 tabular-nums mt-1">{metrics.followUpsDue}</p>
          <p className="text-[11px] text-slate-500 mt-1">{metrics.interested} interested</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('applications')}
          className="crm-card p-3.5 text-left hover:border-slate-300 hover:shadow-md transition-all"
        >
          <p className="text-xs text-slate-500">Disbursed Volume</p>
          <p className="font-display text-xl font-bold text-emerald-700 tabular-nums mt-1">{formatCompactCurrency(metrics.disbursed)}</p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{metrics.inProcessing} in processing</p>
        </button>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => onNavigate('distribution')}
          className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5" />
          Distribute ({metrics.unassigned})
        </button>
        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className="min-h-[44px] crm-card hover:bg-slate-50 text-slate-800 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
          Verify KYC
        </button>
        <button
          type="button"
          onClick={() => onNavigate('employees')}
          className="min-h-[44px] crm-card hover:bg-slate-50 text-slate-800 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          Team ({metrics.staffCount})
        </button>
      </div>

      {/* Velocity & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 crm-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">7-Day Call Velocity</h2>
            <span className="text-xs text-slate-500 tabular-nums">{callLogs.length} logs</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={callTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={28} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Total Calls" stroke="#2563EB" fill="#DBEAFE" strokeWidth={2} />
                <Area type="monotone" dataKey="connected" name="Connected" stroke="#16A34A" fill="#DCFCE7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 crm-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              Recent Activity
            </h2>
            <button type="button" onClick={() => onNavigate('reports')} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              Reports
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {activityLogs.slice(0, 6).map((act) => (
              <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs font-medium text-slate-900">{act.summary}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {act.actorName} · {formatDateTime(act.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 2. MOBILE LEADS ====================
type LeadFormValues = z.infer<typeof leadFormSchema>;

function MobileLeads({
  actor,
  leads,
  employees,
  banks,
  callLogs,
  followUps,
  documents,
  settings,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  leads: Lead[];
  employees: Employee[];
  banks: Bank[];
  callLogs: CallLog[];
  followUps: FollowUp[];
  documents: CustomerDocument[];
  settings: { duplicateRule: DuplicateRule };
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scoreTierFilter, setScoreTierFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiScoringBusy, setAiScoringBusy] = useState(false);

  const staffList = useMemo(() => employees.filter((e) => e.role === 'staff' && e.status === 'active'), [employees]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, ComputedLeadScore>();
    leads.forEach((l) => map.set(l.id, resolveEffectiveLeadScore(l, callLogs, followUps, documents)));
    return map;
  }, [leads, callLogs, followUps, documents]);

  const activeDetailLead = useMemo(
    () => (detailLead ? leads.find((l) => l.id === detailLead.id) || detailLead : null),
    [detailLead, leads]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => (showArchived ? l.isArchived : !l.isArchived))
      .filter((l) => (statusFilter === 'ALL' ? true : l.status === statusFilter))
      .filter((l) => (scoreTierFilter === 'ALL' ? true : scoreMap.get(l.id)?.scoreTier === scoreTierFilter))
      .filter((l) => {
        if (!q) return true;
        return (
          l.customerName.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.leadCode.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (scoreMap.get(b.id)?.leadScore || 0) - (scoreMap.get(a.id)?.leadScore || 0));
  }, [leads, showArchived, statusFilter, scoreTierFilter, search, scoreMap]);

  const handleRunAiScore = async (targets: Lead[]) => {
    if (targets.length === 0) return;
    setAiScoringBusy(true);
    try {
      const results = await scoreLeadsWithAI(actor, targets, callLogs, followUps, documents);
      notify('AI scoring complete', `Scored ${results.length} lead(s).`);
    } catch (err) {
      notify('AI scoring error', err instanceof Error ? err.message : 'Unable to score leads.', 'error');
    } finally {
      setAiScoringBusy(false);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as never,
    defaultValues: {
      employmentType: 'Salaried',
      loanType: 'Personal Loan',
      leadSource: 'Website',
      status: 'New',
      priority: 'Medium',
      monthlyIncome: 50000,
      requiredLoanAmount: 500000,
    },
  });

  const openCreate = () => {
    setEditingLead(null);
    reset({
      customerName: '',
      phone: '',
      email: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      employmentType: 'Salaried',
      monthlyIncome: 50000,
      requiredLoanAmount: 500000,
      loanType: 'Personal Loan',
      preferredBank: '',
      leadSource: 'Website',
      assignedEmployeeId: '',
      status: 'New',
      priority: 'Medium',
      remarks: '',
    });
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    reset({
      customerName: lead.customerName,
      phone: lead.phone,
      email: lead.email || '',
      city: lead.city,
      state: lead.state,
      employmentType: lead.employmentType,
      monthlyIncome: lead.monthlyIncome,
      requiredLoanAmount: lead.requiredLoanAmount,
      loanType: lead.loanType,
      preferredBank: lead.preferredBank || '',
      leadSource: lead.leadSource,
      assignedEmployeeId: lead.assignedEmployeeId || '',
      status: lead.status,
      priority: lead.priority,
      remarks: lead.remarks || '',
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: LeadFormValues) => {
    setSaving(true);
    try {
      if (editingLead) {
        await updateLead(actor, editingLead.id, values, employees);
        notify('Lead updated', `${values.customerName} saved.`);
      } else {
        await createLead(
          actor,
          {
            ...values,
            email: values.email?.trim() || undefined,
            preferredBank: values.preferredBank || undefined,
            assignedEmployeeId: values.assignedEmployeeId || undefined,
            remarks: values.remarks?.trim() || undefined,
          },
          employees,
          leads,
          settings.duplicateRule
        );
        notify('Lead created', `${values.customerName} added to pipeline.`);
      }
      setFormOpen(false);
    } catch (err) {
      notify('Lead save failed', err instanceof Error ? err.message : 'Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveConfirm) return;
    setSaving(true);
    try {
      await archiveLead(actor, archiveConfirm, !archiveConfirm.isArchived);
      notify(archiveConfirm.isArchived ? 'Lead restored' : 'Lead archived', archiveConfirm.customerName);
      setArchiveConfirm(null);
      setDetailLead(null);
    } catch (err) {
      notify('Action failed', err instanceof Error ? err.message : 'Unable to update.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, ID..."
            className="w-full min-h-[44px] pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[44px] px-3.5 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
        <button
          type="button"
          onClick={() => exportLeadsFile(filtered, 'csv')}
          aria-label="Export CSV"
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setShowArchived((s) => !s)}
          className={cn(
            'min-h-[36px] px-3 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0',
            showArchived ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
          )}
        >
          {showArchived ? 'Showing Archived' : 'Active Leads'}
        </button>
        {['ALL', ...LEAD_STATUSES].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={cn(
              'min-h-[36px] px-3 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0',
              statusFilter === st ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
            )}
          >
            {st === 'ALL' ? `All (${filtered.length})` : st}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-0.5 gap-2">
        <div className="flex items-center gap-2">
          <select
            value={scoreTierFilter}
            onChange={(e) => setScoreTierFilter(e.target.value)}
            className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="ALL">All Scores</option>
            <option value="Hot">Hot (75–100)</option>
            <option value="Warm">Warm (45–74)</option>
            <option value="Cold">Cold (0–44)</option>
          </select>
          <button
            type="button"
            disabled={aiScoringBusy || filtered.length === 0}
            onClick={() => void handleRunAiScore(filtered.slice(0, 10))}
            className="min-h-[34px] inline-flex items-center gap-1 px-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiScoringBusy ? 'Scoring...' : 'AI Score Top 10'}
          </button>
        </div>
        <button
          type="button"
          onClick={() =>
            updateDuplicateRule(
              actor,
              settings.duplicateRule === 'phone_or_email' ? 'phone' : 'phone_or_email'
            )
          }
          className="text-blue-600 font-medium whitespace-nowrap"
        >
          Guard: {settings.duplicateRule === 'phone_or_email' ? 'Phone/Email' : 'Phone'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 60).map((lead) => {
          const computed = scoreMap.get(lead.id);
          return (
          <div
            key={lead.id}
            className="crm-card p-3.5 space-y-2.5 flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <EntityMonogram name={lead.customerName} size="md" className="mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono">{lead.leadCode}</span>
                      <span>· {lead.priority} priority</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{lead.customerName}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {lead.phone} · {lead.city}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={lead.status} />
                  {computed && (
                    <LeadScoreBadge
                      score={computed.leadScore}
                      tier={computed.scoreTier}
                      isAi={computed.scoreModel.includes('gemini')}
                      compact
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500">{lead.loanType}: </span>
                  <strong className="text-slate-900 tabular-nums">{formatCompactCurrency(lead.requiredLoanAmount)}</strong>
                </div>
                <span className="text-slate-500 truncate max-w-[140px]">
                  {lead.assignedEmployeeName || 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDetailLead(lead)}
                className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Inspect
              </button>
              <button
                type="button"
                onClick={() => openEdit(lead)}
                className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirm(lead)}
                className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                {lead.isArchived ? 'Restore' : 'Archive'}
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 crm-card p-8 text-center text-xs text-slate-500">
            No leads match your current filters.
          </div>
        )}
      </div>

      {/* Lead Detail Sheet */}
      <MobileSheet
        open={Boolean(activeDetailLead)}
        onClose={() => setDetailLead(null)}
        title={activeDetailLead?.customerName || ''}
        subtitle={activeDetailLead ? `${activeDetailLead.leadCode} · ${activeDetailLead.loanType}` : ''}
      >
        {activeDetailLead && (
          <div className="space-y-4 text-xs">
            <LeadScoreBreakdownCard
              computed={scoreMap.get(activeDetailLead.id) || resolveEffectiveLeadScore(activeDetailLead, callLogs, followUps, documents)}
              scoringBusy={aiScoringBusy}
              onRunAiScore={() => void handleRunAiScore([activeDetailLead])}
            />
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-semibold text-slate-900 mt-0.5 tabular-nums">{activeDetailLead.phone}</p>
              </div>
              <div>
                <p className="text-slate-500">Location</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {activeDetailLead.city}, {activeDetailLead.state}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Income</p>
                <p className="font-semibold text-slate-900 tabular-nums mt-0.5">
                  {formatCurrency(activeDetailLead.monthlyIncome)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Loan Requested</p>
                <p className="font-semibold text-slate-900 tabular-nums mt-0.5">
                  {formatCurrency(activeDetailLead.requiredLoanAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Assigned To</p>
                <p className="font-semibold text-slate-900 mt-0.5">{activeDetailLead.assignedEmployeeName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-slate-500">Source</p>
                <p className="font-semibold text-slate-900 mt-0.5">{activeDetailLead.leadSource}</p>
              </div>
            </div>
            {activeDetailLead.remarks && (
              <div className="pb-4 border-b border-slate-100">
                <p className="text-slate-500 mb-1">Remarks</p>
                <p className="text-slate-800 leading-relaxed">{activeDetailLead.remarks}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const l = activeDetailLead;
                  setDetailLead(null);
                  openEdit(l);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold"
              >
                Edit Lead
              </button>
              <a
                href={`tel:${activeDetailLead.phone}`}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold flex items-center justify-center gap-1.5"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                Call Customer
              </a>
            </div>
          </div>
        )}
      </MobileSheet>

      {/* Create / Edit Lead Bottom Sheet */}
      <MobileSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingLead ? `Edit ${editingLead.leadCode}` : 'Create Lead'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Customer Name *</label>
            <input {...register('customerName')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            {errors.customerName && <p className="text-rose-600 mt-1">{errors.customerName.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone *</label>
              <input {...register('phone')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
              {errors.phone && <p className="text-rose-600 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email</label>
              <input {...register('email')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
              {errors.email && <p className="text-rose-600 mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">City *</label>
              <input {...register('city')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
              {errors.city && <p className="text-rose-600 mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">State *</label>
              <input {...register('state')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
              {errors.state && <p className="text-rose-600 mt-1">{errors.state.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Loan Type</label>
              <select {...register('loanType')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                {LOAN_TYPES.map((lt) => (
                  <option key={lt} value={lt}>{lt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Employment</label>
              <select {...register('employmentType')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                {EMPLOYMENT_TYPES.map((et) => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Monthly Income</label>
              <input type="number" {...register('monthlyIncome')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Loan Amount</label>
              <input type="number" {...register('requiredLoanAmount')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status</label>
              <select {...register('status')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Priority</label>
              <select {...register('priority')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                {LEAD_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Preferred Bank</label>
              <select {...register('preferredBank')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                <option value="">Any Bank</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assign Agent</label>
              <select {...register('assignedEmployeeId')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                <option value="">Unassigned</option>
                {staffList.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lead Source</label>
            <input {...register('leadSource')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Remarks</label>
            <textarea rows={2} {...register('remarks')} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingLead ? 'Save Changes' : 'Create Lead'}
          </button>
        </form>
      </MobileSheet>

      <ConfirmDialog
        open={Boolean(archiveConfirm)}
        onClose={() => setArchiveConfirm(null)}
        onConfirm={handleArchiveConfirm}
        title={archiveConfirm?.isArchived ? 'Restore Lead' : 'Archive Lead'}
        message={`Confirm ${archiveConfirm?.isArchived ? 'restoring' : 'archiving'} ${archiveConfirm?.customerName}?`}
        confirmLabel={archiveConfirm?.isArchived ? 'Restore' : 'Archive'}
        danger={!archiveConfirm?.isArchived}
        busy={saving}
      />
    </div>
  );
}

// ==================== 3. MOBILE LEAD DISTRIBUTION ====================
function MobileDistribution({
  actor,
  leads,
  employees,
  leadAssignments,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  leads: Lead[];
  employees: Employee[];
  leadAssignments: Array<{ id: string; leadCode: string; customerName: string; toEmployeeName: string; method: string; createdAt: string }>;
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [busy, setBusy] = useState(false);

  const activeLeads = useMemo(() => leads.filter((l) => !l.isArchived), [leads]);
  const unassigned = useMemo(() => activeLeads.filter((l) => !l.assignedEmployeeId), [activeLeads]);
  const activeStaff = useMemo(() => employees.filter((e) => e.role === 'staff' && e.status === 'active'), [employees]);

  const workload = useMemo(() => {
    const map = new Map<string, number>();
    activeLeads.forEach((l) => {
      if (l.assignedEmployeeId) map.set(l.assignedEmployeeId, (map.get(l.assignedEmployeeId) || 0) + 1);
    });
    return activeStaff.map((emp) => ({ emp, count: map.get(emp.id) || 0 })).sort((a, b) => a.count - b.count);
  }, [activeLeads, activeStaff]);

  const handleRoundRobin = async () => {
    if (unassigned.length === 0) return;
    setBusy(true);
    try {
      const count = await roundRobinDistributeLeads(actor, unassigned, activeStaff, activeLeads, true);
      notify('Auto-distributed', `${count} unassigned leads distributed evenly.`);
    } catch (err) {
      notify('Distribution failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleManualAssign = async () => {
    const emp = activeStaff.find((e) => e.id === targetStaffId);
    const chosen = activeLeads.filter((l) => selectedIds.includes(l.id));
    if (!emp || chosen.length === 0) return;
    setBusy(true);
    try {
      await assignLeadsToEmployee(actor, chosen, emp, chosen.length > 1 ? 'bulk' : 'manual');
      notify('Leads assigned', `${chosen.length} lead(s) assigned to ${emp.fullName}.`);
      setSelectedIds([]);
    } catch (err) {
      notify('Assignment failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 crm-anim-fade">
      <div className="bg-[#0B1220] text-white rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300">Unassigned Queue</p>
            <p className="font-display text-2xl font-bold tabular-nums">{unassigned.length} Leads</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-300">Active Agents</p>
            <p className="font-display text-xl font-bold tabular-nums">{activeStaff.length}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || unassigned.length === 0 || activeStaff.length === 0}
          onClick={handleRoundRobin}
          className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Auto Round-Robin Distribute All ({unassigned.length})
        </button>
      </div>

      {/* Manual Selection Bar */}
      <div className="crm-card p-3.5 space-y-2.5">
        <p className="font-display text-xs font-semibold text-slate-900">
          Manual / Bulk Assignment ({selectedIds.length} selected)
        </p>
        <div className="flex gap-2">
          <select
            value={targetStaffId}
            onChange={(e) => setTargetStaffId(e.target.value)}
            className="flex-1 min-h-[44px] px-3 border border-slate-200 rounded-xl text-xs bg-white"
          >
            <option value="">Choose staff member...</option>
            {workload.map(({ emp, count }) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({count} leads)
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !targetStaffId || selectedIds.length === 0}
            onClick={handleManualAssign}
            className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
          >
            Assign
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {(unassigned.length > 0 ? unassigned : activeLeads.slice(0, 20)).map((lead) => {
            const checked = selectedIds.includes(lead.id);
            return (
              <label key={lead.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedIds((prev) =>
                      prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id]
                    )
                  }
                  className="w-5 h-5 rounded border-slate-300 text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {lead.customerName} <span className="font-mono text-slate-400">({lead.leadCode})</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {lead.loanType} · {formatCompactCurrency(lead.requiredLoanAmount)} ·{' '}
                    {lead.assignedEmployeeName || 'Unassigned'}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Workload & History Side-by-Side on Larger Screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crm-card p-4 space-y-2.5">
          <h3 className="font-display text-sm font-semibold text-slate-900">Agent Lead Workload</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workload.map(({ emp, count }) => (
              <div key={emp.id} className="flex items-center justify-between text-xs py-1">
                <span className="font-medium text-slate-800 truncate">{emp.fullName}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{count} leads</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-card p-4 space-y-2">
          <h3 className="font-display text-sm font-semibold text-slate-900">Recent Assignments</h3>
          <div className="divide-y divide-slate-100">
            {leadAssignments.slice(0, 8).map((a) => (
              <div key={a.id} className="py-2 text-xs">
                <p className="font-medium text-slate-900">
                  {a.customerName} ({a.leadCode}) → {a.toEmployeeName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {a.method.replace('_', ' ')} · {formatDateTime(a.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 4. MOBILE EMPLOYEES ====================
type EmpFormValues = z.infer<typeof employeeFormSchema>;

function MobileEmployees({
  actor,
  employees,
  leads,
  callLogs,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  employees: Employee[];
  leads: Lead[];
  callLogs: Array<{ employeeId: string; callTime: string }>;
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [targetEmp, setTargetEmp] = useState<Employee | null>(null);
  const [newTarget, setNewTarget] = useState(45);
  const [saving, setSaving] = useState(false);
  const todayKey = getTodayKey();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmpFormValues>({
    resolver: zodResolver(employeeFormSchema) as never,
    defaultValues: { role: 'staff', department: 'Loan Sales', status: 'active', dailyCallTarget: 45 },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (e) =>
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const openAdd = () => {
    setEditing(null);
    reset({
      fullName: '',
      email: '',
      phone: '',
      role: 'staff',
      department: 'Personal & Home Loans',
      joiningDate: todayKey,
      status: 'active',
      dailyCallTarget: 45,
    });
    setFormOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    reset({
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department,
      joiningDate: emp.joiningDate,
      status: emp.status,
      dailyCallTarget: emp.dailyCallTarget,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: EmpFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await updateEmployee(actor, editing.id, values);
        notify('Employee updated', values.fullName);
      } else {
        await createEmployee(actor, values);
        notify('Employee added', values.fullName);
      }
      setFormOpen(false);
    } catch (err) {
      notify('Save failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTargetSave = async () => {
    if (!targetEmp) return;
    setSaving(true);
    try {
      await setEmployeeDailyTarget(actor, targetEmp, newTarget, todayKey);
      notify('Target updated', `${targetEmp.fullName}: ${newTarget} calls/day`);
      setTargetEmp(null);
    } catch (err) {
      notify('Failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full min-h-[44px] pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-xl"
          />
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="min-h-[44px] px-3.5 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((emp) => {
          const assignedCount = leads.filter((l) => !l.isArchived && l.assignedEmployeeId === emp.id).length;
          const todayCalls = callLogs.filter((c) => c.employeeId === emp.id && getDateKey(c.callTime) === todayKey).length;
          return (
            <div key={emp.id} className="crm-card p-3.5 space-y-2.5 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-400">{emp.employeeCode} · {emp.department}</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{emp.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                  </div>
                  <StatusBadge status={emp.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50/80 border border-slate-100 rounded-lg p-2 text-xs">
                  <div>
                    <p className="text-slate-500">Leads</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{assignedCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Calls Today</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{todayCalls}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Target</p>
                    <p className="font-semibold text-blue-600 tabular-nums">{emp.dailyCallTarget}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(emp)}
                  className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetEmp(emp);
                    setNewTarget(emp.dailyCallTarget);
                  }}
                  className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Set Target
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateEmployee(actor, emp.id, { status: emp.status === 'active' ? 'inactive' : 'active' })
                  }
                  className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <MobileSheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
            <input {...register('fullName')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            {errors.fullName && <p className="text-rose-600 mt-1">{errors.fullName.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email *</label>
              <input {...register('email')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone *</label>
              <input {...register('phone')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Department</label>
              <input {...register('department')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Daily Target</label>
              <input type="number" {...register('dailyCallTarget')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Role</label>
              <select {...register('role')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Joining Date</label>
              <input type="date" {...register('joiningDate')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            {saving ? 'Saving...' : 'Save Employee'}
          </button>
        </form>
      </MobileSheet>

      <MobileSheet
        open={Boolean(targetEmp)}
        onClose={() => setTargetEmp(null)}
        title="Set Daily Call Target"
        subtitle={targetEmp?.fullName}
      >
        <div className="space-y-4">
          <input
            type="number"
            min={1}
            max={500}
            value={newTarget}
            onChange={(e) => setNewTarget(Number(e.target.value))}
            className="w-full min-h-[46px] px-3 border border-slate-200 rounded-xl text-base font-semibold tabular-nums"
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleTargetSave}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold"
          >
            {saving ? 'Updating...' : 'Update Target'}
          </button>
        </div>
      </MobileSheet>
    </div>
  );
}

// ==================== 5. MOBILE CALL LOGS ====================
type CallFormValues = z.infer<typeof callLogFormSchema>;

function MobileCalls({
  actor,
  leads,
  employees,
  callLogs,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  leads: Lead[];
  employees: Employee[];
  callLogs: Array<{
    id: string;
    leadCode: string;
    customerName: string;
    customerPhone: string;
    employeeName: string;
    callTime: string;
    durationSeconds: number;
    status: CallStatus;
    remarks?: string;
  }>;
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const todayKey = getTodayKey();

  const stats = useMemo(() => {
    const today = callLogs.filter((c) => getDateKey(c.callTime) === todayKey);
    return {
      total: today.length,
      connected: today.filter((c) => ['Connected', 'Interested', 'Callback Requested'].includes(c.status)).length,
      notConnected: today.filter((c) => ['Not Connected', 'Busy', 'No Answer', 'Wrong Number'].includes(c.status)).length,
      interested: today.filter((c) => c.status === 'Interested').length,
    };
  }, [callLogs, todayKey]);

  const filtered = useMemo(
    () => callLogs.filter((c) => (statusFilter === 'ALL' ? true : c.status === statusFilter)),
    [callLogs, statusFilter]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallFormValues>({
    resolver: zodResolver(callLogFormSchema) as never,
    defaultValues: { status: 'Connected', durationSeconds: 120 },
  });

  const onSubmit = async (values: CallFormValues) => {
    const lead = leads.find((l) => l.id === values.leadId);
    const emp =
      employees.find((e) => e.id === lead?.assignedEmployeeId) ||
      employees.find((e) => e.email.toLowerCase() === actor.email.toLowerCase()) ||
      employees[0];
    if (!lead || !emp) return;
    setSaving(true);
    try {
      await recordCallLog(actor, lead, emp, values);
      notify('Call logged', `${lead.customerName} (${values.status})`);
      setLogOpen(false);
      reset();
    } catch (err) {
      notify('Failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card p-2.5 text-center">
          <p className="text-[11px] text-slate-500">Today</p>
          <p className="font-display text-lg font-bold text-slate-900 tabular-nums">{stats.total}</p>
        </div>
        <div className="crm-card p-2.5 text-center">
          <p className="text-[11px] text-slate-500">Connected</p>
          <p className="font-display text-lg font-bold text-emerald-700 tabular-nums">{stats.connected}</p>
        </div>
        <div className="crm-card p-2.5 text-center">
          <p className="text-[11px] text-slate-500">Missed</p>
          <p className="font-display text-lg font-bold text-amber-700 tabular-nums">{stats.notConnected}</p>
        </div>
        <div className="crm-card p-2.5 text-center">
          <p className="text-[11px] text-slate-500">Interested</p>
          <p className="font-display text-lg font-bold text-blue-600 tabular-nums">{stats.interested}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 min-h-[44px] px-3 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="ALL">All Call Statuses ({callLogs.length})</option>
          {CALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Call
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 50).map((c) => (
          <div key={c.id} className="crm-card p-3.5 space-y-1.5 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {c.customerName} <span className="font-mono text-xs text-slate-400">({c.leadCode})</span>
                </p>
                <p className="text-xs text-slate-500">
                  {c.employeeName} · {formatDuration(c.durationSeconds)}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            {c.remarks && <p className="text-xs text-slate-700 leading-relaxed">{c.remarks}</p>}
            <p className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(c.callTime)}</p>
          </div>
        ))}
      </div>

      <MobileSheet open={logOpen} onClose={() => setLogOpen(false)} title="Log Customer Call">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lead *</label>
            <select {...register('leadId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Select lead...</option>
              {leads.filter((l) => !l.isArchived).slice(0, 100).map((l) => (
                <option key={l.id} value={l.id}>{l.customerName} ({l.leadCode})</option>
              ))}
            </select>
            {errors.leadId && <p className="text-rose-600 mt-1">{errors.leadId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Call Outcome</label>
              <select {...register('status')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
                {CALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Duration (sec)</label>
              <input type="number" {...register('durationSeconds')} className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Next Follow-Up (optional)</label>
            <input type="datetime-local" {...register('nextFollowUpDate')} className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Remarks</label>
            <textarea rows={3} {...register('remarks')} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            {saving ? 'Saving...' : 'Save Call Log'}
          </button>
        </form>
      </MobileSheet>
    </div>
  );
}

// ==================== 6. MOBILE FOLLOW-UPS ====================
type FollowUpFormValues = z.infer<typeof followUpFormSchema>;

function MobileFollowUps({
  actor,
  leads,
  employees,
  followUps,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  leads: Lead[];
  employees: Employee[];
  followUps: FollowUp[];
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [bucket, setBucket] = useState<'overdue' | 'today' | 'upcoming' | 'completed'>('overdue');
  const [addOpen, setAddOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<FollowUp | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [reassignTarget, setReassignTarget] = useState<FollowUp | null>(null);
  const [reassignEmpId, setReassignEmpId] = useState('');
  const [saving, setSaving] = useState(false);

  const todayKey = getTodayKey();
  const nowMs = Date.now();

  const grouped = useMemo(() => {
    const overdue: FollowUp[] = [];
    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];
    const completed: FollowUp[] = [];

    followUps.forEach((f) => {
      if (f.status === 'completed') {
        completed.push(f);
        return;
      }
      if (f.status === 'cancelled') return;
      const key = getDateKey(f.scheduledAt);
      const ts = new Date(f.scheduledAt).getTime();
      if (key === todayKey) today.push(f);
      else if (ts < nowMs) overdue.push(f);
      else upcoming.push(f);
    });
    return { overdue, today, upcoming, completed };
  }, [followUps, todayKey, nowMs]);

  const activeList = grouped[bucket];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpFormSchema) as never,
  });

  const onCreate = async (values: FollowUpFormValues) => {
    const lead = leads.find((l) => l.id === values.leadId);
    const emp = employees.find((e) => e.id === values.employeeId);
    if (!lead || !emp) return;
    setSaving(true);
    try {
      await createFollowUp(actor, lead, emp, values.scheduledAt, values.notes);
      notify('Follow-up scheduled', lead.customerName);
      setAddOpen(false);
      reset();
    } catch (err) {
      notify('Failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['overdue', `Overdue (${grouped.overdue.length})`],
              ['today', `Today (${grouped.today.length})`],
              ['upcoming', `Upcoming (${grouped.upcoming.length})`],
              ['completed', `Done (${grouped.completed.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBucket(id)}
              className={cn(
                'min-h-[38px] px-3 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0',
                bucket === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="min-h-[40px] px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold shrink-0"
        >
          + New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeList.map((f) => (
          <div key={f.id} className="crm-card p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{f.customerName}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {f.employeeName} · {formatDateTime(f.scheduledAt)}
                  </p>
                </div>
                <StatusBadge status={f.status} />
              </div>
              {f.notes && <p className="text-xs text-slate-700">{f.notes}</p>}
            </div>
            {f.status === 'pending' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCompleteTarget(f);
                    setOutcomeNotes('');
                  }}
                  className="min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReassignTarget(f);
                    setReassignEmpId(f.employeeId);
                  }}
                  className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Reassign
                </button>
              </div>
            )}
          </div>
        ))}
        {activeList.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 crm-card p-8 text-center text-xs text-slate-500">
            No follow-ups in this bucket.
          </div>
        )}
      </div>

      <MobileSheet open={addOpen} onClose={() => setAddOpen(false)} title="Schedule Follow-up">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lead *</label>
            <select {...register('leadId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Select lead...</option>
              {leads.filter((l) => !l.isArchived).slice(0, 100).map((l) => (
                <option key={l.id} value={l.id}>{l.customerName} ({l.leadCode})</option>
              ))}
            </select>
            {errors.leadId && <p className="text-rose-600 mt-1">{errors.leadId.message}</p>}
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Assign Staff *</label>
            <select {...register('employeeId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Select employee...</option>
              {employees.filter((e) => e.role === 'staff' && e.status === 'active').map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            {errors.employeeId && <p className="text-rose-600 mt-1">{errors.employeeId.message}</p>}
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Date & Time *</label>
            <input type="datetime-local" {...register('scheduledAt')} className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm" />
            {errors.scheduledAt && <p className="text-rose-600 mt-1">{errors.scheduledAt.message}</p>}
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes</label>
            <textarea rows={2} {...register('notes')} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Schedule Follow-up
          </button>
        </form>
      </MobileSheet>

      <MobileSheet open={Boolean(completeTarget)} onClose={() => setCompleteTarget(null)} title="Complete Follow-up">
        <div className="space-y-3">
          <textarea
            rows={3}
            value={outcomeNotes}
            onChange={(e) => setOutcomeNotes(e.target.value)}
            placeholder="Enter call outcome notes..."
            className="w-full p-3 border border-slate-200 rounded-xl text-sm"
          />
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!completeTarget) return;
              setSaving(true);
              try {
                await completeFollowUp(actor, completeTarget, outcomeNotes || 'Completed on call.');
                notify('Follow-up completed', completeTarget.customerName);
                setCompleteTarget(null);
              } catch (err) {
                notify('Completion failed', err instanceof Error ? err.message : 'Unable to save.', 'error');
              } finally {
                setSaving(false);
              }
            }}
            className="w-full min-h-[46px] rounded-xl bg-emerald-600 text-white text-sm font-semibold"
          >
            Confirm Completion
          </button>
        </div>
      </MobileSheet>

      <MobileSheet open={Boolean(reassignTarget)} onClose={() => setReassignTarget(null)} title="Reassign Follow-up">
        <div className="space-y-3">
          <select
            value={reassignEmpId}
            onChange={(e) => setReassignEmpId(e.target.value)}
            className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm bg-white"
          >
            {employees.filter((e) => e.role === 'staff' && e.status === 'active').map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              const emp = employees.find((e) => e.id === reassignEmpId);
              if (!reassignTarget || !emp) return;
              setSaving(true);
              try {
                await reassignFollowUp(actor, reassignTarget, emp);
                notify('Reassigned', `Assigned to ${emp.fullName}`);
                setReassignTarget(null);
              } catch (err) {
                notify('Reassign failed', err instanceof Error ? err.message : 'Unable to reassign.', 'error');
              } finally {
                setSaving(false);
              }
            }}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold"
          >
            Save Assignment
          </button>
        </div>
      </MobileSheet>
    </div>
  );
}

// ==================== 7. MOBILE DOCUMENTS & KYC ====================
function MobileDocuments({
  actor,
  leads,
  employees,
  documents,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  leads: Lead[];
  employees: Employee[];
  documents: CustomerDocument[];
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [docType, setDocType] = useState<DocumentType>('Aadhaar Card');
  const [file, setFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectDoc, setRejectDoc] = useState<CustomerDocument | null>(null);
  const [rejectStatus, setRejectStatus] = useState<DocumentStatus>('Rejected');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => documents.filter((d) => (statusFilter === 'ALL' ? true : d.status === statusFilter)),
    [documents, statusFilter]
  );

  const handlePreview = async (docItem: CustomerDocument) => {
    setPreviewDoc(docItem);
    setPreviewUrl(null);
    if (docItem.hasFileBlob) {
      const url = await fetchDocumentBlob(docItem);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = leads.find((l) => l.id === leadId);
    const emp = employees.find((em) => em.id === lead?.assignedEmployeeId) || employees[0];
    if (!lead || !emp || !file) return;
    setBusy(true);
    try {
      await uploadCustomerDocument(actor, lead, emp, docType, file);
      notify('Document uploaded', `${docType} saved for ${lead.customerName}`);
      setUploadOpen(false);
      setFile(null);
    } catch (err) {
      notify('Upload error', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 min-h-[44px] px-3 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="ALL">All Documents ({documents.length})</option>
          <option value="Pending">Pending Verification</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
          <option value="Re-upload Required">Re-upload Required</option>
        </select>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((d) => (
          <div key={d.id} className="crm-card p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{d.docType}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {d.customerName} ({d.leadCode}) · {d.fileName}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              {d.rejectionReason && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2">{d.rejectionReason}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePreview(d)}
                className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => verifyCustomerDocument(actor, d, 'Verified')}
                className="min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verify
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectDoc(d);
                  setRejectStatus('Re-upload Required');
                  setRejectReason('');
                }}
                className="min-h-[40px] rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <MobileSheet open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload KYC Document">
        <form onSubmit={handleUpload} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Lead *</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Select lead...</option>
              {leads.filter((l) => !l.isArchived).slice(0, 100).map((l) => (
                <option key={l.id} value={l.id}>{l.customerName} ({l.leadCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Document Type *</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select File (Image/PDF) *</label>
            <input type="file" accept="image/*,.pdf" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
          </div>
          <button type="submit" disabled={busy} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            {busy ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
      </MobileSheet>

      <MobileSheet
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.docType || ''}
        subtitle={previewDoc?.fileName}
      >
        {previewDoc && (
          <div className="space-y-3">
            {previewUrl ? (
              previewDoc.mimeType.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.fileName} className="w-full rounded-xl border border-slate-200" />
              ) : (
                <a
                  href={previewUrl}
                  download={previewDoc.fileName}
                  className="min-h-[44px] rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download {previewDoc.fileName}
                </a>
              )
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
                {previewDoc.previewSummary || 'Document metadata record verified.'}
              </div>
            )}
          </div>
        )}
      </MobileSheet>

      <MobileSheet open={Boolean(rejectDoc)} onClose={() => setRejectDoc(null)} title="Reject / Request Re-upload">
        <div className="space-y-3 text-xs">
          <select
            value={rejectStatus}
            onChange={(e) => setRejectStatus(e.target.value as DocumentStatus)}
            className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm bg-white"
          >
            <option value="Re-upload Required">Re-upload Required</option>
            <option value="Rejected">Rejected</option>
          </select>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full p-3 border border-slate-200 rounded-xl text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              if (!rejectDoc) return;
              await verifyCustomerDocument(actor, rejectDoc, rejectStatus, rejectReason || 'Requires clearer scan.');
              notify('Updated', `${rejectDoc.docType} marked ${rejectStatus}`);
              setRejectDoc(null);
            }}
            className="w-full min-h-[46px] rounded-xl bg-rose-600 text-white text-sm font-semibold"
          >
            Submit Decision
          </button>
        </div>
      </MobileSheet>
    </div>
  );
}

// ==================== 8. MOBILE BANKS & SCHEMES ====================
type BankFormValues = z.infer<typeof bankFormSchema>;
type SchemeFormValues = z.infer<typeof schemeFormSchema>;

function MobileBanks({
  actor,
  banks,
  schemes,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  banks: Bank[];
  schemes: LoanScheme[];
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [view, setView] = useState<'banks' | 'schemes'>('banks');
  const [bankSheet, setBankSheet] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [schemeSheet, setSchemeSheet] = useState(false);
  const [editingScheme, setEditingScheme] = useState<LoanScheme | null>(null);
  const [saving, setSaving] = useState(false);

  const bankForm = useForm<BankFormValues>({
    resolver: zodResolver(bankFormSchema) as never,
    defaultValues: { logoColor: '#2563EB', status: 'active' },
  });

  const schemeForm = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema) as never,
    defaultValues: { loanType: 'Personal Loan', status: 'active', minAmount: 100000, maxAmount: 2500000, interestRate: 10.5, minIncome: 25000 },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-1.5 bg-white border border-slate-200 rounded-xl p-1 flex-1">
          <button
            type="button"
            onClick={() => setView('banks')}
            className={cn(
              'min-h-[38px] rounded-lg text-xs font-semibold',
              view === 'banks' ? 'bg-slate-900 text-white' : 'text-slate-600'
            )}
          >
            Banks ({banks.length})
          </button>
          <button
            type="button"
            onClick={() => setView('schemes')}
            className={cn(
              'min-h-[38px] rounded-lg text-xs font-semibold',
              view === 'schemes' ? 'bg-slate-900 text-white' : 'text-slate-600'
            )}
          >
            Schemes ({schemes.length})
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (view === 'banks') {
              setEditingBank(null);
              bankForm.reset({ name: '', shortCode: '', logoColor: '#2563EB', contactPerson: '', contactNumber: '', email: '', status: 'active' });
              setBankSheet(true);
            } else {
              setEditingScheme(null);
              schemeForm.reset({
                bankId: banks[0]?.id || '',
                schemeName: '',
                loanType: 'Personal Loan',
                minAmount: 100000,
                maxAmount: 2500000,
                interestRate: 10.5,
                minIncome: 30000,
                processingFee: '1% + GST',
                tenureMonths: '12 - 60 months',
                status: 'active',
              });
              setSchemeSheet(true);
            }
          }}
          className="min-h-[44px] px-3.5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
        >
          + Add
        </button>
      </div>

      {view === 'banks' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {banks.map((b) => (
            <div key={b.id} className="crm-card p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{b.name} ({b.shortCode})</p>
                  <p className="text-xs text-slate-500">{b.contactPerson} · {b.contactNumber}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBank(b);
                    bankForm.reset(b);
                    setBankSheet(true);
                  }}
                  className="flex-1 min-h-[38px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteBank(actor, b)}
                  className="min-h-[38px] px-3 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {schemes.map((s) => (
            <div key={s.id} className="crm-card p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.schemeName}</p>
                    <p className="text-xs text-slate-500">{s.bankName} · {s.loanType}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/80 border border-slate-100 rounded-lg p-2">
                  <div>
                    <p className="text-slate-500">Rate</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{s.interestRate}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Max Loan</p>
                    <p className="font-semibold text-slate-900 tabular-nums">{formatCompactCurrency(s.maxAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tenure</p>
                    <p className="font-semibold text-slate-900">{s.tenureMonths}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingScheme(s);
                    schemeForm.reset(s);
                    setSchemeSheet(true);
                  }}
                  className="flex-1 min-h-[38px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteLoanScheme(actor, s)}
                  className="min-h-[38px] px-3 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MobileSheet open={bankSheet} onClose={() => setBankSheet(false)} title={editingBank ? 'Edit Bank' : 'Add Partner Bank'}>
        <form
          onSubmit={bankForm.handleSubmit(async (v) => {
            setSaving(true);
            try {
              await saveBank(actor, v, editingBank?.id);
              notify('Bank saved', v.name);
              setBankSheet(false);
            } finally {
              setSaving(false);
            }
          })}
          className="space-y-3 text-xs"
        >
          <input placeholder="Bank Name" {...bankForm.register('name')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Short Code" {...bankForm.register('shortCode')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            <input placeholder="Contact Person" {...bankForm.register('contactPerson')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Phone" {...bankForm.register('contactNumber')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            <input placeholder="Email" {...bankForm.register('email')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Save Bank
          </button>
        </form>
      </MobileSheet>

      <MobileSheet open={schemeSheet} onClose={() => setSchemeSheet(false)} title={editingScheme ? 'Edit Scheme' : 'Add Loan Scheme'}>
        <form
          onSubmit={schemeForm.handleSubmit(async (v) => {
            const bank = banks.find((b) => b.id === v.bankId);
            if (!bank) return;
            setSaving(true);
            try {
              await saveLoanScheme(actor, { ...v, bankName: bank.name }, editingScheme?.id);
              notify('Scheme saved', v.schemeName);
              setSchemeSheet(false);
            } finally {
              setSaving(false);
            }
          })}
          className="space-y-3 text-xs"
        >
          <select {...schemeForm.register('bankId')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input placeholder="Scheme Name" {...schemeForm.register('schemeName')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select {...schemeForm.register('loanType')} className="w-full min-h-[42px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              {LOAN_TYPES.map((lt) => (
                <option key={lt} value={lt}>{lt}</option>
              ))}
            </select>
            <input type="number" step="0.1" placeholder="Rate %" {...schemeForm.register('interestRate')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Min Amount" {...schemeForm.register('minAmount')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            <input type="number" placeholder="Max Amount" {...schemeForm.register('maxAmount')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Processing Fee" {...schemeForm.register('processingFee')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
            <input placeholder="Tenure" {...schemeForm.register('tenureMonths')} className="w-full min-h-[42px] px-3 border border-slate-200 rounded-xl text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Save Loan Scheme
          </button>
        </form>
      </MobileSheet>
    </div>
  );
}

// ==================== 9. MOBILE LOAN APPLICATIONS ====================
type AppFormValues = z.infer<typeof loanApplicationFormSchema>;

function MobileApplications({
  actor,
  applications,
  leads,
  employees,
  banks,
  schemes,
  statusHistory,
  notify,
}: {
  actor: { uid: string; email: string; name: string; role: 'admin' };
  applications: LoanApplication[];
  leads: Lead[];
  employees: Employee[];
  banks: Bank[];
  schemes: LoanScheme[];
  statusHistory: Array<{ id: string; applicationId: string; fromStatus?: string; toStatus: string; remarks?: string; changedByName: string; createdAt: string }>;
  notify: (t: string, m?: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [stageFilter, setStageFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [updateApp, setUpdateApp] = useState<LoanApplication | null>(null);
  const [timelineApp, setTimelineApp] = useState<LoanApplication | null>(null);
  const [nextStatus, setNextStatus] = useState<LoanApplicationStatus>('Under Bank Review');
  const [remarks, setRemarks] = useState('');
  const [disbursedAmt, setDisbursedAmt] = useState(0);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => applications.filter((a) => (stageFilter === 'ALL' ? true : a.status === stageFilter)),
    [applications, stageFilter]
  );

  const appForm = useForm<AppFormValues>({
    resolver: zodResolver(loanApplicationFormSchema) as never,
    defaultValues: { loanAmount: 500000 },
  });

  const handleStatusSave = async () => {
    if (!updateApp) return;
    setSaving(true);
    try {
      await updateLoanApplicationStatus(actor, updateApp, nextStatus, remarks || `Stage updated to ${nextStatus}.`, undefined, disbursedAmt);
      notify('Application updated', `${updateApp.applicationCode} -> ${nextStatus}`);
      setUpdateApp(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="flex-1 min-h-[44px] px-3 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="ALL">All 9 Stages ({applications.length})</option>
          {LOAN_APPLICATION_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((app) => (
          <div key={app.id} className="crm-card p-3.5 space-y-2 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <EntityMonogram name={app.customerName} size="md" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-400">{app.applicationCode} · {app.bankName}</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{app.customerName}</p>
                    <p className="text-xs text-slate-500 truncate">{app.schemeName}</p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(app.loanAmount)}</span>
                <span className="text-slate-500">{app.employeeName}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUpdateApp(app);
                  setNextStatus(app.status);
                  setRemarks('');
                  setDisbursedAmt(app.disbursedAmount || app.loanAmount);
                }}
                className="min-h-[40px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Update Stage
              </button>
              <button
                type="button"
                onClick={() => setTimelineApp(app)}
                className="min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline
              </button>
            </div>
          </div>
        ))}
      </div>

      <MobileSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Create Loan Application">
        <form
          onSubmit={appForm.handleSubmit(async (v) => {
            const lead = leads.find((l) => l.id === v.leadId);
            const bank = banks.find((b) => b.id === v.bankId);
            const scheme = schemes.find((s) => s.id === v.schemeId);
            const emp = employees.find((e) => e.id === lead?.assignedEmployeeId) || employees[0];
            if (!lead || !bank || !scheme || !emp) return;
            setSaving(true);
            try {
              await createLoanApplication(actor, lead, emp, bank, scheme, v);
              notify('Application created', lead.customerName);
              setCreateOpen(false);
            } finally {
              setSaving(false);
            }
          })}
          className="space-y-3 text-xs"
        >
          <select {...appForm.register('leadId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Select Lead...</option>
            {leads.filter((l) => !l.isArchived).slice(0, 100).map((l) => (
              <option key={l.id} value={l.id}>{l.customerName} ({l.leadCode})</option>
            ))}
          </select>
          <select {...appForm.register('bankId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Select Bank...</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select {...appForm.register('schemeId')} className="w-full min-h-[44px] px-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Select Scheme...</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.schemeName} ({s.bankName})</option>
            ))}
          </select>
          <input type="number" placeholder="Loan Amount" {...appForm.register('loanAmount')} className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm" />
          <button type="submit" disabled={saving} className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold">
            Submit Application
          </button>
        </form>
      </MobileSheet>

      <MobileSheet
        open={Boolean(updateApp)}
        onClose={() => setUpdateApp(null)}
        title="Update Application Stage"
        subtitle={updateApp?.applicationCode}
      >
        <div className="space-y-3 text-xs">
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as LoanApplicationStatus)}
            className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm bg-white"
          >
            {LOAN_APPLICATION_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          {nextStatus === 'Disbursed' && (
            <input
              type="number"
              value={disbursedAmt}
              onChange={(e) => setDisbursedAmt(Number(e.target.value))}
              placeholder="Disbursed Amount"
              className="w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm"
            />
          )}
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Underwriting or bank remarks..."
            className="w-full p-3 border border-slate-200 rounded-xl text-sm"
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleStatusSave}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 text-white text-sm font-semibold"
          >
            {saving ? 'Updating...' : 'Save Stage'}
          </button>
        </div>
      </MobileSheet>

      <MobileSheet
        open={Boolean(timelineApp)}
        onClose={() => setTimelineApp(null)}
        title="Application Status Timeline"
        subtitle={timelineApp?.applicationCode}
      >
        <div className="space-y-3">
          {timelineApp &&
            statusHistory
              .filter((h) => h.applicationId === timelineApp.id)
              .map((h) => (
                <div key={h.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={h.toStatus} />
                    <span className="text-[11px] text-slate-400">{formatDate(h.createdAt)}</span>
                  </div>
                  {h.remarks && <p className="text-slate-700 mt-1.5">{h.remarks}</p>}
                  <p className="text-[11px] text-slate-500 mt-1">Updated by {h.changedByName}</p>
                </div>
              ))}
        </div>
      </MobileSheet>
    </div>
  );
}

// ==================== 10. MOBILE REPORTS & ANALYTICS ====================
function MobileReports({
  leads,
  employees,
  callLogs,
  applications,
}: {
  leads: Lead[];
  employees: Employee[];
  callLogs: Array<{ employeeId: string; status: CallStatus }>;
  applications: LoanApplication[];
  activityLogs: Array<{ id: string }>;
}) {
  const bankSummary = useMemo(() => {
    const map = new Map<string, { bank: string; disbursed: number; count: number }>();
    applications.forEach((a) => {
      const cur = map.get(a.bankName) || { bank: a.bankName.split(' ')[0], disbursed: 0, count: 0 };
      cur.count += 1;
      if (a.status === 'Disbursed') cur.disbursed += Math.round((a.disbursedAmount || a.loanAmount) / 100000);
      map.set(a.bankName, cur);
    });
    return Array.from(map.values());
  }, [applications]);

  const exportReport = () => {
    const rows = employees
      .filter((e) => e.role === 'staff')
      .map((e) => {
        const empLeads = leads.filter((l) => !l.isArchived && l.assignedEmployeeId === e.id);
        const empCalls = callLogs.filter((c) => c.employeeId === e.id);
        const empDisbursed = applications
          .filter((a) => a.employeeId === e.id && a.status === 'Disbursed')
          .reduce((s, a) => s + (a.disbursedAmount || a.loanAmount), 0);
        return [e.employeeCode, e.fullName, empLeads.length, empCalls.length, empDisbursed].join(',');
      });
    const csv = ['Code,Employee,Leads,Calls,DisbursedINR', ...rows].join('\n');
    downloadTextFile(csv, `finbridge_mobile_report_${getTodayKey()}.csv`);
  };

  const totalDisbursed = applications
    .filter((a) => a.status === 'Disbursed')
    .reduce((s, a) => s + (a.disbursedAmount || a.loanAmount), 0);

  return (
    <div className="space-y-4 crm-anim-fade">
      <div className="crm-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Total Disbursed Portfolio</p>
          <p className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">{formatCompactCurrency(totalDisbursed)}</p>
        </div>
        <button
          type="button"
          onClick={exportReport}
          className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crm-card p-4">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">Disbursement by Partner Bank (₹ Lakhs)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bankSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="bank" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={32} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="disbursed" name="Disbursed (₹L)" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="crm-card p-4 space-y-2.5">
          <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Top Staff Performance
          </h3>
          <div className="divide-y divide-slate-100">
            {employees
              .filter((e) => e.role === 'staff')
              .slice(0, 10)
              .map((e) => {
                const calls = callLogs.filter((c) => c.employeeId === e.id).length;
                const apps = applications.filter((a) => a.employeeId === e.id && a.status === 'Disbursed').length;
                return (
                  <div key={e.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{e.fullName}</p>
                      <p className="text-[11px] text-slate-500">{e.department}</p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-slate-900">{calls} calls</p>
                      <p className="text-[11px] text-emerald-700">{apps} disbursed</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
