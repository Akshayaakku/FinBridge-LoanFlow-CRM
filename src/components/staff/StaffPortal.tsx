import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileCheck2,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  PhoneCall,
  Search,
  Smartphone,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { createFollowUp, recordCallLog, scoreLeadsWithAI, updateLead } from '../../services/crmService';
import { computeBaselineLeadScore, resolveEffectiveLeadScore, type ComputedLeadScore } from '../../lib/leadScoring';
import { formatCompactCurrency, formatCurrency, formatDateTime, formatDuration, getDateKey, getTodayKey } from '../../lib/utils';
import {
  CALL_STATUSES,
  LEAD_STATUSES,
  type CallStatus,
  type Lead,
  type LeadStatus,
} from '../../types/crm';
import { LeadScoreBadge, LeadScoreBreakdownCard } from '../ui/LeadScoreBadge';
import { NotificationCenter } from '../ui/NotificationCenter';
import { FinBridgeLogo } from '../ui/FinBridgeLogo';
import { ChartTooltip, Drawer, EntityMonogram, KpiCard, Modal, StatusBadge } from '../ui/Primitives';
import { StaffApplicationsTab, StaffDocumentsTab, StaffFollowUpsTab, StaffPerformanceTab } from './StaffOperationsTabs';

export type StaffTab = 'dashboard' | 'leads' | 'calls' | 'followups' | 'documents' | 'applications' | 'performance';

const STAFF_NAV: Array<{ id: StaffTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'My Leads', icon: Users },
  { id: 'calls', label: 'Call Logger', icon: PhoneCall },
  { id: 'followups', label: 'My Follow-ups', icon: CalendarClock },
  { id: 'documents', label: 'My Documents', icon: FileCheck2 },
  { id: 'applications', label: 'My Applications', icon: Building2 },
  { id: 'performance', label: 'My Performance', icon: BarChart3 },
];

