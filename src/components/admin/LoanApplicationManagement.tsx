import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, Clock, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { createLoanApplication, updateLoanApplicationStatus } from '../../services/crmService';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import {
  LOAN_APPLICATION_STATUSES,
  loanApplicationFormSchema,
  type LoanApplication,
  type LoanApplicationStatus,
} from '../../types/crm';
import { Drawer, EntityMonogram, Modal, StatusBadge } from '../ui/Primitives';

type AppFormValues = z.infer<typeof loanApplicationFormSchema>;

export function LoanApplicationManagement() {
  const { userProfile } = useAuth();
  const { applications, leads, employees, banks, schemes, statusHistory, notify } = useCrmData();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [statusModalApp, setStatusModalApp] = useState<LoanApplication | null>(null);
  const [timelineApp, setTimelineApp] = useState<LoanApplication | null>(null);

  const [nextStatus, setNextStatus] = useState<LoanApplicationStatus>('Under Bank Review');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [disbursedAmt, setDisbursedAmt] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications
      .filter((a) => (stageFilter === 'ALL' ? true : a.status === stageFilter))
      .filter((a) => {
        if (!q) return true;
        return (
          a.customerName.toLowerCase().includes(q) ||
          a.applicationCode.toLowerCase().includes(q) ||
          a.bankName.toLowerCase().includes(q) ||
          (a.bankReferenceNumber || '').toLowerCase().includes(q)
        );
      });
  }, [applications, stageFilter, search]);

  const { register, handleSubmit, watch, reset } = useForm<AppFormValues>({
    resolver: zodResolver(loanApplicationFormSchema) as never,
    defaultValues: {
      bankId: banks[0]?.id || '',
      loanAmount: 1500000,
    },
  });

  const watchedBankId = watch('bankId');
  const availableSchemes = useMemo(
    () => schemes.filter((s) => s.bankId === watchedBankId && s.status === 'active'),
    [schemes, watchedBankId]
  );

  const onCreateApp = async (values: AppFormValues) => {
    const lead = leads.find((l) => l.id === values.leadId);
    const bank = banks.find((b) => b.id === values.bankId);
    const scheme = schemes.find((s) => s.id === values.schemeId);
    if (!lead || !bank || !scheme) return;
    const emp =
      employees.find((e) => e.id === lead.assignedEmployeeId) ||
      employees.find((e) => e.role === 'staff') ||
      employees[0];
    if (!emp) return;

    setSaving(true);
    try {
      await createLoanApplication(actor, lead, emp, bank, scheme, {
        loanAmount: values.loanAmount,
        bankReferenceNumber: values.bankReferenceNumber,
        remarks: values.remarks,
      });
      notify('Application created', `Submitted ${lead.customerName} to ${bank.name}.`);
      reset();
      setCreateOpen(false);
    } catch (err) {
      notify('Failed to create', err instanceof Error ? err.message : 'Unable to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (app: LoanApplication) => {
    setStatusModalApp(app);
    setNextStatus(app.status);
    setStatusRemarks(app.remarks || '');
    setBankRef(app.bankReferenceNumber || '');
    setDisbursedAmt(app.disbursedAmount || app.loanAmount);
  };

  const handleStatusUpdate = async () => {
    if (!statusModalApp) return;
    setSaving(true);
    try {
      await updateLoanApplicationStatus(
        actor,
        statusModalApp,
        nextStatus,
        statusRemarks,
        bankRef,
        nextStatus === 'Disbursed' ? disbursedAmt : undefined
      );
      notify('Application updated', `${statusModalApp.applicationCode} moved to ${nextStatus}.`);
      setStatusModalApp(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            Loan Application &amp; Disbursement Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {applications.length} applications across 9 bank underwriting &amp; disbursement stages
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="crm-btn-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          New Loan Application
        </button>
      </div>

      {/* Filters */}
      <div className="crm-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search application ID, customer, bank, reference..."
            className="crm-input-compact pl-9"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="crm-select-compact"
        >
          <option value="ALL">All 9 Stages</option>
          {LOAN_APPLICATION_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Applications Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-3 px-4">Application ID</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Bank &amp; Scheme</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Agent</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-3">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <p className="font-mono font-semibold text-slate-900">{app.applicationCode}</p>
                    <p className="text-[11px] font-mono text-slate-400">{app.bankReferenceNumber || 'Pending Ref'}</p>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <EntityMonogram name={app.customerName} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{app.customerName}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{app.leadCode} · {app.customerPhone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-slate-800">{app.bankName}</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{app.schemeName}</p>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    <p className="font-semibold text-slate-900">{formatCompactCurrency(app.loanAmount)}</p>
                    {app.status === 'Disbursed' && app.disbursedAmount && (
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Disb: {formatCompactCurrency(app.disbursedAmount)}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{app.employeeName}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="py-3 px-3 tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDate(app.updatedAt)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTimelineApp(app)}
                        className="crm-btn-secondary py-1.5 px-2.5 text-xs"
                      >
                        <Clock className="w-3 h-3" />
                        Timeline
                      </button>
                      <button
                        type="button"
                        onClick={() => openStatusModal(app)}
                        className="crm-btn-primary py-1.5 px-2.5 text-xs"
                      >
                        Update Stage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Application Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Loan Application">
        <form onSubmit={handleSubmit(onCreateApp)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Lead *</label>
            <select {...register('leadId')} className="crm-select w-full">
              <option value="">Select customer...</option>
              {leads
                .filter((l) => !l.isArchived)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customerName} ({l.leadCode}) — {l.loanType}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Partner Bank *</label>
              <select {...register('bankId')} className="crm-select w-full">
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loan Scheme *</label>
              <select {...register('schemeId')} className="crm-select w-full">
                <option value="">Select scheme...</option>
                {availableSchemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.schemeName} ({s.interestRate}%)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loan Amount (₹) *</label>
              <input type="number" {...register('loanAmount')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bank Reference No.</label>
              <input {...register('bankReferenceNumber')} placeholder="Auto-generated if blank" className="crm-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea rows={2} {...register('remarks')} className="crm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Submitting...' : 'Create Application'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Stage / Disbursement Modal */}
      <Modal
        open={Boolean(statusModalApp)}
        onClose={() => setStatusModalApp(null)}
        title={`Update Stage · ${statusModalApp?.applicationCode}`}
        subtitle={statusModalApp ? `${statusModalApp.customerName} · ${statusModalApp.bankName}` : undefined}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Application Stage *</label>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as LoanApplicationStatus)}
              className="crm-select w-full"
            >
              {LOAN_APPLICATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bank Reference Number</label>
            <input
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              className="crm-input font-mono"
            />
          </div>

          {nextStatus === 'Disbursed' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Disbursed Amount (₹) *</label>
              <input
                type="number"
                value={disbursedAmt}
                onChange={(e) => setDisbursedAmt(Number(e.target.value))}
                className="crm-input tabular-nums"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bank / Underwriting Remarks</label>
            <textarea
              rows={3}
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              className="crm-input"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStatusModalApp(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={handleStatusUpdate} disabled={saving} className="crm-btn-primary">
              {saving ? 'Updating...' : 'Save Stage Update'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Application Timeline Drawer */}
      <Drawer
        open={Boolean(timelineApp)}
        onClose={() => setTimelineApp(null)}
        title={timelineApp ? `${timelineApp.applicationCode} · ${timelineApp.customerName}` : 'Timeline'}
        subtitle={timelineApp ? `${timelineApp.bankName} · ${timelineApp.schemeName}` : undefined}
      >
        {timelineApp && (
          <div className="space-y-6">
            <div className="pb-5 border-b border-slate-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Current Stage</p>
                <div className="mt-1.5">
                  <StatusBadge status={timelineApp.status} />
                </div>
              </div>
              <div>
                <p className="text-slate-500">Sanctioned / Requested</p>
                <p className="font-semibold text-slate-900 mt-1 tabular-nums">{formatCurrency(timelineApp.loanAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Bank Reference</p>
                <p className="font-mono text-slate-800 mt-1">{timelineApp.bankReferenceNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Disbursed Amount</p>
                <p className="font-semibold text-emerald-700 mt-1 tabular-nums">
                  {timelineApp.disbursedAmount ? formatCurrency(timelineApp.disbursedAmount) : 'Pending'}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-slate-800 mb-3">
                Underwriting Status History
              </h4>
              <div className="divide-y divide-slate-100">
                {statusHistory
                  .filter((h) => h.applicationId === timelineApp.id)
                  .map((h) => (
                    <div key={h.id} className="py-3 first:pt-0 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {h.fromStatus && (
                            <>
                              <StatusBadge status={h.fromStatus} />
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            </>
                          )}
                          <StatusBadge status={h.toStatus} />
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(h.createdAt)}</span>
                      </div>
                      <p className="text-slate-700">{h.remarks || 'Stage transition recorded.'}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Updated by {h.changedByName}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
