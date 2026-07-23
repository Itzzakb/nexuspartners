import { RotateCcw } from 'lucide-react';
import type { Ticket } from '@/types/ticket';

interface DeletedTicketCardProps {
  ticket: Ticket;
  restoring?: boolean;
  onRestore: (ticket: Ticket) => void;
}

function formatDeletedDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DeletedTicketCard({ ticket, restoring, onRestore }: DeletedTicketCardProps) {
  const deletedBy = ticket.deletedByName || 'Unknown';
  const deletedAt = formatDeletedDate(ticket.deletedAt || ticket.updatedAt);

  return (
    <div className="np-card overflow-hidden p-0">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="truncate text-base font-semibold text-heading">{ticket.candidateName}</h3>
            <span className="shrink-0 text-sm text-body">{ticket.ticketNumber}</span>
          </div>
          {ticket.email ? (
            <p className="mt-1 truncate text-sm text-body">{ticket.email}</p>
          ) : (
            <p className="mt-1 text-sm text-body">No email</p>
          )}
          <p className="mt-2 text-sm text-body">
            By: {deletedBy}
            {deletedAt ? ` • ${deletedAt}` : ''}
          </p>
        </div>

        <button
          type="button"
          className="np-btn-secondary !px-4 !py-2 shrink-0 text-sm"
          disabled={restoring}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRestore(ticket);
          }}
        >
          <RotateCcw className={`mr-1.5 h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
          {restoring ? 'Restoring…' : 'Restore'}
        </button>
      </div>

      <div className="border-t border-red-100 bg-red-50 px-5 py-3">
        <p className="text-sm text-red-700">
          <span className="font-semibold">Reason:</span>{' '}
          {ticket.deleteReason?.trim() || 'No reason provided'}
        </p>
      </div>
    </div>
  );
}
