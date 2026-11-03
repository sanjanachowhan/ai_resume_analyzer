import { Lightbulb, ThumbsUp, Wrench } from 'lucide-react';
import { deriveStrengths } from '../../utils/analysisHelpers.js';

function Card({ title, icon: Icon, tone = 'text-brand-600', children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        {Icon && <Icon size={18} className={tone} />} {title}
      </h2>
      <div className="mt-4 text-sm">{children}</div>
    </div>
  );
}

const Bullets = ({ items }) => (
  <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
    {items.map((item) => <li key={item}>{item}</li>)}
  </ul>
);

export default function InsightsSection({ analysis }) {
  const gap = analysis.ai?.gap;
  const rewrites = analysis.ai?.improvements?.rewrites ?? [];
  const strengths = gap?.strengths?.length ? gap.strengths : deriveStrengths(analysis);
  const weak = analysis.skills.weak;
  const otherGaps = gap
    ? [
        ['Qualifications', gap.missingQualifications],
        ['Experience areas', gap.missingExperienceAreas],
        ['Soft skills', gap.missingSoftSkills],
      ].filter(([, items]) => items.length)
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {strengths.length > 0 && (
          <Card title="Your strengths" icon={ThumbsUp} tone="text-emerald-600">
            <Bullets items={strengths} />
          </Card>
        )}

        <Card title="How to improve your resume" icon={Lightbulb}>
          {analysis.suggestions.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-slate-700">
              {analysis.suggestions.map((s) => <li key={s}>{s}</li>)}
            </ol>
          ) : (
            <p className="text-slate-500">No suggestions available.</p>
          )}
        </Card>
      </div>

      {weak.length > 0 && (
        <Card title="Skills that need more evidence" icon={Wrench} tone="text-amber-600">
          <ul className="space-y-2">
            {weak.map((w) => (
              <li key={w.skill}>
                <span className="font-semibold">{w.skill}:</span> <span className="text-slate-600">{w.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(otherGaps.length > 0 || gap?.sectionsToImprove?.length > 0 || gap?.projectIdeas?.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {otherGaps.length > 0 && (
            <Card title="Other gaps">
              <div className="space-y-4">
                {otherGaps.map(([label, items]) => (
                  <div key={label}><p className="mb-1 font-medium">{label}</p><Bullets items={items} /></div>
                ))}
              </div>
            </Card>
          )}
          {gap?.sectionsToImprove?.length > 0 && (
            <Card title="Sections to improve">
              <ul className="space-y-2">
                {gap.sectionsToImprove.map((s) => (
                  <li key={s.section}><span className="font-semibold">{s.section}:</span> <span className="text-slate-600">{s.reason}</span></li>
                ))}
              </ul>
            </Card>
          )}
          {gap?.projectIdeas?.length > 0 && (
            <Card title="Project ideas that would strengthen your application">
              <Bullets items={gap.projectIdeas} />
            </Card>
          )}
        </div>
      )}

      {rewrites.length > 0 && (
        <Card title="Suggested rewrites">
          <p className="mb-4 text-xs text-slate-500">
            Wording only: nothing is added that is not already on your resume. Replace any bracketed placeholder with a real result if you have one.
          </p>
          <ul className="space-y-4">
            {rewrites.map((r) => (
              <li key={r.current} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r.section}</p>
                <p className="mt-2 text-slate-500 line-through decoration-slate-300">{r.current}</p>
                <p className="mt-2 text-slate-900">{r.suggested}</p>
                {r.note && <p className="mt-2 text-xs text-slate-500">{r.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
