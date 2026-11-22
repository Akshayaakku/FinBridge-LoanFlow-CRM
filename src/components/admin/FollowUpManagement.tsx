import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, CheckCircle2, Plus, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { completeFollowUp, createFollowUp, reassignFollowUp } from '../../services/crmService';
import { formatDateTime, getDateKey, getTodayKey } from '../../lib/utils';
import { followUpFormSchema, type FollowUp } from '../../types/crm';
import { EmptyState, EntityMonogram, Modal, StatusBadge } from '../ui/Primitives';

type FollowUpFormValues = z.infer<typeof followUpFormSchema>;

export function FollowUpManagement() {
  const { userProfile } = useAuth();
  const { followUps, leads, employees, notify } = useCrmData();

  const [bucket, setBucket] = useState<'overdue' | 'today' | 'upcoming' | 'completed'>('today');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completingItem, setCompletingItem] = useState<FollowUp | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [reassignItem, setReassignItem] = useState<FollowUp | null>(null);
  const [reassignEmpId, setReassignEmpId] = useState('');
  const [saving, setSaving] = useState(false);

  const todayKey = getTodayKey();
  const nowMs = Date.now();

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const categorized = useMemo(() => {
    const overdue: FollowUp[] = [];
    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];
    const completed: FollowUp[] = [];

    for (const f of followUps) {
      if (f.status === 'completed') {
        completed.push(f);
        continue;
      }
      if (f.status === 'cancelled') continue;
      const dKey = getDateKey(f.scheduledAt);
      const tMs = new Date(f.scheduledAt).getTime();
      if (dKey === todayKey) {
        today.push(f);
      } else if (tMs < nowMs) {
        overdue.push(f);
      } else {
        upcoming.push(f);
      }
    }

    return { overdue, today, upcoming, completed };
  }, [followUps, todayKey, nowMs]);

  const currentList = categorized[bucket];

  const { register, handleSubmit, reset } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpFormSchema) as never,
  });

  const onSchedule = async (values: FollowUpFormValues) => {
    const lead = leads.find((l) => l.id === values.leadId);
    const emp = employees.find((e) => e.id === values.employeeId);
    if (!lead || !emp) return;
    setSaving(true);
    try {
      await createFollowUp(actor, lead, emp, values.scheduledAt, values.notes);
      notify('Follow-up scheduled', `Scheduled callback for ${lead.customerName}.`);
      reset();
      setScheduleOpen(false);
    } catch (err) {
      notify('Error', err instanceof Error ? err.message : 'Unable to schedule.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completingItem) return;
    setSaving(true);
    try {
      await completeFollowUp(actor, completingItem, outcomeNotes || 'Follow-up call completed.');
      notify('Follow-up completed', `${completingItem.customerName} marked done.`);
      setCompletingItem(null);
      setOutcomeNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignItem || !reassignEmpId) return;
    const emp = employees.find((e) => e.id === reassignEmpId);
    if (!emp) return;
    await reassignFollowUp(actor, reassignItem, emp);
    notify('Follow-up reassigned', `Assigned to ${emp.fullName}.`);
    setReassignItem(null);
    setReassignEmpId('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display text-slate-900">Follow-up Queue &amp; Callbacks</h2>
          <p className="text-xs text-slate-500">
            Track overdue, today&apos;s, and upcoming customer callbacks across the team
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="crm-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule Follow-up
        </button>
      </div>

      {/* Bucket Tabs */}
      <div className="crm-segment">
        {(
          [
            { id: 'overdue', label: `Overdue (${categorized.overdue.length})` },
            { id: 'today', label: `Today (${categorized.today.length})` },
            { id: 'upcoming', label: `Upcoming (${categorized.upcoming.length})` },
            { id: 'completed', label: `Completed (${categorized.completed.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBucket(tab.id)}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap ${
              bucket === tab.id ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 font-medium hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-5 h-5" />}
          title={`No ${bucket} follow-ups`}
          description="Follow-ups scheduled from call logs or manually will appear here."
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="crm-th-row">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-3">Assigned Agent</th>
                  <th className="py-3 px-3">Scheduled Time</th>
                  <th className="py-3 px-3">Notes / Outcome</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentList.map((f) => {
                  const isOverdue = f.status === 'pending' && new Date(f.scheduledAt).getTime() < nowMs && getDateKey(f.scheduledAt) !== todayKey;
                  return (
                    <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <EntityMonogram name={f.customerName} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {f.customerName} <span className="font-mono font-normal text-slate-400">· {f.leadCode}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">{f.customerPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">{f.employeeName}</td>
                      <td
                        className={`py-3 px-3 tabular-nums whitespace-nowrap ${
                          isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {formatDateTime(f.scheduledAt)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {f.status === 'completed' ? f.outcomeNotes || f.notes : f.notes || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {f.status === 'pending' && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReassignItem(f);
                                setReassignEmpId(f.employeeId);
                              }}
                              className="crm-btn-secondary py-1.5 px-2.5 text-xs"
                            >
                              <UserCheck className="w-3 h-3" />
                              Reassign
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompletingItem(f)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Complete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Follow-Up Call">
        <form onSubmit={handleSubmit(onSchedule)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lead *</label>
            <select {...register('leadId')} className="crm-select w-full">
              <option value="">Select customer...</option>
              {leads
                .filter((l) => !l.isArchived)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customerName} ({l.leadCode})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assign Employee *</label>
            <select {...register('employeeId')} className="crm-select w-full">
              <option value="">Select specialist...</option>
              {employees
                .filter((e) => e.role === 'staff' && e.status === 'active')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.department})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date &amp; Time *</label>
            <input type="datetime-local" {...register('scheduledAt')} className="crm-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea rows={3} {...register('notes')} className="crm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setScheduleOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Modal */}
      <Modal
        open={Boolean(completingItem)}
        onClose={() => setCompletingItem(null)}
        title={`Complete Follow-Up · ${completingItem?.customerName}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Outcome Notes</label>
            <textarea
              rows={3}
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="Summarize customer response and next action..."
              className="crm-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCompletingItem(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              Mark Completed
            </button>
          </div>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal
        open={Boolean(reassignItem)}
        onClose={() => setReassignItem(null)}
        title={`Reassign Follow-Up · ${reassignItem?.customerName}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <select
            value={reassignEmpId}
            onChange={(e) => setReassignEmpId(e.target.value)}
            className="crm-select w-full"
          >
            {employees
              .filter((e) => e.role === 'staff' && e.status === 'active')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.department})
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReassignItem(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleReassign} className="crm-btn-primary">
              Save Reassignment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
