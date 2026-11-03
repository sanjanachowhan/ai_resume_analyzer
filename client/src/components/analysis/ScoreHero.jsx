import { Sparkles } from 'lucide-react';
import ScoreRing from '../match/ScoreRing.jsx';
import { verdict } from '../../utils/analysisHelpers.js';

export default function ScoreHero({ analysis }) {
  const v = verdict(analysis.scores.overall);
  const summary = analysis.ai?.summary;
  const gap = analysis.ai?.gap;

  return (
    <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3">
      <div className="flex flex-col items-center justify-center text-center">
        <ScoreRing score={analysis.scores.overall} />
        <p className={`mt-4 text-lg font-semibold ${v.tone}`}>{v.label}</p>
      </div>

      <div className="md:col-span-2">
        {summary || gap ? (
          <>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <Sparkles size={14} /> AI summary
            </p>
            <h2 className="mt-2 text-xl font-bold">{summary?.headline ?? 'How you match this job'}</h2>
            <p className="mt-2 text-slate-700">{summary?.summary ?? gap.summary}</p>
            {summary?.topPriorities?.length > 0 && (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Do these first</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
                  {summary.topPriorities.map((p) => <li key={p}>{p}</li>)}
                </ol>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">How you match this job</h2>
            <p className="mt-2 text-slate-600">
              This score comes from a transparent comparison of skills, keywords, experience, education, duties and soft skills.
              AI explanations are not available for this analysis.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
