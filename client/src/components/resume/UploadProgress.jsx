import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

function StepIcon({ status }) {
  if (status === 'done') return <CheckCircle2 size={20} className="text-emerald-500" />;
  if (status === 'active') return <Loader2 size={20} className="animate-spin text-brand-600" />;
  return <Circle size={20} className="text-slate-300" />;
}

// stage: 'uploading' | 'extracting' | 'done'
export default function UploadProgress({ stage, percent }) {
  const uploadStatus = stage === 'uploading' ? 'active' : 'done';
  const extractStatus = stage === 'uploading' ? 'pending' : stage === 'extracting' ? 'active' : 'done';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <StepIcon status={uploadStatus} />
        <div className="flex-1">
          <div className="flex justify-between text-sm font-medium">
            <span>Uploading file</span>
            {stage === 'uploading' && <span className="text-slate-500">{percent}%</span>}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-200"
              style={{ width: `${stage === 'uploading' ? percent : 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <StepIcon status={extractStatus} />
        <span className={`text-sm font-medium ${extractStatus === 'pending' ? 'text-slate-400' : ''}`}>
          Extracting and saving text
        </span>
      </div>
    </div>
  );
}
