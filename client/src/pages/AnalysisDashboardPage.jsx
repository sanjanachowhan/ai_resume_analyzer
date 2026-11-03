import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import ScoreHero from '../components/analysis/ScoreHero.jsx';
import ScoreCharts from '../components/analysis/ScoreCharts.jsx';
import SkillsSection from '../components/analysis/SkillsSection.jsx';
import InsightsSection from '../components/analysis/InsightsSection.jsx';
import ScoreBreakdown from '../components/match/ScoreBreakdown.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { formatDate } from '../utils/formatters.js';

export default function AnalysisDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    analysisService
      .get(id)
      .then((a) => !cancelled && setAnalysis(a))
      .catch((err) => !cancelled && setError(err.userMessage))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // force = true runs the AI again even though a saved result exists; false only fills in missing AI insights.
  const handleRun = async (force) => {
    setRunning(true);
    try {
      const { analysis: next } = await analysisService.run({ resumeId: analysis.resume.id, jobId: analysis.job.id, force });
      setAnalysis(next);
      toast.success(next.aiAvailable ? 'Analysis updated.' : 'AI insights are still unavailable.');
      navigate(`/analysis/${next.id}`, { replace: true });
    } catch (err) {
      toast.error(err.userMessage);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner size={32} /></div>;

  if (error || !analysis) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">We couldn't open this analysis</h1>
        <p className="mt-2 text-sm text-slate-600">{error || 'It may have been deleted.'}</p>
        <Link to="/analysis" className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Start a new analysis</Link>
      </div>
    );
  }

  const { components, keywords, responsibilities, aiMeta } = analysis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/analysis" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> New analysis
          </Link>
          <h1 className="mt-2 text-3xl font-bold">
            {analysis.job.title}{analysis.job.company && <span className="font-normal text-slate-500"> at {analysis.job.company}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{analysis.resume.fileName} · analyzed {formatDate(analysis.createdAt)}</p>
        </div>
        {analysis.aiAvailable && (
          <button
            onClick={() => handleRun(true)} disabled={running}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {running ? 'Re-running…' : 'Re-run AI analysis'}
          </button>
        )}
      </div>

      {!analysis.aiAvailable && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <p className="font-medium">AI insights are not available for this analysis.</p>
              <p className="mt-1">{aiMeta?.error?.message ?? 'Please try again later.'} Your score and skill results are saved.</p>
            </div>
          </div>
          <button
            onClick={() => handleRun(false)} disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {running && <Loader2 size={16} className="animate-spin" />} Try AI again
          </button>
        </div>
      )}

      <ScoreHero analysis={analysis} />
      {components && <ScoreCharts analysis={analysis} />}
      <SkillsSection skills={analysis.skills} />
      <InsightsSection analysis={analysis} />

      <details className="rounded-2xl border border-slate-200 bg-white p-6">
        <summary className="cursor-pointer font-semibold">How this score was calculated</summary>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {components && <ScoreBreakdown components={components} />}
          <div className="space-y-6 text-sm">
            {keywords.matched.length + keywords.missing.length > 0 && (
              <div>
                <p className="font-semibold">Keywords</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Found on your resume</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {keywords.matched.map((k) => <span key={k} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{k}</span>)}
                </div>
                {keywords.missing.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Not found</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {keywords.missing.map((k) => <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{k}</span>)}
                    </div>
                  </>
                )}
              </div>
            )}
            {responsibilities.length > 0 && (
              <div>
                <p className="font-semibold">Job duties covered by your resume</p>
                <ul className="mt-2 space-y-3">
                  {responsibilities.map((r) => (
                    <li key={r.text}>
                      <p className="text-slate-700">{r.text}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${r.covered ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.round(r.coverage * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </details>

      {aiMeta?.provider && (
        <p className="pb-4 text-center text-xs text-slate-400">
          AI insights by {aiMeta.provider} ({aiMeta.model}) in {Math.round((aiMeta.durationMs ?? 0) / 1000)}s.
          {aiMeta.warnings?.length > 0 && ` Note: ${aiMeta.warnings.join(' ')}`}
        </p>
      )}
    </div>
  );
}
