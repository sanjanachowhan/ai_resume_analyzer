const LABELS = {
  skills: 'Skills',
  keywords: 'Keywords',
  experience: 'Experience',
  education: 'Education',
  responsibilities: 'Responsibilities',
  softSkills: 'Soft skills',
};

const barColor = (score) => (score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500');

export default function ScoreBreakdown({ components }) {
  return (
    <ul className="space-y-4">
      {Object.entries(LABELS).map(([key, label]) => {
        const c = components[key];
        const counted = c.status === 'scored';
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{label}</span>
              {counted ? (
                <span className="font-semibold">{c.score}%</span>
              ) : (
                <span className="text-xs font-medium text-slate-400">
                  {c.status === 'unknown' ? 'Could not detect' : 'Not required'}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              {counted && <div className={`h-full rounded-full ${barColor(c.score)}`} style={{ width: `${c.score}%` }} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {counted ? `Counts for ${Math.round(c.effectiveWeight * 100)}% of the overall score.` : ''}
              {c.note ? ` ${c.note}` : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
