import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where, type Query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getDateKey, getTodayKey, toIsoString } from '../lib/utils';
import {
  markAllNotificationsRead,
  markNotificationRead,
  pushCrmNotifications,
  type CreateNotificationPayload,
} from '../services/crmService';
import { seedDatabaseIfNeeded, seedNotificationsIfMissing } from '../services/seedService';
import type {
  ActivityLog,
  Bank,
  CallLog,
  CrmNotification,
  CrmSettings,
  CustomerDocument,
  Employee,
  FollowUp,
  Lead,
  LeadAssignment,
  LoanApplication,
  LoanScheme,
  LoanStatusHistory,
} from '../types/crm';
import { useAuth } from './AuthContext';

export interface ToastNotification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'info';
}

interface CrmDataContextValue {
  employees: Employee[];
  leads: Lead[];
  leadAssignments: LeadAssignment[];
  callLogs: CallLog[];
  followUps: FollowUp[];
  documents: CustomerDocument[];
  banks: Bank[];
  schemes: LoanScheme[];
  applications: LoanApplication[];
  statusHistory: LoanStatusHistory[];
  activityLogs: ActivityLog[];
  notifications: CrmNotification[];
  settings: CrmSettings;
  dataLoading: boolean;
  seeding: boolean;
  dataError: string | null;
  realtimeConnected: boolean;
  browserPushEnabled: boolean;
  toggleBrowserPush: () => Promise<void>;
  markNotificationAsRead: (notifId: string) => Promise<void>;
  markAllNotificationsAsRead: (subset?: CrmNotification[]) => Promise<void>;
  toasts: ToastNotification[];
  notify: (title: string, message?: string, type?: ToastNotification['type']) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_SETTINGS: CrmSettings = {
  id: 'global',
  duplicateRule: 'phone_or_email',
  defaultDailyCallTarget: 45,
  roundRobinIndex: 0,
  seeded: false,
  updatedAt: new Date().toISOString(),
};

const CrmDataContext = createContext<CrmDataContextValue | null>(null);

function normalizeDoc<T extends object>(id: string, raw: Record<string, unknown>): T {
  const copy: Record<string, unknown> = { id, ...raw };
  if ('createdAt' in copy) copy.createdAt = toIsoString(copy.createdAt);
  if ('updatedAt' in copy) copy.updatedAt = toIsoString(copy.updatedAt);
  return copy as T;
}

export function CrmDataProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, userProfile, role, portalMode, inspectedStaffEmail } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadAssignments, setLeadAssignments] = useState<LeadAssignment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [schemes, setSchemes] = useState<LoanScheme[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [statusHistory, setStatusHistory] = useState<LoanStatusHistory[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [settings, setSettings] = useState<CrmSettings>(DEFAULT_SETTINGS);

  const [dataLoading, setDataLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(
    () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const syncedAlertIdsRef = useRef<Set<string>>(new Set());
  const activePortalScopeRef = useRef({ role, portalMode, inspectedStaffEmail, userEmail: userProfile?.email || '' });
  activePortalScopeRef.current = {
    role,
    portalMode,
    inspectedStaffEmail,
    userEmail: userProfile?.email || '',
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, message?: string, type: ToastNotification['type'] = 'success') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  const toggleBrowserPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      notify('Browser alerts unavailable', 'Your browser does not support native notifications.', 'info');
      return;
    }
    if (Notification.permission === 'granted') {
      setBrowserPushEnabled((prev) => !prev);
      return;
    }
    const perm = await Notification.requestPermission();
    const granted = perm === 'granted';
    setBrowserPushEnabled(granted);
    if (granted) {
      notify('Desktop alerts enabled', 'You will receive live browser alerts for new CRM events.');
    } else {
      notify('Permission declined', 'In-app real-time alerts remain active.', 'info');
    }
  }, [notify]);

  const markNotificationAsRead = useCallback(async (notifId: string) => {
    await markNotificationRead(notifId);
  }, []);

  const markAllNotificationsAsRead = useCallback(
    async (subset?: CrmNotification[]) => {
      await markAllNotificationsRead(subset || notifications);
    },
    [notifications]
  );

  useEffect(() => {
    if (!firebaseUser || !userProfile) {
      setEmployees([]);
      setLeads([]);
      setLeadAssignments([]);
      setCallLogs([]);
      setFollowUps([]);
      setDocuments([]);
      setBanks([]);
      setSchemes([]);
      setApplications([]);
      setStatusHistory([]);
      setActivityLogs([]);
      setNotifications([]);
      setRealtimeConnected(false);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const setup = async () => {
      setDataLoading(true);
      setDataError(null);

      try {
        if (role === 'admin') {
          setSeeding(true);
          await seedDatabaseIfNeeded(firebaseUser.uid, userProfile.fullName, userProfile.email);
          await seedNotificationsIfMissing(userProfile.fullName);
          if (!cancelled) setSeeding(false);
        }
      } catch (err) {
        console.error('Seed check error:', err);
        if (!cancelled) setSeeding(false);
      }

      if (cancelled) return;

      const userEmail = userProfile.email;
      const attach = <T extends object>(
        colName: string,
        q: Query,
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        sortKey?: keyof T
      ) => {
        const unsub = onSnapshot(
          q,
          (snap) => {
            const list = snap.docs.map((d) => normalizeDoc<T>(d.id, d.data() as Record<string, unknown>));
            if (sortKey) {
              list.sort((a, b) => String(b[sortKey] || '').localeCompare(String(a[sortKey] || '')));
            }
            setter(list);
          },
          (err) => {
            console.error(`Snapshot error (${colName}):`, err);
            setDataError(`Unable to sync ${colName}. Please verify permissions.`);
            try {
              handleFirestoreError(err, OperationType.LIST, colName);
            } catch {
              // Logged by handleFirestoreError
            }
          }
        );
        unsubs.push(unsub);
      };

      const empQuery =
        role === 'admin'
          ? collection(db, 'employees')
          : query(collection(db, 'employees'), where('email', '==', userEmail));
      attach<Employee>('employees', empQuery, setEmployees, 'employeeCode');

      const leadsQuery =
        role === 'admin'
          ? collection(db, 'leads')
          : query(collection(db, 'leads'), where('assignedEmployeeEmail', '==', userEmail));
      attach<Lead>('leads', leadsQuery, setLeads, 'leadDate');

      const asgQuery =
        role === 'admin'
          ? collection(db, 'lead_assignments')
          : query(collection(db, 'lead_assignments'), where('toEmployeeEmail', '==', userEmail));
      attach<LeadAssignment>('lead_assignments', asgQuery, setLeadAssignments, 'createdAt');

      const callsQuery =
        role === 'admin'
          ? collection(db, 'call_logs')
          : query(collection(db, 'call_logs'), where('employeeEmail', '==', userEmail));
      attach<CallLog>('call_logs', callsQuery, setCallLogs, 'callTime');

      const fupQuery =
        role === 'admin'
          ? collection(db, 'follow_ups')
          : query(collection(db, 'follow_ups'), where('employeeEmail', '==', userEmail));
      attach<FollowUp>('follow_ups', fupQuery, setFollowUps, 'scheduledAt');

      const docsQuery =
        role === 'admin'
          ? collection(db, 'customer_documents')
          : query(collection(db, 'customer_documents'), where('employeeEmail', '==', userEmail));
      attach<CustomerDocument>('customer_documents', docsQuery, setDocuments, 'createdAt');

      attach<Bank>('banks', collection(db, 'banks'), setBanks, 'name');
      attach<LoanScheme>('loan_schemes', collection(db, 'loan_schemes'), setSchemes, 'schemeName');

      const appsQuery =
        role === 'admin'
          ? collection(db, 'loan_applications')
          : query(collection(db, 'loan_applications'), where('employeeEmail', '==', userEmail));
      attach<LoanApplication>('loan_applications', appsQuery, setApplications, 'applicationDate');

      const histQuery =
        role === 'admin'
          ? collection(db, 'loan_status_history')
          : query(collection(db, 'loan_status_history'), where('employeeEmail', '==', userEmail));
      attach<LoanStatusHistory>('loan_status_history', histQuery, setStatusHistory, 'createdAt');

      const actQuery =
        role === 'admin'
          ? collection(db, 'activity_logs')
          : query(collection(db, 'activity_logs'), where('actorEmail', '==', userEmail));
      attach<ActivityLog>('activity_logs', actQuery, setActivityLogs, 'createdAt');

      // Real-time persistent push listener for notifications
      let isInitialNotifSnap = true;
      const notifQuery =
        role === 'admin'
          ? collection(db, 'notifications')
          : query(collection(db, 'notifications'), where('targetEmail', '==', userEmail));

      const notifUnsub = onSnapshot(
        notifQuery,
        (snap) => {
          setRealtimeConnected(true);
          const list = snap.docs.map((d) => normalizeDoc<CrmNotification>(d.id, d.data() as Record<string, unknown>));
          list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          setNotifications(list);

          if (isInitialNotifSnap) {
            isInitialNotifSnap = false;
            return;
          }

          const scope = activePortalScopeRef.current;
          const viewingStaff = scope.role === 'staff' || scope.portalMode === 'staff';
          const activeTargetEmail = (scope.role === 'staff' ? scope.userEmail : scope.inspectedStaffEmail).toLowerCase();

          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const n = normalizeDoc<CrmNotification>(change.doc.id, change.doc.data() as Record<string, unknown>);
            if (n.read) return;

            const matchesActiveView = viewingStaff
              ? n.targetRole === 'staff' && n.targetEmail.toLowerCase() === activeTargetEmail
              : n.targetRole === 'admin';

            if (!matchesActiveView) return;

            const toastTone: ToastNotification['type'] =
              n.severity === 'urgent' ? 'error' : n.severity === 'success' ? 'success' : 'info';
            notify(n.title, n.message, toastTone);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(n.title, { body: n.message });
              } catch {
                // Ignore browser notification restrictions inside iframes
              }
            }
          });
        },
        (err) => {
          setRealtimeConnected(false);
          console.error('Snapshot error (notifications):', err);
        }
      );
      unsubs.push(notifUnsub);

      const settingsUnsub = onSnapshot(
        collection(db, 'settings'),
        (snap) => {
          const globalDoc = snap.docs.find((d) => d.id === 'global');
          if (globalDoc) {
            setSettings(normalizeDoc<CrmSettings>(globalDoc.id, globalDoc.data() as Record<string, unknown>));
          }
          setDataLoading(false);
        },
        () => {
          setDataLoading(false);
        }
      );
      unsubs.push(settingsUnsub);
    };

    void setup();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, userProfile, role, notify]);

  // Idempotent threshold sync: ensure overdue follow-ups & pending KYC documents emit persisted notifications
  useEffect(() => {
    if (!firebaseUser || !userProfile || dataLoading || seeding) return;
    if (followUps.length === 0 && documents.length === 0) return;

    const existingIds = new Set(notifications.map((n) => n.id));
    const toCreate: CreateNotificationPayload[] = [];
    const nowMs = Date.now();
    const todayKey = getTodayKey();

    if (role === 'admin') {
      const overdue = followUps
        .filter((f) => f.status === 'pending' && new Date(f.scheduledAt).getTime() < nowMs)
        .slice(0, 3);
      overdue.forEach((f) => {
        const id = `ntf_adm_over_${f.id}`;
        if (!existingIds.has(id) && !syncedAlertIdsRef.current.has(id)) {
          syncedAlertIdsRef.current.add(id);
          toCreate.push({
            id,
            targetRole: 'admin',
            targetEmail: 'admin@loancrm.com',
            category: 'lead_attention',
            severity: 'urgent',
            title: `Overdue follow-up: ${f.customerName}`,
            message: `Assigned to ${f.employeeName} (${f.leadCode}) — requires immediate attention.`,
            entityType: 'follow_up',
            entityId: f.id,
            leadCode: f.leadCode,
            actorName: 'SLA Watchdog',
          });
        }
      });

      const pendingDocs = documents.filter((d) => d.status === 'Pending').slice(0, 2);
      pendingDocs.forEach((d) => {
        const id = `ntf_adm_doc_${d.id}`;
        if (!existingIds.has(id) && !syncedAlertIdsRef.current.has(id)) {
          syncedAlertIdsRef.current.add(id);
          toCreate.push({
            id,
            targetRole: 'admin',
            targetEmail: 'admin@loancrm.com',
            category: 'doc_update',
            severity: 'warning',
            title: `KYC awaiting review: ${d.docType}`,
            message: `${d.customerName} (${d.leadCode}) uploaded by ${d.employeeName}.`,
            entityType: 'customer_document',
            entityId: d.id,
            leadCode: d.leadCode,
            actorName: d.employeeName,
          });
        }
      });
    } else {
      const myDue = followUps
        .filter(
          (f) =>
            f.status === 'pending' &&
            f.employeeEmail.toLowerCase() === userProfile.email.toLowerCase() &&
            getDateKey(f.scheduledAt) <= todayKey
        )
        .slice(0, 3);
      myDue.forEach((f) => {
        const id = `ntf_stf_due_${f.id}`;
        if (!existingIds.has(id) && !syncedAlertIdsRef.current.has(id)) {
          syncedAlertIdsRef.current.add(id);
          toCreate.push({
            id,
            targetRole: 'staff',
            targetEmail: f.employeeEmail,
            category: 'follow_up_upcoming',
            severity: new Date(f.scheduledAt).getTime() < nowMs ? 'urgent' : 'warning',
            title: `Follow-up due: ${f.customerName}`,
            message: `${f.leadCode} scheduled for ${new Date(f.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
            entityType: 'follow_up',
            entityId: f.id,
            leadCode: f.leadCode,
            actorName: 'Scheduler',
          });
        }
      });
    }

    if (toCreate.length > 0) {
      void pushCrmNotifications(toCreate);
    }
  }, [firebaseUser, userProfile, role, dataLoading, seeding, followUps, documents, notifications]);

  return (
    <CrmDataContext.Provider
      value={{
        employees,
        leads,
        leadAssignments,
        callLogs,
        followUps,
        documents,
        banks,
        schemes,
        applications,
        statusHistory,
        activityLogs,
        notifications,
        settings,
        dataLoading,
        seeding,
        dataError,
        realtimeConnected,
        browserPushEnabled,
        toggleBrowserPush,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </CrmDataContext.Provider>
  );
}

export function useCrmData() {
  const ctx = useContext(CrmDataContext);
  if (!ctx) throw new Error('useCrmData must be used inside CrmDataProvider');
  return ctx;
}
