import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { aiService } from '../../services/aiService.js';

// Shows which AI provider the server uses and lets you run a quick connection test.
// API keys never reach the browser: the server only reports whether a key is set.
export default function AiStatusCard() {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    aiService.status().then(setStatus).catch((err) => setStatusError(err.userMessage));
  }, []);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    setTestError('');
    try {
      setResult(await aiService.test());
    } catch (err) {
      setTestError(err.userMessage);
    } finally {
      setTesting(false);
    }
  };

  const active = status?.providers?.[status.activeProvider];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <Sparkles size={22} />
          </span>
          <div>
            <h2 className="font-semibold">AI connection</h2>
            {statusError && <p className="mt-1 text-sm text-rose-600">{statusError}</p>}
            {!status && !statusError && <p className="mt-1 text-sm text-slate-500">Checking…</p>}
            {status && (
              <p className="mt-1 text-sm text-slate-600">
                Provider: <span className="font-medium capitalize">{status.activeProvider}</span> · Model:{' '}
                <span className="font-medium">{active?.model}</span> ·{' '}
                {active?.configured ? (
                  <span className="font-medium text-emerald-600">API key set</span>
                ) : (
                  <span className="font-medium text-amber-600">API key missing</span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={runTest}
          disabled={testing || !status}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {testing && <Loader2 size={16} className="animate-spin" />}
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {result && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          <CheckCircle2 size={18} /> Connected to {result.provider} ({result.model}) in {result.latencyMs} ms. Reply: “{result.reply.message}”
        </p>
      )}
      {testError && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <XCircle size={18} /> {testError}
        </p>
      )}
    </div>
  );
}
