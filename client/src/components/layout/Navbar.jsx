import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles size={18} />
          </span>
          ResumeIQ
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          {user ? (
            <Link to="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-white shadow-sm hover:bg-brand-700">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link to="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-white shadow-sm hover:bg-brand-700">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
