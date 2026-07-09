import { useEffect, useState } from 'react';
import { teamApi } from '@/lib/api';
import type { Team, ExternalStudent } from '@/types/phase4';

export default function MyTeam() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [memberStudents, setMemberStudents] = useState<Record<string, ExternalStudent[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);

  useEffect(() => {
    teamApi
      .my()
      .then((data) => setTeams(data.teams))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, []);

  const loadMemberStudents = async (teamId: string, username: string) => {
    const key = `${teamId}:${username}`;
    setLoadingMember(key);
    try {
      const data = await teamApi.memberStudents(teamId, username);
      setMemberStudents((prev) => ({ ...prev, [key]: data.students || [] }));
    } catch {
      setMemberStudents((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingMember(null);
    }
  };

  if (loading) return <p className="text-body">Loading...</p>;

  if (teams.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">My Team</h1>
        <div className="np-card p-8 text-center text-body">
          You are not assigned as a team lead on any team.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">My Team</h1>
        <p className="mt-1 text-body">View your team members and their assigned students</p>
      </div>

      {teams.map((team) => (
        <div key={team.id} className="np-card p-6">
          <h2 className="text-xl">{team.teamName}</h2>
          <p className="text-sm text-body">You are the team lead</p>

          <div className="mt-4 space-y-4">
            {team.members.map((member) => {
              const key = `${team.id}:${member.username}`;
              const students = memberStudents[key];
              return (
                <div key={member.username} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-heading">{member.name || member.username}</p>
                      <p className="text-xs text-body">{member.email} · {member.mobile}</p>
                    </div>
                    <button
                      type="button"
                      className="np-btn-secondary text-sm"
                      disabled={loadingMember === key}
                      onClick={() => loadMemberStudents(team.id, member.username)}
                    >
                      {loadingMember === key ? 'Loading...' : 'Load students'}
                    </button>
                  </div>

                  {students && (
                    <ul className="mt-3 space-y-1 text-sm text-body">
                      {students.length === 0 ? (
                        <li>No students found</li>
                      ) : (
                        students.map((s, i) => (
                          <li key={i}>
                            {(s.name || s.studentname) as string} — {(s.phone || s.mobile) as string}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
