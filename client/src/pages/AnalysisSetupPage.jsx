import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Wand2 } from 'lucide-react';
import { resumeService } from '../services/resumeService.js';
import { jobService } from '../services/jobService.js';
import { matchService } from '../services/matchService.js';
import { analysisService } from '../services/analysisService.js';
import AnalysisProgress from '../components/analysis/AnalysisProgress.jsx';
import Spinner from '../components/ui/Spinner.jsx';

const selectClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:opacity-60';

export default function AnalysisSetupPage() {
  const navigate = useNavigate();

  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');

  const [phase, setPhase] = useState('idle'); // idle | compare | ai | error
  const [failedAt, setFailedAt] = useState(null); // 'compare' | 'ai'
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([resumeService.list(), jobService.list()])
      .then(([r, j]) => {
        setResumes(r);
        setJobs(j);
        if (r.length) setResumeId(r[0].id);
        if (j.length) setJobId(j[0].id);
      })
      .catch((err) => setLoadError(err.userMessage))
      .finally(() => setLoading(false));
  }, []);

  const resume = resumes.find((r) => r.id === resumeId);
  const job = jobs.find((j) => j.id === jobId);
  const running = phase === 'compare' || phase === 'ai';

  const handleAnalyze = async () => {
    setError('');
    setFailedAt(null);
    setPhase('compare');
    let stage = 'compare';
    try {
      // 1. Instant, deterministic comparison. It also fails early, with a clear message, if the job has nothing to score.
      await matchService.preview({ resumeId, jobId });
      // 2. AI gap analysis and recommendations (saved on the server). A saved result comes back immediately.
      stage = 'ai';
      setPhase('ai');
      const { analysis } = await analysisService.run({ resumeId, jobId });
      navigate(`/analysis/${analysis.id}`);
    } catch (err) {
      setFailedAt(stage);
      setPhase('error');
      setError(err.userMessage);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (loadError) {
    return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>;
  }

  if (!resumes.length || !jobs.length) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Almost there</h1>
        <p className="mt-2 text-sm text-slate-600">You need at least one resume and one job description to run an analysis.</p>
        <div className="mt-5 flex justify-center gap-3 text-sm font-semibold">
          {!resumes.length && <Link to="/resumes" className="rounded-lg bg-brand-600 px-4 py-2 text-white">Upload a resume</Link>}
          {!jobs.length && <Link to="/jobs" className="rounded-lg bg-brand-600 px-4 py-2 text-white">Add a job description</Link>}
        </div>
      </div>
    );
  }

  // Steps 1-4 were completed when the resume and job were saved; 5-6 are the live work.
  const skillCount = resume?.parsedData?.profile?.skills?.length;
  const status = (step) => {
    if (step === 'compare') {
      if (phase === 'compare') return 'active';
      if (phase === 'error' && failedAt === 'compare') return 'error';
      return 'done';
    }
    if (phase === 'ai') return 'active';
    if (phase === 'error' && failedAt === 'ai') return 'error';
    return 'pending';
  };
  const steps = [
    { key: 'resume', label: 'Resume uploaded', detail: resume?.fileName, status: 'done' },
    { key: 'text', label: 'Resume text extracted', status: 'done' },
    { key: 'job', label: 'Job description analyzed', detail: job?.title, status: 'done' },
    { key: 'skills', label: 'Skills and requirements extracted', detail: skillCount != null ? `${skillCount} skills found on your resume` : undefined, status: 'done' },
    { key: 'compare', label: 'Comparing resume with job', status: status('compare') },
    { key: 'ai', label: 'Running AI gap analysis and generating recommendations', detail: phase === 'ai' ? 'This can take 10 to 40 seconds' : undefined, status: status('ai') },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Analyze your resume</h1>
      <p className="mt-2 text-slate-600">Choose a resume and a job description. You'll get a match score, the gaps, and specific improvements.</p>

      <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="resume" className="mb-1.5 block text-sm font-medium text-slate-700">Resume</label>
          <select id="resume" className={selectClass} value={resumeId} disabled={running} onChange={(e) => setResumeId(e.target.value)}>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.fileName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="job" className="mb-1.5 block text-sm font-medium text-slate-700">Job description</label>
          <select id="job" className={selectClass} value={jobId} disabled={running} onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.company ? ` — ${j.company}` : ''}</option>)}
          </select>
        </div>
        <button
          onClick={handleAnalyze} disabled={running}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {running ? 'Analyzing…' : phase === 'error' ? 'Try again' : 'Analyze resume'}
        </button>
      </div>

      {phase !== 'idle' && (
        <div className="mt-6 space-y-4">
          <AnalysisProgress steps={steps} />
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
