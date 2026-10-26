import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthBackdrop, { Wordmark } from '../../components/auth/AuthBackdrop';

export default function SignIn() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login({ email: form.email, password: form.password });
      navigate('/');
    } catch (err) {
      setError(err.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackdrop>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <div className="flex justify-center mb-6"><Wordmark size="sm" linked /></div>
        <div className="aura-glass-card">
        <div className="flex flex-col items-center gap-3 mb-10">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h1>
          <p className="text-sm text-[var(--text-muted)]">Sign in to your Aura account</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="you@example.com" required className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Password</label>
            <div className="relative">
              <input name="password" type={showPw ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required className="input pr-11" />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-[var(--text-muted)] mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-aura-400 font-medium hover:underline">Create one</Link>
        </p>
        </div>
      </div>
      </main>
    </AuthBackdrop>
  );
}
