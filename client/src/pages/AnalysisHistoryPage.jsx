import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Loader2, Search, Sparkles, Trash2 } from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import ScorePill from '../components/analysis/ScorePill.jsx';
import { formatDate } from '../utils/formatters.js';

const PAGE_SIZE = 10;

export default function AnalysisHistoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Wait for the user to stop typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    analysisService
      .list({ page, pageSize: PAGE_SIZE, sort, q: debouncedSearch })
      .then((result) => {
        if (cancelled) return;
        // Deleted the last item on a page: step back instead of showing an empty page.
        if (result.items.length === 0 && result.page > 1) setPage(result.totalPages);
        else setData(result);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.userMessage))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, sort, debouncedSearch, reloadKey]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete the analysis of "${item.job.title}"? Your resume and job description are kept.`)) return;
    setDeletingId(item.id);
    try {
      await analysisService.remove(item.id);
      toast.success('Analysis deleted.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err.userMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilter = debouncedSearch.length > 0;
  const items = data?.items ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analysis history</h1>
          <p className="mt-2 text-slate-600">Every analysis you have run. Open one to see the full report.</p>
        </div>
        <Link to="/analysis" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Sparkles size={16} /> New analysis
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search" value={search} aria-label="Search analyses"
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by job title, company or resume…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>
        <select
          value={sort} aria-label="Sort analyses"
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        >
          <option value="date">Newest first</option>
          <option value="score">Highest score first</option>
        </select>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className={`mt-6 space-y-3 transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        {loading && !data && [1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}

        {data && items.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-semibold">{hasFilter ? 'No analyses match your search' : 'No analyses yet'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilter ? 'Try a different word, or clear the search.' : 'Run your first analysis to see how your resume matches a job.'}
            </p>
            {!hasFilter && (
              <Link to="/analysis" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Analyze a resume</Link>
            )}
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-nowrap sm:p-5">
            <ScorePill score={item.score} />
            <div className="min-w-0 flex-1">
              <Link to={`/analysis/${item.id}`} className="block truncate font-semibold hover:text-brand-700">
                {item.job.title}{item.job.company && <span className="font-normal text-slate-500"> at {item.job.company}</span>}
              </Link>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {item.resume.fileName} · {formatDate(item.createdAt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="text-emerald-600">{item.matchedCount} matched</span> ·{' '}
                <span className="text-rose-600">{item.missingCount} missing</span>
                {!item.aiAvailable && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">no AI insights</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/analysis/${item.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View</Link>
              <button
                onClick={() => handleDelete(item)} disabled={deletingId === item.id} aria-label={`Delete analysis of ${item.job.title}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                {deletingId === item.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => p - 1)} disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-slate-500">Page {data.page} of {data.totalPages} · {data.total} analyses</span>
          <button
            onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium disabled:opacity-40"
          >
            Next <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </>
  );
}
