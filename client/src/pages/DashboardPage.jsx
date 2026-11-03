import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BarChart3, FileText, Sparkles, Trophy } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../hooks/useAuth.js';
import { analysisService } from '../services/analysisService.js';
import AiStatusCard from '../components/ai/AiStatusCard.jsx';
import ScorePill from '../components/analysis/ScorePill.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { formatDate } from '../utils/formatters.js';

function StatCard({ icon: Icon, label, value, hint, to }) {
  const body = (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-200">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Icon size={20} /></span>
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    analysisService.stats().then(setStats).catch((err) => setError(err.userMessage));
  }, []);

  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {firstName} 👋</h1>
          <p className="mt-2 text-slate-600">Here is how your applications are shaping up.</p>
        </div>
        <Link to="/analysis" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-700">
          <Sparkles size={18} /> Quick analysis
        </Link>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {!stats && !error && <div className="flex justify-center py-10"><Spinner /></div>}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={BarChart3} label="Total analyses" value={stats.total} />
            <StatCard icon={Award} label="Average match score" value={stats.averageScore != null ? `${stats.averageScore}%` : '–'} />
            <StatCard
              icon={Trophy} label="Highest match" value={stats.highest ? `${stats.highest.score}%` : '–'}
              hint={stats.highest ? `${stats.highest.jobTitle}${stats.highest.company ? ` at ${stats.highest.company}` : ''}` : 'No analyses yet'}
              to={stats.highest ? `/analysis/${stats.highest.id}` : undefined}
            />
          </div>

          {stats.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <FileText className="mx-auto text-slate-300" size={36} />
              <h2 className="mt-3 font-semibold">No analyses yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Upload a resume, add a job description, and run your first analysis. Your scores and progress will show up here.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm font-semibold">
                <Link to="/resumes" className="rounded-lg border border-slate-300 px-4 py-2">Upload a resume</Link>
                <Link to="/jobs" className="rounded-lg border border-slate-300 px-4 py-2">Add a job</Link>
                <Link to="/analysis" className="rounded-lg bg-brand-600 px-4 py-2 text-white">Run an analysis</Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-3">
                <h2 className="font-semibold">Match score trend</h2>
                {stats.trend.length >= 2 ? (
                  <div className="mt-4 h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.trend.map((t) => ({ ...t, label: formatDate(t.date) }))} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} />
                        <Tooltip formatter={(v) => [`${v}%`, 'Match']} />
                        <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Run at least two analyses to see how your scores change over time.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Recent analyses</h2>
                  <Link to="/history" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
                </div>
                <ul className="mt-4 space-y-3">
                  {stats.recent.map((item) => (
                    <li key={item.id}>
                      <Link to={`/analysis/${item.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                        <ScorePill score={item.score} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.job.title}</p>
                          <p className="truncate text-xs text-slate-500">{item.job.company ? `${item.job.company} · ` : ''}{formatDate(item.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      <AiStatusCard />
    </div>
  );
}
