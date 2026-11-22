import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FinBridgeLogo } from './components/ui/FinBridgeLogo';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLayout, type AdminTab } from './components/admin/AdminLayout';
import { BankSchemeManagement } from './components/admin/BankSchemeManagement';
import { CallManagement } from './components/admin/CallManagement';
import { DocumentManagement } from './components/admin/DocumentManagement';
import { EmployeeManagement } from './components/admin/EmployeeManagement';
import { FollowUpManagement } from './components/admin/FollowUpManagement';
import { LeadDistribution } from './components/admin/LeadDistribution';
import { LeadManagement } from './components/admin/LeadManagement';
import { LoanApplicationManagement } from './components/admin/LoanApplicationManagement';
import { ReportsAnalytics } from './components/admin/ReportsAnalytics';
import { LoginPage } from './components/auth/LoginPage';
import { MobileAdminApp } from './components/mobile/MobileAdminApp';
import { StaffPortal } from './components/staff/StaffPortal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CrmDataProvider, useCrmData } from './context/CrmDataContext';

function CrmWorkspaceRouter() {
  const { firebaseUser, userProfile, role, loading, portalMode, signOut } = useAuth();
  const { seeding, dataError } = useCrmData();
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-6">
        <FinBridgeLogo size="lg" variant="light" className="mb-3" />
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Authenticating FinBridge CRM session...</span>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !userProfile) {
    return <LoginPage />;
  }

  if (userProfile.status === 'inactive') {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-slate-900">Account Deactivated</h2>
          <p className="text-sm text-slate-600">
            Your workspace account ({userProfile.email}) is currently marked inactive. Contact your CRM Administrator to restore access.
          </p>
          <button type="button" onClick={signOut} className="crm-btn-secondary mx-auto">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (role === 'staff' || portalMode === 'staff') {
    return <StaffPortal />;
  }

  if (portalMode === 'mobile_admin') {
    return <MobileAdminApp />;
  }

  return (
    <AdminLayout
      activeTab={adminTab}
      onSelectTab={setAdminTab}
      globalSearch={globalSearch}
      onGlobalSearchChange={(val) => {
        setGlobalSearch(val);
        if (val.trim() && adminTab !== 'leads') {
          setAdminTab('leads');
        }
      }}
    >
      {dataError && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {dataError}
        </div>
      )}
      {seeding && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Preparing initial demo data across 110 leads, 20 staff agents, 6 banks, and 12 loan schemes...
        </div>
      )}
      {adminTab === 'dashboard' && <AdminDashboard onNavigate={setAdminTab} />}
      {adminTab === 'leads' && <LeadManagement initialSearch={globalSearch} />}
      {adminTab === 'distribution' && <LeadDistribution />}
      {adminTab === 'employees' && <EmployeeManagement />}
      {adminTab === 'calls' && <CallManagement />}
      {adminTab === 'followups' && <FollowUpManagement />}
      {adminTab === 'documents' && <DocumentManagement />}
      {adminTab === 'banks' && <BankSchemeManagement />}
      {adminTab === 'applications' && <LoanApplicationManagement />}
      {adminTab === 'reports' && <ReportsAnalytics />}
    </AdminLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CrmDataProvider>
          <CrmWorkspaceRouter />
          <ToastContainer />
        </CrmDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
