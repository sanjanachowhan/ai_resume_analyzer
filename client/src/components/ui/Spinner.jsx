import { Loader2 } from 'lucide-react';

export default function Spinner({ fullPage = false, size = 24 }) {
  const icon = <Loader2 size={size} className="animate-spin text-brand-600" aria-label="Loading" />;
  if (!fullPage) return icon;
  return <div className="flex min-h-screen items-center justify-center">{icon}</div>;
}
