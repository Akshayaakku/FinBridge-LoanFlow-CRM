import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { computeBaselineLeadScore } from '../lib/leadScoring';
import { downloadTextFile, makeId, normalizePhone, stripUndefined } from '../lib/utils';
import type {
  Bank,
  CallLog,
  CallStatus,
  CrmNotification,
  CustomerDocument,
  DocumentStatus,
  DocumentType,
  DuplicateRule,
  Employee,
  FollowUp,
  Lead,
  LeadPriority,
  LeadStatus,
  LoanApplication,
  LoanApplicationStatus,
  LoanScheme,
  LoanType,
  NotificationCategory,
  NotificationEntityType,
  NotificationSeverity,
  UserRole,
} from '../types/crm';

export interface ActorContext {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

async function logActivity(
  actor: ActorContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
) {
  const id = makeId('act');
  await setDoc(doc(db, 'activity_logs', id), {
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    summary: summary.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export interface CreateNotificationPayload {
  id?: string;
  targetRole: UserRole;
  targetEmail: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: string;
  leadCode?: string;
  actorName: string;
}

const ADMIN_BROADCAST_EMAIL = 'admin@loancrm.com';

export async function pushCrmNotifications(items: CreateNotificationPayload[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const CHUNK = 350;
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = items.slice(i, i + CHUNK);
      for (const item of slice) {
        const id = item.id || makeId('ntf');
        batch.set(
          doc(db, 'notifications', id),
          stripUndefined({
            targetRole: item.targetRole,
            targetEmail: item.targetEmail.toLowerCase(),
            category: item.category,
            severity: item.severity,
            title: item.title.slice(0, 160),
            message: item.message.slice(0, 500),
            entityType: item.entityType,
            entityId: item.entityId,
            leadCode: item.leadCode,
            read: false,
            actorName: item.actorName.slice(0, 150) || 'FinBridge CRM',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('Failed to push notifications:', err);
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), {
      read: true,
      readAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function markAllNotificationsRead(notifications: CrmNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  try {
    const nowIso = new Date().toISOString();
    const CHUNK = 350;
    for (let i = 0; i < unread.length; i += CHUNK) {
      const batch = writeBatch(db);
      unread.slice(i, i + CHUNK).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), {
          read: true,
          readAt: nowIso,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

// ==================== EMPLOYEES ====================
export async function createEmployee(
  actor: ActorContext,
  payload: Omit<Employee, 'id' | 'employeeCode' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeId('emp');
  const code = `EMP-${Math.floor(100 + Math.random() * 900)}`;
  const normalizedEmail = payload.email.trim().toLowerCase();
  try {
    await setDoc(
      doc(db, 'employees', id),
      stripUndefined({
        ...payload,
        email: normalizedEmail,
        employeeCode: code,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, 'Employee Created', 'employee', id, `Added ${payload.fullName} (${payload.department}) with daily target ${payload.dailyCallTarget}.`);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `employees/${id}`);
  }
}

export async function updateEmployee(
  actor: ActorContext,
  id: string,
  updates: Partial<Employee>
): Promise<void> {
  try {
    const clean = stripUndefined({
      ...updates,
      ...(updates.email ? { email: updates.email.trim().toLowerCase() } : {}),
      updatedAt: serverTimestamp(),
    });
    delete clean.id;
    delete clean.createdAt;
    await updateDoc(doc(db, 'employees', id), clean);
    await logActivity(actor, 'Employee Updated', 'employee', id, `Updated employee profile (${updates.fullName || id}).`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${id}`);
  }
}

export async function setEmployeeDailyTarget(
  actor: ActorContext,
  emp: Employee,
  dailyCallTarget: number,
  dateKey: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'employees', emp.id), {
      dailyCallTarget,
      updatedAt: serverTimestamp(),
    });
    const targetId = `tgt_${emp.id}_${dateKey}`;
    await setDoc(doc(db, 'daily_targets', targetId), {
      employeeId: emp.id,
      employeeEmail: emp.email,
      date: dateKey,
      callTarget: dailyCallTarget,
      updatedByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, 'Daily Target Updated', 'employee', emp.id, `Set daily call target to ${dailyCallTarget} for ${emp.fullName}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${emp.id}`);
  }
}

// ==================== LEADS ====================
export async function createLead(
  actor: ActorContext,
  payload: Omit<Lead, 'id' | 'leadCode' | 'isArchived' | 'createdAt' | 'updatedAt'>,
  employees: Employee[],
  existingLeads: Lead[],
  duplicateRule: DuplicateRule
): Promise<string> {
  const normPhone = normalizePhone(payload.phone);
  const normEmail = (payload.email || '').trim().toLowerCase();

  if (duplicateRule !== 'none') {
    const duplicate = existingLeads.find((l) => {
      if (l.isArchived) return false;
      const phoneMatch = normPhone.length >= 8 && normalizePhone(l.phone) === normPhone;
      const emailMatch = normEmail.length > 0 && (l.email || '').trim().toLowerCase() === normEmail;
      if (duplicateRule === 'phone') return phoneMatch;
      if (duplicateRule === 'email') return emailMatch;
      return phoneMatch || emailMatch;
    });
    if (duplicate) {
      throw new Error(`Duplicate lead detected (${duplicate.leadCode} — ${duplicate.customerName}).`);
    }
  }

  const id = makeId('lead');
  const leadCode = `LD-${Math.floor(2000 + Math.random() * 8000)}`;
  const assignedEmp = payload.assignedEmployeeId
    ? employees.find((e) => e.id === payload.assignedEmployeeId)
    : undefined;

  try {
    const baseScore = computeBaselineLeadScore(payload);
    await setDoc(
      doc(db, 'leads', id),
      stripUndefined({
        ...payload,
        leadCode,
        assignedEmployeeId: assignedEmp?.id,
        assignedEmployeeName: assignedEmp?.fullName,
        assignedEmployeeEmail: assignedEmp?.email?.toLowerCase(),
        assignedEmployeeUid: assignedEmp?.uid,
        leadScore: baseScore.leadScore,
        scoreTier: baseScore.scoreTier,
        scoreSummary: baseScore.scoreSummary,
        scoreFactors: baseScore.scoreFactors,
        scoredAt: new Date().toISOString(),
        scoreModel: baseScore.scoreModel,
        leadDate: new Date().toISOString(),
        isArchived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, 'Lead Created', 'lead', id, `Created lead ${leadCode} for ${payload.customerName} (${payload.loanType}).`);
    if (assignedEmp) {
      await pushCrmNotifications([
        {
          targetRole: 'staff',
          targetEmail: assignedEmp.email,
          category: 'lead_assigned',
          severity: payload.priority === 'High' ? 'urgent' : 'info',
          title: `New lead assigned: ${leadCode}`,
          message: `${payload.customerName} · ${payload.loanType} (${payload.city}) assigned to you.`,
          entityType: 'lead',
          entityId: id,
          leadCode,
          actorName: actor.name,
        },
        {
          targetRole: 'admin',
          targetEmail: ADMIN_BROADCAST_EMAIL,
          category: 'lead_assigned',
          severity: 'info',
          title: `Lead ${leadCode} assigned to ${assignedEmp.fullName}`,
          message: `${payload.customerName} (${payload.loanType}) routed to ${assignedEmp.fullName}.`,
          entityType: 'lead',
          entityId: id,
          leadCode,
          actorName: actor.name,
        },
      ]);
    } else {
      await pushCrmNotifications([
        {
          targetRole: 'admin',
          targetEmail: ADMIN_BROADCAST_EMAIL,
          category: 'lead_attention',
          severity: 'warning',
          title: `Unassigned lead awaiting routing: ${leadCode}`,
          message: `${payload.customerName} (${payload.loanType}) requires staff assignment.`,
          entityType: 'lead',
          entityId: id,
          leadCode,
          actorName: actor.name,
        },
      ]);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `leads/${id}`);
  }
}

export async function updateLead(
  actor: ActorContext,
  id: string,
  updates: Partial<Lead>,
  employees?: Employee[]
): Promise<void> {
  try {
    const enriched: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.email === '') {
      enriched.email = deleteField();
    }
    if (updates.preferredBank === '') {
      enriched.preferredBank = deleteField();
    }
    if (employees && updates.assignedEmployeeId !== undefined) {
      if (!updates.assignedEmployeeId) {
        enriched.assignedEmployeeId = deleteField();
        enriched.assignedEmployeeName = deleteField();
        enriched.assignedEmployeeEmail = deleteField();
        enriched.assignedEmployeeUid = deleteField();
      } else {
        const emp = employees.find((e) => e.id === updates.assignedEmployeeId);
        if (emp) {
          enriched.assignedEmployeeName = emp.fullName;
          enriched.assignedEmployeeEmail = emp.email.toLowerCase();
          if (emp.uid) enriched.assignedEmployeeUid = emp.uid;
          else enriched.assignedEmployeeUid = deleteField();
        }
      }
    }
    delete enriched.id;
    delete enriched.createdAt;
    await updateDoc(doc(db, 'leads', id), stripUndefined(enriched));
    await logActivity(actor, 'Lead Updated', 'lead', id, `Updated lead ${updates.leadCode || id}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
  }
}

export async function archiveLead(actor: ActorContext, lead: Lead, archived = true): Promise<void> {
  try {
    await updateDoc(doc(db, 'leads', lead.id), {
      isArchived: archived,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, archived ? 'Lead Archived' : 'Lead Restored', 'lead', lead.id, `${archived ? 'Archived' : 'Restored'} lead ${lead.leadCode} (${lead.customerName}).`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
  }
}

export async function deleteLeadPermanent(actor: ActorContext, lead: Lead): Promise<void> {
  try {
    await deleteDoc(doc(db, 'leads', lead.id));
    await logActivity(actor, 'Lead Deleted', 'lead', lead.id, `Deleted lead ${lead.leadCode} (${lead.customerName}).`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `leads/${lead.id}`);
  }
}

// Transaction-safe Lead Assignment (single, bulk, or round-robin)
export async function assignLeadsToEmployee(
  actor: ActorContext,
  leadsToAssign: Lead[],
  targetEmployee: Employee,
  method: 'manual' | 'bulk' | 'round_robin',
  notes = ''
): Promise<void> {
  if (leadsToAssign.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const lead of leadsToAssign) {
      const leadRef = doc(db, 'leads', lead.id);
      batch.update(
        leadRef,
        stripUndefined({
          assignedEmployeeId: targetEmployee.id,
          assignedEmployeeName: targetEmployee.fullName,
          assignedEmployeeEmail: targetEmployee.email.toLowerCase(),
          assignedEmployeeUid: targetEmployee.uid,
          updatedAt: serverTimestamp(),
        })
      );
      const asgId = makeId('asg');
      batch.set(
        doc(db, 'lead_assignments', asgId),
        stripUndefined({
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          fromEmployeeId: lead.assignedEmployeeId,
          fromEmployeeName: lead.assignedEmployeeName,
          toEmployeeId: targetEmployee.id,
          toEmployeeName: targetEmployee.fullName,
          toEmployeeEmail: targetEmployee.email.toLowerCase(),
          assignedByUid: actor.uid,
          assignedByName: actor.name,
          method,
          notes: notes || `${method.replace('_', ' ')} assignment`,
          createdAt: serverTimestamp(),
        })
      );
    }
    await batch.commit();
    await logActivity(
      actor,
      'Leads Assigned',
      'lead_assignment',
      targetEmployee.id,
      `Assigned ${leadsToAssign.length} lead(s) to ${targetEmployee.fullName} via ${method}.`
    );
    const firstLead = leadsToAssign[0];
    await pushCrmNotifications([
      {
        targetRole: 'staff',
        targetEmail: targetEmployee.email,
        category: 'lead_assigned',
        severity: 'info',
        title:
          leadsToAssign.length === 1
            ? `Lead assigned: ${firstLead.leadCode}`
            : `${leadsToAssign.length} new leads assigned to you`,
        message:
          leadsToAssign.length === 1
            ? `${firstLead.customerName} (${firstLead.loanType}) assigned by ${actor.name}.`
            : `Includes ${firstLead.customerName} and ${leadsToAssign.length - 1} other borrower(s).`,
        entityType: 'lead',
        entityId: firstLead.id,
        leadCode: firstLead.leadCode,
        actorName: actor.name,
      },
      {
        targetRole: 'admin',
        targetEmail: ADMIN_BROADCAST_EMAIL,
        category: 'lead_assigned',
        severity: 'success',
        title: `Assigned ${leadsToAssign.length} lead(s) to ${targetEmployee.fullName}`,
        message: `Assignment completed via ${method.replace('_', ' ')}.`,
        entityType: 'lead',
        entityId: firstLead.id,
        leadCode: firstLead.leadCode,
        actorName: actor.name,
      },
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

export async function roundRobinDistributeLeads(
  actor: ActorContext,
  unassignedLeads: Lead[],
  activeStaff: Employee[],
  allLeads: Lead[],
  balanceByWorkload = true
): Promise<number> {
  if (unassignedLeads.length === 0 || activeStaff.length === 0) return 0;

  try {
    const workloadMap = new Map<string, number>();
    for (const emp of activeStaff) workloadMap.set(emp.id, 0);
    for (const l of allLeads) {
      if (!l.isArchived && l.assignedEmployeeId && workloadMap.has(l.assignedEmployeeId)) {
        workloadMap.set(l.assignedEmployeeId, (workloadMap.get(l.assignedEmployeeId) || 0) + 1);
      }
    }

    const sortedStaff = [...activeStaff].sort((a, b) =>
      balanceByWorkload ? (workloadMap.get(a.id) || 0) - (workloadMap.get(b.id) || 0) : 0
    );

    const settingsRef = doc(db, 'settings', 'global');
    let startIdx = 0;

    await runTransaction(db, async (tx) => {
      const settingsSnap = await tx.get(settingsRef);
      if (settingsSnap.exists()) {
        startIdx = Number(settingsSnap.data().roundRobinIndex || 0);
        tx.update(settingsRef, {
          roundRobinIndex: (startIdx + unassignedLeads.length) % sortedStaff.length,
          updatedAt: serverTimestamp(),
        });
      }
    });

    const CHUNK = 180;
    const perAgentSummary = new Map<string, { emp: Employee; count: number; sampleLead: Lead }>();
    for (let offset = 0; offset < unassignedLeads.length; offset += CHUNK) {
      const batch = writeBatch(db);
      const slice = unassignedLeads.slice(offset, offset + CHUNK);
      slice.forEach((lead, localIdx) => {
        const globalIdx = offset + localIdx;
        let emp: Employee;
        if (balanceByWorkload) {
          sortedStaff.sort((a, b) => (workloadMap.get(a.id) || 0) - (workloadMap.get(b.id) || 0));
          emp = sortedStaff[0];
          workloadMap.set(emp.id, (workloadMap.get(emp.id) || 0) + 1);
        } else {
          emp = sortedStaff[(startIdx + globalIdx) % sortedStaff.length];
        }

        const existingSummary = perAgentSummary.get(emp.id);
        if (existingSummary) {
          existingSummary.count += 1;
        } else {
          perAgentSummary.set(emp.id, { emp, count: 1, sampleLead: lead });
        }

        batch.update(
          doc(db, 'leads', lead.id),
          stripUndefined({
            assignedEmployeeId: emp.id,
            assignedEmployeeName: emp.fullName,
            assignedEmployeeEmail: emp.email.toLowerCase(),
            assignedEmployeeUid: emp.uid,
            updatedAt: serverTimestamp(),
          })
        );
        batch.set(
          doc(db, 'lead_assignments', makeId('asg')),
          stripUndefined({
            leadId: lead.id,
            leadCode: lead.leadCode,
            customerName: lead.customerName,
            fromEmployeeId: lead.assignedEmployeeId,
            fromEmployeeName: lead.assignedEmployeeName,
            toEmployeeId: emp.id,
            toEmployeeName: emp.fullName,
            toEmployeeEmail: emp.email.toLowerCase(),
            assignedByUid: actor.uid,
            assignedByName: actor.name,
            method: 'round_robin',
            notes: balanceByWorkload ? 'Auto workload-balanced round-robin' : 'Auto sequential round-robin',
            createdAt: serverTimestamp(),
          })
        );
      });
      await batch.commit();
    }

    await logActivity(
      actor,
      'Round-Robin Distribution',
      'lead_assignment',
      'round_robin',
      `Auto-distributed ${unassignedLeads.length} leads across ${activeStaff.length} active employees.`
    );

    const notifs: CreateNotificationPayload[] = Array.from(perAgentSummary.values()).map(({ emp, count, sampleLead }) => ({
      targetRole: 'staff',
      targetEmail: emp.email,
      category: 'lead_assigned',
      severity: 'info',
      title: `${count} lead${count > 1 ? 's' : ''} auto-assigned to you`,
      message: `Round-robin distribution routed ${sampleLead.customerName}${count > 1 ? ` + ${count - 1} more` : ''} to your queue.`,
      entityType: 'lead',
      entityId: sampleLead.id,
      leadCode: sampleLead.leadCode,
      actorName: actor.name,
    }));
    notifs.push({
      targetRole: 'admin',
      targetEmail: ADMIN_BROADCAST_EMAIL,
      category: 'lead_assigned',
      severity: 'success',
      title: `Round-robin distributed ${unassignedLeads.length} leads`,
      message: `Balanced across ${perAgentSummary.size} active call centre agents.`,
      entityType: 'lead',
      entityId: unassignedLeads[0].id,
      leadCode: unassignedLeads[0].leadCode,
      actorName: actor.name,
    });
    await pushCrmNotifications(notifs);
    return unassignedLeads.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

// ==================== CSV / XLSX IMPORT & EXPORT ====================
export interface ParsedImportRow {
  customerName: string;
  phone: string;
  email?: string;
  city: string;
  state: string;
  employmentType: Lead['employmentType'];
  monthlyIncome: number;
  requiredLoanAmount: number;
  loanType: LoanType;
  preferredBank?: string;
  leadSource: string;
  priority: LeadPriority;
  remarks?: string;
}

export async function parseLeadsImportFile(file: File): Promise<ParsedImportRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let rawRows: Record<string, unknown>[] = [];

  if (ext === 'csv') {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    rawRows = parsed.data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
  } else {
    throw new Error('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
  }

  const normalizeLoanType = (val: string): LoanType => {
    const lower = val.toLowerCase();
    if (lower.includes('home')) return 'Home Loan';
    if (lower.includes('business')) return 'Business Loan';
    if (lower.includes('auto') || lower.includes('car')) return 'Auto Loan';
    if (lower.includes('edu')) return 'Education Loan';
    if (lower.includes('property') || lower.includes('lap')) return 'Loan Against Property';
    return 'Personal Loan';
  };

  const normalizeEmpType = (val: string): Lead['employmentType'] => {
    const lower = val.toLowerCase();
    if (lower.includes('self')) return 'Self-Employed';
    if (lower.includes('business')) return 'Business Owner';
    if (lower.includes('prof')) return 'Professional';
    return 'Salaried';
  };

  const normalizePriority = (val: string): LeadPriority => {
    const lower = val.toLowerCase();
    if (lower.includes('high')) return 'High';
    if (lower.includes('low')) return 'Low';
    return 'Medium';
  };

  return rawRows
    .map((row): ParsedImportRow | null => {
      const getField = (...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
          if (found && row[found] !== undefined && String(row[found]).trim() !== '') {
            return String(row[found]).trim();
          }
        }
        return '';
      };

      const customerName = getField('Customer Name', 'customerName', 'Name', 'fullName');
      const phone = getField('Phone', 'Phone Number', 'phone', 'Mobile');
      if (!customerName || !phone) return null;

      return {
        customerName,
        phone,
        email: getField('Email', 'email') || undefined,
        city: getField('City', 'city') || 'Mumbai',
        state: getField('State', 'state') || 'Maharashtra',
        employmentType: normalizeEmpType(getField('Employment Type', 'employmentType') || 'Salaried'),
        monthlyIncome: Number(getField('Monthly Income', 'monthlyIncome', 'Income').replace(/[^\d.]/g, '')) || 45000,
        requiredLoanAmount: Number(getField('Required Loan Amount', 'Loan Amount', 'requiredLoanAmount', 'Amount').replace(/[^\d.]/g, '')) || 500000,
        loanType: normalizeLoanType(getField('Loan Type', 'loanType') || 'Personal Loan'),
        preferredBank: getField('Preferred Bank', 'preferredBank') || undefined,
        leadSource: getField('Lead Source', 'leadSource', 'Source') || 'CSV Import',
        priority: normalizePriority(getField('Priority', 'priority') || 'Medium'),
        remarks: getField('Remarks', 'remarks', 'Notes') || undefined,
      };
    })
    .filter((r): r is ParsedImportRow => r !== null);
}

export async function bulkImportLeads(
  actor: ActorContext,
  rows: ParsedImportRow[],
  existingLeads: Lead[],
  duplicateRule: DuplicateRule
): Promise<{ imported: number; skippedDuplicates: number }> {
  const existingPhones = new Set(existingLeads.filter((l) => !l.isArchived).map((l) => normalizePhone(l.phone)));
  const existingEmails = new Set(existingLeads.filter((l) => !l.isArchived && l.email).map((l) => l.email!.trim().toLowerCase()));

  const toCreate: ParsedImportRow[] = [];
  let skippedDuplicates = 0;

  for (const row of rows) {
    const np = normalizePhone(row.phone);
    const ne = (row.email || '').trim().toLowerCase();
    let isDup = false;
    if (duplicateRule === 'phone') isDup = np.length >= 8 && existingPhones.has(np);
    else if (duplicateRule === 'email') isDup = ne.length > 0 && existingEmails.has(ne);
    else if (duplicateRule === 'phone_or_email') {
      isDup = (np.length >= 8 && existingPhones.has(np)) || (ne.length > 0 && existingEmails.has(ne));
    }

    if (isDup) {
      skippedDuplicates += 1;
      continue;
    }
    if (np.length >= 8) existingPhones.add(np);
    if (ne) existingEmails.add(ne);
    toCreate.push(row);
  }

  try {
    const CHUNK = 350;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = toCreate.slice(i, i + CHUNK);
      slice.forEach((row, idx) => {
        const id = makeId('lead');
        const leadCode = `LD-${Math.floor(3000 + Math.random() * 6999)}-${i + idx}`;
        const baseScore = computeBaselineLeadScore({
          ...row,
          status: 'New',
        });
        batch.set(
          doc(db, 'leads', id),
          stripUndefined({
            ...row,
            leadCode: leadCode.slice(0, 16),
            status: 'New' as LeadStatus,
            leadScore: baseScore.leadScore,
            scoreTier: baseScore.scoreTier,
            scoreSummary: baseScore.scoreSummary,
            scoreFactors: baseScore.scoreFactors,
            scoredAt: new Date().toISOString(),
            scoreModel: baseScore.scoreModel,
            leadDate: new Date().toISOString(),
            isArchived: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });
      await batch.commit();
    }
    await logActivity(actor, 'Bulk Lead Import', 'lead', 'bulk_import', `Imported ${toCreate.length} leads (${skippedDuplicates} duplicates skipped).`);
    return { imported: toCreate.length, skippedDuplicates };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

export function exportLeadsFile(leads: Lead[], format: 'csv' | 'xlsx') {
  const rows = leads.map((l) => ({
    'Lead ID': l.leadCode,
    'Customer Name': l.customerName,
    'Phone Number': l.phone,
    Email: l.email || '',
    City: l.city,
    State: l.state,
    'Employment Type': l.employmentType,
    'Monthly Income': l.monthlyIncome,
    'Required Loan Amount': l.requiredLoanAmount,
    'Loan Type': l.loanType,
    'Preferred Bank': l.preferredBank || '',
    'Lead Source': l.leadSource,
    'Assigned Employee': l.assignedEmployeeName || 'Unassigned',
    'Lead Status': l.status,
    Priority: l.priority,
    'Created Date': l.leadDate || l.createdAt,
    Remarks: l.remarks || '',
  }));

  if (format === 'csv') {
    const csv = Papa.unparse(rows);
    downloadTextFile(csv, `finbridge_leads_${new Date().toISOString().slice(0, 10)}.csv`);
  } else {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `finbridge_leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}

// ==================== CALL LOGS & FOLLOW-UPS ====================
export async function recordCallLog(
  actor: ActorContext,
  lead: Lead,
  employee: Employee,
  payload: {
    status: CallStatus;
    durationSeconds: number;
    remarks?: string;
    nextFollowUpDate?: string;
    updateLeadStatus?: LeadStatus;
  }
): Promise<string> {
  const callId = makeId('call');
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'call_logs', callId),
      stripUndefined({
        leadId: lead.id,
        leadCode: lead.leadCode,
        customerName: lead.customerName,
        customerPhone: lead.phone,
        employeeId: employee.id,
        employeeEmail: employee.email.toLowerCase(),
        employeeUid: actor.uid,
        employeeName: employee.fullName,
        callTime: new Date().toISOString(),
        durationSeconds: payload.durationSeconds,
        status: payload.status,
        remarks: payload.remarks,
        nextFollowUpDate: payload.nextFollowUpDate || undefined,
        createdAt: serverTimestamp(),
      })
    );

    const derivedLeadStatus: LeadStatus =
      payload.updateLeadStatus ||
      (payload.status === 'Interested'
        ? 'Interested'
        : payload.status === 'Not Interested'
        ? 'Not Interested'
        : payload.status === 'Callback Requested'
        ? 'Callback Requested'
        : lead.status === 'New'
        ? 'Contacted'
        : lead.status);

    const updatedLeadScore = computeBaselineLeadScore({
      ...lead,
      status: derivedLeadStatus,
    });

    batch.update(
      doc(db, 'leads', lead.id),
      stripUndefined({
        status: derivedLeadStatus,
        remarks: payload.remarks ? payload.remarks : lead.remarks,
        leadScore: updatedLeadScore.leadScore,
        scoreTier: updatedLeadScore.scoreTier,
        scoreSummary: updatedLeadScore.scoreSummary,
        scoreFactors: updatedLeadScore.scoreFactors,
        scoredAt: new Date().toISOString(),
        scoreModel: updatedLeadScore.scoreModel,
        updatedAt: serverTimestamp(),
      })
    );

    if (payload.nextFollowUpDate) {
      const fupId = makeId('fup');
      batch.set(
        doc(db, 'follow_ups', fupId),
        stripUndefined({
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          customerPhone: lead.phone,
          employeeId: employee.id,
          employeeEmail: employee.email.toLowerCase(),
          employeeUid: actor.uid,
          employeeName: employee.fullName,
          scheduledAt: new Date(payload.nextFollowUpDate).toISOString(),
          notes: payload.remarks || `Callback requested after ${payload.status} call.`,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    await batch.commit();
    await logActivity(actor, 'Call Logged', 'call_log', callId, `${employee.fullName} logged a ${payload.status} call with ${lead.customerName}.`);
    const callNotifs: CreateNotificationPayload[] = [];
    if (payload.nextFollowUpDate) {
      callNotifs.push({
        targetRole: 'staff',
        targetEmail: employee.email,
        category: 'follow_up_upcoming',
        severity: 'info',
        title: `Callback scheduled: ${lead.customerName}`,
        message: `Follow-up set for ${new Date(payload.nextFollowUpDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
        entityType: 'follow_up',
        entityId: lead.id,
        leadCode: lead.leadCode,
        actorName: actor.name,
      });
    }
    if (payload.status === 'Callback Requested' && lead.priority === 'High') {
      callNotifs.push({
        targetRole: 'admin',
        targetEmail: ADMIN_BROADCAST_EMAIL,
        category: 'lead_attention',
        severity: 'warning',
        title: `High-priority callback: ${lead.customerName}`,
        message: `${employee.fullName} logged Callback Requested on ${lead.leadCode}.`,
        entityType: 'lead',
        entityId: lead.id,
        leadCode: lead.leadCode,
        actorName: actor.name,
      });
    }
    if (callNotifs.length > 0) await pushCrmNotifications(callNotifs);
    return callId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `call_logs/${callId}`);
  }
}

export async function createFollowUp(
  actor: ActorContext,
  lead: Lead,
  employee: Employee,
  scheduledAt: string,
  notes?: string
): Promise<string> {
  const id = makeId('fup');
  try {
    await setDoc(
      doc(db, 'follow_ups', id),
      stripUndefined({
        leadId: lead.id,
        leadCode: lead.leadCode,
        customerName: lead.customerName,
        customerPhone: lead.phone,
        employeeId: employee.id,
        employeeEmail: employee.email.toLowerCase(),
        employeeUid: employee.uid || actor.uid,
        employeeName: employee.fullName,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, 'Follow-Up Scheduled', 'follow_up', id, `Scheduled follow-up for ${lead.customerName} (${employee.fullName}).`);
    await pushCrmNotifications([
      {
        targetRole: 'staff',
        targetEmail: employee.email,
        category: 'follow_up_upcoming',
        severity: 'info',
        title: `Upcoming follow-up: ${lead.customerName}`,
        message: `Scheduled for ${new Date(scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
        entityType: 'follow_up',
        entityId: id,
        leadCode: lead.leadCode,
        actorName: actor.name,
      },
    ]);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `follow_ups/${id}`);
  }
}

export async function completeFollowUp(
  actor: ActorContext,
  followUp: FollowUp,
  outcomeNotes: string
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'follow_ups', followUp.id),
      stripUndefined({
        status: 'completed',
        completedAt: new Date().toISOString(),
        outcomeNotes,
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, 'Follow-Up Completed', 'follow_up', followUp.id, `Completed follow-up for ${followUp.customerName}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `follow_ups/${followUp.id}`);
  }
}

export async function reassignFollowUp(
  actor: ActorContext,
  followUp: FollowUp,
  employee: Employee,
  scheduledAt?: string
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'follow_ups', followUp.id),
      stripUndefined({
        employeeId: employee.id,
        employeeEmail: employee.email.toLowerCase(),
        employeeUid: employee.uid,
        employeeName: employee.fullName,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, 'Follow-Up Reassigned', 'follow_up', followUp.id, `Reassigned follow-up for ${followUp.customerName} to ${employee.fullName}.`);
    await pushCrmNotifications([
      {
        targetRole: 'staff',
        targetEmail: employee.email,
        category: 'follow_up_upcoming',
        severity: 'warning',
        title: `Follow-up reassigned to you: ${followUp.customerName}`,
        message: `Scheduled at ${new Date(scheduledAt || followUp.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
        entityType: 'follow_up',
        entityId: followUp.id,
        leadCode: followUp.leadCode,
        actorName: actor.name,
      },
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `follow_ups/${followUp.id}`);
  }
}

// ==================== CUSTOMER DOCUMENTS ====================
async function fileToCompactDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/') && file.size > 350000) {
    // Compress large images on canvas so they stay comfortably under Firestore 1MB limit
    const bitmap = await createImageBitmap(file);
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
  }
  if (file.size > 650000) {
    throw new Error('File exceeds 650 KB limit for direct secure upload. Please upload a compressed PDF or image.');
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadCustomerDocument(
  actor: ActorContext,
  lead: Lead,
  employee: Employee,
  docType: DocumentType,
  file: File,
  existingDocToReplace?: CustomerDocument
): Promise<string> {
  const dataUrl = await fileToCompactDataUrl(file);
  const docId = existingDocToReplace ? existingDocToReplace.id : makeId('doc');

  try {
    const batch = writeBatch(db);
    if (existingDocToReplace) {
      batch.update(
        doc(db, 'customer_documents', docId),
        stripUndefined({
          fileName: file.name.slice(0, 240),
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          hasFileBlob: true,
          previewSummary: `Re-uploaded ${docType} (${file.name}).`,
          status: 'Pending' as DocumentStatus,
          rejectionReason: '',
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      batch.set(
        doc(db, 'customer_documents', docId),
        stripUndefined({
          leadId: lead.id,
          leadCode: lead.leadCode,
          customerName: lead.customerName,
          employeeId: employee.id,
          employeeEmail: employee.email,
          employeeUid: employee.uid || actor.uid,
          employeeName: employee.fullName,
          docType,
          fileName: file.name.slice(0, 240),
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          hasFileBlob: true,
          previewSummary: `Uploaded ${docType} (${file.name}).`,
          status: 'Pending' as DocumentStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    batch.set(
      doc(db, 'document_files', docId),
      stripUndefined({
        docId,
        leadId: lead.id,
        employeeEmail: employee.email,
        employeeUid: employee.uid || actor.uid,
        dataUrl,
        createdAt: serverTimestamp(),
      })
    );

    await batch.commit();
    await logActivity(actor, existingDocToReplace ? 'Document Re-uploaded' : 'Document Uploaded', 'customer_document', docId, `${docType} uploaded for ${lead.customerName}.`);
    await pushCrmNotifications([
      {
        targetRole: 'admin',
        targetEmail: ADMIN_BROADCAST_EMAIL,
        category: 'doc_update',
        severity: 'info',
        title: `${existingDocToReplace ? 'KYC Re-uploaded' : 'New KYC Pending Verification'}: ${docType}`,
        message: `${employee.fullName} uploaded ${docType} for ${lead.customerName} (${lead.leadCode}).`,
        entityType: 'customer_document',
        entityId: docId,
        leadCode: lead.leadCode,
        actorName: actor.name,
      },
    ]);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customer_documents/${docId}`);
  }
}

export async function fetchDocumentBlob(docItem: CustomerDocument): Promise<string | null> {
  if (!docItem.hasFileBlob) return null;
  try {
    const snap = await getDoc(doc(db, 'document_files', docItem.id));
    if (snap.exists()) {
      return String(snap.data().dataUrl || '');
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `document_files/${docItem.id}`);
  }
}

export async function verifyCustomerDocument(
  actor: ActorContext,
  docItem: CustomerDocument,
  status: DocumentStatus,
  rejectionReason?: string
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'customer_documents', docItem.id),
      stripUndefined({
        status,
        rejectionReason: status === 'Verified' ? '' : rejectionReason || 'Requires clearer scan.',
        verifiedByUid: actor.uid,
        verifiedByName: actor.name,
        verifiedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      })
    );
    await logActivity(actor, `Document ${status}`, 'customer_document', docItem.id, `${docItem.docType} for ${docItem.customerName} marked ${status}.`);
    const sev: NotificationSeverity = status === 'Verified' ? 'success' : status === 'Rejected' || status === 'Re-upload Required' ? 'urgent' : 'info';
    await pushCrmNotifications([
      {
        targetRole: 'staff',
        targetEmail: docItem.employeeEmail,
        category: 'doc_update',
        severity: sev,
        title: `KYC ${status}: ${docItem.docType}`,
        message:
          status === 'Verified'
            ? `${docItem.docType} for ${docItem.customerName} (${docItem.leadCode}) was verified.`
            : `${docItem.docType} for ${docItem.customerName}: ${rejectionReason || 'Requires clearer scan.'}`,
        entityType: 'customer_document',
        entityId: docItem.id,
        leadCode: docItem.leadCode,
        actorName: actor.name,
      },
      {
        targetRole: 'admin',
        targetEmail: ADMIN_BROADCAST_EMAIL,
        category: 'doc_update',
        severity: sev,
        title: `Document ${status}: ${docItem.docType}`,
        message: `${docItem.customerName} (${docItem.leadCode}) updated by ${actor.name}.`,
        entityType: 'customer_document',
        entityId: docItem.id,
        leadCode: docItem.leadCode,
        actorName: actor.name,
      },
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `customer_documents/${docItem.id}`);
  }
}

// ==================== BANKS & LOAN SCHEMES ====================
export async function saveBank(
  actor: ActorContext,
  payload: Omit<Bank, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || makeId('bank');
  try {
    if (existingId) {
      await updateDoc(doc(db, 'banks', id), { ...payload, updatedAt: serverTimestamp() });
      await logActivity(actor, 'Bank Updated', 'bank', id, `Updated partner bank ${payload.name}.`);
    } else {
      await setDoc(doc(db, 'banks', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity(actor, 'Bank Added', 'bank', id, `Added partner bank ${payload.name}.`);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `banks/${id}`);
  }
}

export async function deleteBank(actor: ActorContext, bank: Bank): Promise<void> {
  try {
    await deleteDoc(doc(db, 'banks', bank.id));
    await logActivity(actor, 'Bank Removed', 'bank', bank.id, `Removed partner bank ${bank.name}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `banks/${bank.id}`);
  }
}

export async function saveLoanScheme(
  actor: ActorContext,
  payload: Omit<LoanScheme, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || makeId('sch');
  try {
    if (existingId) {
      await updateDoc(doc(db, 'loan_schemes', id), stripUndefined({ ...payload, updatedAt: serverTimestamp() }));
      await logActivity(actor, 'Loan Scheme Updated', 'loan_scheme', id, `Updated scheme ${payload.schemeName} (${payload.bankName}).`);
    } else {
      await setDoc(
        doc(db, 'loan_schemes', id),
        stripUndefined({
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      await logActivity(actor, 'Loan Scheme Created', 'loan_scheme', id, `Created scheme ${payload.schemeName} (${payload.bankName}).`);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `loan_schemes/${id}`);
  }
}

export async function deleteLoanScheme(actor: ActorContext, scheme: LoanScheme): Promise<void> {
  try {
    await deleteDoc(doc(db, 'loan_schemes', scheme.id));
    await logActivity(actor, 'Loan Scheme Deleted', 'loan_scheme', scheme.id, `Deleted scheme ${scheme.schemeName}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `loan_schemes/${scheme.id}`);
  }
}

// ==================== LOAN APPLICATIONS ====================
export async function createLoanApplication(
  actor: ActorContext,
  lead: Lead,
  employee: Employee,
  bank: Bank,
  scheme: LoanScheme,
  payload: {
    loanAmount: number;
    bankReferenceNumber?: string;
    remarks?: string;
  }
): Promise<string> {
  const appId = makeId('app');
  const applicationCode = `APP-${Math.floor(202700 + Math.random() * 79999)}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'loan_applications', appId),
      stripUndefined({
        applicationCode,
        leadId: lead.id,
        leadCode: lead.leadCode,
        customerName: lead.customerName,
        customerPhone: lead.phone,
        employeeId: employee.id,
        employeeEmail: employee.email,
        employeeUid: employee.uid,
        employeeName: employee.fullName,
        bankId: bank.id,
        bankName: bank.name,
        schemeId: scheme.id,
        schemeName: scheme.schemeName,
        loanType: scheme.loanType,
        loanAmount: payload.loanAmount,
        applicationDate: new Date().toISOString(),
        status: 'Documents Pending' as LoanApplicationStatus,
        bankReferenceNumber: payload.bankReferenceNumber || `BNK-${bank.shortCode}-${Math.floor(1000 + Math.random() * 8999)}`,
        remarks: payload.remarks || `Application initiated for ${scheme.schemeName}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    batch.set(
      doc(db, 'loan_status_history', makeId('lsh')),
      stripUndefined({
        applicationId: appId,
        applicationCode,
        employeeEmail: employee.email,
        fromStatus: 'Lead Interested',
        toStatus: 'Documents Pending',
        remarks: payload.remarks || 'Application created and queued for KYC submission.',
        changedByUid: actor.uid,
        changedByName: actor.name,
        createdAt: serverTimestamp(),
      })
    );

    batch.update(doc(db, 'leads', lead.id), {
      status: 'Qualified',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    await logActivity(actor, 'Application Created', 'loan_application', appId, `Created ${applicationCode} for ${lead.customerName} (${bank.name}).`);
    return appId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `loan_applications/${appId}`);
  }
}

export async function updateLoanApplicationStatus(
  actor: ActorContext,
  app: LoanApplication,
  newStatus: LoanApplicationStatus,
  remarks: string,
  bankReferenceNumber?: string,
  disbursedAmount?: number
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'loan_applications', app.id),
      stripUndefined({
        status: newStatus,
        remarks,
        ...(bankReferenceNumber ? { bankReferenceNumber } : {}),
        ...(newStatus === 'Disbursed'
          ? {
              disbursedAmount: disbursedAmount || app.loanAmount,
              disbursedAt: new Date().toISOString(),
            }
          : {}),
        updatedAt: serverTimestamp(),
      })
    );

    batch.set(
      doc(db, 'loan_status_history', makeId('lsh')),
      stripUndefined({
        applicationId: app.id,
        applicationCode: app.applicationCode,
        employeeEmail: app.employeeEmail,
        fromStatus: app.status,
        toStatus: newStatus,
        remarks,
        changedByUid: actor.uid,
        changedByName: actor.name,
        createdAt: serverTimestamp(),
      })
    );

    if (newStatus === 'Disbursed' || newStatus === 'Approved') {
      batch.update(doc(db, 'leads', app.leadId), {
        status: 'Converted',
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await logActivity(
      actor,
      `Application ${newStatus}`,
      'loan_application',
      app.id,
      `${app.applicationCode} (${app.customerName}) moved from ${app.status} to ${newStatus}.`
    );
    await pushCrmNotifications([
      {
        targetRole: 'staff',
        targetEmail: app.employeeEmail,
        category: 'application_update',
        severity: newStatus === 'Approved' || newStatus === 'Disbursed' ? 'success' : newStatus === 'Rejected' ? 'urgent' : 'info',
        title: `Application ${newStatus}: ${app.applicationCode}`,
        message: `${app.customerName} (${app.bankName}) moved to ${newStatus}.`,
        entityType: 'loan_application',
        entityId: app.id,
        leadCode: app.leadCode,
        actorName: actor.name,
      },
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `loan_applications/${app.id}`);
  }
}

export async function addStaffApplicationRemark(
  actor: ActorContext,
  app: LoanApplication,
  remarks: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'loan_applications', app.id), {
      remarks,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, 'Application Note Added', 'loan_application', app.id, `${actor.name} updated remarks on ${app.applicationCode}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `loan_applications/${app.id}`);
  }
}

export async function updateDuplicateRule(actor: ActorContext, duplicateRule: DuplicateRule): Promise<void> {
  try {
    await updateDoc(doc(db, 'settings', 'global'), {
      duplicateRule,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, 'Settings Updated', 'settings', 'global', `Duplicate lead detection rule set to ${duplicateRule}.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
  }
}

export async function fetchAllStatusHistoryForApp(applicationId: string) {
  try {
    const snap = await getDocs(collection(db, 'loan_status_history'));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((h: Record<string, unknown>) => h.applicationId === applicationId);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'loan_status_history');
  }
}

export interface AiScoredResult {
  id: string;
  leadScore: number;
  scoreTier: 'Hot' | 'Warm' | 'Cold';
  recommendedPriority: LeadPriority;
  scoreFactors: {
    demographics: number;
    financialCapacity: number;
    sourceQuality: number;
    engagementHistory: number;
  };
  scoreSummary: string;
  scoreModel: string;
}

export async function scoreLeadsWithAI(
  actor: ActorContext,
  targetLeads: Lead[],
  allCalls: CallLog[],
  allFollowUps: FollowUp[],
  allDocs: CustomerDocument[]
): Promise<AiScoredResult[]> {
  if (targetLeads.length === 0) return [];
  const batchLeads = targetLeads.slice(0, 15);
  const nowMs = Date.now();

  const payloadLeads = batchLeads.map((lead) => {
    const leadCalls = allCalls.filter((c) => c.leadId === lead.id);
    const leadFups = allFollowUps.filter((f) => f.leadId === lead.id);
    const leadDocs = allDocs.filter((d) => d.leadId === lead.id);
    const sortedCalls = [...leadCalls].sort((a, b) =>
      String(b.callTime || '').localeCompare(String(a.callTime || ''))
    );
    return {
      id: lead.id,
      leadCode: lead.leadCode,
      customerName: lead.customerName,
      city: lead.city,
      state: lead.state,
      employmentType: lead.employmentType,
      monthlyIncome: lead.monthlyIncome,
      requiredLoanAmount: lead.requiredLoanAmount,
      loanType: lead.loanType,
      leadSource: lead.leadSource,
      status: lead.status,
      priority: lead.priority,
      callStats: {
        totalCalls: leadCalls.length,
        connectedCalls: leadCalls.filter((c) => ['Connected', 'Interested', 'Callback Requested'].includes(c.status)).length,
        interestedCalls: leadCalls.filter((c) => c.status === 'Interested').length,
        notInterestedCalls: leadCalls.filter((c) => c.status === 'Not Interested').length,
        callbackRequests: leadCalls.filter((c) => c.status === 'Callback Requested').length,
        lastCallStatus: sortedCalls[0]?.status,
        lastCallRemarks: sortedCalls[0]?.remarks?.slice(0, 180),
      },
      followUpStats: {
        totalFollowUps: leadFups.length,
        completedFollowUps: leadFups.filter((f) => f.status === 'completed').length,
        pendingFollowUps: leadFups.filter((f) => f.status === 'pending').length,
        overdueFollowUps: leadFups.filter((f) => f.status === 'pending' && new Date(f.scheduledAt).getTime() < nowMs).length,
      },
      docCount: leadDocs.length,
    };
  });

  const res = await fetch('/api/ai/score-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: payloadLeads }),
  });

  const body = (await res.json()) as { results?: AiScoredResult[]; error?: string };
  if (!res.ok || !body.results) {
    throw new Error(body.error || 'AI Lead Scoring service returned an error.');
  }

  try {
    const batch = writeBatch(db);
    const scoredAt = new Date().toISOString();
    const hotNotifications: CreateNotificationPayload[] = [];

    for (const item of body.results) {
      const leadObj = batchLeads.find((l) => l.id === item.id);
      if (!leadObj) continue;

      batch.update(
        doc(db, 'leads', leadObj.id),
        stripUndefined({
          leadScore: item.leadScore,
          scoreTier: item.scoreTier,
          scoreSummary: item.scoreSummary,
          scoreFactors: item.scoreFactors,
          scoredAt,
          scoreModel: item.scoreModel,
          priority: item.recommendedPriority,
          updatedAt: serverTimestamp(),
        })
      );

      if (item.scoreTier === 'Hot') {
        hotNotifications.push({
          targetRole: leadObj.assignedEmployeeEmail ? 'staff' : 'admin',
          targetEmail: leadObj.assignedEmployeeEmail || ADMIN_BROADCAST_EMAIL,
          category: 'lead_attention',
          severity: 'urgent',
          title: `Hot Lead Scored (${item.leadScore}/100): ${leadObj.leadCode}`,
          message: `${leadObj.customerName} (${leadObj.loanType}) — ${item.scoreSummary}`,
          entityType: 'lead',
          entityId: leadObj.id,
          leadCode: leadObj.leadCode,
          actorName: actor.name,
        });
      }
    }

    await batch.commit();
    await logActivity(
      actor,
      'AI Lead Scoring',
      'lead',
      batchLeads[0].id,
      `Scored ${body.results.length} lead(s) using Gemini AI (${body.results.filter((r) => r.scoreTier === 'Hot').length} Hot).`
    );
    if (hotNotifications.length > 0) {
      await pushCrmNotifications(hotNotifications.slice(0, 5));
    }
    return body.results;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'leads');
  }
}

