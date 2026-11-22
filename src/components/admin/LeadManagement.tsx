import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ArrowUpDown,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import {
  archiveLead,
  assignLeadsToEmployee,
  bulkImportLeads,
  createLead,
  deleteLeadPermanent,
  exportLeadsFile,
  parseLeadsImportFile,
  scoreLeadsWithAI,
  updateDuplicateRule,
  updateLead,
  type ParsedImportRow,
} from '../../services/crmService';
import { resolveEffectiveLeadScore, type ComputedLeadScore } from '../../lib/leadScoring';
import { downloadTextFile, formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatDuration, getDateKey } from '../../lib/utils';
import {
  EMPLOYMENT_TYPES,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LOAN_TYPES,
  leadFormSchema,
  type DuplicateRule,
  type Lead,
} from '../../types/crm';
import { LeadScoreBadge, LeadScoreBreakdownCard } from '../ui/LeadScoreBadge';
import { ConfirmDialog, Drawer, EmptyState, EntityMonogram, Modal, Pagination, StatusBadge } from '../ui/Primitives';

type LeadFormValues = z.infer<typeof leadFormSchema>;
type SortField = 'customerName' | 'requiredLoanAmount' | 'status' | 'priority' | 'leadDate' | 'leadScore';

export function LeadManagement({ initialSearch = '' }: { initialSearch?: string }) {
  const { userProfile } = useAuth();
  const { leads, employees, banks, callLogs, followUps, documents, applications, settings, notify } = useCrmData();

  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [scoreTierFilter, setScoreTierFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [aiScoringBusy, setAiScoringBusy] = useState(false);

  const [sortField, setSortField] = useState<SortField>('leadScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEmpId, setBulkEmpId] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

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

  const leadScoreMap = useMemo(() => {
    const map = new Map<string, ComputedLeadScore>();
    leads.forEach((lead) => {
      map.set(lead.id, resolveEffectiveLeadScore(lead, callLogs, followUps, documents));
    });
    return map;
  }, [leads, callLogs, followUps, documents]);

  const activeDetailLead = useMemo(
    () => (detailLead ? leads.find((l) => l.id === detailLead.id) || detailLead : null),
    [detailLead, leads]
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => Boolean(l.isArchived) === showArchived)
      .filter((l) => {
        if (!q) return true;
        return (
          l.customerName.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.leadCode.toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q)
        );
      })
      .filter((l) => (statusFilter === 'ALL' ? true : l.status === statusFilter))
      .filter((l) => {
        if (employeeFilter === 'ALL') return true;
        if (employeeFilter === 'UNASSIGNED') return !l.assignedEmployeeId;
        return l.assignedEmployeeId === employeeFilter;
      })
      .filter((l) => (loanTypeFilter === 'ALL' ? true : l.loanType === loanTypeFilter))
      .filter((l) => (priorityFilter === 'ALL' ? true : l.priority === priorityFilter))
      .filter((l) => {
        if (scoreTierFilter === 'ALL') return true;
        return leadScoreMap.get(l.id)?.scoreTier === scoreTierFilter;
      })
      .filter((l) => (!dateFilter ? true : getDateKey(l.leadDate || l.createdAt) === dateFilter))
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'leadScore') {
          cmp = (leadScoreMap.get(a.id)?.leadScore || 0) - (leadScoreMap.get(b.id)?.leadScore || 0);
        } else if (sortField === 'requiredLoanAmount') {
          cmp = a.requiredLoanAmount - b.requiredLoanAmount;
        } else if (sortField === 'leadDate') {
          cmp = String(a.leadDate || a.createdAt).localeCompare(String(b.leadDate || b.createdAt));
        } else {
          cmp = String(a[sortField]).localeCompare(String(b[sortField]));
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [leads, showArchived, search, statusFilter, employeeFilter, loanTypeFilter, priorityFilter, scoreTierFilter, dateFilter, sortField, sortAsc, leadScoreMap]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = filteredLeads.slice((page - 1) * pageSize, page * pageSize);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as never,
    defaultValues: {
      employmentType: 'Salaried',
      loanType: 'Home Loan',
      status: 'New',
      priority: 'Medium',
      leadSource: 'Website Inquiry',
      monthlyIncome: 50000,
      requiredLoanAmount: 1500000,
    },
  });

  const openCreateModal = () => {
    setEditingLead(null);
    reset({
      customerName: '',
      phone: '',
      email: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      employmentType: 'Salaried',
      monthlyIncome: 50000,
      requiredLoanAmount: 1500000,
      loanType: 'Home Loan',
      preferredBank: '',
      leadSource: 'Website Inquiry',
      assignedEmployeeId: '',
      status: 'New',
      priority: 'Medium',
      remarks: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (lead: Lead) => {
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

  const onSubmitLead = async (values: LeadFormValues) => {
    setSaving(true);
    try {
      if (editingLead) {
        await updateLead(actor, editingLead.id, values, employees);
        notify('Lead updated', `${values.customerName} (${editingLead.leadCode}) saved.`);
      } else {
        await createLead(
          actor,
          {
            ...values,
            email: values.email || undefined,
            preferredBank: values.preferredBank || undefined,
            assignedEmployeeId: values.assignedEmployeeId || undefined,
            remarks: values.remarks || undefined,
          },
          employees,
          leads,
          settings.duplicateRule
        );
        notify('Lead created', `${values.customerName} added to pipeline.`);
      }
      setFormOpen(false);
    } catch (err) {
      notify('Could not save lead', err instanceof Error ? err.message : 'Check form inputs.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc((s) => !s);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedLeads.map((l) => l.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkAssign = async () => {
    const emp = employees.find((e) => e.id === bulkEmpId);
    if (!emp || selectedIds.length === 0) return;
    const targets = leads.filter((l) => selectedIds.includes(l.id));
    try {
      await assignLeadsToEmployee(actor, targets, emp, 'bulk', 'Bulk assignment from Lead Management');
      notify('Bulk assignment complete', `${targets.length} leads assigned to ${emp.fullName}.`);
      setSelectedIds([]);
      setBulkEmpId('');
    } catch (err) {
      notify('Assignment failed', err instanceof Error ? err.message : 'Unable to assign leads.', 'error');
    }
  };

  const handleFileParse = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const parsed = await parseLeadsImportFile(file);
      if (parsed.length === 0) {
        setImportError('No valid lead rows found. Ensure Customer Name and Phone columns exist.');
      }
      setImportRows(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to parse file.');
    }
  };

  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const result = await bulkImportLeads(actor, importRows, leads, settings.duplicateRule);
      notify(
        'Import completed',
        `Imported ${result.imported} leads (${result.skippedDuplicates} duplicates skipped).`
      );
      setImportRows([]);
      setImportOpen(false);
    } catch (err) {
      notify('Import failed', err instanceof Error ? err.message : 'Error importing leads.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csv =
      'Customer Name,Phone Number,Email,City,State,Employment Type,Monthly Income,Required Loan Amount,Loan Type,Preferred Bank,Lead Source,Priority,Remarks\n' +
      'Aarav Kulkarni,+91 98000-77101,aarav.sample@example.test,Pune,Maharashtra,Salaried,85000,3200000,Home Loan,HDFC Bank,Website Inquiry,High,Pre-approved inquiry\n' +
      'Nisha Verma,+91 98000-77102,nisha.sample@example.test,Bengaluru,Karnataka,Self-Employed,120000,1500000,Business Loan,ICICI Bank,Partner Referral,Medium,Needs GST docs';
    downloadTextFile(csv, 'finbridge_lead_import_template.csv');
  };

  const handleRunAiScoring = async (targets: Lead[]) => {
    if (targets.length === 0) return;
    setAiScoringBusy(true);
    try {
      const results = await scoreLeadsWithAI(actor, targets, callLogs, followUps, documents);
      const hotCount = results.filter((r) => r.scoreTier === 'Hot').length;
      notify(
        'Gemini AI scoring complete',
        `Scored ${results.length} lead(s) (${hotCount} Hot priority detected).`
      );
    } catch (err) {
      notify(
        'AI scoring error',
        err instanceof Error ? err.message : 'Unable to score leads with Gemini AI.',
        'error'
      );
    } finally {
      setAiScoringBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display text-slate-900">Lead Pipeline</h2>
          <p className="text-xs text-slate-500">
            {filteredLeads.length} {showArchived ? 'archived' : 'active'} leads · Duplicate policy:{' '}
            <span className="font-medium text-slate-700">{settings.duplicateRule.replace(/_/g, ' ')}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={aiScoringBusy || filteredLeads.length === 0}
            onClick={() =>
              void handleRunAiScoring(
                selectedIds.length > 0
                  ? leads.filter((l) => selectedIds.includes(l.id))
                  : paginatedLeads.slice(0, 10)
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50/90 text-blue-700 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiScoringBusy
              ? 'Scoring...'
              : selectedIds.length > 0
              ? `AI Score Selected (${Math.min(15, selectedIds.length)})`
              : 'AI Score Visible'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="crm-btn-secondary"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV/Excel
          </button>
          <button
            type="button"
            onClick={() => exportLeadsFile(filteredLeads, 'csv')}
            className="crm-btn-secondary"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportLeadsFile(filteredLeads, 'xlsx')}
            className="crm-btn-secondary"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="crm-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            New Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="crm-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, phone, lead ID, city..."
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
            <option value="ALL">All Statuses</option>
            {LEAD_STATUSES.map((s) => (
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
            <option value="UNASSIGNED">Unassigned</option>
            {employees
              .filter((e) => e.role === 'staff')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
          </select>
          <select
            value={loanTypeFilter}
            onChange={(e) => {
              setLoanTypeFilter(e.target.value);
              setPage(1);
            }}
            className="crm-select-compact"
          >
            <option value="ALL">All Loan Types</option>
            {LOAN_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="crm-select-compact"
          >
            <option value="ALL">All Priorities</option>
            {LEAD_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span>AI Score Tier:</span>
              <select
                value={scoreTierFilter}
                onChange={(e) => {
                  setScoreTierFilter(e.target.value);
                  setPage(1);
                }}
                className="crm-select-compact py-1"
              >
                <option value="ALL">All Scores</option>
                <option value="Hot">Hot (75–100)</option>
                <option value="Warm">Warm (45–74)</option>
                <option value="Cold">Cold (0–44)</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span>Created Date:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
                className="crm-input-compact w-auto py-1"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setPage(1);
                  setSelectedIds([]);
                }}
                className="rounded border-slate-300"
              />
              Show Archived Leads
            </label>
          </div>

          {(search || statusFilter !== 'ALL' || employeeFilter !== 'ALL' || loanTypeFilter !== 'ALL' || priorityFilter !== 'ALL' || scoreTierFilter !== 'ALL' || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setEmployeeFilter('ALL');
                setLoanTypeFilter('ALL');
                setPriorityFilter('ALL');
                setScoreTierFilter('ALL');
                setDateFilter('');
                setPage(1);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium tabular-nums">
            {selectedIds.length} lead(s) selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkEmpId}
              onChange={(e) => setBulkEmpId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-white"
            >
              <option value="">Choose employee...</option>
              {activeStaff.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.department})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkAssign}
              disabled={!bulkEmpId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Assign Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      {paginatedLeads.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No leads match your filters"
          description="Try clearing search filters or add a new borrower lead to the pipeline."
          action={
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Create First Lead
            </button>
          }
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="crm-th-row">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedLeads.every((l) => selectedIds.includes(l.id))}
                      onChange={toggleSelectAllPage}
                      aria-label="Select page leads"
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-3 px-3">Lead ID</th>
                  <th className="py-3 px-3">
                    <button type="button" onClick={() => toggleSort('customerName')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      Customer <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">Loan &amp; Income</th>
                  <th className="py-3 px-3 text-right">
                    <button type="button" onClick={() => toggleSort('requiredLoanAmount')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">Assigned Agent</th>
                  <th className="py-3 px-3">
                    <button type="button" onClick={() => toggleSort('leadScore')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      AI Score <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button type="button" onClick={() => toggleSort('priority')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      Priority <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">
                    <button type="button" onClick={() => toggleSort('leadDate')} className="inline-flex items-center gap-1 hover:text-slate-800">
                      Created <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedLeads.map((lead) => {
                  const computed = leadScoreMap.get(lead.id);
                  return (
                  <tr key={lead.id} className="hover:bg-slate-50/75">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(lead.id) ? prev.filter((id) => id !== lead.id) : [...prev, lead.id]
                          )
                        }
                        aria-label={`Select ${lead.customerName}`}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">{lead.leadCode}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <EntityMonogram name={lead.customerName} />
                        <div>
                          <button
                            type="button"
                            onClick={() => setDetailLead(lead)}
                            className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                          >
                            {lead.customerName}
                          </button>
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {lead.phone} · {lead.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-800">{lead.loanType}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {lead.employmentType} · {formatCompactCurrency(lead.monthlyIncome)}/mo
                      </p>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCompactCurrency(lead.requiredLoanAmount)}
                    </td>
                    <td className="py-3 px-3">
                      {lead.assignedEmployeeName ? (
                        <span className="text-slate-800 font-medium">{lead.assignedEmployeeName}</span>
                      ) : (
                        <span className="text-amber-700 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {computed && (
                        <LeadScoreBadge
                          score={computed.leadScore}
                          tier={computed.scoreTier}
                          isAi={computed.scoreModel.includes('gemini')}
                        />
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={lead.priority} />
                    </td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDate(lead.leadDate || lead.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailLead(lead)}
                          title="View Details"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(lead)}
                          title="Edit Lead"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await archiveLead(actor, lead, !lead.isArchived);
                            notify(lead.isArchived ? 'Lead restored' : 'Lead archived', `${lead.leadCode} updated.`);
                          }}
                          title={lead.isArchived ? 'Restore Lead' : 'Archive Lead'}
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                        >
                          {lead.isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(lead)}
                          title="Delete Lead"
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredLeads.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create / Edit Lead Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingLead ? `Edit Lead · ${editingLead.leadCode}` : 'Create New Lead'}
        subtitle="Validate borrower details and assign to a loan sales specialist."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitLead)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Name *</label>
              <input {...register('customerName')} className="crm-input" />
              {errors.customerName && <p className="text-xs text-rose-600 mt-1">{errors.customerName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
              <input {...register('phone')} className="crm-input" />
              {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input type="email" {...register('email')} className="crm-input" />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                <input {...register('city')} className="crm-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">State *</label>
                <input {...register('state')} className="crm-input" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Employment Type *</label>
              <select {...register('employmentType')} className="crm-select w-full">
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Monthly Income (₹) *</label>
              <input type="number" {...register('monthlyIncome')} className="crm-input tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Loan Type *</label>
              <select {...register('loanType')} className="crm-select w-full">
                {LOAN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Required Loan Amount (₹) *</label>
              <input type="number" {...register('requiredLoanAmount')} className="crm-input tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Bank</label>
              <select {...register('preferredBank')} className="crm-select w-full">
                <option value="">No preference</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lead Source *</label>
              <input {...register('leadSource')} className="crm-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assign Employee</label>
              <select {...register('assignedEmployeeId')} className="crm-select w-full">
                <option value="">Unassigned</option>
                {activeStaff.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lead Status *</label>
                <select {...register('status')} className="crm-select w-full">
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Priority *</label>
                <select {...register('priority')} className="crm-select w-full">
                  {LEAD_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
            <textarea rows={3} {...register('remarks')} className="crm-input" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="crm-btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="crm-btn-primary px-4 py-2 text-sm"
            >
              {saving ? 'Saving...' : editingLead ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV / Excel Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk Import Leads (CSV / Excel)"
        subtitle="Upload .csv, .xlsx, or .xls files with automatic duplicate lead prevention."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-900">Duplicate Matching Policy</p>
              <p className="text-[11px] text-slate-500">Skip incoming rows that match existing active leads</p>
            </div>
            <select
              value={settings.duplicateRule}
              onChange={async (e) => {
                await updateDuplicateRule(actor, e.target.value as DuplicateRule);
                notify('Duplicate rule updated', `Policy set to ${e.target.value.replace(/_/g, ' ')}.`);
              }}
              className="crm-select-compact"
            >
              <option value="phone_or_email">Match Phone or Email</option>
              <option value="phone">Match Phone Number Only</option>
              <option value="email">Match Email Only</option>
              <option value="none">Allow All (No Duplicate Check)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => void handleFileParse(e.target.files?.[0])}
              className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
            />
            <button type="button" onClick={downloadSampleTemplate} className="text-xs font-medium text-blue-600 hover:underline">
              Download Sample CSV Template
            </button>
          </div>

          {importError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{importError}</div>
          )}

          {importRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-700">
                Previewing {importRows.length} parsed lead(s)
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Loan Type</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importRows.slice(0, 15).map((r, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-3 font-medium text-slate-900">{r.customerName}</td>
                        <td className="py-1.5 px-3 tabular-nums">{r.phone}</td>
                        <td className="py-1.5 px-3">{r.loanType}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{formatCompactCurrency(r.requiredLoanAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setImportOpen(false)} className="crm-btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importRows.length === 0 || importing}
              className="crm-btn-primary px-4 py-2 text-sm"
            >
              {importing ? 'Importing...' : `Import ${importRows.length} Leads`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lead Detail Drawer */}
      <Drawer
        open={Boolean(activeDetailLead)}
        onClose={() => setDetailLead(null)}
        title={activeDetailLead?.customerName || 'Lead Details'}
        subtitle={activeDetailLead ? `${activeDetailLead.leadCode} · ${activeDetailLead.loanType} · ${activeDetailLead.city}, ${activeDetailLead.state}` : undefined}
      >
        {activeDetailLead && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={activeDetailLead.status} />
              <StatusBadge status={activeDetailLead.priority} />
              <span className="text-xs text-slate-500">
                Source: <strong className="text-slate-800">{activeDetailLead.leadSource}</strong>
              </span>
            </div>

            <LeadScoreBreakdownCard
              computed={leadScoreMap.get(activeDetailLead.id) || resolveEffectiveLeadScore(activeDetailLead, callLogs, followUps, documents)}
              scoringBusy={aiScoringBusy}
              onRunAiScore={() => void handleRunAiScoring([activeDetailLead])}
            />

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4 border-y border-slate-200/90 text-xs">
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-medium text-slate-900 mt-0.5 tabular-nums">{activeDetailLead.phone}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-medium text-slate-900 mt-0.5 break-all">{activeDetailLead.email || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Required Loan</p>
                <p className="font-semibold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(activeDetailLead.requiredLoanAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Income</p>
                <p className="font-medium text-slate-900 mt-0.5 tabular-nums">{formatCurrency(activeDetailLead.monthlyIncome)}</p>
              </div>
              <div>
                <p className="text-slate-500">Assigned Specialist</p>
                <p className="font-medium text-slate-900 mt-0.5">{activeDetailLead.assignedEmployeeName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-slate-500">Preferred Bank</p>
                <p className="font-medium text-slate-900 mt-0.5">{activeDetailLead.preferredBank || 'Any Partner Bank'}</p>
              </div>
            </div>

            {activeDetailLead.remarks && (
              <div className="pb-4 border-b border-slate-200/80">
                <h4 className="text-xs font-semibold font-display text-slate-800 mb-1">Remarks</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{activeDetailLead.remarks}</p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold font-display text-slate-800 mb-2">
                Call History ({callLogs.filter((c) => c.leadId === activeDetailLead.id).length})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden">
                {callLogs.filter((c) => c.leadId === activeDetailLead.id).length === 0 ? (
                  <p className="p-3.5 text-xs text-slate-400">No calls logged yet.</p>
                ) : (
                  callLogs
                    .filter((c) => c.leadId === activeDetailLead.id)
                    .map((c) => (
                      <div key={c.id} className="p-3.5 text-xs bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={c.status} />
                          <span className="text-slate-500 tabular-nums">
                            {formatDateTime(c.callTime)} · {formatDuration(c.durationSeconds)}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1.5">{c.remarks || 'No call notes'}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Agent: {c.employeeName}</p>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold font-display text-slate-800 mb-2">
                Documents &amp; Applications
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="border border-slate-200/90 rounded-xl p-3.5 bg-slate-50/40">
                  <p className="font-medium text-slate-800 mb-2">KYC Documents</p>
                  {documents.filter((d) => d.leadId === activeDetailLead.id).length === 0 ? (
                    <p className="text-slate-400">No documents uploaded yet.</p>
                  ) : (
                    documents
                      .filter((d) => d.leadId === activeDetailLead.id)
                      .map((d) => (
                        <div key={d.id} className="flex items-center justify-between py-1.5 border-t border-slate-200/60 first:border-t-0">
                          <span className="text-slate-700">{d.docType}</span>
                          <StatusBadge status={d.status} />
                        </div>
                      ))
                  )}
                </div>
                <div className="border border-slate-200/90 rounded-xl p-3.5 bg-slate-50/40">
                  <p className="font-medium text-slate-800 mb-2">Follow-ups &amp; Applications</p>
                  {followUps
                    .filter((f) => f.leadId === activeDetailLead.id)
                    .map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-1.5 border-t border-slate-200/60 first:border-t-0">
                        <span className="text-slate-700 tabular-nums">{formatDate(f.scheduledAt)}</span>
                        <StatusBadge status={f.status} />
                      </div>
                    ))}
                  {applications
                    .filter((a) => a.leadId === activeDetailLead.id)
                    .map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5 border-t border-slate-200/60 first:border-t-0">
                        <span className="text-slate-700 font-mono">{a.applicationCode}</span>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteLeadPermanent(actor, deleteTarget);
          notify('Lead deleted', `${deleteTarget.leadCode} permanently removed.`);
          setDeleteTarget(null);
        }}
        title="Delete Lead Permanently?"
        message={`Are you sure you want to permanently delete ${deleteTarget?.customerName} (${deleteTarget?.leadCode})? You can archive the lead instead if you want to retain historical data.`}
        confirmLabel="Delete Permanently"
        danger
      />
    </div>
  );
}
