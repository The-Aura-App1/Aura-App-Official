import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SignUp() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm] = useState({ email:'', username:'', password:'', confirmPassword:'', birthYear:'' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8)               { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(form.password))           { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(form.password))           { setError('Password must contain at least one number.'); return; }
    if (form.username.length < 3)               { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setError('Username: letters, numbers, underscores only.'); return; }
    setLoading(true);
    try {
      await register({
        email:     form.email,
        password:  form.password,
        username:  form.username,
        birthYear: parseInt(form.birthYear, 10),
      });
      navigate('/confirm-email', { state: { email: form.email } });
    } catch (err) {
      setError(err.message ?? 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-aura-500 flex items-center justify-center shadow-aura-md">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create your account</h1>
          <p className="text-sm text-[var(--text-muted)] text-center">You must be at least 13 years old to join Aura.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="you@example.com" required className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Username</label>
            <input name="username" type="text" value={form.username} onChange={handleChange}
              placeholder="your_username" required className="input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Birth Year</label>
            <input name="birthYear" type="number" value={form.birthYear} onChange={handleChange}
              placeholder={String(currentYear - 18)} min={currentYear - 120} max={currentYear - 13}
              required className="input" />
            <p className="text-xs text-[var(--text-muted)]">Must be {currentYear - 12} or earlier.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Password</label>
            <div className="relative">
              <input name="password" type={showPw ? 'text' : 'password'} value={form.password}
                onChange={handleChange} placeholder="Min 8 chars, 1 uppercase, 1 number"
                required className="input pr-11" />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)]">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-primary)]">Confirm Password</label>
            <input name="confirmPassword" type="password" value={form.confirmPassword}
              onChange={handleChange} placeholder="••••••••" required className="input" />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-[var(--text-muted)] mt-6">
          Already have an account?{' '}
          <Link to="/signin" className="text-aura-400 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}