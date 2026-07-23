import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Briefcase, FileText, LogOut, Users } from 'lucide-react';
import { useRecruiterAuth } from '@/context/RecruiterAuthContext';
import { AppLogo } from '@/components/ui/AppLogo';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/recruiter-portal/applications', label: 'Applications', icon: Briefcase },
  { to: '/recruiter-portal/students', label: 'My Students', icon: Users },
  { to: '/recruiter-portal/resume-library', label: 'Resume Library', icon: FileText },
];

export function RecruiterLayout() {
  const { recruiter, company, logout } = useRecruiterAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/recruiter-portal/login');
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted">
      <header className="shrink-0 border-b border-border bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" />
            <div>
              <p className="text-sm font-semibold text-heading">
                {company?.appTitle?.replace('Admin', 'Recruiter Portal') || 'Nexus Partners Recruiter Portal'}
              </p>
              <p className="text-xs text-body">{company?.name || 'nexuspartners.com'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-heading">{recruiter?.name}</p>
              <p className="text-xs text-body">@{recruiter?.username}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-body hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto mt-3 flex max-w-7xl gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-body hover:bg-white hover:text-heading'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
