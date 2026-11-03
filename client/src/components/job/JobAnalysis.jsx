function Chips({ title, items, tone = 'slate' }) {
  if (!items?.length) return null;
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    slate: 'bg-white text-slate-700 ring-slate-200',
  };
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tones[tone]}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shows what the extraction engine found in a job description (job.parsedData).
export default function JobAnalysis({ analysis }) {
  if (!analysis) {
    return (
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        No extracted requirements for this job yet.
      </p>
    );
  }

  const years = analysis.yearsExperience;
  const yearsLabel = years ? `${years.min}${years.max ? `–${years.max}` : '+'} years` : null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Chips title="Required skills" items={analysis.requiredSkills} tone="brand" />
      <Chips title="Preferred skills" items={analysis.preferredSkills} tone="amber" />
      <Chips title="Soft skills" items={analysis.softSkills} />
      <Chips title="Certifications" items={analysis.certifications} />

      {(yearsLabel || analysis.minEducation) && (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          {yearsLabel && (
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Experience</dt>
              <dd className="mt-1 text-slate-800">{yearsLabel}</dd>
            </div>
          )}
          {analysis.minEducation && (
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">Education</dt>
              <dd className="mt-1 text-slate-800">{analysis.minEducation.label} or higher</dd>
            </div>
          )}
        </dl>
      )}

      {analysis.responsibilities?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsibilities</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {analysis.responsibilities.slice(0, 6).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
