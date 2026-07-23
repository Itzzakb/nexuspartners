import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { useTickets } from '@/context/TicketContext';
import { ticketApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { TicketCard } from '@/components/tickets/TicketCard';
import { DeletedTicketCard } from '@/components/tickets/DeletedTicketCard';
import type { Ticket, TicketView } from '@/types/ticket';

const VIEW_OPTIONS: { value: TicketView; label: string }[] = [
  { value: 'all', label: 'All Tickets' },
  { value: 'new_resumes', label: 'New Resumes' },
  { value: 'existing_resume', label: 'Existing Resume' },
  { value: 'my_tickets', label: 'My Tickets' },
  { value: 'group_created', label: 'Group Created' },
  { value: 'waiting_for_approval', label: 'Waiting for Approval' },
  { value: 'sent_to_onboarding', label: 'Sent to Onboarding' },
  { value: 'onboarded', label: 'Onboarded Successfully' },
  { value: 'deleted', label: 'Deleted' },
];

export default function Tickets() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const { tickets, loading, refreshTickets } = useTickets();
  const [searchParams, setSearchParams] = useSearchParams();

  const view = (searchParams.get('view') || 'all') as TicketView;
  const companyId = searchParams.get('companyId') || '';
  const assignedTo = searchParams.get('assignedTo') || '';
  const ticketType = searchParams.get('ticketType') || '';
  const noChatLink = searchParams.get('noChatLink') || '';
  const isDeletedView = view === 'deleted';

  const [resumeMembers, setResumeMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { view };
    if (companyId) p.companyId = companyId;
    if (assignedTo) p.assignedTo = assignedTo;
    if (ticketType) p.ticketType = ticketType;
    if (noChatLink) p.noChatLink = noChatLink;
    return p;
  }, [view, companyId, assignedTo, ticketType, noChatLink]);

  useEffect(() => {
    refreshTickets(queryParams);
  }, [queryParams]);

  useEffect(() => {
    ticketApi
      .resumeTeam(companyId || undefined)
      .then((data) => {
        setResumeMembers(data.members);
      })
      .catch(() => setResumeMembers([]));
  }, [companyId]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTickets(queryParams);
    setRefreshing(false);
  };

  const handleRestore = async (ticket: Ticket) => {
    setRestoringId(ticket.id);
    try {
      await ticketApi.restore(ticket.id);
      toast.success(`Restored ${ticket.ticketNumber}`);
      await refreshTickets(queryParams);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore ticket');
    } finally {
      setRestoringId(null);
    }
  };

  const visibleViews = VIEW_OPTIONS.filter((v) => {
    if (v.value === 'my_tickets') return user?.role === 'resume';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">{isDeletedView ? 'Deleted Tickets' : 'Tickets'}</h1>
          {!isDeletedView && (
            <p className="mt-1 text-body">
              {VIEW_OPTIONS.find((v) => v.value === view)?.label}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="np-btn-secondary !px-4"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {!isDeletedView && (
            <Link to="/create" className="np-btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Link>
          )}
        </div>
      </div>

      <div className="np-card flex flex-wrap gap-3 p-4">
        <select
          className="np-input !w-auto min-w-[160px]"
          value={view}
          onChange={(e) => setFilter('view', e.target.value)}
        >
          {visibleViews.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        {user?.isPlatformAdmin && (
          <select
            className="np-input !w-auto min-w-[160px]"
            value={companyId}
            onChange={(e) => setFilter('companyId', e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {view === 'all' && (
          <>
            <select
              className="np-input !w-auto min-w-[160px]"
              value={assignedTo}
              onChange={(e) => setFilter('assignedTo', e.target.value)}
            >
              <option value="">All assignments</option>
              <option value="unallocated">Unallocated</option>
              {resumeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              className="np-input !w-auto min-w-[140px]"
              value={ticketType}
              onChange={(e) => setFilter('ticketType', e.target.value)}
            >
              <option value="">All types</option>
              <option value="new_resume">New Resume</option>
              <option value="existing_resume">Existing Resume</option>
            </select>

            <select
              className="np-input !w-auto min-w-[160px]"
              value={noChatLink}
              onChange={(e) => setFilter('noChatLink', e.target.value)}
            >
              <option value="">All chat links</option>
              <option value="true">Without chat link</option>
            </select>
          </>
        )}

        {view === 'onboarded' && (
          <select
            className="np-input !w-auto min-w-[140px]"
            value={ticketType}
            onChange={(e) => setFilter('ticketType', e.target.value)}
          >
            <option value="">All types</option>
            <option value="new_resume">New Resume</option>
            <option value="existing_resume">Existing Resume</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="np-card py-16 text-center text-body">
          {isDeletedView ? 'No deleted tickets' : 'No tickets found'}
        </div>
      ) : isDeletedView ? (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Showing {tickets.length} deleted ticket{tickets.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <DeletedTicketCard
                key={ticket.id}
                ticket={ticket}
                restoring={restoringId === ticket.id}
                onRestore={handleRestore}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} showCompany={!!user?.isPlatformAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
