import { CheckCircle2, Download, Eye, FileCheck2, RotateCcw, Upload, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { fetchDocumentBlob, uploadCustomerDocument, verifyCustomerDocument } from '../../services/crmService';
import { downloadTextFile, formatDate } from '../../lib/utils';
import { DOCUMENT_TYPES, type CustomerDocument, type DocumentStatus, type DocumentType } from '../../types/crm';
import { EmptyState, EntityMonogram, Modal, StatusBadge } from '../ui/Primitives';

export function DocumentManagement() {
  const { userProfile } = useAuth();
  const { documents, leads, employees, notify } = useCrmData();

  const [tab, setTab] = useState<'Pending' | 'ALL' | 'Verified' | 'Rejected'>('Pending');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('Aadhaar Card');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<{ doc: CustomerDocument; nextStatus: 'Rejected' | 'Re-upload Required' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const actor = useMemo(
    () => ({
      uid: userProfile?.uid || '',
      email: userProfile?.email || '',
      name: userProfile?.fullName || 'CRM Admin',
      role: 'admin' as const,
    }),
    [userProfile]
  );

  const filteredDocs = useMemo(() => {
    if (tab === 'ALL') return documents;
    if (tab === 'Rejected') return documents.filter((d) => d.status === 'Rejected' || d.status === 'Re-upload Required');
    return documents.filter((d) => d.status === tab);
  }, [documents, tab]);

  const handleUpload = async () => {
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead || !selectedFile) return;
    const emp =
      employees.find((e) => e.id === lead.assignedEmployeeId) ||
      employees.find((e) => e.role === 'staff') ||
      employees[0];
    if (!emp) return;

    setUploading(true);
    try {
      await uploadCustomerDocument(actor, lead, emp, selectedDocType, selectedFile);
      notify('Document uploaded', `${selectedDocType} attached to ${lead.customerName}.`);
      setUploadOpen(false);
      setSelectedFile(null);
      setSelectedLeadId('');
    } catch (err) {
      notify('Upload failed', err instanceof Error ? err.message : 'Unable to upload file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async (docItem: CustomerDocument) => {
    setPreviewDoc(docItem);
    setPreviewBlobUrl(null);
    if (docItem.hasFileBlob) {
      setPreviewLoading(true);
      try {
        const url = await fetchDocumentBlob(docItem);
        setPreviewBlobUrl(url);
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleDownload = async (docItem: CustomerDocument) => {
    if (docItem.hasFileBlob) {
      const url = await fetchDocumentBlob(docItem);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = docItem.fileName;
        a.click();
        return;
      }
    }
    const content = [
      `FinBridge CRM Verified Document Record`,
      `Document Type: ${docItem.docType}`,
      `Customer: ${docItem.customerName} (${docItem.leadCode})`,
      `File Name: ${docItem.fileName}`,
      `Verification Status: ${docItem.status}`,
      `Uploaded By: ${docItem.employeeName}`,
      `Summary: ${docItem.previewSummary || 'Demo KYC document record'}`,
    ].join('\n');
    downloadTextFile(content, `${docItem.leadCode}_${docItem.docType.replace(/\s+/g, '_')}_record.txt`, 'text/plain');
  };

  const handleVerifyAction = async (docItem: CustomerDocument, status: DocumentStatus, reason?: string) => {
    await verifyCustomerDocument(actor, docItem, status, reason);
    notify(`Document ${status}`, `${docItem.docType} for ${docItem.customerName} updated.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            KYC &amp; Customer Document Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {documents.filter((d) => d.status === 'Pending').length} pending verification · Secure preview and compliance review
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="crm-btn-primary"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Customer Document
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="crm-segment">
        {(
          [
            { id: 'Pending', label: `Pending Review (${documents.filter((d) => d.status === 'Pending').length})` },
            { id: 'Verified', label: `Verified (${documents.filter((d) => d.status === 'Verified').length})` },
            { id: 'Rejected', label: `Rejected / Re-upload (${documents.filter((d) => d.status === 'Rejected' || d.status === 'Re-upload Required').length})` },
            { id: 'ALL', label: `All Documents (${documents.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap ${
              tab === t.id
                ? 'bg-white text-slate-900 font-semibold shadow-sm'
                : 'text-slate-600 font-medium hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="w-5 h-5" />}
          title="No documents in this queue"
          description="Upload customer KYC documents or switch tabs to review other verification statuses."
        />
      ) : (
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="crm-th-row">
                  <th className="py-3 px-4">Document &amp; File</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Uploaded By</th>
                  <th className="py-3 px-3">Uploaded Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Review Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{d.docType}</p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[240px]">
                        {d.fileName} · {Math.round(d.fileSize / 1024)} KB
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <EntityMonogram name={d.customerName} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{d.customerName}</p>
                          <p className="text-[11px] font-mono text-slate-400">{d.leadCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{d.employeeName}</td>
                    <td className="py-3 px-3 tabular-nums text-slate-500">{formatDate(d.createdAt)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={d.status} />
                      {d.rejectionReason && (
                        <p className="text-[11px] text-rose-600 mt-1 max-w-[200px] truncate">{d.rejectionReason}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openPreview(d)}
                          title="Preview"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(d)}
                          title="Download"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {d.status !== 'Verified' && (
                          <button
                            type="button"
                            onClick={() => handleVerifyAction(d, 'Verified')}
                            title="Approve KYC Document"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTarget({ doc: d, nextStatus: 'Re-upload Required' });
                            setRejectReason(d.rejectionReason || '');
                          }}
                          title="Request Re-upload"
                          className="p-1.5 rounded-md text-amber-700 hover:bg-amber-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTarget({ doc: d, nextStatus: 'Rejected' });
                            setRejectReason(d.rejectionReason || '');
                          }}
                          title="Reject Document"
                          className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
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

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Customer Document">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Lead *</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="crm-select w-full"
            >
              <option value="">Select lead...</option>
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Document Type *</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
              className="crm-select w-full"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select File (PNG, JPG, PDF up to 650 KB) *</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setUploadOpen(false)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedLeadId || !selectedFile || uploading}
              onClick={handleUpload}
              className="crm-btn-primary"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `${previewDoc.docType} · ${previewDoc.customerName}` : 'Preview'}
        subtitle={previewDoc?.fileName}
        maxWidth="max-w-2xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900">Lead: {previewDoc.leadCode} · Agent: {previewDoc.employeeName}</p>
                <p className="text-slate-500 mt-0.5">{previewDoc.previewSummary}</p>
              </div>
              <StatusBadge status={previewDoc.status} />
            </div>

            {previewLoading ? (
              <div className="h-64 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                Loading secure file payload...
              </div>
            ) : previewBlobUrl ? (
              previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewBlobUrl}
                  alt={previewDoc.fileName}
                  className="max-h-96 mx-auto rounded-lg border border-slate-200 object-contain"
                />
              ) : (
                <iframe
                  title={previewDoc.fileName}
                  src={previewBlobUrl}
                  className="w-full h-96 rounded-lg border border-slate-200"
                />
              )
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/70 text-center space-y-2">
                <FileCheck2 className="w-10 h-10 text-blue-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-900">Verified Metadata Record</p>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {previewDoc.previewSummary || 'Seeded sample document metadata. Upload a live PNG/JPG/PDF to inspect binary preview.'}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDownload(previewDoc)}
                className="crm-btn-secondary"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              {previewDoc.status !== 'Verified' && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleVerifyAction(previewDoc, 'Verified');
                    setPreviewDoc(null);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  Approve Document
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject / Re-upload Modal */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title={`${rejectTarget?.nextStatus} · ${rejectTarget?.doc.docType}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason / Feedback for Staff *</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the document is rejected or needs re-upload..."
              className="crm-input"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejectTarget(null)} className="crm-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!rejectTarget) return;
                await handleVerifyAction(rejectTarget.doc, rejectTarget.nextStatus, rejectReason);
                setRejectTarget(null);
              }}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
            >
              Confirm {rejectTarget?.nextStatus}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
