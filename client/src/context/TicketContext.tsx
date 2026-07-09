import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { ticketApi } from '@/lib/api';
import type { Ticket, TicketStats, TicketView } from '@/types/ticket';
import { useAuth } from './AuthContext';

interface TicketContextValue {
  tickets: Ticket[];
  loading: boolean;
  stats: TicketStats | null;
  refreshTickets: (params?: Record<string, string>) => Promise<void>;
  refreshStats: () => Promise<void>;
  getTicket: (id: string) => Promise<{ ticket: Ticket; history: import('@/types/ticket').TicketHistoryEntry[] }>;
}

const TicketContext = createContext<TicketContextValue | null>(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export function TicketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [listParams, setListParams] = useState<Record<string, string>>({ view: 'all' });

  const refreshTickets = useCallback(async (params?: Record<string, string>) => {
    if (!user) return;
    const p = params ?? listParams;
    if (params) setListParams(p);
    setLoading(true);
    try {
      const data = await ticketApi.list(p);
      setTickets(data.tickets);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [user, listParams]);

  const refreshStats = useCallback(async () => {
    if (!user) return;
    try {
      const data = await ticketApi.stats();
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [user]);

  const getTicket = useCallback(async (id: string) => {
    return ticketApi.get(id);
  }, []);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('accessToken');
    const s = io(SOCKET_URL || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('ticket:created', () => {
      refreshTickets();
      refreshStats();
    });
    s.on('ticket:updated', () => refreshTickets());
    s.on('ticket:stage_changed', () => {
      refreshTickets();
      refreshStats();
    });
    s.on('ticket:assigned', () => refreshTickets());
    s.on('ticket:deleted', () => {
      refreshTickets();
      refreshStats();
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, refreshTickets, refreshStats]);

  useEffect(() => {
    if (user) {
      refreshTickets();
      refreshStats();
    }
  }, [user]);

  const value = useMemo(
    () => ({
      tickets,
      loading,
      stats,
      refreshTickets,
      refreshStats,
      getTicket,
      socket,
    }),
    [tickets, loading, stats, refreshTickets, refreshStats, getTicket, socket]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error('useTickets must be used within TicketProvider');
  return ctx;
}

export type { TicketView };
