import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  GitBranch,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
  Search,
  Smartphone,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCrmData } from '../../context/CrmDataContext';
import { cn, getDateKey, getTodayKey } from '../../lib/utils';
import { NotificationCenter } from '../ui/NotificationCenter';
import { FinBridgeLogo } from '../ui/FinBridgeLogo';

export type AdminTab =
  | 'dashboard'
  | 'leads'
  | 'distribution'
  | 'employees'
  | 'calls'
  | 'followups'
  | 'documents'
  | 'banks'
  | 'applications'
  | 'reports';

interface NavGroup {
  label: string;
  items: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Pipeline & Calling',
    items: [
      { id: 'leads', label: 'Lead Management', icon: Users },
      { id: 'distribution', label: 'Lead Distribution', icon: GitBranch },
      { id: 'employees', label: 'Employees', icon: UserCheck },
      { id: 'calls', label: 'Call Logs', icon: PhoneCall },
      { id: 'followups', label: 'Follow-ups', icon: CalendarClock },
    ],
  },
  {
    label: 'Underwriting & Partners',
    items: [
      { id: 'documents', label: 'Documents & KYC', icon: FileCheck2 },
      { id: 'banks', label: 'Banks & Schemes', icon: Landmark },
      { id: 'applications', label: 'Loan Applications', icon: Building2 },
    ],
  },
  {
    label: 'Insights',
    items: [{ id: 'reports', label: 'Reports & Analytics', icon: BarChart3 }],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function AdminLayout({
  activeTab,
  onSelectTab,
  globalSearch,
  onGlobalSearchChange,
  children,
}: {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  children: React.ReactNode;
}) {
  const { userProfile, role, setPortalMode, signOut } = useAuth();
  const { seeding, leads, followUps, documents } = useCrmData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  const navCounts = useMemo<Partial<Record<AdminTab, { count: number; urgent?: boolean }>>>(() => {
    const todayKey = getTodayKey();
    const unassignedCount = leads.filter((l) => !l.isArchived && !l.assignedEmployeeId).length;
    const dueFollowups = followUps.filter(
      (f) => f.status === 'pending' && getDateKey(f.scheduledAt) <= todayKey
    ).length;
    const pendingDocs = documents.filter((d) => d.status === 'Pending').length;
    return {
      distribution: unassignedCount > 0 ? { count: unassignedCount, urgent: true } : undefined,
      followups: dueFollowups > 0 ? { count: dueFollowups, urgent: true } : undefined,
      documents: pendingDocs > 0 ? { count: pendingDocs } : undefined,
    };
  }, [leads, followUps, documents]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setProfileOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim() && activeTab !== 'leads') {
      onSelectTab('leads');
    }
  };

  if (role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex">
      {/* Desktop Collapsible Obsidian Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-[#0B1220] text-slate-300 border-r border-slate-800/80 transition-all duration-150 shrink-0 sticky top-0 h-screen',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.08] shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <FinBridgeLogo size="sm" variant="dark" />
              <div className="min-w-0">
                <span className="font-display font-bold text-sm text-white truncate block leading-tight">
                  FinBridge CRM
                </span>
                <span className="text-[10.5px] text-slate-400 truncate block">Admin Console</span>
              </div>
            </div>
          ) : (
            <FinBridgeLogo size="sm" variant="dark" className="mx-auto" />
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-medium text-slate-400/80 mb-1.5">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const badge = navCounts[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'relative w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-blue-500"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-400' : 'text-slate-400')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!collapsed && badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10.5px] font-semibold tabular-nums leading-none shrink-0',
                          badge.urgent
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/[0.08] text-slate-300'
                        )}
                      >
                        {badge.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.08] space-y-1 shrink-0">
          {!collapsed && (
            <p className="px-3 text-[11px] font-medium text-slate-400/80 mb-1">Workspaces</p>
          )}
          <button
            type="button"
            onClick={() => setPortalMode('mobile_admin')}
            title={collapsed ? 'Mobile Admin (/admin/mobile)' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            <Smartphone className="w-4 h-4 shrink-0 text-blue-400" />
            {!collapsed && <span>Mobile Admin UI</span>}
          </button>
          <button
            type="button"
            onClick={() => setPortalMode('staff')}
            title={collapsed ? 'Staff Portal View' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            <Users className="w-4 h-4 shrink-0 text-emerald-400" />
            {!collapsed && <span>Staff Portal View</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-out Drawer for Desktop Admin on Narrow Screens */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex bg-slate-950/60 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-72 bg-[#0B1220] text-slate-200 h-full flex flex-col shadow-2xl">
            <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.08]">
              <span className="font-display font-bold text-white">FinBridge CRM</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-3 text-[11px] font-medium text-slate-400/80">{group.label}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    const badge = navCounts[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                          active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-400' : 'text-slate-400')} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {badge && (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums leading-none',
                              badge.urgent ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.08] text-slate-300'
                            )}
                          >
                            {badge.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="p-3 border-t border-white/[0.08] space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPortalMode('mobile_admin');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-white/10 text-white"
              >
                <Smartphone className="w-4 h-4 text-blue-400" />
                Open Mobile Admin UI
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPortalMode('staff');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                Preview Staff Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Admin Portal</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold font-display text-slate-900 truncate">{currentNav.label}</h1>
            </div>
            {seeding && (
              <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
                Initializing demo data...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <form onSubmit={handleGlobalSearchSubmit} className="hidden sm:block relative w-64 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="search"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Search leads..."
                className="w-full pl-9 pr-12 py-1.5 text-sm bg-slate-50/90 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15 focus:border-blue-600 transition-all"
              />
              <kbd className="pointer-events-none hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded absolute right-2 top-1/2 -translate-y-1/2">
                /
              </kbd>
            </form>

            {/* Quick Mobile Admin Toggle Button */}
            <button
              type="button"
              onClick={() => setPortalMode('mobile_admin')}
              className="hidden lg:inline-flex crm-btn-secondary py-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Mobile Admin
            </button>

            {/* Real-Time Notifications */}
            <NotificationCenter
              scope="admin"
              onNavigate={(tab) => onSelectTab(tab as AdminTab)}
            />

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              >
                {!avatarError ? (
                  <img
                    src="/src/assets/images/avatar_admin_director_1795325977708.jpg"
                    alt={userProfile?.fullName || 'Admin'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-7 h-7 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {(userProfile?.fullName || 'A').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[120px] leading-tight">
                    {userProfile?.fullName || 'CRM Admin'}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">Administrator</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="crm-anim-fade absolute right-0 mt-2 w-60 bg-white border border-slate-200/90 rounded-xl shadow-[0_14px_34px_rgba(15,23,42,0.12)] overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-900 truncate">{userProfile?.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{userProfile?.email}</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setPortalMode('mobile_admin');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      Switch to Mobile Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setPortalMode('staff');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Users className="w-4 h-4 text-emerald-600" />
                      Preview Staff Portal
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
