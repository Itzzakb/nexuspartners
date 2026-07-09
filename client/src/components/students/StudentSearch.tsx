import { useState } from 'react';
import { Search } from 'lucide-react';
import { externalApi } from '@/lib/api';
import type { ExternalStudent } from '@/types/phase4';

interface StudentSearchProps {
  companyId?: string;
  onSelect: (student: ExternalStudent) => void;
  placeholder?: string;
}

function studentLabel(s: ExternalStudent) {
  const name = s.name || s.studentname || 'Unknown';
  const phone = s.phone || s.mobile || '';
  return phone ? `${name} (${phone})` : name;
}

export function StudentSearch({ companyId, onSelect, placeholder }: StudentSearchProps) {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<ExternalStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await externalApi.students(companyId);
      setStudents(data.students || []);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const name = (s.name || s.studentname || '').toLowerCase();
    const phone = (s.phone || s.mobile || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || email.includes(q);
  });

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            className="np-input pl-9"
            placeholder={placeholder || 'Search student by name or phone...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (!students.length) loadStudents();
              else setOpen(true);
            }}
          />
        </div>
        <button type="button" className="np-btn-secondary" onClick={loadStudents} disabled={loading}>
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {filtered.slice(0, 20).map((s, i) => (
            <button
              key={i}
              type="button"
              className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onSelect(s);
                setQuery(studentLabel(s));
                setOpen(false);
              }}
            >
              {studentLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
