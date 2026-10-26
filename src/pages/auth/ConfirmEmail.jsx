import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthBackdrop, { SiteHeader, Wordmark } from '../../components/auth/AuthBackdrop';

export default function ConfirmEmail() {
  const { confirmEmail, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email    = location.state?.email ?? '';
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await confirmEmail({ email, code: code.trim() });
      navigate('/signin', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await resendCode({ email });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.message ?? 'Could not resend code.');
    }
  }

  return (
    <AuthBackdrop>
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8"><Wordmark size="sm" linked /></div>
        <div className="aura-glass-card">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-aura-500/20 border border-aura-500/30 flex items-center justify-center">
            <Mail size={28} className="text-aura-400" />
          </div>
          <h1 className="font-hand text-4xl font-bold text-[var(--text-primary)]">Check your email</h1>
          <p className="text-sm text-[var(--text-muted)]">
            We sent a 6-digit code to{' '}
            <span className="text-[var(--text-primary)] font-medium">{email || 'your email'}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            placeholder="000000" maxLength={6} required
            className="input text-center text-2xl tracking-[0.5em] font-mono" />
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>
        <button onClick={handleResend}
          className="mt-4 text-sm text-[var(--text-muted)] hover:text-aura-600 transition-colors">
          {resent ? 'Code resent!' : "Didn't get it? Resend code"}
        </button>
        </div>
      </div>
      </main>
    </AuthBackdrop>
  );
}
