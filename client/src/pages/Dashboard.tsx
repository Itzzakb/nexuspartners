import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { interviewApi, ticketApi } from '@/lib/api';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { TicketActivityChart } from '@/components/dashboard/TicketActivityChart';
import { DashboardBottomPanel } from '@/components/dashboard/DashboardBottomPanel';
import type { Interview } from '@/types/phase4';
import type { InterviewStats } from '@/types/phase4';
import type { TicketDashboardData } from '@/types/ticket';

type ChartRange = '7d' | '30d' | '3m';
type BottomTab = 'tickets' | 'interviews' | 'stages';

export default function Dashboard() {
  const { user, company } = useAuth();
  const [chartRange, setChartRange] = useState<ChartRange>('30d');
  const [bottomTab, setBottomTab] = useState<BottomTab>('tickets');
  const [dashboard, setDashboard] = useState<TicketDashboardData | null>(null);
  const [interviewStats, setInterviewStats] = useState<InterviewStats | null>(null);
  const [upcomingInterviews, setUpcomingInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const loadDashboard = useCallback(async (range: ChartRange, silent = false) => {
    if (!silent) setLoading(true);
    else setChartLoading(true);
    try {
      const [dashData, statsData, interviewsData] = await Promise.all([
        ticketApi.dashboard(range),
        interviewApi.stats(),
        interviewApi.list({ upcoming: '7' }),
      ]);
      setDashboard(dashData);
      setInterviewStats(statsData.stats);
      setUpcomingInterviews(interviewsData.interviews);
    } catch {
      setDashboard(null);
      setInterviewStats(null);
      setUpcomingInterviews([]);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(chartRange);
  }, [loadDashboard, chartRange]);

  const handleRangeChange = (range: ChartRange) => {
    setChartRange(range);
  };

  if (loading && !dashboard) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = dashboard?.stats;
  const trends = dashboard?.trends;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Dashboard</h1>
        <p className="mt-1 text-body">
          Welcome back, {user?.name} · {company?.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Total Tickets"
          value={stats?.total ?? 0}
          trend={trends?.total.value}
          trendLabel={trends?.total.label}
        />
        <DashboardStatCard
          label="Pending"
          value={stats?.pending ?? 0}
          trend={trends?.pending.value}
          trendLabel={trends?.pending.label}
        />
        <DashboardStatCard
          label="Waiting"
          value={stats?.waitingForApproval ?? 0}
          trend={trends?.waiting.value}
          trendLabel={trends?.waiting.label}
        />
        <DashboardStatCard
          label="Completed"
          value={stats?.completed ?? 0}
          trend={trends?.completed.value}
          trendLabel={trends?.completed.label}
        />
      </div>

      <TicketActivityChart
        points={dashboard?.activity ?? []}
        range={chartRange}
        onRangeChange={handleRangeChange}
        loading={chartLoading}
      />

      <DashboardBottomPanel
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        tickets={dashboard?.recentTickets ?? []}
        ticketCount={dashboard?.activeTicketCount ?? 0}
        interviews={upcomingInterviews}
        interviewCount={upcomingInterviews.length}
        interviewStats={interviewStats}
      />
    </div>
  );
}
