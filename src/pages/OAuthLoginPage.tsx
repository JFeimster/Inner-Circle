import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export interface AuthenticatedMember {
  email: string;
  name: string;
  provider: 'google' | 'linkedin' | 'microsoft' | 'email' | 'invite';
}

interface OAuthLoginPageProps {
  defaultEmail: string;
  defaultName: string;
  onBackToLanding: () => void;
  onAuthenticated: (member: AuthenticatedMember) => void;
}

type OAuthProvider = 'google' | 'linkedin' | 'microsoft';

const AUTH_LOUNGE_IMAGE = '/src/assets/images/editorial_auth_lounge_1795589531132.jpg';

const PROVIDER_META: Record<
  OAuthProvider,
  { label: string; subtitle: string; scopes: string }
> = {
  google: {
    label: 'Google Workspace',
    subtitle: 'Syncs sign-in, Calendar, Drive & Gmail drafts',
    scopes: 'openid · email · profile · calendar · drive.file',
  },
  linkedin: {
    label: 'LinkedIn Advisory',
    subtitle: 'Verifies executive profile & launch sharing',
    scopes: 'openid · profile · email · w_member_social',
  },
  microsoft: {
    label: 'Microsoft Entra ID',
    subtitle: 'Brokerage Outlook & Microsoft 365 credentials',
    scopes: 'openid · profile · email · Calendars.ReadWrite',
  },
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.86l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.33A7.2 7.2 0 0 1 4.9 12c0-.81.14-1.6.38-2.33V6.58H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.42l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.71c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.58l4 3.09c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.28 2.37 4.28 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function OAuthLoginPage({
  defaultEmail,
  defaultName,
  onBackToLanding,
  onAuthenticated,
}: OAuthLoginPageProps) {
  const [authMode, setAuthMode] = useState<'oauth' | 'invite'>('oauth');
  const [activeProvider, setActiveProvider] = useState<OAuthProvider | null>(null);
  const [imgError, setImgError] = useState(false);

  // Form fields
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [inviteCode, setInviteCode] = useState('MOONSHINE-2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeSession = async (
    targetEmail: string,
    targetName: string,
    provider: AuthenticatedMember['provider']
  ) => {
    setError(null);
    const cleanedEmail = targetEmail.trim().toLowerCase();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError('Please enter a valid member email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: cleanedEmail,
          name: targetName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication could not be completed.');
        return;
      }

      onAuthenticated({
        email: data.account?.email ?? cleanedEmail,
        name: data.account?.name ?? (targetName.trim() || defaultName),
        provider,
      });
    } catch {
      setError('Unable to reach authentication server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code || (!code.startsWith('MOONSHINE') && !code.startsWith('MC-'))) {
      setError('Enter a valid cohort code (for example, MOONSHINE-2026 or your MC- reference code).');
      return;
    }
    completeSession(email, name, 'invite');
  };

  return (
    <div className="min-h-screen bg-elite-black text-white font-sans grid grid-cols-1 lg:grid-cols-12 items-stretch selection:bg-gold selection:text-elite-black">
      {/* Left Column: Full-Height Architectural Showcase */}
      <aside className="relative hidden lg:flex lg:col-span-5 flex-col justify-between p-10 overflow-hidden border-r border-white/10 bg-[#0d0d0f]">
        {!imgError ? (
          <img
            src={AUTH_LOUNGE_IMAGE}
            alt="Moonshine Capital obsidian stone and brushed bronze members club atrium"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1b1610] via-elite-black to-[#140b20]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-elite-black/95 via-elite-black/45 to-elite-black/65" />

        <div className="relative z-10 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="font-display text-xl tracking-wider text-gold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
          >
            Moonshine Capital
          </button>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <blockquote className="text-2xl font-display font-light text-white leading-snug">
            &ldquo;Precision onboarding turns ambitious independent advisors into market leaders within their first thirty days.&rdquo;
          </blockquote>
          <div className="space-y-1 text-xs">
            <p className="font-medium text-gold">David Sterling</p>
            <p className="text-white/60">Senior Managing Partner · Inner Circle Mentorship</p>
          </div>
          <div className="pt-5 border-t border-white/15 flex flex-wrap items-center gap-2 text-xs text-white/55">
            <span>30-Day Roadmap</span>
            <span aria-hidden="true">·</span>
            <span>Marketing Vault</span>
            <span aria-hidden="true">·</span>
            <span>AI Studio</span>
          </div>
        </div>
      </aside>

      {/* Right Column: Spacious Executive OAuth Canvas */}
      <section className="lg:col-span-7 flex flex-col justify-between px-6 py-8 md:px-14 md:py-10">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-xs font-medium text-white/65 hover:text-gold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
          >
            <ArrowLeft size={14} />
            Back to Overview
          </button>
          <span className="lg:hidden font-display text-base text-gold">Moonshine Capital</span>
        </div>

        {/* Centered Auth Container */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md mx-auto my-10 space-y-8"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-gold">Member Portal Access</p>
            <h1 className="text-3xl md:text-4xl font-display font-light text-white text-balance">
              Sign in to the <span className="text-gold italic">Inner Circle</span>
            </h1>
            <p className="text-sm text-white/55">
              Authenticate with your connected workspace provider or activate an approved cohort invitation code.
            </p>
          </div>

          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAuthMode('oauth');
                setActiveProvider(null);
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                authMode === 'oauth'
                  ? 'bg-white text-elite-black font-semibold'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              OAuth Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('invite');
                setActiveProvider(null);
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                authMode === 'invite'
                  ? 'bg-white text-elite-black font-semibold'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              Invite Code
            </button>
          </div>

          {authMode === 'oauth' ? (
            activeProvider ? (
              /* OAuth Provider Consent / Account Selection Step */
              <div className="rounded-2xl border border-gold/30 bg-white/[0.03] p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    {activeProvider === 'google' && <GoogleMark />}
                    {activeProvider === 'linkedin' && <LinkedInMark />}
                    {activeProvider === 'microsoft' && <MicrosoftMark />}
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {PROVIDER_META[activeProvider].label}
                      </p>
                      <p className="text-xs text-white/55">
                        {PROVIDER_META[activeProvider].subtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProvider(null);
                      setError(null);
                    }}
                    className="text-xs text-white/55 hover:text-white transition-colors"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs text-white/60">Select verified member account</p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => completeSession(defaultEmail, defaultName, activeProvider)}
                    className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-gold/50 transition-colors flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{defaultName}</p>
                      <p className="text-xs text-white/55">{defaultEmail}</p>
                    </div>
                    {loading ? (
                      <Loader2 size={15} className="animate-spin text-gold" />
                    ) : (
                      <ArrowRight size={15} className="text-gold" />
                    )}
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    completeSession(email, name, activeProvider);
                  }}
                  className="pt-4 border-t border-white/10 space-y-3"
                >
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-white/60">Or authorize another account email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-gold"
                    />
                  </label>
                  <p className="text-[11px] font-mono text-white/40">
                    Requested scopes: {PROVIDER_META[activeProvider].scopes}
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Verifying Session...
                      </>
                    ) : (
                      <>
                        Authorize &amp; Enter Portal
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Primary OAuth Provider Stack + Direct Email Fallback */
              <div className="space-y-6">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setActiveProvider('google')}
                    className="w-full px-5 py-3.5 rounded-xl bg-white text-elite-black hover:bg-white/90 transition-colors flex items-center justify-between text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <span className="flex items-center gap-3">
                      <GoogleMark />
                      <span>Continue with Google</span>
                    </span>
                    <span className="text-[11px] font-medium text-elite-black/55">Recommended</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProvider('linkedin')}
                    className="w-full px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 transition-colors flex items-center justify-between text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <span className="flex items-center gap-3">
                      <LinkedInMark />
                      <span>Continue with LinkedIn</span>
                    </span>
                    <ArrowRight size={14} className="text-white/40" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveProvider('microsoft')}
                    className="w-full px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 transition-colors flex items-center justify-between text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <span className="flex items-center gap-3">
                      <MicrosoftMark />
                      <span>Continue with Microsoft</span>
                    </span>
                    <ArrowRight size={14} className="text-white/40" />
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-white/35">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or continue with member email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    completeSession(email, name, 'email');
                  }}
                  className="space-y-4"
                >
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-white/65">Member Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@moonshinecapital.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full border border-gold/50 text-gold hover:bg-gold hover:text-elite-black transition-colors text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Continue to Member Portal
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )
          ) : (
            /* Cohort Invite Code Activation */
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <label className="space-y-1.5 block">
                <span className="text-xs text-white/65">Invitation Code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="MOONSHINE-2026"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm font-mono uppercase tracking-wider text-gold placeholder:text-white/30 focus:outline-none focus:border-gold"
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs text-white/65">Full Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jason Feimster"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs text-white/65">Work Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@moonshinecapital.com"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                />
              </label>

              <p className="text-xs text-white/45 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green shrink-0" />
                <span>Includes 30 monthly AI Studio credits &amp; Day 1 onboarding access.</span>
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Activating Seat...
                  </>
                ) : (
                  <>
                    Activate Member Seat
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {error && (
            <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </motion.div>

        {/* Quiet Security & Application Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white/45 pt-6 border-t border-white/10">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={14} className="text-gold/80 shrink-0" />
            <span>Isolated member sessions · Server-verified quotas</span>
          </span>
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-white/65 hover:text-gold transition-colors text-left sm:text-right"
          >
            Need an invite? Apply on Overview
          </button>
        </div>
      </section>
    </div>
  );
}
