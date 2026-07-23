import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { userApi, type User } from '@/lib/api';
import { toast } from '@/lib/toast';

const ROLES = ['admin', 'mentor', 'resume', 'onboarding'] as const;

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userApi.list();
      setUsers(data.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleActive = async (u: User) => {
    try {
      await userApi.update(u.id, { isActive: !u.isActive });
      toast.success(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`);
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const changeRole = async (u: User, role: string) => {
    try {
      await userApi.update(u.id, { role: role as User['role'] });
      toast.success(`Role updated for ${u.name}`);
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const sendReset = async (u: User) => {
    try {
      await userApi.sendReset(u.id);
      toast.success(`Password reset link sent to ${u.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset');
    }
  };

  if (!currentUser?.isCompanyAdmin && !currentUser?.isPlatformAdmin) {
    return <p className="text-body">Access denied.</p>;
  }

  if (!loading && loadError) {
    return <p className="text-body">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">User Management</h1>
        <p className="mt-1 text-body">Activate, revoke, and manage team members</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="np-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium text-heading">Name</th>
                <th className="px-4 py-3 font-medium text-heading">Email</th>
                <th className="px-4 py-3 font-medium text-heading">Role</th>
                {currentUser.isPlatformAdmin && (
                  <th className="px-4 py-3 font-medium text-heading">Company</th>
                )}
                <th className="px-4 py-3 font-medium text-heading">Status</th>
                <th className="px-4 py-3 font-medium text-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-heading">{u.name}</td>
                  <td className="px-4 py-3 text-body">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={u.isPlatformAdmin}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  {currentUser.isPlatformAdmin && (
                    <td className="px-4 py-3 text-body">{u.companyName}</td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-pill px-2.5 py-0.5 text-xs font-medium ${
                        u.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="np-btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => toggleActive(u)}
                        disabled={u.id === currentUser.id}
                      >
                        {u.isActive ? 'Revoke' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="np-btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => sendReset(u)}
                      >
                        Send reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
