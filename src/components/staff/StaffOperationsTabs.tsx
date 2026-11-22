import { CalendarClock, CheckCircle2, Clock, FileCheck2, RotateCcw, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCrmData } from '../../context/CrmDataContext';
import {
  addStaffApplicationRemark,
  completeFollowUp,
  uploadCustomerDocument,
  type ActorContext,
} from '../../services/crmService';
import { formatCompactCurrency, formatDate, formatDateTime, getDateKey, getTodayKey } from '../../lib/utils';
import {
  DOCUMENT_TYPES,
  type CallLog,
  type CustomerDocument,
  type DocumentType,
  type Employee,
  type FollowUp,
  type Lead,
  type LoanApplication,
  type LoanStatusHistory,
} from '../../types/crm';
import { ChartTooltip, Drawer, EmptyState, EntityMonogram, KpiCard, Modal, StatusBadge } from '../ui/Primitives';

export function StaffFollowUpsTab({
  actor,
  myFollowUps,
}: {
  actor: ActorContext;
  myFollowUps: FollowUp[];
}) {
  const { notify } = useCrmData();
  const [bucket, setBucket] = useState<'today' | 'overdue' | 'upcoming' | 'completed'>('today');
  const [completing, setCompleting] = useState<FollowUp | null>(null);
  const [notes, setNotes] = useState('');

  const todayKey = getTodayKey();
  const nowMs = Date.now();

  const grouped = useMemo(() => {
    const today: FollowUp[] = [];
    const overdue: FollowUp[] = [];
    const upcoming: FollowUp[] = [];
    const completed: FollowUp[] = [];

    for (const f of myFollowUps) {
      if (f.status === 'completed') {
        completed.push(f);
        continue;
      }
      if (f.status === 'cancelled') continue;
      const key = getDateKey(f.scheduledAt);
      if (key === todayKey) today.push(f);
      else if (new Date(f.scheduledAt).getTime() < nowMs) overdue.push(f);
      else upcoming.push(f);
    }
    return { today, overdue, upcoming, completed };
  }, [myFollowUps, todayKey, nowMs]);

  const list = grouped[bucket];

  return (
    <div className="space-y-4 crm-anim-fade">
      <div className="crm-segment">
        {(
          [
            { id: 'today', label: `Today (${grouped.today.length})` },
            { id: 'overdue', label: `Overdue (${grouped.overdue.length})` },
            { id: 'upcoming', label: `Upcoming (${grouped.upcoming.length})` },
            { id: 'completed', label: `Completed (${grouped.completed.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setBucket(t.id)}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all ${
              bucket === t.id
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 font-medium hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<CalendarClock className="w-5 h-5" />} title={`No ${bucket} follow-ups`} description="Scheduled callbacks appear here." />
      ) : (
        <div className="crm-card divide-y divide-slate-100">
          {list.map((f) => (
            <div key={f.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {f.customerName} <span className="font-mono text-xs text-slate-400">· {f.leadCode}</span>
                </p>
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  {f.customerPhone} · {formatDateTime(f.scheduledAt)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {f.status === 'completed' ? f.outcomeNotes || f.notes : f.notes}
                </p>
              </div>
              {f.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => setCompleting(f)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Complete
                </button>
              ) : (
                <StatusBadge status={f.status} />
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(completing)} onClose={() => setCompleting(null)} title="Complete Follow-Up" maxWidth="max-w-md">
        <div className="space-y-4">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Outcome notes from customer callback..."
            className="crm-input"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCompleting(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!completing) return;
                await completeFollowUp(actor, completing, notes || 'Follow-up completed.');
                notify('Follow-up completed', completing.customerName);
                setCompleting(null);
                setNotes('');
              }}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Confirm Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function StaffDocumentsTab({
  actor,
  employee,
  myLeads,
  myDocuments,
}: {
  actor: ActorContext;
  employee: Employee;
  myLeads: Lead[];
  myDocuments: CustomerDocument[];
}) {
  const { notify } = useCrmData();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<CustomerDocument | null>(null);
  const [leadId, setLeadId] = useState('');
  const [docType, setDocType] = useState<DocumentType>('Aadhaar Card');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async () => {
    const targetLead = replacingDoc
      ? myLeads.find((l) => l.id === replacingDoc.leadId) || myLeads[0]
      : myLeads.find((l) => l.id === leadId);
    if (!targetLead || !file) return;

    setBusy(true);
    try {
      await uploadCustomerDocument(
        actor,
        targetLead,
        employee,
        replacingDoc ? replacingDoc.docType : docType,
        file,
        replacingDoc || undefined
      );
      notify(replacingDoc ? 'Replacement uploaded' : 'Document uploaded', `${file.name} submitted for KYC review.`);
      setUploadOpen(false);
      setReplacingDoc(null);
      setFile(null);
    } catch (err) {
      notify('Upload failed', err instanceof Error ? err.message : 'Unable to upload.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 crm-anim-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900">Customer KYC Documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload documents for assigned customers and track admin verification</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setReplacingDoc(null);
            setUploadOpen(true);
          }}
          className="crm-btn-primary"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Document
        </button>
      </div>

      {myDocuments.length === 0 ? (
        <EmptyState icon={<FileCheck2 className="w-5 h-5" />} title="No documents uploaded yet" description="Upload Aadhaar, PAN, salary slips, or bank statements for your customers." />
      ) : (
        <div className="crm-card divide-y divide-slate-100">
          {myDocuments.map((d) => (
            <div key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {d.docType} · {d.customerName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {d.fileName} · Uploaded {formatDate(d.createdAt)}
                </p>
                {d.rejectionReason && (
                  <p className="text-xs text-rose-600 mt-1">Feedback: {d.rejectionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={d.status} />
                {(d.status === 'Rejected' || d.status === 'Re-upload Required') && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingDoc(d);
                      setUploadOpen(true);
                    }}
                    className="crm-btn-secondary py-1.5 px-2.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Re-upload
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setReplacingDoc(null);
        }}
        title={replacingDoc ? `Upload Replacement · ${replacingDoc.docType}` : 'Upload Customer Document'}
      >
        <div className="space-y-4">
          {!replacingDoc && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Customer Lead *</label>
                <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="crm-select w-full">
                  <option value="">Select customer...</option>
                  {myLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.customerName} ({l.leadCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Document Type *</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="crm-select w-full">
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">File (PNG, JPG, PDF up to 650 KB) *</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setUploadOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !file || (!replacingDoc && !leadId)}
              onClick={handleUpload}
              className="crm-btn-primary"
            >
              {busy ? 'Uploading...' : 'Submit Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function StaffApplicationsTab({
  actor,
  myApplications,
  statusHistory,
}: {
  actor: ActorContext;
  myApplications: LoanApplication[];
  statusHistory: LoanStatusHistory[];
}) {
  const { notify } = useCrmData();
  const [drawerApp, setDrawerApp] = useState<LoanApplication | null>(null);
  const [noteText, setNoteText] = useState('');

  return (
    <div className="space-y-4 crm-anim-fade">
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="crm-th-row">
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Bank &amp; Scheme</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {myApplications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">{app.applicationCode}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <EntityMonogram name={app.customerName} size="xs" />
                      <span className="font-medium text-slate-800">{app.customerName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-slate-800">{app.bankName}</p>
                    <p className="text-[11px] text-slate-500">{app.schemeName}</p>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold tabular-nums">{formatCompactCurrency(app.loanAmount)}</td>
                  <td className="py-3 px-3"><StatusBadge status={app.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerApp(app);
                        setNoteText(app.remarks || '');
                      }}
                      className="crm-btn-secondary py-1.5 px-2.5"
                    >
                      <Clock className="w-3 h-3" /> Track &amp; Note
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={Boolean(drawerApp)}
        onClose={() => setDrawerApp(null)}
        title={drawerApp ? `${drawerApp.applicationCode} · ${drawerApp.customerName}` : ''}
        subtitle={drawerApp ? `${drawerApp.bankName} · ${drawerApp.schemeName}` : undefined}
      >
        {drawerApp && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 text-xs">
              <div>
                <p className="text-slate-500">Current Stage</p>
                <div className="mt-1.5"><StatusBadge status={drawerApp.status} /></div>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Bank Ref</p>
                <p className="font-mono text-slate-900 mt-1">{drawerApp.bankReferenceNumber || '—'}</p>
              </div>
            </div>

            <div className="space-y-2.5 pb-5 border-b border-slate-100">
              <label className="block font-display text-xs font-semibold text-slate-800">Follow-Up Remarks</label>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="crm-input"
              />
              <button
                type="button"
                onClick={async () => {
                  await addStaffApplicationRemark(actor, drawerApp, noteText);
                  notify('Remark saved', `${drawerApp.applicationCode} updated.`);
                }}
                className="crm-btn-primary"
              >
                Save Follow-up Remark
              </button>
            </div>

            <div>
              <h4 className="font-display text-xs font-semibold text-slate-800 mb-3">Stage History</h4>
              <div className="divide-y divide-slate-100">
                {statusHistory
                  .filter((h) => h.applicationId === drawerApp.id)
                  .map((h) => (
                    <div key={h.id} className="py-3 first:pt-0 text-xs">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={h.toStatus} />
                        <span className="text-[11px] text-slate-400 tabular-nums">{formatDateTime(h.createdAt)}</span>
                      </div>
                      <p className="text-slate-600 mt-1.5">{h.remarks}</p>
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

export function StaffPerformanceTab({
  employee,
  myLeads,
  myCalls,
  myFollowUps,
  myApplications,
}: {
  employee: Employee;
  myLeads: Lead[];
  myCalls: CallLog[];
  myFollowUps: FollowUp[];
  myApplications: LoanApplication[];
}) {
  const todayKey = getTodayKey();

  const metrics = useMemo(() => {
    const callsToday = myCalls.filter((c) => getDateKey(c.callTime) === todayKey).length;
    const targetPct = employee.dailyCallTarget > 0 ? Math.round((callsToday / employee.dailyCallTarget) * 100) : 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekKey = getDateKey(weekAgo);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthKey = getDateKey(monthAgo);

    const weeklyCalls = myCalls.filter((c) => getDateKey(c.callTime) >= weekKey).length;
    const monthlyCalls = myCalls.filter((c) => getDateKey(c.callTime) >= monthKey).length;
    const interested = myCalls.filter((c) => c.status === 'Interested').length;
    const converted = myLeads.filter((l) => l.status === 'Converted').length;
    const convRate = myLeads.length > 0 ? Math.round((converted / myLeads.length) * 100) : 0;
    const completedFups = myFollowUps.filter((f) => f.status === 'completed').length;
    const fupRate = myFollowUps.length > 0 ? Math.round((completedFups / myFollowUps.length) * 100) : 0;

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = getDateKey(d);
      trend.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        calls: myCalls.filter((c) => getDateKey(c.callTime) === k).length,
      });
    }

    return { callsToday, targetPct, weeklyCalls, monthlyCalls, interested, convRate, fupRate, trend };
  }, [employee, myLeads, myCalls, myFollowUps, todayKey]);

  return (
    <div className="space-y-6 crm-anim-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Calls Today" value={metrics.callsToday} subtext={`Target: ${employee.dailyCallTarget}`} tone="primary" />
        <KpiCard label="Target Achievement" value={`${metrics.targetPct}%`} subtext="Daily quota attainment" tone="success" />
        <KpiCard label="Weekly / Monthly Calls" value={`${metrics.weeklyCalls} / ${metrics.monthlyCalls}`} subtext="7-day & 30-day totals" />
        <KpiCard label="Interested Outcomes" value={metrics.interested} subtext="Qualified borrower calls" tone="success" />
        <KpiCard label="Lead Conversion Rate" value={`${metrics.convRate}%`} subtext={`${myLeads.length} total assigned leads`} />
        <KpiCard label="Follow-up Completion" value={`${metrics.fupRate}%`} subtext={`${myFollowUps.length} total follow-ups`} />
        <KpiCard label="Loan Applications" value={myApplications.length} subtext="Submitted to partner banks" tone="primary" />
        <KpiCard label="Disbursed Apps" value={myApplications.filter((a) => a.status === 'Disbursed').length} subtext="Completed payouts" tone="success" />
      </div>

      <div className="crm-card p-5">
        <h3 className="font-display text-sm font-semibold text-slate-900 mb-1">7-Day Call Output</h3>
        <p className="text-xs text-slate-500 mb-4">Daily call volume compared against your {employee.dailyCallTarget} call benchmark</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="calls" name="Calls Logged" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
