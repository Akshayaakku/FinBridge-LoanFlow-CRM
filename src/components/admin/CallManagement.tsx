import { zodResolver } from '@hookform/resolvers/zod';
import { PhoneCall, PhoneIncoming, PhoneOff, Plus, Search, ThumbsUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { recordCallLog } from '../../services/crmService';
import { formatDateTime, formatDuration, getDateKey, getTodayKey } from '../../lib/utils';
import { CALL_STATUSES, LEAD_STATUSES, callLogFormSchema } from '../../types/crm';
import { EntityMonogram, KpiCard, Modal, Pagination, StatusBadge } from '../ui/Primitives';

type CallFormValues = z.infer<typeof callLogFormSchema>;

export function CallManagement() {
  const { userProfile } = useAuth();
  const { callLogs, leads, employees, notify } = useCrmData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayKey = getTodayKey();
  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const stats = useMemo(() => {
    const todays = callLogs.filter((c) => getDateKey(c.callTime) === todayKey);
    const connected = todays.filter((c) =>
      ['Connected', 'Interested', 'Not Interested', 'Callback Requested'].includes(c.status)
    ).length;
    const notConnected = todays.filter((c) =>
      ['Not Connected', 'Busy', 'No Answer', 'Wrong Number'].includes(c.status)
    ).length;
    const interested = todays.filter((c) => c.status === 'Interested').length;
    return { totalToday: todays.length, connected, notConnected, interested };
  }, [callLogs, todayKey]);

  const employeeStats = useMemo(() => {
    return employees
      .filter((e) => e.role === 'staff')
      .map((emp) => {
        const empCalls = callLogs.filter((c) => c.employeeId === emp.id || c.employeeEmail === emp.email);
        const todayCount = empCalls.filter((c) => getDateKey(c.callTime) === todayKey).length;
        const connected = empCalls.filter((c) =>
          ['Connected', 'Interested', 'Not Interested', 'Callback Requested'].includes(c.status)
        ).length;
        const interested = empCalls.filter((c) => c.status === 'Interested').length;
        return { emp, total: empCalls.length, todayCount, connected, interested };
      })
      .sort((a, b) => b.total - a.total);
  }, [employees, callLogs, todayKey]);

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return callLogs
      .filter((c) => (statusFilter === 'ALL' ? true : c.status === statusFilter))
      .filter((c) => (employeeFilter === 'ALL' ? true : c.employeeId === employeeFilter))
      .filter((c) => {
        if (!q) return true;
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.leadCode.toLowerCase().includes(q) ||
          c.employeeName.toLowerCase().includes(q) ||
          (c.remarks || '').toLowerCase().includes(q)
        );
      });
  }, [callLogs, statusFilter, employeeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));
  const paginated = filteredCalls.slice((page - 1) * pageSize, page * pageSize);

  const { register, handleSubmit, reset } = useForm<CallFormValues>({
    resolver: zodResolver(callLogFormSchema) as never,
    defaultValues: {
      status: 'Connected',
      durationSeconds: 180,
    },
  });

  const onSubmit = async (values: CallFormValues) => {
    const lead = leads.find((l) => l.id === values.leadId);
    if (!lead) return;
    const emp =
      employees.find((e) => e.id === lead.assignedEmployeeId) ||
      employees.find((e) => e.email === actor.email) ||
      employees[0];
    if (!emp) return;

    setSaving(true);
    try {
      await recordCallLog(actor, lead, emp, {
        status: values.status,
        durationSeconds: values.durationSeconds,
        remarks: values.remarks,
        nextFollowUpDate: values.nextFollowUpDate || undefined,
        updateLeadStatus: values.updateLeadStatus || undefined,
      });
      notify('Call logged', `Recorded ${values.status} call for ${lead.customerName}.`);
      reset();
      setLogOpen(false);
    } catch (err) {
      notify('Failed to log call', err instanceof Error ? err.message : 'Unable to save call.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display text-slate-900">Call Operations &amp; Telemetry</h2>
          <p className="text-xs text-slate-500">Real-time outbound call volume and agent connection outcomes</p>
        </div>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="crm-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Customer Call
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Calls Today" value={stats.totalToday} icon={<PhoneCall className="w-4 h-4" />} tone="primary" />
        <KpiCard label="Connected Calls" value={stats.connected} icon={<PhoneIncoming className="w-4 h-4" />} tone="success" />
        <KpiCard label="Not Connected" value={stats.notConnected} icon={<PhoneOff className="w-4 h-4" />} tone="warning" />
        <KpiCard label="Interested Outcomes" value={stats.interested} icon={<ThumbsUp className="w-4 h-4" />} tone="success" />
      </div>

      {/* Employee-wise Call Stats */}
      <div className="crm-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/90">
          <h3 className="text-sm font-semibold font-display text-slate-900">Employee-Wise Call Statistics</h3>
        </div>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row sticky top-0">
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-right">Today</th>
                <th className="py-2.5 px-3 text-right">Daily Target</th>
                <th className="py-2.5 px-3 text-right">Total Calls</th>
                <th className="py-2.5 px-3 text-right">Connected</th>
                <th className="py-2.5 px-4 text-right">Interested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {employeeStats.map((row) => (
                <tr key={row.emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <EntityMonogram name={row.emp.fullName} size="xs" />
                      <span>{row.emp.fullName}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-slate-500">{row.emp.department}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-medium">{row.todayCount}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">{row.emp.dailyCallTarget}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold">{row.total}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-700">{row.connected}</td>
                  <td className="py-2 px-4 text-right tabular-nums font-semibold text-blue-700">{row.interested}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters & Call Logs Table */}
      <div className="crm-card overflow-hidden">
        <div className="p-4 border-b border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, lead ID, remarks..."
              className="crm-input-compact pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="crm-select-compact"
          >
            <option value="ALL">All Call Outcomes</option>
            {CALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setPage(1);
            }}
            className="crm-select-compact"
          >
            <option value="ALL">All Employees</option>
            {employees
              .filter((e) => e.role === 'staff')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-3 px-4">Customer / Lead</th>
                <th className="py-3 px-3">Agent</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3 text-right">Duration</th>
                <th className="py-3 px-3">Call Status</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginated.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <EntityMonogram name={c.customerName} size="xs" />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {c.customerName} <span className="font-mono text-slate-400">· {c.leadCode}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{c.customerPhone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">{c.employeeName}</td>
                  <td className="py-3 px-3 text-slate-600 tabular-nums whitespace-nowrap">{formatDateTime(c.callTime)}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">{formatDuration(c.durationSeconds)}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{c.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={filteredCalls.length} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* Log Call Modal */}
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Customer Call">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Lead *</label>
            <select {...register('leadId')} className="crm-select w-full">
              <option value="">Select a lead...</option>
              {leads
                .filter((l) => !l.isArchived)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customerName} ({l.leadCode}) — {l.phone}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Call Outcome *</label>
              <select {...register('status')} className="crm-select w-full">
                {CALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Duration (seconds) *</label>
              <input type="number" {...register('durationSeconds')} className="crm-input tabular-nums" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Update Lead Status</label>
              <select {...register('updateLeadStatus')} className="crm-select w-full">
                <option value="">Auto from call outcome</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Next Follow-Up Date</label>
              <input type="datetime-local" {...register('nextFollowUpDate')} className="crm-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Call Remarks</label>
            <textarea rows={3} {...register('remarks')} className="crm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLogOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Saving...' : 'Save Call Log'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
