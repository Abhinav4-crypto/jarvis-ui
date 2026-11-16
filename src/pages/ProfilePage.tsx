import React, { useState } from 'react';
import { Check, Edit3, Mail, MapPin, Shield, User, X } from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';

export function ProfilePage() {
  const { profile, updateProfile } = useJarvis();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const inputClass =
    'w-full rounded-xl border border-amber-900/15 dark:border-amber-500/20 bg-white dark:bg-[#141316] px-3.5 py-2 text-sm text-[#171411] dark:text-[#FAF6EE] focus:outline-none focus:border-amber-500';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-page-enter pb-20">
      {/* Profile Hero Header */}
      <GlassCard glow padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-500/45 bg-amber-500/10 flex items-center justify-center shrink-0">
              {!avatarFailed && profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-amber-500" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
                {profile.name}
              </h1>
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                {profile.role} · {profile.handle}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-400">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {profile.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              </div>
            </div>
          </div>

          {!editing && (
            <Button
              variant="primary"
              icon={<Edit3 className="w-4 h-4" />}
              onClick={() => {
                setDraft(profile);
                setEditing(true);
              }}
            >
              Edit Profile
            </Button>
          )}
        </div>

        <p className="mt-5 pt-4 border-t border-amber-900/10 dark:border-white/[0.06] text-sm leading-relaxed text-stone-700 dark:text-stone-300">
          {profile.bio}
        </p>
      </GlassCard>

      {editing ? (
        <GlassCard padding="lg">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
              Edit User Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Role / Title
                </label>
                <input
                  type="text"
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Bio
              </label>
              <textarea
                rows={3}
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="secondary" icon={<X className="w-4 h-4" />} onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon={<Check className="w-4 h-4" />}>
                Save Profile
              </Button>
            </div>
          </form>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Account & Personalization Preferences */}
          <GlassCard padding="md" className="space-y-4">
            <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
              Personalization Settings
            </h2>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Dashboard Greeting Prefix
              </label>
              <input
                type="text"
                value={profile.preferredGreeting}
                onChange={(e) => updateProfile({ preferredGreeting: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                JARVIS Companion Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['executive', 'friendly', 'technical'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateProfile({ companionTone: tone })}
                    className={[
                      'px-3 py-2 rounded-xl border text-xs font-medium capitalize cursor-pointer',
                      profile.companionTone === tone
                        ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        : 'border-amber-900/12 dark:border-amber-500/18 text-stone-700 dark:text-stone-300',
                    ].join(' ')}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Account & Privacy Preferences */}
          <GlassCard padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Account & Privacy Preferences
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-amber-900/10 dark:border-white/[0.06]">
                <span className="text-stone-600 dark:text-stone-400">Workspace Handle</span>
                <span className="font-mono text-[#171411] dark:text-[#FAF6EE]">{profile.handle}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-amber-900/10 dark:border-white/[0.06]">
                <span className="text-stone-600 dark:text-stone-400">Timezone</span>
                <span className="font-mono text-[#171411] dark:text-[#FAF6EE]">{profile.timezone}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE]">
                    Sync Preferences with Local Backend
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Share profile tone when desktop bridge connects
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.shareTelemetryWithLocalBackend}
                  onClick={() =>
                    updateProfile({
                      shareTelemetryWithLocalBackend: !profile.shareTelemetryWithLocalBackend,
                    })
                  }
                  className={[
                    'w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0',
                    profile.shareTelemetryWithLocalBackend
                      ? 'bg-amber-500'
                      : 'bg-stone-300 dark:bg-stone-700',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'block w-5 h-5 rounded-full bg-white transition-transform',
                      profile.shareTelemetryWithLocalBackend
                        ? 'translate-x-5'
                        : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
