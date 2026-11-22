import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Landmark, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { deleteBank, deleteLoanScheme, saveBank, saveLoanScheme } from '../../services/crmService';
import { formatCompactCurrency } from '../../lib/utils';
import { bankFormSchema, LOAN_TYPES, schemeFormSchema, type Bank, type LoanScheme } from '../../types/crm';
import { ConfirmDialog, Modal, StatusBadge } from '../ui/Primitives';

type BankFormValues = z.infer<typeof bankFormSchema>;
type SchemeFormValues = z.infer<typeof schemeFormSchema>;

export function BankSchemeManagement() {
  const { userProfile } = useAuth();
  const { banks, schemes, notify } = useCrmData();

  const [tab, setTab] = useState<'banks' | 'schemes'>('banks');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [deleteBankTarget, setDeleteBankTarget] = useState<Bank | null>(null);

  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<LoanScheme | null>(null);
  const [deleteSchemeTarget, setDeleteSchemeTarget] = useState<LoanScheme | null>(null);
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

  const bankForm = useForm<BankFormValues>({
    resolver: zodResolver(bankFormSchema) as never,
    defaultValues: { logoColor: '#0F4C81', status: 'active' },
  });

  const schemeForm = useForm<SchemeFormValues>({
    resolver: zodResolver(schemeFormSchema) as never,
    defaultValues: {
      loanType: 'Home Loan',
      minAmount: 500000,
      maxAmount: 50000000,
      interestRate: 8.75,
      minIncome: 30000,
      minCreditScore: 720,
      processingFee: '0.50%',
      tenureMonths: '60 - 360 months',
      status: 'active',
    },
  });

  const openBankModal = (bank?: Bank) => {
    setEditingBank(bank || null);
    bankForm.reset(
      bank
        ? {
            name: bank.name,
            shortCode: bank.shortCode,
            logoColor: bank.logoColor,
            contactPerson: bank.contactPerson,
            contactNumber: bank.contactNumber,
            email: bank.email,
            status: bank.status,
          }
        : {
            name: '',
            shortCode: '',
            logoColor: '#0F4C81',
            contactPerson: '',
            contactNumber: '',
            email: '',
            status: 'active',
          }
    );
    setBankModalOpen(true);
  };

  const openSchemeModal = (scheme?: LoanScheme) => {
    setEditingScheme(scheme || null);
    schemeForm.reset(
      scheme
        ? {
            bankId: scheme.bankId,
            schemeName: scheme.schemeName,
            loanType: scheme.loanType,
            minAmount: scheme.minAmount,
            maxAmount: scheme.maxAmount,
            interestRate: scheme.interestRate,
            minIncome: scheme.minIncome,
            minCreditScore: scheme.minCreditScore,
            processingFee: scheme.processingFee,
            tenureMonths: scheme.tenureMonths,
            description: scheme.description || '',
            status: scheme.status,
          }
        : {
            bankId: banks[0]?.id || '',
            schemeName: '',
            loanType: 'Home Loan',
            minAmount: 500000,
            maxAmount: 50000000,
            interestRate: 8.75,
            minIncome: 30000,
            minCreditScore: 720,
            processingFee: '0.50%',
            tenureMonths: '60 - 360 months',
            description: '',
            status: 'active',
          }
    );
    setSchemeModalOpen(true);
  };

  const onSaveBank = async (values: BankFormValues) => {
    setSaving(true);
    try {
      await saveBank(actor, values, editingBank?.id);
      notify(editingBank ? 'Bank updated' : 'Bank added', `${values.name} saved.`);
      setBankModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const onSaveScheme = async (values: SchemeFormValues) => {
    const bank = banks.find((b) => b.id === values.bankId);
    if (!bank) return;
    setSaving(true);
    try {
      await saveLoanScheme(actor, { ...values, bankName: bank.name }, editingScheme?.id);
      notify(editingScheme ? 'Scheme updated' : 'Scheme created', `${values.schemeName} saved.`);
      setSchemeModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            Banking Partners &amp; Loan Schemes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {banks.length} partner banks · {schemes.length} active &amp; archived loan products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openBankModal()}
            className="crm-btn-secondary"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Bank
          </button>
          <button
            type="button"
            onClick={() => openSchemeModal()}
            className="crm-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Loan Scheme
          </button>
        </div>
      </div>

      <div className="crm-segment">
        <button
          type="button"
          onClick={() => setTab('banks')}
          className={`px-4 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap ${
            tab === 'banks' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          Partner Banks ({banks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('schemes')}
          className={`px-4 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap ${
            tab === 'schemes' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          Loan Schemes ({schemes.length})
        </button>
      </div>

      {tab === 'banks' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((bank) => {
            const bankSchemes = schemes.filter((s) => s.bankId === bank.id);
            return (
              <div
                key={bank.id}
                className="crm-card p-5 space-y-4 hover:shadow-md hover:border-slate-300/80 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg text-white font-display font-bold text-xs flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: bank.logoColor }}
                    >
                      {bank.shortCode.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{bank.name}</h3>
                      <p className="text-xs text-slate-500">{bankSchemes.length} loan schemes</p>
                    </div>
                  </div>
                  <StatusBadge status={bank.status} />
                </div>

                <div className="text-xs space-y-1.5 text-slate-600 pt-2.5 border-t border-slate-100">
                  <p>
                    <span className="text-slate-400">SPOC:</span>{' '}
                    <span className="font-medium text-slate-800">{bank.contactPerson}</span>
                  </p>
                  <p className="tabular-nums">
                    <span className="text-slate-400">Phone:</span> {bank.contactNumber}
                  </p>
                  <p className="truncate">
                    <span className="text-slate-400">Email:</span> {bank.email}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => openBankModal(bank)}
                    className="crm-btn-secondary py-1.5 px-2.5 text-xs"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteBankTarget(bank)}
                    className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Bank"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="crm-th-row">
                  <th className="py-3 px-4">Scheme &amp; Bank</th>
                  <th className="py-3 px-3">Loan Type</th>
                  <th className="py-3 px-3 text-right">Amount Range</th>
                  <th className="py-3 px-3 text-right">Rate (p.a.)</th>
                  <th className="py-3 px-3 text-right">Min Income / Score</th>
                  <th className="py-3 px-3">Tenure &amp; Fee</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {schemes.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{s.schemeName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Landmark className="w-3 h-3" /> {s.bankName}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{s.loanType}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {formatCompactCurrency(s.minAmount)} – {formatCompactCurrency(s.maxAmount)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-blue-700">
                      {s.interestRate}%
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                      {formatCompactCurrency(s.minIncome)}/mo
                      {s.minCreditScore ? ` · ${s.minCreditScore}+` : ''}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <p>{s.tenureMonths}</p>
                      <p className="text-[11px] text-slate-400">Fee: {s.processingFee}</p>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openSchemeModal(s)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSchemeTarget(s)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      <Modal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        title={editingBank ? `Edit ${editingBank.name}` : 'Add Partner Bank'}
      >
        <form onSubmit={bankForm.handleSubmit(onSaveBank)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name *</label>
              <input {...bankForm.register('name')} className="crm-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Short Code *</label>
                <input {...bankForm.register('shortCode')} className="crm-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Brand Color</label>
                <input type="color" {...bankForm.register('logoColor')} className="w-full h-9 p-1 border border-slate-200 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person *</label>
              <input {...bankForm.register('contactPerson')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Number *</label>
              <input {...bankForm.register('contactNumber')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Partner Email *</label>
              <input type="email" {...bankForm.register('email')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status *</label>
              <select {...bankForm.register('status')} className="crm-select w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBankModalOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Saving...' : 'Save Bank'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Loan Scheme Modal */}
      <Modal
        open={schemeModalOpen}
        onClose={() => setSchemeModalOpen(false)}
        title={editingScheme ? `Edit ${editingScheme.schemeName}` : 'Add Loan Scheme'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={schemeForm.handleSubmit(onSaveScheme)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Associated Bank *</label>
              <select {...schemeForm.register('bankId')} className="crm-select w-full">
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Scheme Name *</label>
              <input {...schemeForm.register('schemeName')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loan Type *</label>
              <select {...schemeForm.register('loanType')} className="crm-select w-full">
                {LOAN_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {lt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Interest Rate (% p.a.) *</label>
              <input type="number" step="0.05" {...schemeForm.register('interestRate')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Min Loan Amount (₹) *</label>
              <input type="number" {...schemeForm.register('minAmount')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Max Loan Amount (₹) *</label>
              <input type="number" {...schemeForm.register('maxAmount')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Min Monthly Income (₹) *</label>
              <input type="number" {...schemeForm.register('minIncome')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Min Credit Score</label>
              <input type="number" {...schemeForm.register('minCreditScore')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Processing Fee *</label>
              <input {...schemeForm.register('processingFee')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tenure *</label>
              <input {...schemeForm.register('tenureMonths')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status *</label>
              <select {...schemeForm.register('status')} className="crm-select w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={2} {...schemeForm.register('description')} className="crm-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSchemeModalOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Saving...' : 'Save Scheme'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteBankTarget)}
        onClose={() => setDeleteBankTarget(null)}
        onConfirm={async () => {
          if (!deleteBankTarget) return;
          await deleteBank(actor, deleteBankTarget);
          notify('Bank removed', `${deleteBankTarget.name} deleted.`);
          setDeleteBankTarget(null);
        }}
        title="Remove Partner Bank?"
        message={`Delete ${deleteBankTarget?.name}? Existing loan applications retain historical bank names.`}
        confirmLabel="Remove Bank"
        danger
      />

      <ConfirmDialog
        open={Boolean(deleteSchemeTarget)}
        onClose={() => setDeleteSchemeTarget(null)}
        onConfirm={async () => {
          if (!deleteSchemeTarget) return;
          await deleteLoanScheme(actor, deleteSchemeTarget);
          notify('Scheme deleted', `${deleteSchemeTarget.schemeName} removed.`);
          setDeleteSchemeTarget(null);
        }}
        title="Delete Loan Scheme?"
        message={`Delete ${deleteSchemeTarget?.schemeName}?`}
        confirmLabel="Delete Scheme"
        danger
      />
    </div>
  );
}
