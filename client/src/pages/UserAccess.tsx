import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCompanies } from '@/context/CompanyContext';
import { permissionApi, userApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { MODULE_KEYS } from '@/lib/permissions';
import { Toggle, ToggleField } from '@/components/ui/Toggle';
import type { PermissionTemplate } from '@/types/phase6';
import type { User } from '@/lib/api';

export default function UserAccess() {
  const { user } = useAuth();
  const { companies } = useCompanies();
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templatePerms, setTemplatePerms] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [userData, templateData] = await Promise.all([
      userApi.list(companyId || undefined),
      permissionApi.listTemplates(companyId || undefined),
    ]);
    setUsers(userData.users);
    setTemplates(templateData.templates);
  };

  useEffect(() => {
    permissionApi.modules().then(() => {
      const defaults: Record<string, boolean> = {};
      MODULE_KEYS.forEach((k) => { defaults[k] = false; });
      setTemplatePerms(defaults);
    });
    load().catch(() => {});
  }, [companyId]);

  if (!user?.isCompanyAdmin && !user?.isPlatformAdmin) {
    return <p className="text-body">Admin access required.</p>;
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await permissionApi.createTemplate({
        name: templateName,
        modulePermissions: templatePerms,
        companyId: companyId || undefined,
      });
      setTemplateName('');
      toast.success('Template created');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const handleApplyTemplate = async (userId: string, templateId: string) => {
    try {
      await permissionApi.updateUser(userId, { permissionTemplateId: templateId });
      toast.success('Permissions updated');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const togglePerm = (userId: string, module: string, current: boolean) => {
    const u = users.find((x) => x.id === userId);
    if (!u || u.isCompanyAdmin || u.isPlatformAdmin) return;
    const next = { ...(u.modulePermissions || {}), [module]: !current };
    permissionApi.updateUser(userId, { modulePermissions: next }).then(load);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">User Access</h1>
        <p className="mt-1 text-body">Manage module permissions and templates</p>
      </div>

      {user?.isPlatformAdmin && (
        <select className="np-input max-w-xs" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      <form onSubmit={handleCreateTemplate} className="np-card space-y-4 p-6">
        <h2 className="text-lg">Create permission template</h2>
        <input className="np-input max-w-sm" placeholder="Template name" value={templateName}
          onChange={(e) => setTemplateName(e.target.value)} required />
        <div className="flex flex-wrap gap-3">
          {MODULE_KEYS.map((mod) => (
            <ToggleField
              key={mod}
              label={mod.replace('_', ' ')}
              checked={!!templatePerms[mod]}
              onChange={(checked) => setTemplatePerms({ ...templatePerms, [mod]: checked })}
              labelClassName="capitalize"
            />
          ))}
        </div>
        <button type="submit" className="np-btn-primary">Save template</button>
      </form>

      {templates.length > 0 && (
        <div className="np-card p-4">
          <h2 className="mb-3 text-lg">Templates</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <span key={t.id} className="rounded-full bg-muted px-3 py-1 text-sm">{t.name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto np-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-body">
              <th className="p-4">User</th>
              <th className="p-4">Role</th>
              {MODULE_KEYS.map((m) => (
                <th key={m} className="p-2 text-xs capitalize">{m.slice(0, 4)}</th>
              ))}
              <th className="p-4">Template</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border">
                <td className="p-4">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-body">{u.email}</p>
                </td>
                <td className="p-4">
                  {u.isCompanyAdmin ? 'Admin' : u.role}
                </td>
                {MODULE_KEYS.map((mod) => (
                  <td key={mod} className="p-2 text-center">
                    {u.isCompanyAdmin || u.isPlatformAdmin ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <Toggle
                        size="sm"
                        checked={!!u.modulePermissions?.[mod]}
                        onChange={() => togglePerm(u.id, mod, !!u.modulePermissions?.[mod])}
                        aria-label={`${u.name} ${mod}`}
                      />
                    )}
                  </td>
                ))}
                <td className="p-4">
                  {!u.isCompanyAdmin && !u.isPlatformAdmin && (
                    <select className="np-input text-xs" defaultValue=""
                      onChange={(e) => e.target.value && handleApplyTemplate(u.id, e.target.value)}>
                      <option value="">Apply template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
