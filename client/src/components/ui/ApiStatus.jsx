import { useHealth } from '../../hooks/useHealth.js';

export default function ApiStatus() {
  const { loading, data, error } = useHealth();

  let label = 'Checking API…';
  let dot = 'bg-slate-400 animate-pulse';

  if (!loading) {
    if (data?.status === 'ok') {
      label = 'API & database online';
      dot = 'bg-emerald-500';
    } else if (data?.status === 'degraded') {
      label = 'API online, database unreachable';
      dot = 'bg-amber-500';
    } else {
      label = error || 'API offline';
      dot = 'bg-rose-500';
    }
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
