import { AlertTriangle, Check, CircleDashed } from 'lucide-react';

const priorityStyle = {
  High: 'bg-rose-50 text-rose-700 ring-rose-100',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-100',
  Low: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function Card({ title, icon: Icon, tone, count, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        {Icon && <Icon size={18} className={tone} />} {title}
        <span className="text-sm font-normal text-slate-400">({count})</span>
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function SkillsSection({ skills }) {
  const { matched, partial, missing, additional } = skills;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Matched skills" icon={Check} tone="text-emerald-600" count={matched.length}>
          {matched.length ? (
            <ul className="flex flex-wrap gap-2">
              {matched.map((m) => (
                <li key={m.skill} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <Check size={14} /> {m.skill}
                  {m.via && <span className="text-xs font-normal text-emerald-600/70">({m.via})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">None of the job's skills were found on your resume.</p>
          )}
          {matched.some((m) => m.weakEvidence) && (
            <p className="mt-3 text-xs text-slate-500">
              Skills marked in the evidence section below are only listed, not shown in use.
            </p>
          )}
        </Card>

        <Card title="Related skills" icon={CircleDashed} tone="text-amber-600" count={partial.length}>
          {partial.length ? (
            <ul className="space-y-2 text-sm">
              {partial.map((p) => (
                <li key={p.skill}>
                  <span className="font-medium">{p.skill}</span>
                  <span className="text-slate-500"> — you have {p.relatedTo}, which is related</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No partially matching skills.</p>
          )}
        </Card>
      </div>

      <Card title="Missing skills" icon={AlertTriangle} tone="text-rose-600" count={missing.length}>
        {missing.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {missing.map((m) => (
              <li key={m.skill} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="font-semibold">{m.skill}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${priorityStyle[m.importance]}`}>
                    {m.importance} priority
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{m.reason}</p>
                <p className="mt-2 text-sm text-slate-800">
                  <span className="font-semibold">Recommendation: </span>{m.recommendation}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing missing. Your resume covers every skill the job lists.</p>
        )}
      </Card>

      {additional.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-6">
          <summary className="cursor-pointer font-semibold">
            Other skills on your resume <span className="text-sm font-normal text-slate-400">({additional.length}, not needed for this job)</span>
          </summary>
          <ul className="mt-4 flex flex-wrap gap-2">
            {additional.map((name) => (
              <li key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{name}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