export function StaffPortal() {
  const {
    userProfile,
    role,
    accessDeniedNotice,
    clearAccessDeniedNotice,
    setPortalMode,
    inspectedStaffEmail,
    setInspectedStaffEmail,
    signOut,
  } = useAuth();
  const { employees, leads, callLogs, followUps, documents, applications, statusHistory, notify } = useCrmData();

  const [activeTab, setActiveTab] = useState<StaffTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine the active staff profile (strictly own email for staff role, selectable for admin preview)
  const activeEmail = role === 'staff' ? userProfile?.email || '' : inspectedStaffEmail;
  const activeEmployee = useMemo(() => {
    return (
      employees.find((e) => e.email.toLowerCase() === activeEmail.toLowerCase()) ||
      employees.find((e) => e.role === 'staff') || {
        id: 'emp_self',
        employeeCode: 'STAFF',
        fullName: userProfile?.fullName || 'Call Centre Agent',
        email: activeEmail,
        phone: '+91 98000-00000',
        role: 'staff' as const,
        department: 'Retail Loans',
        joiningDate: getTodayKey(),
        status: 'active' as const,
        dailyCallTarget: 45,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }, [employees, activeEmail, userProfile]);

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || activeEmployee.fullName,
      role,
    }),
    [userProfile, activeEmployee, role]
  );

  // Scoped datasets for this employee
  const myLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          !l.isArchived &&
          (l.assignedEmployeeId === activeEmployee.id ||
            (l.assignedEmployeeEmail || '').toLowerCase() === activeEmployee.email.toLowerCase())
      ),
    [leads, activeEmployee]
  );

  const myCalls = useMemo(
    () =>
      callLogs.filter(
        (c) =>
          c.employeeId === activeEmployee.id ||
          c.employeeEmail.toLowerCase() === activeEmployee.email.toLowerCase()
      ),
    [callLogs, activeEmployee]
  );

  const myFollowUps = useMemo(
    () =>
      followUps.filter(
        (f) =>
          f.employeeId === activeEmployee.id ||
          f.employeeEmail.toLowerCase() === activeEmployee.email.toLowerCase()
      ),
    [followUps, activeEmployee]
  );

  const myDocuments = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.employeeId === activeEmployee.id ||
          d.employeeEmail.toLowerCase() === activeEmployee.email.toLowerCase()
      ),
    [documents, activeEmployee]
  );

  const myApplications = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.employeeId === activeEmployee.id ||
          a.employeeEmail.toLowerCase() === activeEmployee.email.toLowerCase()
      ),
    [applications, activeEmployee]
  );

  const todayKey = getTodayKey();
  const dashMetrics = useMemo(() => {
    const todaysAssigned = myLeads.filter((l) => getDateKey(l.leadDate || l.createdAt) === todayKey).length;
    const target = activeEmployee.dailyCallTarget || 45;
    const completedToday = myCalls.filter((c) => getDateKey(c.callTime) === todayKey).length;
    const remaining = Math.max(0, target - completedToday);
    const interested = myLeads.filter((l) => ['Interested', 'Qualified', 'Converted'].includes(l.status)).length;
    const followUpsDue = myFollowUps.filter((f) => f.status === 'pending' && getDateKey(f.scheduledAt) <= todayKey).length;
    const loansInProgress = myApplications.filter((a) => !['Disbursed', 'Closed', 'Rejected'].includes(a.status)).length;
    const converted = myLeads.filter((l) => l.status === 'Converted').length;
    const conversionRate = myLeads.length > 0 ? Math.round((converted / myLeads.length) * 100) : 0;
    const pct = target > 0 ? Math.min(100, Math.round((completedToday / target) * 100)) : 0;
    return {
      todaysAssigned,
      target,
      completedToday,
      remaining,
      interested,
      followUpsDue,
      loansInProgress,
      conversionRate,
      pct,
    };
  }, [myLeads, myCalls, myFollowUps, myApplications, activeEmployee, todayKey]);

  const weeklyChart = useMemo(() => {
    const arr: Array<{ day: string; calls: number; interested: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      const calls = myCalls.filter((c) => getDateKey(c.callTime) === key);
      arr.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        calls: calls.length,
        interested: calls.filter((c) => c.status === 'Interested').length,
      });
    }
    return arr;
  }, [myCalls]);

  // My Leads state
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('ALL');
  const [scoreTierFilter, setScoreTierFilter] = useState('ALL');
  const [aiScoringBusy, setAiScoringBusy] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadStatusEdit, setLeadStatusEdit] = useState<LeadStatus>('Contacted');
  const [leadRemarksEdit, setLeadRemarksEdit] = useState('');
  const [leadSaving, setLeadSaving] = useState(false);

  // Call Logger modal/state
  const [quickCallLead, setQuickCallLead] = useState<Lead | null>(null);
  const [callLeadId, setCallLeadId] = useState('');
  const [callOutcome, setCallOutcome] = useState<CallStatus>('Connected');
  const [callDuration, setCallDuration] = useState(180);
  const [callRemarks, setCallRemarks] = useState('');
  const [callNextFollowUp, setCallNextFollowUp] = useState('');
  const [callBusy, setCallBusy] = useState(false);

  // Schedule follow-up shortcut
  const [fupLead, setFupLead] = useState<Lead | null>(null);
  const [fupTime, setFupTime] = useState('');
  const [fupNotes, setFupNotes] = useState('');
  const [fupSaving, setFupSaving] = useState(false);

  const leadScoreMap = useMemo(() => {
    const map = new Map<string, ComputedLeadScore>();
    myLeads.forEach((l) => {
      map.set(l.id, resolveEffectiveLeadScore(l, myCalls, myFollowUps, myDocuments));
    });
    return map;
  }, [myLeads, myCalls, myFollowUps, myDocuments]);

  const activeSelectedLead = useMemo(
    () => (selectedLead ? myLeads.find((l) => l.id === selectedLead.id) || selectedLead : null),
    [selectedLead, myLeads]
  );

  const filteredMyLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return myLeads
      .filter((l) => (leadStatusFilter === 'ALL' ? true : l.status === leadStatusFilter))
      .filter((l) => (scoreTierFilter === 'ALL' ? true : leadScoreMap.get(l.id)?.scoreTier === scoreTierFilter))
      .filter((l) => {
        if (!q) return true;
        return (
          l.customerName.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.leadCode.toLowerCase().includes(q) ||
          l.loanType.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (leadScoreMap.get(b.id)?.leadScore || 0) - (leadScoreMap.get(a.id)?.leadScore || 0));
  }, [myLeads, leadStatusFilter, scoreTierFilter, leadSearch, leadScoreMap]);

  const handleRunAiScoring = async (targets: Lead[]) => {
    if (targets.length === 0) return;
    setAiScoringBusy(true);
    try {
      const results = await scoreLeadsWithAI(actor, targets, myCalls, myFollowUps, myDocuments);
      const hotCount = results.filter((r) => r.scoreTier === 'Hot').length;
      notify('AI scoring complete', `Scored ${results.length} assigned lead(s) (${hotCount} Hot).`);
    } catch (err) {
      notify('AI scoring error', err instanceof Error ? err.message : 'Unable to score leads.', 'error');
    } finally {
      setAiScoringBusy(false);
    }
  };

  const openLeadDrawer = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadStatusEdit(lead.status);
    setLeadRemarksEdit(lead.remarks || '');
  };

  const handleSaveLeadUpdate = async () => {
    if (!activeSelectedLead) return;
    setLeadSaving(true);
    try {
      const leadCalls = myCalls.filter((c) => c.leadId === activeSelectedLead.id);
      const leadFups = myFollowUps.filter((f) => f.leadId === activeSelectedLead.id);
      const leadDocs = myDocuments.filter((d) => d.leadId === activeSelectedLead.id);
      const updatedScore = computeBaselineLeadScore(
        { ...activeSelectedLead, status: leadStatusEdit },
        leadCalls,
        leadFups,
        leadDocs
      );
      await updateLead(actor, activeSelectedLead.id, {
        status: leadStatusEdit,
        remarks: leadRemarksEdit,
        leadScore: updatedScore.leadScore,
        scoreTier: updatedScore.scoreTier,
        scoreSummary: updatedScore.scoreSummary,
        scoreFactors: updatedScore.scoreFactors,
        scoredAt: new Date().toISOString(),
        scoreModel: updatedScore.scoreModel,
      });
      notify('Lead updated', `${activeSelectedLead.customerName} status set to ${leadStatusEdit}.`);
      setSelectedLead({
        ...activeSelectedLead,
        status: leadStatusEdit,
        remarks: leadRemarksEdit,
        ...updatedScore,
      });
    } catch (err) {
      notify('Unable to update lead', err instanceof Error ? err.message : 'Please try again.', 'error');
    } finally {
      setLeadSaving(false);
    }
  };

  const handleLogCall = async (targetLead: Lead | null) => {
    const lead = targetLead || myLeads.find((l) => l.id === callLeadId);
    if (!lead) {
      notify('Select a customer lead', 'Choose an assigned lead before logging a call.', 'error');
      return;
    }
    setCallBusy(true);
    try {
      await recordCallLog(actor, lead, activeEmployee, {
        status: callOutcome,
        durationSeconds: callDuration,
        remarks: callRemarks,
        nextFollowUpDate: callNextFollowUp || undefined,
      });
      notify('Call saved', `Logged ${callOutcome} call with ${lead.customerName}.`);
      setCallRemarks('');
      setCallNextFollowUp('');
      setQuickCallLead(null);
    } catch (err) {
      notify('Error logging call', err instanceof Error ? err.message : 'Unable to save call.', 'error');
    } finally {
      setCallBusy(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!fupLead || !fupTime) return;
    setFupSaving(true);
    try {
      await createFollowUp(actor, fupLead, activeEmployee, fupTime, fupNotes);
      notify('Follow-up scheduled', `Callback set for ${fupLead.customerName}.`);
      setFupLead(null);
      setFupTime('');
      setFupNotes('');
    } catch (err) {
      notify('Follow-up failed', err instanceof Error ? err.message : 'Unable to schedule follow-up.', 'error');
    } finally {
      setFupSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex">
      {/* Staff Obsidian Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0B1220] text-slate-300 border-r border-slate-800/80 sticky top-0 h-screen shrink-0">
        <div className="h-16 px-4 flex items-center gap-2.5 border-b border-white/[0.08]">
          <FinBridgeLogo size="sm" variant="dark" />
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white truncate leading-tight">FinBridge Agent</p>
            <p className="text-[11px] text-slate-400 truncate">{activeEmployee.department}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {STAFF_NAV.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const countBadge =
              item.id === 'leads' && myLeads.length > 0
                ? { count: myLeads.length, urgent: false }
                : item.id === 'followups' && dashMetrics.followUpsDue > 0
                ? { count: dashMetrics.followUpsDue, urgent: true }
                : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-blue-500"
                    aria-hidden="true"
                  />
                )}
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {countBadge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold tabular-nums leading-none shrink-0 ${
                      countBadge.urgent ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.08] text-slate-300'
                    }`}
                  >
                    {countBadge.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {role === 'admin' && (
          <div className="p-3 border-t border-white/[0.08] space-y-1">
            <p className="px-3 text-[11px] font-medium text-slate-400/80 mb-1">Admin Preview</p>
            <button
              type="button"
              onClick={() => setPortalMode('admin')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Monitor className="w-4 h-4 text-blue-400" />
              Back to Admin Portal
            </button>
            <button
              type="button"
              onClick={() => setPortalMode('mobile_admin')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Mobile Admin UI
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Staff Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex bg-slate-950/60 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-72 bg-[#0B1220] text-slate-200 h-full flex flex-col shadow-2xl">
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.08]">
              <span className="font-display font-bold text-white">Agent Workspace</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {STAFF_NAV.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {role === 'admin' && (
              <div className="p-3 border-t border-white/[0.08] space-y-2">
                <div>
                  <label className="block px-1 text-[11px] font-medium text-slate-400 mb-1">Viewing Agent</label>
                  <select
                    value={inspectedStaffEmail}
                    onChange={(e) => setInspectedStaffEmail(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  >
                    {employees
                      .filter((e) => e.role === 'staff')
                      .map((e) => (
                        <option key={e.id} value={e.email}>
                          {e.fullName}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPortalMode('admin');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                >
                  <Monitor className="w-4 h-4 text-blue-400" />
                  Back to Admin Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPortalMode('mobile_admin');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-white/[0.06]"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Mobile Admin UI
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate">
                {STAFF_NAV.find((n) => n.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {activeEmployee.fullName} · {activeEmployee.employeeCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {role === 'admin' && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-slate-500">Viewing Agent:</span>
                <select
                  value={inspectedStaffEmail}
                  onChange={(e) => setInspectedStaffEmail(e.target.value)}
                  className="crm-select-compact py-1.5"
                >
                  {employees
                    .filter((e) => e.role === 'staff')
                    .map((e) => (
                      <option key={e.id} value={e.email}>
                        {e.fullName}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <NotificationCenter
              scope="staff"
              staffEmail={activeEmployee.email}
              onNavigate={(tab) => setActiveTab(tab as StaffTab)}
            />
            <button
              type="button"
              onClick={signOut}
              className="crm-btn-secondary py-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {accessDeniedNotice && (
            <div
              role="alert"
              className="mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3"
            >
              <span>{accessDeniedNotice}</span>
              <button
                type="button"
                onClick={clearAccessDeniedNotice}
                className="text-amber-700 hover:text-amber-950 font-semibold shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 crm-anim-fade">
              {/* Target Progress Banner */}
              <div className="crm-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-display text-base font-bold tracking-tight text-slate-900">
                      Daily Call Target Progress
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dashMetrics.completedToday} completed out of {dashMetrics.target} daily calls ({dashMetrics.remaining} remaining)
                    </p>
                  </div>
                  <span className="font-display text-xl font-bold text-blue-600 tabular-nums">{dashMetrics.pct}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${dashMetrics.pct}%` }}
                  />
                </div>
              </div>

              {/* 8 Staff KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Assigned Leads" value={myLeads.length} subtext={`${dashMetrics.todaysAssigned} added today`} icon={<Users className="w-4 h-4" />} tone="primary" onClick={() => setActiveTab('leads')} />
                <KpiCard label="Daily Call Target" value={dashMetrics.target} subtext="Calls expected today" icon={<Target className="w-4 h-4" />} />
                <KpiCard label="Completed Calls" value={dashMetrics.completedToday} subtext="Logged today" icon={<CheckCircle2 className="w-4 h-4" />} tone="success" onClick={() => setActiveTab('calls')} />
                <KpiCard label="Remaining Calls" value={dashMetrics.remaining} subtext="To hit daily quota" icon={<PhoneCall className="w-4 h-4" />} tone="warning" />
                <KpiCard label="Interested Customers" value={dashMetrics.interested} subtext="Ready for KYC" icon={<Flame className="w-4 h-4" />} tone="success" />
                <KpiCard label="Follow-ups Due" value={dashMetrics.followUpsDue} subtext="Overdue & today" icon={<CalendarClock className="w-4 h-4" />} tone="warning" onClick={() => setActiveTab('followups')} />
                <KpiCard label="Loans in Progress" value={dashMetrics.loansInProgress} subtext="Bank processing" icon={<Building2 className="w-4 h-4" />} tone="primary" onClick={() => setActiveTab('applications')} />
                <KpiCard label="Conversion Rate" value={`${dashMetrics.conversionRate}%`} subtext="Personal lead conversion" icon={<BarChart3 className="w-4 h-4" />} onClick={() => setActiveTab('performance')} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 crm-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900">7-Day Personal Call Activity</h3>
                      <p className="text-xs text-slate-500">Total calls logged vs interested prospects</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-600" /> Calls
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" /> Interested
                      </span>
                    </div>
                  </div>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="calls" name="Calls" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="interested" name="Interested" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 crm-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-slate-900">Priority Assigned Leads</h3>
                    <button type="button" onClick={() => setActiveTab('leads')} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      Open All
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[...myLeads]
                      .sort((a, b) => (leadScoreMap.get(b.id)?.leadScore || 0) - (leadScoreMap.get(a.id)?.leadScore || 0))
                      .slice(0, 5)
                      .map((l) => {
                        const computed = leadScoreMap.get(l.id);
                        return (
                        <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <EntityMonogram name={l.customerName} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => openLeadDrawer(l)} className="text-xs font-semibold text-slate-900 hover:text-blue-600 truncate block">
                                  {l.customerName}
                                </button>
                                {computed && (
                                  <LeadScoreBadge
                                    score={computed.leadScore}
                                    tier={computed.scoreTier}
                                    isAi={computed.scoreModel.includes('gemini')}
                                    compact
                                  />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 tabular-nums">
                                {l.loanType} · {formatCompactCurrency(l.requiredLoanAmount)} · {l.phone}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCallLead(l);
                              setCallOutcome('Connected');
                            }}
                            className="crm-btn-primary py-1.5 px-2.5 shrink-0"
                          >
                            Log Call
                          </button>
                        </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="space-y-4 crm-anim-fade">
              <div className="crm-card p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search your assigned leads..."
                    className="crm-input-compact pl-9"
                  />
                </div>
                <select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value)}
                  className="crm-select-compact"
                >
                  <option value="ALL">All Statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={scoreTierFilter}
                  onChange={(e) => setScoreTierFilter(e.target.value)}
                  className="crm-select-compact"
                >
                  <option value="ALL">All AI Scores</option>
                  <option value="Hot">Hot (75–100)</option>
                  <option value="Warm">Warm (45–74)</option>
                  <option value="Cold">Cold (0–44)</option>
                </select>
                <button
                  type="button"
                  disabled={aiScoringBusy || filteredMyLeads.length === 0}
                  onClick={() => void handleRunAiScoring(filteredMyLeads.slice(0, 10))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiScoringBusy ? 'Scoring...' : 'AI Score My Leads'}
                </button>
              </div>

              <div className="crm-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="crm-th-row">
                        <th className="py-3 px-4">Lead</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Loan &amp; Income</th>
                        <th className="py-3 px-3 text-right">Amount</th>
                        <th className="py-3 px-3">AI Score</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Priority</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredMyLeads.map((l) => {
                        const computed = leadScoreMap.get(l.id);
                        return (
                        <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{l.leadCode}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <EntityMonogram name={l.customerName} />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openLeadDrawer(l)}
                                  className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                                >
                                  {l.customerName}
                                </button>
                                <p className="text-[11px] text-slate-500 tabular-nums">{l.phone} · {l.city}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-800">{l.loanType}</p>
                            <p className="text-[11px] text-slate-500 tabular-nums">{formatCompactCurrency(l.monthlyIncome)}/mo</p>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatCompactCurrency(l.requiredLoanAmount)}</td>
                          <td className="py-3 px-3">
                            {computed && (
                              <LeadScoreBadge
                                score={computed.leadScore}
                                tier={computed.scoreTier}
                                isAi={computed.scoreModel.includes('gemini')}
                              />
                            )}
                          </td>
                          <td className="py-3 px-3"><StatusBadge status={l.status} /></td>
                          <td className="py-3 px-3"><StatusBadge status={l.priority} /></td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openLeadDrawer(l)}
                                className="crm-btn-secondary py-1.5 px-2.5"
                              >
                                <Eye className="w-3 h-3" /> Details
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuickCallLead(l)}
                                className="crm-btn-primary py-1.5 px-2.5"
                              >
                                Log Call
                              </button>
                              <button
                                type="button"
                                onClick={() => setFupLead(l)}
                                className="crm-btn-secondary py-1.5 px-2.5"
                              >
                                Follow-up
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 crm-anim-fade">
              <div className="lg:col-span-5 crm-card p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold tracking-tight text-slate-900">Record Customer Call</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Save call outcome, duration, remarks, and optional callback</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Customer *</label>
                  <select
                    value={callLeadId}
                    onChange={(e) => setCallLeadId(e.target.value)}
                    className="crm-select w-full"
                  >
                    <option value="">Select lead...</option>
                    {myLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.customerName} ({l.leadCode}) — {l.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Outcome *</label>
                    <select
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value as CallStatus)}
                      className="crm-select w-full"
                    >
                      {CALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Duration (sec)</label>
                    <input
                      type="number"
                      value={callDuration}
                      onChange={(e) => setCallDuration(Number(e.target.value))}
                      className="crm-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Next Follow-Up (optional)</label>
                  <input
                    type="datetime-local"
                    value={callNextFollowUp}
                    onChange={(e) => setCallNextFollowUp(e.target.value)}
                    className="crm-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Call Remarks</label>
                  <textarea
                    rows={3}
                    value={callRemarks}
                    onChange={(e) => setCallRemarks(e.target.value)}
                    placeholder="Customer interest, eligibility notes, or objections..."
                    className="crm-input"
                  />
                </div>
                <button
                  type="button"
                  disabled={callBusy || !callLeadId}
                  onClick={() => handleLogCall(null)}
                  className="crm-btn-primary w-full py-2.5 text-sm"
                >
                  {callBusy ? 'Saving...' : 'Save Call Record'}
                </button>
              </div>

              <div className="lg:col-span-7 crm-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    My Recent Call History ({myCalls.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                  {myCalls.map((c) => (
                    <div key={c.id} className="px-5 py-3.5 text-xs hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {c.customerName} <span className="font-mono text-slate-400">· {c.leadCode}</span>
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-slate-600 mt-1">{c.remarks || 'No notes recorded'}</p>
                      <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                        {formatDateTime(c.callTime)} · {formatDuration(c.durationSeconds)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'followups' && (
            <StaffFollowUpsTab actor={actor} myFollowUps={myFollowUps} />
          )}

          {activeTab === 'documents' && (
            <StaffDocumentsTab actor={actor} employee={activeEmployee} myLeads={myLeads} myDocuments={myDocuments} />
          )}

          {activeTab === 'applications' && (
            <StaffApplicationsTab actor={actor} myApplications={myApplications} statusHistory={statusHistory} />
          )}

          {activeTab === 'performance' && (
            <StaffPerformanceTab employee={activeEmployee} myLeads={myLeads} myCalls={myCalls} myFollowUps={myFollowUps} myApplications={myApplications} />
          )}
        </main>
      </div>

      {/* Lead Detail Drawer */}
      <Drawer
        open={Boolean(activeSelectedLead)}
        onClose={() => setSelectedLead(null)}
        title={activeSelectedLead?.customerName || 'Customer Profile'}
        subtitle={activeSelectedLead ? `${activeSelectedLead.leadCode} · ${activeSelectedLead.loanType} · ${activeSelectedLead.phone}` : undefined}
      >
        {activeSelectedLead && (
          <div className="space-y-6">
            <LeadScoreBreakdownCard
              computed={leadScoreMap.get(activeSelectedLead.id) || resolveEffectiveLeadScore(activeSelectedLead, myCalls, myFollowUps, myDocuments)}
              scoringBusy={aiScoringBusy}
              onRunAiScore={() => void handleRunAiScoring([activeSelectedLead])}
            />

            <div className="grid grid-cols-2 gap-4 pb-5 border-b border-slate-100 text-xs">
              <div>
                <p className="text-slate-500">Required Loan</p>
                <p className="font-semibold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(activeSelectedLead.requiredLoanAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Income</p>
                <p className="font-medium text-slate-900 mt-0.5 tabular-nums">{formatCurrency(activeSelectedLead.monthlyIncome)}</p>
              </div>
              <div>
                <p className="text-slate-500">City / Employment</p>
                <p className="font-medium text-slate-900 mt-0.5">{activeSelectedLead.city} · {activeSelectedLead.employmentType}</p>
              </div>
              <div>
                <p className="text-slate-500">Preferred Bank</p>
                <p className="font-medium text-slate-900 mt-0.5">{activeSelectedLead.preferredBank || 'Any Partner'}</p>
              </div>
            </div>

            <div className="pb-5 border-b border-slate-100 space-y-3">
              <h4 className="font-display text-xs font-semibold text-slate-800">Update Lead Status &amp; Remarks</h4>
              <select
                value={leadStatusEdit}
                onChange={(e) => setLeadStatusEdit(e.target.value as LeadStatus)}
                className="crm-select w-full"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                value={leadRemarksEdit}
                onChange={(e) => setLeadRemarksEdit(e.target.value)}
                className="crm-input"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={leadSaving}
                  onClick={handleSaveLeadUpdate}
                  className="crm-btn-primary"
                >
                  {leadSaving ? 'Saving...' : 'Save Status & Remarks'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickCallLead(activeSelectedLead)}
                  className="crm-btn-secondary"
                >
                  Log Call
                </button>
                <button
                  type="button"
                  onClick={() => setFupLead(activeSelectedLead)}
                  className="crm-btn-secondary"
                >
                  Schedule Follow-up
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-slate-800 mb-2">Previous Interactions</h4>
              <div className="divide-y divide-slate-100">
                {myCalls
                  .filter((c) => c.leadId === activeSelectedLead.id)
                  .map((c) => (
                    <div key={c.id} className="py-3 first:pt-0 text-xs">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={c.status} />
                        <span className="text-slate-400 tabular-nums">{formatDateTime(c.callTime)}</span>
                      </div>
                      <p className="text-slate-700 mt-1.5">{c.remarks}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Quick Log Call Modal */}
      <Modal
        open={Boolean(quickCallLead)}
        onClose={() => setQuickCallLead(null)}
        title={`Log Call · ${quickCallLead?.customerName}`}
        subtitle={quickCallLead?.phone}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Outcome</label>
              <select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value as CallStatus)}
                className="crm-select w-full"
              >
                {CALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Duration (sec)</label>
              <input
                type="number"
                value={callDuration}
                onChange={(e) => setCallDuration(Number(e.target.value))}
                className="crm-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Next Follow-Up (optional)</label>
            <input
              type="datetime-local"
              value={callNextFollowUp}
              onChange={(e) => setCallNextFollowUp(e.target.value)}
              className="crm-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={3}
              value={callRemarks}
              onChange={(e) => setCallRemarks(e.target.value)}
              className="crm-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuickCallLead(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={callBusy}
              onClick={() => handleLogCall(quickCallLead)}
              className="crm-btn-primary"
            >
              {callBusy ? 'Saving...' : 'Save Call'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Schedule Follow-up Modal */}
      <Modal
        open={Boolean(fupLead)}
        onClose={() => setFupLead(null)}
        title={`Schedule Follow-up · ${fupLead?.customerName}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date &amp; Time *</label>
            <input
              type="datetime-local"
              value={fupTime}
              onChange={(e) => setFupTime(e.target.value)}
              className="crm-input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Follow-up Notes</label>
            <textarea
              rows={3}
              value={fupNotes}
              onChange={(e) => setFupNotes(e.target.value)}
              className="crm-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFupLead(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={!fupTime || fupSaving}
              onClick={handleScheduleFollowUp}
              className="crm-btn-primary"
            >
              {fupSaving ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
