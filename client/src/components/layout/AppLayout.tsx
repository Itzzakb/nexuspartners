import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { AppLogo } from '@/components/ui/AppLogo';
import { DEFAULT_APP_TITLE } from '@/lib/branding';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <AppSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-heading hover:bg-muted"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <AppLogo size="sm" />
          <span className="font-semibold text-heading">{DEFAULT_APP_TITLE}</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
