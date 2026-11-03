import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { resumeService } from '../services/resumeService.js';
import ResumeDropzone from '../components/resume/ResumeDropzone.jsx';
import UploadProgress from '../components/resume/UploadProgress.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { formatDate, formatFileSize } from '../utils/formatters.js';

const SECTION_LABELS = {
  summary: 'Summary', skills: 'Skills', education: 'Education',
  experience: 'Experience', projects: 'Projects', certifications: 'Certifications',
};

export default function ResumeUploadPage() {
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | uploading | extracting | done | error
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [resumes, setResumes] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const loadResumes = useCallback(async () => {
    try {
      setResumes(await resumeService.list());
      setListError('');
    } catch (err) {
      setListError(err.userMessage);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const busy = stage === 'uploading' || stage === 'extracting';

  const handleUpload = async () => {
    if (!file || busy) return;
    setError('');
    setResult(null);
    setPercent(0);
    setStage('uploading');

    try {
      const data = await resumeService.upload(file, (evt) => {
        const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
        setPercent(pct);
        if (pct >= 100) setStage('extracting'); // file is on the server; now it is being parsed
      });
      setStage('done');
      setResult(data);
      setFile(null);
      toast.success(data.duplicate ? 'You already uploaded this resume.' : 'Resume uploaded and processed.');
      loadResumes();
    } catch (err) {
      setStage('error');
      setError(err.userMessage);
    }
  };

  const handleDelete = async (resume) => {
    if (!window.confirm(`Delete "${resume.fileName}"? Analyses that use it will also be deleted.`)) return;
    setDeletingId(resume.id);
    try {
      await resumeService.remove(resume.id);
      setResumes((list) => list.filter((r) => r.id !== resume.id));
      toast.success('Resume deleted.');
    } catch (err) {
      toast.error(err.userMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const parsed = result?.resume?.parsedData;

  return (
    <>
      <h1 className="text-3xl font-bold">Your resume</h1>
      <p className="mt-2 text-slate-600">Upload a PDF or DOCX. We extract the text so it can be matched against job descriptions.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <ResumeDropzone file={file} onFileChange={setFile} disabled={busy} />

          {busy && <UploadProgress stage={stage} percent={percent} />}

          {stage === 'error' && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? 'Processing…' : 'Upload and extract text'}
          </button>

          {result && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="font-semibold text-emerald-900">
                {result.duplicate ? 'This resume was already uploaded' : 'Resume processed'}
              </h2>
              <p className="mt-1 text-sm text-emerald-800">{result.resume.fileName}</p>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Name detected</dt>
                  <dd>{parsed?.name || 'Not detected'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Email detected</dt>
                  <dd className="break-all">{parsed?.email || 'Not detected'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Experience</dt>
                  <dd>
                    {parsed?.profile?.yearsExperience?.stated
                      ? `${parsed.profile.yearsExperience.stated} years (stated)`
                      : parsed?.profile?.yearsExperience?.estimated != null
                        ? `About ${parsed.profile.yearsExperience.estimated} years (from dates)`
                        : 'Not detected'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Highest education</dt>
                  <dd>{parsed?.profile?.educationLevel?.label || 'Not detected'}</dd>
                </div>
              </dl>

              <p className="mt-4 text-sm font-medium text-slate-500">Sections found</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {parsed?.sectionsFound?.length ? (
                  parsed.sectionsFound.map((key) => (
                    <span key={key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      {SECTION_LABELS[key]}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-600">None identified. The full text is still saved for analysis.</span>
                )}
              </div>

              {parsed?.profile?.skills?.length > 0 && (
                <>
                  <p className="mt-4 text-sm font-medium text-slate-500">
                    Skills detected ({parsed.profile.skills.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsed.profile.skills.map((skill) => (
                      <span key={skill.name} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-4 text-sm font-medium text-slate-500">Extracted text preview</p>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-4 text-xs text-slate-700 ring-1 ring-emerald-200">
                {result.resume.rawText.slice(0, 800)}
                {result.resume.rawText.length > 800 && '…'}
              </pre>
            </div>
          )}
        </div>

        <aside className="lg:col-span-2">
          <h2 className="font-semibold">Uploaded resumes</h2>
          <div className="mt-3 space-y-3">
            {listLoading && <div className="flex justify-center py-8"><Spinner /></div>}
            {listError && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{listError}</p>
            )}
            {!listLoading && !listError && resumes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No resumes yet. Upload your first one to get started.
              </div>
            )}
            {resumes.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={20} className="shrink-0 text-brand-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {r.fileType.toUpperCase()} · {formatFileSize(r.fileSize)} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(r)}
                  disabled={deletingId === r.id}
                  aria-label={`Delete ${r.fileName}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  {deletingId === r.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
