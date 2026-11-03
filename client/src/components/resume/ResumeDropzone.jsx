import { useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters.js';
import { MAX_FILE_SIZE_MB, getExtension, validateResumeFile } from '../../utils/fileValidation.js';

export default function ResumeDropzone({ file, onFileChange, disabled = false, label = 'resume' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const selectFile = (candidate) => {
    if (!candidate) return;
    const problem = validateResumeFile(candidate);
    if (problem) {
      setError(problem);
      onFileChange(null);
      return;
    }
    setError('');
    onFileChange(candidate);
  };

  const openPicker = () => !disabled && inputRef.current?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) selectFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          selectFile(e.target.files?.[0]);
          e.target.value = ''; // lets the same file be chosen again
        }}
      />

      {file ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <FileText size={22} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-slate-500">
                <span className="font-semibold uppercase">{getExtension(file.name)}</span> · {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              aria-label="Remove file"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPicker())}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-500 hover:bg-brand-50/40'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <UploadCloud size={28} />
          </span>
          <p className="mt-4 font-semibold">Drag and drop your {label} here</p>
          <p className="mt-1 text-sm text-slate-500">
            or <span className="font-semibold text-brand-600">browse files</span>
          </p>
          <p className="mt-3 text-xs text-slate-400">PDF or DOCX, up to {MAX_FILE_SIZE_MB} MB</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
