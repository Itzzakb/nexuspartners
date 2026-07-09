import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, MapPin, Phone, Search, User } from 'lucide-react';
import { recruiterStudentsApi } from '@/lib/recruiterApi';
import type { RecruiterStudent } from '@/types/recruiterPortal';
import { cn } from '@/lib/utils';

export default function RecruiterMyStudents() {
  const [students, setStudents] = useState<RecruiterStudent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await recruiterStudentsApi.list(query);
        setStudents(data.students);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load students');
      } finally {
        setLoading(false);
      }
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-heading">My Students</h1>
          <p className="mt-1 text-sm text-body">Students assigned to your recruiter account</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            type="search"
            placeholder="Search by name, phone, role..."
            className="np-input !pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : students.length === 0 ? (
        <div className="np-card py-16 text-center text-body">No students found</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Link
              key={student.phone}
              to={`/recruiter-portal/students/${encodeURIComponent(student.phone)}`}
              className="np-card block p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-heading">{student.name}</h2>
                    <p className="text-sm text-body">{student.role || 'No role set'}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    student.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-body">
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  {student.phone}
                </p>
                {student.email && (
                  <p className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    {student.email}
                  </p>
                )}
                {student.location && (
                  <p className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {student.location}
                  </p>
                )}
              </div>

              <p className="mt-4 text-sm font-medium text-primary">View details →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
