import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';

function Icon({ status }) {
  if (status === 'done') return <CheckCircle2 size={20} className="text-emerald-500" />;
  if (status === 'active') return <Loader2 size={20} className="animate-spin text-brand-600" />;
  if (status === 'error') return <AlertCircle size={20} className="text-rose-500" />;
  return <Circle size={20} className="text-slate-300" />;
}

// steps: [{ key, label, detail?, status: 'done' | 'active' | 'pending' | 'error' }]
export default function AnalysisProgress({ steps }) {
  return (
    <ol className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3">
          <span className="mt-0.5"><Icon status={step.status} /></span>
          <div>
            <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-slate-400' : ''}`}>{step.label}</p>
            {step.detail && <p className="text-xs text-slate-500">{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
