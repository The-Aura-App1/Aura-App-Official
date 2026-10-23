import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, ChevronLeft, Skip } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const STEPS = ['welcome', 'username', 'avatar', 'banner', 'bio', 'done'];

export default function Onboarding() {
  const { user, attrs, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(0);
  const [username, setUsername] = useState('');
  const [bio, setBio]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const currentStep = STEPS[step];
  const isLast      = step === STEPS.length - 1;

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      // Create/update user record in DynamoDB with correct username
      await api.createUser(
        user.userId,
        attrs?.email ?? '',
        username.trim() || (attrs?.email?.split('@')[0] ?? user.userId)
      );
      await refreshUser();
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    handleFinish();
  }

  function next() {
    if (isLast) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  }

  function back() {
    setStep(s => Math.max(0, s - 1));
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i}
              className={`rounded-full transition-all duration-300
                ${i === step
                  ? 'w-6 h-2 bg-aura-500'
                  : i < step
                    ? 'w-2 h-2 bg-aura-500/50'
                    : 'w-2 h-2 bg-[var(--border)]'
                }`}
            />
          ))}
        </div>

        {/* Step content */}
        {currentStep === 'welcome' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/aura-logo.png" alt="Aura" className="w-20 h-20 rounded-2xl shadow-aura-lg" />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Welcome to Aura App
            </h1>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              Let's set up your profile so the community knows who you are.
              This only takes a minute.
            </p>
          </div>
        )}

        {currentStep === 'username' && (
          <div className="flex flex-col gap-4">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Choose a username
              </h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                This is how others will find and mention you.
              </p>
            </div>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="your_username"
              maxLength={30}
              className="input text-center text-lg"
            />
            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
            <p className="text-xs text-[var(--text-muted)] text-center">
              Letters, numbers, and underscores only
            </p>
          </div>
        )}

        {currentStep === 'avatar' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Add a profile picture
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              Put a face to your name. You can always change this later.
            </p>
            <div className="w-28 h-28 rounded-full bg-aura-500/20
                            border-2 border-dashed border-aura-500/40
                            flex items-center justify-center
                            cursor-pointer hover:border-aura-500
                            transition-all duration-200">
              <span className="text-4xl text-aura-400">
                {username?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <p className="text-xs text-aura-400 cursor-pointer hover:underline">
              Upload photo
            </p>
          </div>
        )}

        {currentStep === 'banner' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Add a banner
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              Give your profile a personal touch with a banner image.
            </p>
            <div className="w-full h-28 rounded-2xl
                            border-2 border-dashed border-aura-500/40
                            flex items-center justify-center
                            cursor-pointer hover:border-aura-500
                            transition-all duration-200"
                 style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #3d2470 100%)' }}>
              <p className="text-xs text-aura-400">Upload banner</p>
            </div>
          </div>
        )}

        {currentStep === 'bio' && (
          <div className="flex flex-col gap-4">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">
                Write a bio
              </h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                Tell the world a little about yourself.
              </p>
            </div>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="I make cool stuff..."
              rows={4}
              maxLength={160}
              className="input resize-none"
            />
            <p className="text-xs text-[var(--text-muted)] text-right">
              {bio.length} / 160
            </p>
          </div>
        )}

        {currentStep === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-aura-500/20
                            border-2 border-aura-500/40
                            flex items-center justify-center">
              <Sparkles size={36} className="text-aura-400" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              You're all set!
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              Welcome to Aura, <span className="text-aura-400 font-semibold">@{username}</span>.
              Start posting and earning aura.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 gap-3">
          {step > 0 && step < STEPS.length - 1 ? (
            <button onClick={back} className="btn-ghost px-4">
              <ChevronLeft size={18} />
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Skip button — not on welcome or done */}
            {currentStep !== 'welcome' && currentStep !== 'done' && (
              <button
                onClick={handleSkip}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-2 transition-colors"
              >
                Skip
              </button>
            )}

            <button
              onClick={next}
              disabled={currentStep === 'username' && !username.trim()}
              className="btn-primary"
            >
              {isLast ? (loading ? 'Setting up...' : 'Go to Feed') : (
                <>
                  {currentStep === 'welcome' ? 'Get Started' : 'Next'}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}