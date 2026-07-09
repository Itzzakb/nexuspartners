import type { ResumeFormData } from '@/types/resumeForm';

export function ResumeFormTable({
  rows,
  emptyMessage = 'No form data submitted yet.',
}: {
  rows: [string, string][];
  emptyMessage?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-body">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium text-heading">Field</th>
            <th className="px-4 py-3 font-medium text-heading">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={`${label}-${i}`} className="border-t border-border">
              <td className="px-4 py-2.5 font-medium text-body whitespace-nowrap">{label}</td>
              <td className="px-4 py-2.5 text-heading whitespace-pre-wrap">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
