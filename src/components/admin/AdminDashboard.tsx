import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Flame,
  GitBranch,
  IndianRupee,
  PhoneCall,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCrmData } from '../../context/CrmDataContext';
import { formatCompactCurrency, formatDate, formatDateTime, getDateKey, getTodayKey } from '../../lib/utils';
import { ChartTooltip, EntityMonogram, KpiCard, StatusBadge } from '../ui/Primitives';
import type { AdminTab } from './AdminLayout';

const PIE_COLORS = ['#2563EB', '#0EA5E9', '#16A34A', '#D97706', '#6366F1', '#DC2626', '#64748B', '#0F172A'];

export function AdminDashboard({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const { leads, employees, callLogs, followUps, documents, applications, activityLogs, dataLoading } = useCrmData();

  const todayKey = getTodayKey();

  const metrics = useMemo(() => {
    const activeLeads = leads.filter((l) => !l.isArchived);
    const todaysAssignedLeads = activeLeads.filter(
      (l) => l.assignedEmployeeId && getDateKey(l.leadDate || l.createdAt) === todayKey
    ).length;
    const activeStaff = employees.filter((e) => e.role === 'staff' && e.status === 'active');
    const callsToday = callLogs.filter((c) => getDateKey(c.callTime) === todayKey).length;
    const dailyCallTarget = activeStaff.reduce((sum, e) => sum + (e.dailyCallTarget || 0), 0);
    const interestedCustomers = activeLeads.filter(
      (l) => l.status === 'Interested' || l.status === 'Qualified' || l.status === 'Converted'
    ).length;
    const followUpsDue = followUps.filter(
      (f) => f.status === 'pending' && getDateKey(f.scheduledAt) <= todayKey
    ).length;
    const loansInProcessing = applications.filter((a) =>
      ['Lead Interested', 'Documents Pending', 'Documents Submitted', 'Under Bank Review', 'Additional Documents Required'].includes(
        a.status
      )
    ).length;
    const loansApproved = applications.filter((a) => a.status === 'Approved' || a.status === 'Disbursed').length;
    const totalDisbursedAmount = applications
      .filter((a) => a.status === 'Disbursed')
      .reduce((sum, a) => sum + (a.disbursedAmount || a.loanAmount || 0), 0);
    const callAttainmentPct = dailyCallTarget > 0 ? Math.round((callsToday / dailyCallTarget) * 100) : 0;
    const unassignedLeads = activeLeads.filter((l) => !l.assignedEmployeeId).length;
    const overdueFollowUps = followUps.filter(
      (f) => f.status === 'pending' && new Date(f.scheduledAt).getTime() < Date.now()
    ).length;
    const pendingKycDocs = documents.filter((d) => d.status === 'Pending').length;

    return {
      totalLeads: activeLeads.length,
      todaysAssignedLeads,
      totalEmployees: employees.filter((e) => e.role === 'staff').length,
      activeStaffCount: activeStaff.length,
      callsToday,
      dailyCallTarget,
      callAttainmentPct,
      interestedCustomers,
      followUpsDue,
      loansInProcessing,
      loansApproved,
      totalDisbursedAmount,
      unassignedLeads,
      overdueFollowUps,
      pendingKycDocs,
    };
  }, [leads, employees, callLogs, followUps, documents, applications, todayKey]);

  const dailyCallsChartData = useMemo(() => {
    const days: Array<{ key: string; label: string; total: number; connected: number; interested: number }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const key = getDateKey(d);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const dayCalls = callLogs.filter((c) => getDateKey(c.callTime) === key);
      const connected = dayCalls.filter((c) =>
        ['Connected', 'Interested', 'Not Interested', 'Callback Requested'].includes(c.status)
      ).length;
      const interested = dayCalls.filter((c) => c.status === 'Interested').length;
      days.push({ key, label, total: dayCalls.length, connected, interested });
    }
    return days;
  }, [callLogs]);

  const leadStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads.filter((x) => !x.isArchived)) {
      counts.set(l.status, (counts.get(l.status) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const appStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of applications) {
      counts.set(a.status, (counts.get(a.status) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({
      name: name.replace('Additional Documents Required', 'Addl. Docs').replace('Documents ', 'Docs '),
      count,
    }));
  }, [applications]);

  const leaderboard = useMemo(() => {
    return employees
      .filter((e) => e.role === 'staff')
      .map((emp) => {
        const empCalls = callLogs.filter((c) => c.employeeId === emp.id || c.employeeEmail === emp.email);
        const empCallsToday = empCalls.filter((c) => getDateKey(c.callTime) === todayKey).length;
        const interested = empCalls.filter((c) => c.status === 'Interested').length;
        const assignedLeads = leads.filter((l) => !l.isArchived && l.assignedEmployeeId === emp.id).length;
        const appsCount = applications.filter((a) => a.employeeId === emp.id).length;
        const achievement = emp.dailyCallTarget > 0 ? Math.min(100, Math.round((empCallsToday / emp.dailyCallTarget) * 100)) : 0;
        return {
          emp,
          totalCalls: empCalls.length,
          callsToday: empCallsToday,
          interested,
          assignedLeads,
          appsCount,
          achievement,
        };
      })
      .sort((a, b) => b.totalCalls - a.totalCalls || b.interested - a.interested)
      .slice(0, 8);
  }, [employees, callLogs, leads, applications, todayKey]);

  const upcomingFollowUps = useMemo(() => {
    return followUps
      .filter((f) => f.status === 'pending')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 6);
  }, [followUps]);

  const recentApps = useMemo(() => applications.slice(0, 6), [applications]);

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded-md bg-slate-200/70" />
            <div className="h-3.5 w-80 rounded-md bg-slate-200/50" />
          </div>
          <div className="h-9 w-48 rounded-lg bg-slate-200/60" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="crm-card p-4 space-y-3">
              <div className="h-3 w-24 rounded bg-slate-200/70" />
              <div className="h-7 w-20 rounded bg-slate-200/80" />
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="crm-card h-20" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 crm-card h-80" />
          <div className="lg:col-span-5 crm-card h-80" />
        </div>
      </div>
    );
  }

  const operationalMetrics: Array<{
    label: string;
    value: number;
    subtext: string;
    icon: React.ReactNode;
    tab: AdminTab;
    accent?: string;
  }> = [
    {
      label: "Today's Assigned Leads",
      value: metrics.todaysAssignedLeads,
      subtext: 'Allocated today',
      icon: <UserPlus className="w-3.5 h-3.5 text-blue-600" />,
      tab: 'distribution',
    },
    {
      label: 'Total Employees',
      value: metrics.totalEmployees,
      subtext: `${metrics.activeStaffCount} active agents`,
      icon: <BadgeCheck className="w-3.5 h-3.5 text-slate-600" />,
      tab: 'employees',
    },
    {
      label: 'Daily Call Target',
      value: metrics.dailyCallTarget,
      subtext: `${metrics.callAttainmentPct}% attainment`,
      icon: <Target className="w-3.5 h-3.5 text-indigo-600" />,
      tab: 'employees',
    },
    {
      label: 'Interested Customers',
      value: metrics.interestedCustomers,
      subtext: 'Qualified & converted',
      icon: <Flame className="w-3.5 h-3.5 text-emerald-600" />,
      tab: 'leads',
      accent: 'text-emerald-700',
    },
    {
      label: 'Follow-ups Due',
      value: metrics.followUpsDue,
      subtext: 'Overdue & today',
      icon: <CalendarClock className="w-3.5 h-3.5 text-amber-600" />,
      tab: 'followups',
      accent: metrics.followUpsDue > 0 ? 'text-amber-700' : undefined,
    },
    {
      label: 'Loans in Processing',
      value: metrics.loansInProcessing,
      subtext: 'Underwriting & KYC',
      icon: <Building2 className="w-3.5 h-3.5 text-blue-600" />,
      tab: 'applications',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold font-display text-slate-900 tracking-tight">
            Executive Operations Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live database metrics across lead intake, call centre productivity, and bank loan disbursements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('distribution')}
            className="crm-btn-secondary"
          >
            Distribute Leads
          </button>
          <button
            type="button"
            onClick={() => onNavigate('leads')}
            className="crm-btn-primary"
          >
            Manage Leads
          </button>
        </div>
      </div>

      {/* Executive Triage Strip */}
      <div className="crm-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          <button
            type="button"
            onClick={() => onNavigate('distribution')}
            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80 flex items-center justify-center shrink-0">
                <GitBranch className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">Unassigned Pool</p>
                <p className="text-[11px] text-slate-500 truncate">Ready for distribution</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold font-display tabular-nums text-slate-900 shrink-0">
              {metrics.unassignedLeads}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('followups')}
            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200/80 flex items-center justify-center shrink-0">
                <CalendarClock className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">Overdue Callbacks</p>
                <p className="text-[11px] text-slate-500 truncate">Past scheduled slot</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold font-display tabular-nums text-rose-700 shrink-0">
              {metrics.overdueFollowUps}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200/80 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">Pending KYC Review</p>
                <p className="text-[11px] text-slate-500 truncate">Awaiting verification</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold font-display tabular-nums text-slate-900 shrink-0">
              {metrics.pendingKycDocs}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('applications')}
            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/80 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">Active Bank Files</p>
                <p className="text-[11px] text-slate-500 truncate">Underwriting in flight</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold font-display tabular-nums text-slate-900 shrink-0">
              {metrics.loansInProcessing}
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </span>
          </button>
        </div>
      </div>

      {/* Tier 1: 4 Primary Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Disbursed"
          value={formatCompactCurrency(metrics.totalDisbursedAmount)}
          subtext="Verified bank funded volume"
          icon={<IndianRupee className="w-4 h-4" />}
          tone="success"
          onClick={() => onNavigate('reports')}
        />
        <KpiCard
          label="Total Leads"
          value={metrics.totalLeads}
          subtext="Active CRM pipeline records"
          icon={<Users className="w-4 h-4" />}
          tone="primary"
          onClick={() => onNavigate('leads')}
        />
        <KpiCard
          label="Calls Completed Today"
          value={metrics.callsToday}
          subtext={`${metrics.callsToday} / ${metrics.dailyCallTarget} daily quota (${metrics.callAttainmentPct}%)`}
          progressPct={metrics.callAttainmentPct}
          icon={<PhoneCall className="w-4 h-4" />}
          tone="primary"
          onClick={() => onNavigate('calls')}
        />
        <KpiCard
          label="Loans Approved"
          value={metrics.loansApproved}
          subtext="Approved & disbursed files"
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
          onClick={() => onNavigate('applications')}
        />
      </div>

      {/* Tier 2: Unified 6-Metric Operational Strip */}
      <div className="crm-card overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {operationalMetrics.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onNavigate(m.tab)}
              className="p-4 text-left hover:bg-slate-50/80 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-700 truncate">
                  {m.label}
                </span>
                {m.icon}
              </div>
              <p
                className={`text-xl font-semibold font-display tabular-nums mt-1.5 ${
                  m.accent || 'text-slate-900'
                }`}
              >
                {m.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.subtext}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Calls Performance */}
        <div className="lg:col-span-7 crm-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold font-display text-slate-900">
                Daily Calls Performance (7 Days)
              </h3>
              <p className="text-xs text-slate-500">Total calls vs connected and interested outcomes</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-600" /> Total
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" /> Connected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-600" /> Interested
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyCallsChartData}>
                <defs>
                  <linearGradient id="callsTotalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Total Calls" stroke="#2563EB" fill="url(#callsTotalGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="connected" name="Connected" stroke="#16A34A" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="interested" name="Interested" stroke="#D97706" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Status Distribution */}
        <div className="lg:col-span-5 crm-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display text-slate-900">Lead Status Distribution</h3>
            <p className="text-xs text-slate-500">Breakdown across active CRM pipeline stages</p>
          </div>
          {leadStatusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No active leads in pipeline yet.
            </div>
          ) : (
            <div className="h-64 flex items-center">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={leadStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {leadStatusData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2 pl-2">
                {leadStatusData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 tabular-nums ml-2">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Second Row: Loan Application Chart + Employee Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 crm-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold font-display text-slate-900">Loan Application Pipeline</h3>
            <p className="text-xs text-slate-500">Applications by current bank processing stage</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appStatusData} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={115} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Applications" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 crm-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/90 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold font-display text-slate-900">
                Employee Performance Leaderboard
              </h3>
              <p className="text-xs text-slate-500">Ranked by call volume and interested customer conversions</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('employees')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all {metrics.totalEmployees} staff
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="crm-th-row">
                  <th className="py-2.5 px-4 w-10">Rank</th>
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3 text-right">Assigned</th>
                  <th className="py-2.5 px-3 text-right">Total Calls</th>
                  <th className="py-2.5 px-3 text-right">Today / Target</th>
                  <th className="py-2.5 px-3 text-right">Interested</th>
                  <th className="py-2.5 px-4 text-right">Apps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leaderboard.map((row, idx) => (
                  <tr key={row.emp.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <EntityMonogram name={row.emp.fullName} size="xs" />
                        <div>
                          <p className="font-medium text-slate-900">{row.emp.fullName}</p>
                          <p className="text-[11px] text-slate-500">{row.emp.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{row.assignedLeads}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900">{row.totalCalls}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      <div className="inline-flex flex-col items-end gap-1">
                        <span>
                          {row.callsToday} / {row.emp.dailyCallTarget}
                        </span>
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${row.achievement}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-700">
                      {row.interested}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-700">{row.appsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row: Upcoming Follow-ups, Recent Applications, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming Follow-ups */}
        <div className="crm-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/90 flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display text-slate-900">Upcoming Follow-ups</h3>
            <button
              type="button"
              onClick={() => onNavigate('followups')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingFollowUps.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No pending follow-ups.</p>
            ) : (
              upcomingFollowUps.map((f) => {
                const isOverdue = new Date(f.scheduledAt).getTime() < Date.now();
                return (
                  <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EntityMonogram name={f.customerName} size="xs" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{f.customerName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {f.employeeName} · {formatDateTime(f.scheduledAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-md ring-1 ring-inset ${
                        isOverdue
                          ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
                          : 'bg-amber-50 text-amber-800 ring-amber-200/80'
                      }`}
                    >
                      {isOverdue ? 'Overdue' : 'Scheduled'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Loan Applications */}
        <div className="crm-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/90 flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display text-slate-900">Recent Loan Applications</h3>
            <button
              type="button"
              onClick={() => onNavigate('applications')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentApps.map((app) => (
              <div key={app.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <EntityMonogram name={app.customerName} size="xs" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {app.customerName} <span className="font-mono text-slate-400">· {app.applicationCode}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate tabular-nums">
                      {app.bankName} · {formatCompactCurrency(app.loanAmount)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="crm-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/90 flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display text-slate-900">Recent Activity</h3>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {activityLogs.slice(0, 6).map((act) => (
              <div key={act.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">{act.action}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(act.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{act.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
