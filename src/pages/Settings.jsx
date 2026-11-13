import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Shield, Bell, KeyRound, Palette, LogOut, ShieldAlert } from 'lucide-react';
import { updatePassword } from 'aws-amplify/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api';
import { ThemeCards } from '../components/theme/ThemePicker';
import { clearTaste, isLearningOn, setLearningOn } from '../utils/tasteProfile';
import { usernameStatusText } from '../utils/format';

const NOTIFICATION_OPTIONS = [
  { key: 'auraGiven',            label: 'Aura given to your posts'   },
  { key: 'auraTaken',            label: 'Aura taken from your posts' },
  { key: 'comment',              label: 'Comments'                   },
  { key: 'reply',                label: 'Replies'                    },
  { key: 'followRequest',        label: 'New followers and requests' },
  { key: 'followAccepted',       label: 'Follow request accepted'    },
  { key: 'groupInvite',          label: 'Group invites'              },
  { key: 'groupRequestApproved', label: 'Group request approved'     },
  { key: 'dailyBonus',           label: 'Daily bonus available'      },
];

function defaultNotificationPrefs(saved) {
  return Object.fromEntries(NOTIFICATION_OPTIONS.map(({ key }) => [key, saved?.[key] !== false]));
}

function Section({ id, icon: Icon, title, children }) {
  return (
    <section id={id} data-tour={id && `settings-${id}`} className="card flex flex-col gap-4 scroll-mt-20">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-aura-400" />
        <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${checked ? 'bg-aura-500' : 'bg-[var(--border)]'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform
                          ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function Message({ error, success }) {
  if (error) {
    return (
      <div className="px-4 py-2.5 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
        {error}
      </div>
    );
  }
  if (success) {
    return (
      <div className="px-4 py-2.5 rounded-xl bg-aura-500/10 border border-aura-500/20 text-aura-400 text-sm">
        {success}
      </div>
    );
  }
  return null;
}

function PasswordForm() {
  const [form, setForm]       = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    if (form.newPassword.length < 8)               { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(form.newPassword))           { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(form.newPassword))           { setError('Password must contain at least one number.'); return; }

    setSaving(true);
    try {
      await updatePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Password changed.');
    } catch (err) {
      setError(err.name === 'NotAuthorizedException' ? 'Current password is incorrect.' : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
        <KeyRound size={15} /> Change password
      </p>
      <input name="oldPassword" type="password" value={form.oldPassword} onChange={handleChange}
        placeholder="Current password" autoComplete="current-password" required className="input" />
      <input name="newPassword" type="password" value={form.newPassword} onChange={handleChange}
        placeholder="New password" autoComplete="new-password" required className="input" />
      <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
        placeholder="Confirm new password" autoComplete="new-password" required className="input" />
      <Message error={error} success={success} />
      <div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { user, dbProfile, username, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { skyDetails, setSkyDetails } = useTheme();

  const [settings, setSettings] = useState(null);
  // Feed learning lives on this device only (tasteProfile.js)
  const [learning, setLearning] = useState(() => isLearningOn(user?.userId));
  const [learnReset, setLearnReset] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Links such as /settings#appearance open at that section
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!dbProfile) return;
    setSettings({
      isPrivate:                !!dbProfile.isPrivate,
      hideAuraRank:             !!dbProfile.hideAuraRank,
      commentVisibilityDefault: dbProfile.commentVisibilityDefault ?? 'anyone',
      notificationPrefs:        defaultNotificationPrefs(dbProfile.notificationPrefs),
    });
  }, [dbProfile]);

  // Saves immediately and rolls back if the request fails
  async function save(changes) {
    const previous = settings;
    setSettings(prev => ({ ...prev, ...changes }));
    setSaving(true);
    setError('');
    try {
      await api.updateProfile(changes);
      await refreshUser();
    } catch (err) {
      setSettings(previous);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function setNotification(key, value) {
    save({ notificationPrefs: { ...settings.notificationPrefs, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex items-center gap-3">
        <SettingsIcon size={24} className="text-aura-400" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Settings</h1>
      </div>

      <Message error={error} />

      {dbProfile?.isAdmin && (
        <Link to="/moderation" className="card mb-4 flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)] hover:border-aura-500/40">
          <ShieldAlert size={18} className="text-aura-400" /> Moderation tools
        </Link>
      )}

      {/* ── Account ── */}
      <Section icon={User} title="Account">
        <div>
          <p className="text-sm text-[var(--text-primary)]">
            Username <span className="font-semibold">@{username}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {usernameStatusText(dbProfile?.usernameStatus)}{' '}
            {dbProfile?.usernameStatus?.canChange && (
              <Link to={`/profile/${encodeURIComponent(username ?? '')}`} className="text-aura-400 hover:underline">
                Change it on your profile.
              </Link>
            )}
          </p>
        </div>
        {dbProfile?.email && (
          <p className="text-sm text-[var(--text-primary)]">
            Email <span className="text-[var(--text-muted)]">{dbProfile.email}</span>
          </p>
        )}
        <div className="divider" />
        <PasswordForm />
        <p className="text-xs text-[var(--text-muted)]">
          Email changes and two-factor authentication are coming soon.
        </p>
        <div className="divider" />
        <button type="button"
          onClick={async () => { await logout(); navigate('/welcome'); }}
          className="btn-secondary self-start text-red-400 hover:bg-red-400/10">
          <LogOut size={16} /> Sign out
        </button>
      </Section>

      {/* ── Appearance (the theme is saved to the account, scenery per device) ── */}
      <Section id="appearance" icon={Palette} title="Appearance">
        <div>
          <p className="text-sm text-[var(--text-primary)]">Theme</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-3">Saved to your account, so it follows you to other devices.</p>
          <ThemeCards />
        </div>
        <Toggle
          label="Animated scenery"
          description="The clouds, stars, snow and waves behind Day, Night, Snowy Peaks, Duskfall and City Skies. Saved on this device."
          checked={skyDetails}
          onChange={setSkyDetails}
        />
      </Section>

      {!settings ? null : (
        <>
          {/* ── Privacy ── */}
          <Section id="privacy" icon={Shield} title="Privacy">
            <Toggle
              label="Learn from what I do"
              description="Your feed adapts to the aura you give and take and the posts you like, right on this device. It's never sent to our servers, and nothing is learned from what you only look at."
              checked={learning}
              onChange={value => { setLearningOn(user?.userId, value); setLearning(value); }}
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-[var(--text-muted)]">
                {learnReset ? 'Done. Your feed starts fresh.' : 'Clear everything your feed has learned on this device.'}
              </p>
              <button type="button" className="btn-secondary shrink-0"
                onClick={() => { clearTaste(user?.userId); setLearnReset(true); }}>
                Reset what Aura learned
              </button>
            </div>
            <Toggle
              label="Private account"
              description="Only followers you approve see your posts and who you follow. Turning this off lets everyone waiting in."
              checked={settings.isPrivate}
              disabled={saving}
              onChange={value => save({ isPrivate: value })}
            />
            <Toggle
              label="Hide global aura rank"
              description="Your rank won't show on your profile."
              checked={settings.hideAuraRank}
              disabled={saving}
              onChange={value => save({ hideAuraRank: value })}
            />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--text-primary)]">Default comment visibility</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Who can comment on your new posts. You can change it on each post when you share it.</p>
              </div>
              <select
                value={settings.commentVisibilityDefault}
                disabled={saving}
                onChange={e => save({ commentVisibilityDefault: e.target.value })}
                className="input w-auto py-2">
                <option value="anyone">Anyone</option>
                <option value="followers">Followers only</option>
              </select>
            </div>
          </Section>

          {/* ── Notifications ── */}
          <Section icon={Bell} title="Notifications">
            <p className="text-xs text-[var(--text-muted)] -mt-2">
              Choose which notifications you get. Group mutes are set on each group's page.
            </p>
            {NOTIFICATION_OPTIONS.map(({ key, label }) => (
              <Toggle
                key={key}
                label={label}
                checked={settings.notificationPrefs[key]}
                disabled={saving}
                onChange={value => setNotification(key, value)}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
