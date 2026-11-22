import { Download } from 'lucide-react';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCrmData } from '../../context/CrmDataContext';
import { downloadTextFile, formatCompactCurrency, getDateKey } from '../../lib/utils';
import { ChartTooltip, EntityMonogram, KpiCard } from '../ui/Primitives';

export function ReportsAnalytics() {
  const { leads, employees, callLogs, followUps, documents, applications, leadAssignments } = useCrmData();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getDateKey(d);
  });
  const [endDate, setEndDate] = useState(() => getDateKey(new Date()));

  const inRange = (isoOrDate: string | undefined) => {
    if (!isoOrDate) return true;
    const key = getDateKey(isoOrDate);
    return (!startDate || key >= startDate) && (!endDate || key <= endDate);
  };

  const reportData = useMemo(() => {
    const activeLeads = leads.filter((l) => !l.isArchived && inRange(l.leadDate || l.createdAt));
    const filteredCalls = callLogs.filter((c) => inRange(c.callTime));
    const filteredFollowUps = followUps.filter((f) => inRange(f.scheduledAt));
    const filteredDocs = documents.filter((d) => inRange(d.createdAt));
    const filteredApps = applications.filter((a) => inRange(a.applicationDate));

    const interestedCount = activeLeads.filter((l) =>
      ['Interested', 'Qualified', 'Converted'].includes(l.status)
    ).length;
    const notInterestedCount = activeLeads.filter((l) => l.status === 'Not Interested').length;
    const convertedCount = activeLeads.filter((l) => l.status === 'Converted').length;
    const conversionRate = activeLeads.length > 0 ? Math.round((convertedCount / activeLeads.length) * 100) : 0;

    const completedFollowUps = filteredFollowUps.filter((f) => f.status === 'completed').length;
    const followUpCompletionRate =
      filteredFollowUps.length > 0 ? Math.round((completedFollowUps / filteredFollowUps.length) * 100) : 0;

    const approvedOrDisbursed = filteredApps.filter(
      (a) => a.status === 'Approved' || a.status === 'Disbursed'
    ).length;
    const approvalRate = filteredApps.length > 0 ? Math.round((approvedOrDisbursed / filteredApps.length) * 100) : 0;

    const totalDisbursed = filteredApps
      .filter((a) => a.status === 'Disbursed')
      .reduce((sum, a) => sum + (a.disbursedAmount || a.loanAmount || 0), 0);

    // Employee performance rows
    const employeeReport = employees
      .filter((e) => e.role === 'staff')
      .map((emp) => {
        const empLeads = activeLeads.filter((l) => l.assignedEmployeeId === emp.id);
        const empCalls = filteredCalls.filter((c) => c.employeeId === emp.id || c.employeeEmail === emp.email);
        const empInt = empCalls.filter((c) => c.status === 'Interested').length;
        const empApps = filteredApps.filter((a) => a.employeeId === emp.id);
        const empDisb = empApps
          .filter((a) => a.status === 'Disbursed')
          .reduce((s, a) => s + (a.disbursedAmount || a.loanAmount), 0);
        return {
          Employee: emp.fullName,
          Department: emp.department,
          'Assigned Leads': empLeads.length,
          'Total Calls': empCalls.length,
          'Interested Calls': empInt,
          'Loan Applications': empApps.length,
          'Disbursed Volume': empDisb,
        };
      });

    // Bank-wise loan performance
    const bankMap = new Map<string, { bank: string; total: number; approved: number; disbursed: number; volume: number }>();
    for (const app of filteredApps) {
      const curr = bankMap.get(app.bankName) || { bank: app.bankName, total: 0, approved: 0, disbursed: 0, volume: 0 };
      curr.total += 1;
      if (app.status === 'Approved' || app.status === 'Disbursed') curr.approved += 1;
      if (app.status === 'Disbursed') {
        curr.disbursed += 1;
        curr.volume += app.disbursedAmount || app.loanAmount;
      }
      bankMap.set(app.bankName, curr);
    }
    const bankPerformance = Array.from(bankMap.values());

    // Document verification breakdown
    const docSummary = ['Pending', 'Verified', 'Rejected', 'Re-upload Required'].map((st) => ({
      Status: st,
      Count: filteredDocs.filter((d) => d.status === st).length,
    }));

    return {
      activeLeads,
      filteredCalls,
      filteredFollowUps,
      filteredDocs,
      filteredApps,
      interestedCount,
      notInterestedCount,
      conversionRate,
      followUpCompletionRate,
      approvalRate,
      totalDisbursed,
      employeeReport,
      bankPerformance,
      docSummary,
    };
  }, [leads, employees, callLogs, followUps, documents, applications, startDate, endDate]);

  const exportCsv = (name: string, rows: Record<string, unknown>[]) => {
    const csv = Papa.unparse(rows);
    downloadTextFile(csv, `finbridge_${name}_${startDate}_to_${endDate}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            Reports &amp; Business Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Date-filtered conversion, call performance, KYC verification, and bank disbursement metrics
          </p>
        </div>

        <div className="crm-card flex flex-wrap items-center gap-2 p-2 text-xs">
          <span className="text-slate-500 pl-1.5 font-medium">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="crm-input-compact w-auto"
          />
          <span className="text-slate-500 font-medium">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="crm-input-compact w-auto"
          />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Lead Conversion Rate" value={`${reportData.conversionRate}%`} subtext={`${reportData.activeLeads.length} leads in period`} tone="primary" />
        <KpiCard label="Interested vs Not Int." value={`${reportData.interestedCount} / ${reportData.notInterestedCount}`} subtext="Qualified vs declined" tone="success" />
        <KpiCard label="Follow-up Completion" value={`${reportData.followUpCompletionRate}%`} subtext={`${reportData.filteredFollowUps.length} scheduled`} />
        <KpiCard label="Loan Approval Rate" value={`${reportData.approvalRate}%`} subtext={`${reportData.filteredApps.length} applications`} tone="success" />
        <KpiCard label="Disbursed Volume" value={formatCompactCurrency(reportData.totalDisbursed)} subtext="Verified bank payouts" tone="success" />
      </div>

      {/* Bank-wise Loan Performance Chart & Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 crm-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Bank-Wise Application &amp; Approval Performance
              </h3>
              <p className="text-xs text-slate-500">Submitted vs Approved/Disbursed per partner bank</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-600" /> Applications
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" /> Approved
              </span>
              <button
                type="button"
                onClick={() => exportCsv('bank_performance', reportData.bankPerformance)}
                className="crm-btn-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.bankPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="bank" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="total" name="Applications" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" name="Approved/Disbursed" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 crm-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">Quick CSV Report Exports</h3>
                <p className="text-xs text-slate-500">Download date-filtered operational datasets</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-3 first:pt-1">
                <div>
                  <p className="font-semibold text-slate-900">Daily Call Performance Report</p>
                  <p className="text-slate-500 tabular-nums">{reportData.filteredCalls.length} call records</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportCsv('call_performance', reportData.filteredCalls as unknown as Record<string, unknown>[])}
                  className="crm-btn-secondary py-1.5 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-slate-900">Lead Assignment Audit Report</p>
                  <p className="text-slate-500 tabular-nums">{leadAssignments.length} assignment logs</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportCsv('lead_assignments', leadAssignments as unknown as Record<string, unknown>[])}
                  className="crm-btn-secondary py-1.5 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-slate-900">Document Verification Report</p>
                  <p className="text-slate-500 tabular-nums">{reportData.filteredDocs.length} KYC records</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportCsv('document_verification', reportData.docSummary)}
                  className="crm-btn-secondary py-1.5 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="flex items-center justify-between py-3 last:pb-1">
                <div>
                  <p className="font-semibold text-slate-900">Loan Disbursement Report</p>
                  <p className="text-slate-500 tabular-nums">{reportData.filteredApps.length} loan files</p>
                </div>
                <button
                  type="button"
                  onClick={() => exportCsv('loan_disbursements', reportData.filteredApps as unknown as Record<string, unknown>[])}
                  className="crm-btn-secondary py-1.5 px-2.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Performance Table */}
      <div className="crm-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">Employee Performance Report</h3>
            <p className="text-xs text-slate-500">Full team call, conversion, and disbursement breakdown</p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv('employee_performance', reportData.employeeReport)}
            className="crm-btn-secondary"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-right">Assigned Leads</th>
                <th className="py-3 px-3 text-right">Calls</th>
                <th className="py-3 px-3 text-right">Interested</th>
                <th className="py-3 px-3 text-right">Applications</th>
                <th className="py-3 px-4 text-right">Disbursed Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {reportData.employeeReport.map((row) => (
                <tr key={row.Employee} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <EntityMonogram name={row.Employee} size="xs" />
                      <span>{row.Employee}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{row.Department}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{row['Assigned Leads']}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">{row['Total Calls']}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-medium">{row['Interested Calls']}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{row['Loan Applications']}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                    {formatCompactCurrency(row['Disbursed Volume'])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
