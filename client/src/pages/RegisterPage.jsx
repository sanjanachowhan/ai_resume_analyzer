import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import AuthCard from '../components/auth/AuthCard.jsx';
import TextField from '../components/ui/TextField.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const { name, email, password } = form;
      const user = await register({ name, email, password });
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.userMessage);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start analyzing your resume against any job."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && !Object.keys(fieldErrors).length && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <TextField
          id="name" name="name" label="Full name" autoComplete="name" placeholder="Jane Doe"
          value={form.name} onChange={handleChange} error={fieldErrors.name} required
        />
        <TextField
          id="email" name="email" type="email" label="Email" autoComplete="email"
          placeholder="you@example.com" value={form.email} onChange={handleChange}
          error={fieldErrors.email} required
        />
        <TextField
          id="password" name="password" type="password" label="Password" autoComplete="new-password"
          placeholder="At least 8 characters, with a letter and a number"
          value={form.password} onChange={handleChange} error={fieldErrors.password} required
        />
        <TextField
          id="confirmPassword" name="confirmPassword" type="password" label="Confirm password"
          autoComplete="new-password" placeholder="Repeat your password"
          value={form.confirmPassword} onChange={handleChange} error={fieldErrors.confirmPassword} required
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
