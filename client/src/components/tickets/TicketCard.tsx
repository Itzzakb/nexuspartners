import { Link } from 'react-router-dom';
import { Calendar, User } from 'lucide-react';
import type { Ticket } from '@/types/ticket';
import { StageBadge } from './StageBadge';

interface TicketCardProps {
  ticket: Ticket;
  showCompany?: boolean;
}

export function TicketCard({ ticket, showCompany }: TicketCardProps) {
  return (
    <Link
      to={`/ticket/${ticket.id}`}
      state={{ from: window.location.pathname + window.location.search }}
      className="np-card block p-5 transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-primary">{ticket.ticketNumber}</span>
            <span className="rounded-pill bg-muted px-2 py-0.5 text-xs capitalize text-body">
              {ticket.ticketType.replace('_', ' ')}
            </span>
            {ticket.ticketType === 'new_resume' && (
              <span
                className={`rounded-pill px-2 py-0.5 text-xs ${
                  ticket.resumeFormStatus === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Form {ticket.resumeFormStatus === 'completed' ? 'filled' : 'unfilled'}
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-lg font-semibold text-heading">
            {ticket.candidateName}
          </h3>
          {showCompany && ticket.companyName && (
            <p className="text-sm text-body">{ticket.companyName}</p>
          )}
        </div>
        <StageBadge stage={ticket.currentStage} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-body">
        {ticket.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(ticket.dueDate).toLocaleDateString()}
          </span>
        )}
        {ticket.assignedToName && (
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {ticket.assignedToName}
          </span>
        )}
        {!ticket.assignedToName && (
          <span className="text-amber-600">Unallocated</span>
        )}
      </div>
    </Link>
  );
}
