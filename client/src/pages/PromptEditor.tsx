import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { promptApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { AppPrompt } from '@/types/phase7';

export default function PromptEditor() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<AppPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await promptApi.list();
      setPrompts(data.prompts);
      const initial: Record<string, string> = {};
      data.prompts.forEach((p) => { initial[p.key] = p.content; });
      setDrafts(initial);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!user?.isPlatformAdmin) {
    return <p className="text-body">Platform admin access required.</p>;
  }

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await promptApi.update(key, { content: drafts[key] });
      toast.success(`Saved "${key}"`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl">Prompt Editor</h1>
        <p className="mt-1 text-body">Edit Gemini and ATS prompts used across the platform</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <p className="text-body">{loadError}</p>
      ) : (
        <div className="space-y-6">
          {prompts.map((p) => (
            <div key={p.key} className="np-card p-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg">{p.label}</h2>
                  <p className="text-xs text-body">Key: {p.key}</p>
                </div>
                <button
                  type="button"
                  className="np-btn-primary !py-2 text-sm"
                  onClick={() => handleSave(p.key)}
                  disabled={saving === p.key}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving === p.key ? 'Saving...' : 'Save'}
                </button>
              </div>
              <textarea
                className="np-input min-h-[160px] font-mono text-sm"
                value={drafts[p.key] ?? p.content}
                onChange={(e) => setDrafts({ ...drafts, [p.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
