import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
  UserCheck,
  Clock,
  Send,
  CheckCircle,
  Trash2,
  Briefcase,
  Calendar,
  UserPlus,
  UsersRound,
  CreditCard,
  Link2,
  Banknote,
  Calculator,
  Shield,
  MessageSquare,
  GraduationCap,
  FileSearch,
  Sparkles,
  Radar,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule, type ModuleKey } from '@/lib/permissions';
import { AppLogo } from '@/components/ui/AppLogo';
import { DEFAULT_APP_TITLE } from '@/lib/branding';
import { cn } from '@/lib/utils';

const ticketNavItems = [
  { to: '/tickets?view=all', label: 'All Tickets', icon: ClipboardList },
  { to: '/tickets?view=new_resumes', label: 'New Resumes', icon: FileText },
  { to: '/tickets?view=existing_resume', label: 'Existing Resume', icon: FileText },
  { to: '/tickets?view=my_tickets', label: 'My Tickets', icon: UserCheck, resumeOnly: true },
  { to: '/tickets?view=group_created', label: 'Group Created', icon: CheckCircle },
  { to: '/tickets?view=waiting_for_approval', label: 'Waiting for Approval', icon: Clock },
  { to: '/tickets?view=sent_to_onboarding', label: 'Sent to Onboarding', icon: Send },
  { to: '/tickets?view=onboarded', label: 'Onboarded Successfully', icon: CheckCircle },
  { to: '/tickets?view=deleted', label: 'Deleted Tickets', icon: Trash2 },
];

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: boolean;
  showAdmin?: boolean;
  showPlatform?: boolean;
  module?: ModuleKey;
};

const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
  { to: '/students', label: 'All Students', icon: GraduationCap, module: 'students' },
  { to: '/search-resume', label: 'Search Resume', icon: FileSearch, module: 'ats' },
  { to: '/ats-resumes', label: 'ATS Resumes', icon: FileText, module: 'ats' },
  { to: '/create', label: 'Create Ticket', icon: Plus, show: true, module: 'tickets' },
  { to: '/interviews', label: 'Interviews', icon: Calendar, module: 'interviews' },
  { to: '/placements', label: 'Job Placements', icon: Briefcase, module: 'placements' },
  { to: '/job-scrap', label: 'Job Scrap', icon: Radar, showAdmin: true, module: 'job_scrap' },
  { to: '/teams', label: 'Teams', icon: UsersRound, showAdmin: true, module: 'teams' },
  { to: '/my-team', label: 'My Team', icon: UserCheck, module: 'teams' },
  { to: '/recruiters', label: 'Recruiters', icon: UserPlus, showAdmin: true, module: 'recruiters' },
  { to: '/payments', label: 'Payments', icon: CreditCard, showAdmin: true, module: 'payments' },
  { to: '/payment-links', label: 'Payment Links', icon: Link2, showAdmin: true, module: 'payments' },
  { to: '/salaries', label: 'Salaries', icon: Banknote, module: 'salaries' },
  { to: '/generate-billing', label: 'Generate Billing', icon: Calculator, module: 'billing' },
  { to: '/chat', label: 'Chat', icon: MessageSquare, module: 'chat' },
  { to: '/user-access', label: 'User Access', icon: Shield, showAdmin: true, module: 'users' },
  { to: '/prompt-editor', label: 'Prompt Editor', icon: Sparkles, showPlatform: true },
  { to: '/users', label: 'User Management', icon: Users, showAdmin: true, module: 'users' },
  { to: '/companies', label: 'Companies', icon: Building2, showPlatform: true },
  { to: '/settings', label: 'Settings', icon: Settings, showAdmin: true },
];

function ticketNavIsActive(pathname: string, search: string, to: string) {
  if (pathname !== '/tickets') return false;
  const currentView = new URLSearchParams(search).get('view') || 'all';
  const targetQuery = to.includes('?') ? to.split('?')[1] : '';
  const targetView = new URLSearchParams(targetQuery).get('view') || 'all';
  return currentView === targetView;
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mainItems = mainNavItems.filter((item) => {
    if (item.showPlatform && user?.isPlatformAdmin) return true;
    if (item.showAdmin && (user?.isCompanyAdmin || user?.isPlatformAdmin)) {
      if (item.module && !canAccessModule(user, item.module)) return false;
      return true;
    }
    if (item.show) return true;
    if (item.module) return canAccessModule(user, item.module);
    return false;
  });

  const ticketItems = ticketNavItems.filter((item) => {
    if (!canAccessModule(user, 'tickets')) return false;
    if (item.resumeOnly) return user?.role === 'resume';
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface md:h-screen">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-3">
          <AppLogo src={company?.logoUrl} size="sm" className="rounded-lg" alt={company?.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-heading">
              {company?.appTitle || company?.name || DEFAULT_APP_TITLE}
            </p>
            <p className="truncate text-xs text-body">{company?.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-1">
          {mainItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-muted text-heading'
                    : 'text-body hover:bg-muted hover:text-heading'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>

        {ticketItems.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-body">
              Tickets
            </p>
            <div className="space-y-1">
              {ticketItems.map(({ to, label, icon: Icon }) => {
                const isActive = ticketNavIsActive(location.pathname, location.search, to);
                return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-muted font-medium text-heading'
                      : 'text-body hover:bg-muted hover:text-heading'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3 truncate text-sm">
          <p className="font-medium text-heading">{user?.name}</p>
          <p className="text-xs text-body">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-body transition hover:bg-muted hover:text-heading"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
