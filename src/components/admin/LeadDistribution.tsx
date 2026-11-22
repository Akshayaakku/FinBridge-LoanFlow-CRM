import { GitBranch, RefreshCw, Search, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { assignLeadsToEmployee, roundRobinDistributeLeads } from '../../services/crmService';
import { formatCompactCurrency, formatDateTime } from '../../lib/utils';
import { EntityMonogram, StatusBadge } from '../ui/Primitives';

export function LeadDistribution() {
  const { userProfile } = useAuth();
  const { leads, employees, leadAssignments, notify } = useCrmData();

  const [viewMode, setViewMode] = useState<'unassigned' | 'assigned'>('unassigned');
  const [search, setSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [balanceWorkload, setBalanceWorkload] = useState(true);
  const [busy, setBusy] = useState(false);

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const activeStaff = useMemo(
    () => employees.filter((e) => e.role === 'staff' && e.status === 'active'),
    [employees]
  );

  const unassignedLeads = useMemo(
    () => leads.filter((l) => !l.isArchived && !l.assignedEmployeeId),
    [leads]
  );

  const assignedLeads = useMemo(
    () => leads.filter((l) => !l.isArchived && Boolean(l.assignedEmployeeId)),
    [leads]
  );

  const visibleLeads = useMemo(() => {
    const source = viewMode === 'unassigned' ? unassignedLeads : assignedLeads;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (l) =>
        l.customerName.toLowerCase().includes(q) ||
        l.leadCode.toLowerCase().includes(q) ||
        l.loanType.toLowerCase().includes(q) ||
        (l.assignedEmployeeName || '').toLowerCase().includes(q)
    );
  }, [viewMode, unassignedLeads, assignedLeads, search]);

  const workloadList = useMemo(() => {
    return activeStaff
      .map((emp) => {
        const count = assignedLeads.filter((l) => l.assignedEmployeeId === emp.id).length;
        const interestedCount = assignedLeads.filter(
          (l) => l.assignedEmployeeId === emp.id && ['Interested', 'Qualified', 'Converted'].includes(l.status)
        ).length;
        return { emp, count, interestedCount };
      })
      .sort((a, b) => a.count - b.count);
  }, [activeStaff, assignedLeads]);

  const maxLoad = Math.max(1, ...workloadList.map((w) => w.count));

  const handleManualOrBulkAssign = async () => {
    const targetEmp = activeStaff.find((e) => e.id === targetEmployeeId);
    if (!targetEmp || selectedLeadIds.length === 0) return;
    const selected = leads.filter((l) => selectedLeadIds.includes(l.id));
    setBusy(true);
    try {
      await assignLeadsToEmployee(
        actor,
        selected,
        targetEmp,
        selected.length > 1 ? 'bulk' : 'manual',
        viewMode === 'assigned' ? 'Admin workload reassignment' : 'Admin lead allocation'
      );
      notify('Leads assigned', `${selected.length} lead(s) assigned to ${targetEmp.fullName}.`);
      setSelectedLeadIds([]);
      setTargetEmployeeId('');
    } catch (err) {
      notify('Assignment failed', err instanceof Error ? err.message : 'Unable to assign.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRoundRobin = async () => {
    const pool =
      selectedLeadIds.length > 0
        ? unassignedLeads.filter((l) => selectedLeadIds.includes(l.id))
        : unassignedLeads;
    if (pool.length === 0) {
      notify('No unassigned leads', 'All active leads are currently assigned.', 'info');
      return;
    }
    setBusy(true);
    try {
      const count = await roundRobinDistributeLeads(actor, pool, activeStaff, leads, balanceWorkload);
      notify(
        'Round-robin complete',
        `Distributed ${count} leads across ${activeStaff.length} active employees.`
      );
      setSelectedLeadIds([]);
    } catch (err) {
      notify('Distribution failed', err instanceof Error ? err.message : 'Unable to distribute.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Auto-Distribution Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold font-display text-slate-900">Lead Distribution &amp; Workload Console</h2>
          <p className="text-xs text-slate-500">
            {unassignedLeads.length} unassigned leads waiting · {activeStaff.length} active call centre agents
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={balanceWorkload}
              onChange={(e) => setBalanceWorkload(e.target.checked)}
              className="rounded border-slate-300"
            />
            Balance by lowest workload
          </label>
          <button
            type="button"
            disabled={busy || unassignedLeads.length === 0}
            onClick={handleRoundRobin}
            className="crm-btn-primary px-4 py-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Auto Round-Robin ({selectedLeadIds.length > 0 && viewMode === 'unassigned' ? selectedLeadIds.length : unassignedLeads.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Lead Queue + Manual/Bulk Assignment */}
        <div className="lg:col-span-7 crm-card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="crm-segment">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('unassigned');
                    setSelectedLeadIds([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    viewMode === 'unassigned' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Unassigned ({unassignedLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('assigned');
                    setSelectedLeadIds([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    viewMode === 'assigned' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Reassign Existing ({assignedLeads.length})
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter queue..."
                  className="crm-input-compact pl-8"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="crm-select-compact flex-1 min-w-[200px]"
              >
                <option value="">Select target employee ({selectedLeadIds.length} selected)...</option>
                {workloadList.map(({ emp, count }) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} — {emp.department} ({count} leads)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !targetEmployeeId || selectedLeadIds.length === 0}
                onClick={handleManualOrBulkAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {viewMode === 'assigned' ? 'Reassign Selected' : 'Assign Selected'}
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[480px] divide-y divide-slate-100">
            {visibleLeads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No leads in this queue.
              </div>
            ) : (
              visibleLeads.slice(0, 60).map((lead) => {
                const checked = selectedLeadIds.includes(lead.id);
                return (
                  <label
                    key={lead.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                      checked ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedLeadIds((prev) =>
                            prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id]
                          )
                        }
                        className="rounded border-slate-300 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {lead.customerName}{' '}
                          <span className="font-mono text-slate-400">· {lead.leadCode}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {lead.loanType} · {formatCompactCurrency(lead.requiredLoanAmount)} · {lead.city}
                          {lead.assignedEmployeeName ? ` · Currently: ${lead.assignedEmployeeName}` : ''}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={lead.priority} />
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Employee Workload Capacity */}
        <div className="lg:col-span-5 crm-card overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold font-display text-slate-900">Employee Workload ({activeStaff.length} Staff)</h3>
              <p className="text-xs text-slate-500">Assigned leads per specialist</p>
            </div>
            <GitBranch className="w-4 h-4 text-slate-400" />
          </div>
          <div className="overflow-y-auto max-h-[540px] divide-y divide-slate-100">
            {workloadList.map(({ emp, count, interestedCount }) => {
              const pct = Math.round((count / maxLoad) * 100);
              return (
                <div key={emp.id} className="px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <EntityMonogram name={emp.fullName} size="xs" />
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-slate-900">{emp.fullName}</span>
                        <span className="text-slate-400 ml-1.5">· {emp.department}</span>
                      </div>
                    </div>
                    <span className="tabular-nums font-semibold text-slate-800 shrink-0">
                      {count} leads <span className="text-emerald-600 font-normal">({interestedCount} int.)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assignment Audit History */}
      <div className="crm-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-sm font-semibold font-display text-slate-900">Assignment &amp; Reassignment History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-2.5 px-4">Lead</th>
                <th className="py-2.5 px-3">From</th>
                <th className="py-2.5 px-3">Assigned To</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Assigned By</th>
                <th className="py-2.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {leadAssignments.slice(0, 15).map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    {a.customerName} <span className="font-mono text-slate-400">({a.leadCode})</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{a.fromEmployeeName || 'Unassigned Pool'}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{a.toEmployeeName}</td>
                  <td className="py-2.5 px-3 capitalize text-slate-600">{a.method.replace('_', ' ')}</td>
                  <td className="py-2.5 px-3 text-slate-600">{a.assignedByName}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-500">{formatDateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
