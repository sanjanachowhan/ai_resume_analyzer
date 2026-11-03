import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, ChevronDown, ChevronUp, FileUp, Loader2, PenLine, Trash2 } from 'lucide-react';
import { jobService } from '../services/jobService.js';
import ResumeDropzone from '../components/resume/ResumeDropzone.jsx';
import TextField from '../components/ui/TextField.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import JobAnalysis from '../components/job/JobAnalysis.jsx';
import { formatDate } from '../utils/formatters.js';

const MIN_DESCRIPTION = 50;
const MAX_DESCRIPTION = 20000;

const tabClass = (active) =>
  `flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
    active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`;

export default function JobDescriptionPage() {
  const [mode, setMode] = useState('paste'); // paste | upload
  const [form, setForm] = useState({ title: '', company: '', description: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');

  const [jobs, setJobs] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({}); // id -> full description
  const [deletingId, setDeletingId] = useState(null);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await jobService.list());
      setListError('');
    } catch (err) {
      setListError(err.userMessage);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Choosing a file immediately extracts its text and moves it into the editable text box.
  const handleFileSelected = async (selected) => {
    setFile(selected);
    setExtractError('');
    if (!selected) return;

    setExtracting(true);
    try {
      const { text, fileName } = await jobService.extract(selected);
      setForm((f) => ({
        ...f,
        description: text,
        title: f.title || fileName.replace(/\.[^.]+$/, ''),
      }));
      setMode('paste');
      toast.success('Text extracted. Review it before saving.');
    } catch (err) {
      setExtractError(err.userMessage);
    } finally {
      setExtracting(false);
      setFile(null);
    }
  };

  const validate = () => {
    const errors = {};
    if (form.title.trim().length < 2) errors.title = 'Job title must be at least 2 characters';
    const length = form.description.trim().length;
    if (length === 0) errors.description = 'Job description is required';
    else if (length < MIN_DESCRIPTION) errors.description = `Job description is too short (at least ${MIN_DESCRIPTION} characters)`;
    else if (length > MAX_DESCRIPTION) errors.description = `Job description is too long (maximum ${MAX_DESCRIPTION.toLocaleString()} characters)`;
    return errors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      await jobService.create(form);
      toast.success('Job description saved.');
      setForm({ title: '', company: '', description: '' });
      loadJobs();
    } catch (err) {
      setError(err.userMessage);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = async (job) => {
    if (expandedId === job.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(job.id);
    if (details[job.id]) return;
    try {
      const full = await jobService.get(job.id);
      setDetails((d) => ({ ...d, [job.id]: full }));
    } catch (err) {
      toast.error(err.userMessage);
      setExpandedId(null);
    }
  };

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.title}"? Analyses that use it will also be deleted.`)) return;
    setDeletingId(job.id);
    try {
      await jobService.remove(job.id);
      setJobs((list) => list.filter((j) => j.id !== job.id));
      toast.success('Job description deleted.');
    } catch (err) {
      toast.error(err.userMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const length = form.description.length;

  return (
    <>
      <h1 className="text-3xl font-bold">Job descriptions</h1>
      <p className="mt-2 text-slate-600">Paste a job posting or upload it as a document. You can edit the text before saving.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <form onSubmit={handleSave} noValidate className="space-y-4 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="title" name="title" label="Job title" placeholder="Full Stack Developer"
              value={form.title} onChange={handleChange} error={fieldErrors.title}
            />
            <TextField
              id="company" name="company" label="Company (optional)" placeholder="Acme Inc."
              value={form.company} onChange={handleChange} error={fieldErrors.company}
            />
          </div>

          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" className={tabClass(mode === 'paste')} onClick={() => setMode('paste')}>
              <PenLine size={16} /> Paste text
            </button>
            <button type="button" className={tabClass(mode === 'upload')} onClick={() => setMode('upload')}>
              <FileUp size={16} /> Upload document
            </button>
          </div>

          {mode === 'paste' ? (
            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-slate-700">
                Job description
              </label>
              <textarea
                id="description" name="description" rows={14}
                placeholder="Paste the full job description here…"
                value={form.description} onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.description)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                  fieldErrors.description
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
              />
              <div className="mt-1.5 flex justify-between text-sm">
                <span className="text-rose-600">{fieldErrors.description}</span>
                <span className={length > MAX_DESCRIPTION ? 'font-medium text-rose-600' : 'text-slate-400'}>
                  {length.toLocaleString()} / {MAX_DESCRIPTION.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <ResumeDropzone file={file} onFileChange={handleFileSelected} disabled={extracting} label="job description" />
              {extracting && (
                <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
                  <Loader2 size={16} className="animate-spin text-brand-600" /> Extracting text…
                </p>
              )}
              {extractError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {extractError}
                </p>
              )}
            </div>
          )}

          {error && !Object.keys(fieldErrors).length && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={saving || extracting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save job description'}
          </button>
        </form>

        <aside className="lg:col-span-2">
          <h2 className="font-semibold">Saved job descriptions</h2>
          <div className="mt-3 space-y-3">
            {listLoading && <div className="flex justify-center py-8"><Spinner /></div>}
            {listError && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{listError}</p>
            )}
            {!listLoading && !listError && jobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No job descriptions yet. Save one to compare it with your resume.
              </div>
            )}
            {jobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Briefcase size={20} className="mt-0.5 shrink-0 text-brand-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-slate-500">
                        {job.company ? `${job.company} · ` : ''}{formatDate(job.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(job)} disabled={deletingId === job.id}
                    aria-label={`Delete ${job.title}`}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {deletingId === job.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>

                {expandedId === job.id ? (
                  details[job.id] ? (
                    <div className="mt-3 space-y-3">
                      <JobAnalysis analysis={details[job.id].parsedData} />
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                        {details[job.id].description}
                      </pre>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Loading…</p>
                  )
                ) : (
                  <p className="mt-3 line-clamp-2 text-xs text-slate-500">{job.preview}</p>
                )}

                <button
                  onClick={() => toggleExpand(job)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  {expandedId === job.id ? <>Hide <ChevronUp size={14} /></> : <>View full text <ChevronDown size={14} /></>}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
