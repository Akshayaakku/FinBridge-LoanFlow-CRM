import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Eye, Plus, Search, Target, UserCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { createEmployee, setEmployeeDailyTarget, updateEmployee } from '../../services/crmService';
import { formatDate, formatDateTime, formatDuration, getDateKey, getTodayKey } from '../../lib/utils';
import { employeeFormSchema, type Employee } from '../../types/crm';
import { Drawer, EntityMonogram, Modal, StatusBadge } from '../ui/Primitives';

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export function EmployeeManagement() {
  const { userProfile } = useAuth();
  const { employees, leads, callLogs, applications, notify } = useCrmData();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [profileEmp, setProfileEmp] = useState<Employee | null>(null);
  const [targetEditEmp, setTargetEditEmp] = useState<Employee | null>(null);
  const [newTargetValue, setNewTargetValue] = useState<number>(45);
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

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => (deptFilter === 'ALL' ? true : e.department === deptFilter))
      .filter((e) => (statusFilter === 'ALL' ? true : e.status === statusFilter))
      .filter((e) => {
        if (!q) return true;
        return (
          e.fullName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
        );
      });
  }, [employees, deptFilter, statusFilter, search]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema) as never,
    defaultValues: {
      role: 'staff',
      department: 'Retail Loans',
      joiningDate: todayKey,
      status: 'active',
      dailyCallTarget: 45,
    },
  });

  const openCreate = () => {
    setEditingEmp(null);
    reset({
      fullName: '',
      email: '',
      phone: '',
      role: 'staff',
      department: 'Retail Loans',
      joiningDate: todayKey,
      status: 'active',
      dailyCallTarget: 45,
    });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
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
    setModalOpen(true);
  };

  const onSubmit = async (values: EmployeeFormValues) => {
    setSaving(true);
    try {
      if (editingEmp) {
        await updateEmployee(actor, editingEmp.id, values);
        notify('Employee updated', `${values.fullName} profile saved.`);
      } else {
        await createEmployee(actor, values);
        notify('Employee created', `${values.fullName} added to team directory.`);
      }
      setModalOpen(false);
    } catch (err) {
      notify('Save failed', err instanceof Error ? err.message : 'Unable to save employee.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (emp: Employee) => {
    const next = emp.status === 'active' ? 'inactive' : 'active';
    await updateEmployee(actor, emp.id, { status: next });
    notify('Account status updated', `${emp.fullName} is now ${next}.`);
  };

  const handleSaveTarget = async () => {
    if (!targetEditEmp) return;
    await setEmployeeDailyTarget(actor, targetEditEmp, newTargetValue, todayKey);
    notify('Daily target updated', `${targetEditEmp.fullName} target set to ${newTargetValue} calls/day.`);
    setTargetEditEmp(null);
  };

  const getEmpMetrics = (emp: Employee) => {
    const empLeads = leads.filter((l) => !l.isArchived && l.assignedEmployeeId === emp.id);
    const empCalls = callLogs.filter((c) => c.employeeId === emp.id || c.employeeEmail === emp.email);
    const callsToday = empCalls.filter((c) => getDateKey(c.callTime) === todayKey).length;
    const interested = empCalls.filter((c) => c.status === 'Interested').length;
    const apps = applications.filter((a) => a.employeeId === emp.id);
    return { empLeads, empCalls, callsToday, interested, apps };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display text-slate-900">Employee &amp; Target Directory</h2>
          <p className="text-xs text-slate-500">
            {employees.length} team members · Configure roles, account access, and daily call quotas
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="crm-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Employee
        </button>
      </div>

      {/* Filter Bar */}
      <div className="crm-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, email, department..."
            className="crm-input-compact pl-9"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="crm-select-compact"
        >
          <option value="ALL">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="crm-select-compact"
        >
          <option value="ALL">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Employee Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Department &amp; Role</th>
                <th className="py-3 px-3 text-right">Assigned Leads</th>
                <th className="py-3 px-3 text-right">Today / Target</th>
                <th className="py-3 px-3 text-right">Interested</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredEmployees.map((emp) => {
                const m = getEmpMetrics(emp);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/75">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{emp.employeeCode}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <EntityMonogram name={emp.fullName} />
                        <div>
                          <button
                            type="button"
                            onClick={() => setProfileEmp(emp)}
                            className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                          >
                            {emp.fullName}
                          </button>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {emp.email} · {emp.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-slate-800 font-medium">{emp.department}</p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {emp.role} · Joined {formatDate(emp.joiningDate)}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-slate-800">
                      {m.empLeads.length}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetEditEmp(emp);
                          setNewTargetValue(emp.dailyCallTarget);
                        }}
                        className="inline-flex flex-col items-end gap-1 font-medium text-slate-900 hover:text-blue-600"
                      >
                        <span className="inline-flex items-center gap-1">
                          {m.callsToday} / {emp.dailyCallTarget}
                          <Target className="w-3 h-3 text-slate-400" />
                        </span>
                        <span className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <span
                            className="block h-full bg-blue-600 rounded-full"
                            style={{
                              width: `${emp.dailyCallTarget > 0 ? Math.min(100, Math.round((m.callsToday / emp.dailyCallTarget) * 100)) : 0}%`,
                            }}
                          />
                        </span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium text-emerald-700">
                      {m.interested}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setProfileEmp(emp)}
                          title="View Profile & Performance"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          title="Edit Employee"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(emp)}
                          title={emp.status === 'active' ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                        >
                          {emp.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
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

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEmp ? `Edit ${editingEmp.fullName}` : 'Add New Employee'}
        subtitle="Configure team member profile, portal role, and daily call target."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input {...register('fullName')} className="crm-input" />
              {errors.fullName && <p className="text-xs text-rose-600 mt-1">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Work Email *</label>
              <input type="email" {...register('email')} className="crm-input" />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone *</label>
              <input {...register('phone')} className="crm-input" />
              {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department *</label>
              <input {...register('department')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
              <select {...register('role')} className="crm-select w-full">
                <option value="staff">Staff / Call Centre Agent</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Account Status *</label>
              <select {...register('status')} className="crm-select w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Joining Date *</label>
              <input type="date" {...register('joiningDate')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Daily Call Target *</label>
              <input type="number" {...register('dailyCallTarget')} className="crm-input tabular-nums" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="crm-btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="crm-btn-primary px-4 py-2 text-sm"
            >
              {saving ? 'Saving...' : editingEmp ? 'Save Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Daily Target Modal */}
      <Modal
        open={Boolean(targetEditEmp)}
        onClose={() => setTargetEditEmp(null)}
        title={`Daily Call Target · ${targetEditEmp?.fullName}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Calls per Day</label>
            <input
              type="number"
              min={1}
              max={500}
              value={newTargetValue}
              onChange={(e) => setNewTargetValue(Number(e.target.value))}
              className="crm-input tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTargetEditEmp(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleSaveTarget} className="crm-btn-primary">
              Update Target
            </button>
          </div>
        </div>
      </Modal>

      {/* Employee Profile Drawer */}
      <Drawer
        open={Boolean(profileEmp)}
        onClose={() => setProfileEmp(null)}
        title={profileEmp?.fullName || 'Employee Profile'}
        subtitle={profileEmp ? `${profileEmp.employeeCode} · ${profileEmp.department} · ${profileEmp.email}` : undefined}
      >
        {profileEmp && (() => {
          const m = getEmpMetrics(profileEmp);
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Assigned Leads</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums mt-1">{m.empLeads.length}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Today Calls</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums mt-1">
                    {m.callsToday} / {profileEmp.dailyCallTarget}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Interested</p>
                  <p className="text-lg font-semibold text-emerald-700 tabular-nums mt-1">{m.interested}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-slate-500">Loan Apps</p>
                  <p className="text-lg font-semibold text-blue-700 tabular-nums mt-1">{m.apps.length}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold font-display text-slate-800 mb-2">
                  Assigned Leads ({m.empLeads.length})
                </h4>
                <div className="border border-slate-200/90 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {m.empLeads.map((l) => (
                    <div key={l.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{l.customerName}</p>
                        <p className="text-[11px] text-slate-500">{l.loanType} · {l.phone}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold font-display text-slate-800 mb-2">
                  Recent Call Logs ({m.empCalls.length})
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {m.empCalls.slice(0, 10).map((c) => (
                    <div key={c.id} className="border border-slate-200 rounded-lg p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{c.customerName}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-slate-600 mt-1">{c.remarks}</p>
                      <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                        {formatDateTime(c.callTime)} · {formatDuration(c.durationSeconds)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
