import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { teamApi, externalApi } from '@/lib/api';
import type { Team, TeamMember, ExternalRecruiter } from '@/types/phase4';
import { toast } from '@/lib/toast';

export default function Teams() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [teams, setTeams] = useState<Team[]>([]);
  const [recruiters, setRecruiters] = useState<ExternalRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [form, setForm] = useState({
    teamName: '',
    teamLeadName: '',
    teamLeadPhone: '',
    teamLeadEmail: '',
    companyId: user?.companyId || '',
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberPick, setMemberPick] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = user?.isCompanyAdmin || user?.isPlatformAdmin;

  const load = async () => {
    setLoading(true);
    try {
      const [teamsData, recruitersData] = await Promise.all([
        teamApi.list(companyId || undefined),
        externalApi.recruiters(companyId || undefined).catch(() => ({ clerks: [] })),
      ]);
      setTeams(teamsData.teams);
      setRecruiters(recruitersData.clerks || []);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const addMember = () => {
    const r = recruiters.find((x) => x.username === memberPick);
    if (!r || !memberPick) return;
    setMembers((prev) => [
      ...prev,
      {
        username: memberPick,
        name: (r.name as string) || memberPick,
        email: (r.email as string) || '',
        mobile: (r.mobile as string) || (r.phone as string) || '',
      },
    ]);
    setMemberPick('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamApi.create({ ...form, members });
      setShowForm(false);
      setForm({
        teamName: '',
        teamLeadName: '',
        teamLeadPhone: '',
        teamLeadEmail: '',
        companyId: user?.companyId || '',
      });
      setMembers([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="np-card p-8 text-center text-body">
        Admin access required. Team leads can view their team on <strong>My Team</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Teams</h1>
          <p className="mt-1 text-body">Organize recruiters into teams with a team lead</p>
        </div>
        <button type="button" className="np-btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Create team
        </button>
      </div>

      {user?.isPlatformAdmin && (
        <div className="np-card p-4">
          <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="np-card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="np-input" placeholder="Team name *" required value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })} />
            <input className="np-input" placeholder="Team lead name *" required value={form.teamLeadName}
              onChange={(e) => setForm({ ...form, teamLeadName: e.target.value })} />
            <input className="np-input" placeholder="Lead phone" value={form.teamLeadPhone}
              onChange={(e) => setForm({ ...form, teamLeadPhone: e.target.value })} />
            <input className="np-input" placeholder="Lead email" value={form.teamLeadEmail}
              onChange={(e) => setForm({ ...form, teamLeadEmail: e.target.value })} />
          </div>

          <div className="flex flex-wrap gap-2">
            <select className="np-input max-w-xs" value={memberPick} onChange={(e) => setMemberPick(e.target.value)}>
              <option value="">Add recruiter...</option>
              {recruiters.map((r, i) => (
                <option key={i} value={r.username as string}>
                  {(r.name as string) || r.username} ({r.username})
                </option>
              ))}
            </select>
            <button type="button" className="np-btn-secondary" onClick={addMember}>Add member</button>
          </div>

          {members.length > 0 && (
            <ul className="text-sm text-body">
              {members.map((m, i) => (
                <li key={i}>{m.name} — {m.username}</li>
              ))}
            </ul>
          )}

          <button type="submit" className="np-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create team'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-body">Loading...</p>
      ) : teams.length === 0 ? (
        <div className="np-card p-8 text-center text-body">No teams yet</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="np-card p-5">
              <h2 className="text-lg">{team.teamName}</h2>
              <p className="text-sm text-body">
                Lead: {team.teamLeadName} · {team.teamLeadEmail}
              </p>
              <p className="mt-2 text-xs text-body">{team.companyLabel}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {team.members.map((m, i) => (
                  <li key={i} className="text-heading">
                    {m.name || m.username}
                    <span className="text-body"> — {m.username}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
