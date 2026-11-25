import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import editorialAuthLounge from '../assets/images/editorial_auth_lounge_1795589531132.jpg';
import {
  isSupabaseBrowserConfigured,
  sendEmailSignInOtp,
  signOutSupabase,
  verifyEmailSignInOtp,
} from '../lib/supabase';

export interface AuthenticatedMember {
  userId: string;
  email: string;
  name: string;
  role: 'member' | 'admin';
  accessToken: string;
  provider: 'supabase-otp' | 'invite';
}

interface PendingVerificationSession {
  userId: string;
  email: string;
  accessToken: string;
}

interface OAuthLoginPageProps {
  defaultEmail: string;
  defaultName: string;
  initialPendingSession?: PendingVerificationSession | null;
  initialNotice?: string | null;
  onBackToLanding: () => void;
  onAuthenticated: (member: AuthenticatedMember) => void;
}

const AUTH_LOUNGE_IMAGE = editorialAuthLounge;

export default function OAuthLoginPage({
  defaultEmail,
  defaultName,
  initialPendingSession = null,
  initialNotice = null,
  onBackToLanding,
  onAuthenticated,
}: OAuthLoginPageProps) {
  const supabaseReady = isSupabaseBrowserConfigured();

  const [authMode, setAuthMode] = useState<'otp' | 'invite'>(
    initialPendingSession ? 'invite' : 'otp'
  );
  const [imgError, setImgError] = useState(false);

  // Email OTP / Magic Link state
  const [email, setEmail] = useState(initialPendingSession?.email ?? defaultEmail);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Verified session awaiting approved invitation redemption
  const [pendingSession, setPendingSession] = useState<PendingVerificationSession | null>(
    initialPendingSession
  );
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState(defaultName);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);

  const checkMembershipAndProceed = async (accessToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Membership verification is temporarily unavailable.');
    }

    if (data.onboarded && data.membershipStatus === 'active' && data.account) {
      onAuthenticated({
        userId: data.account.userId,
        email: data.account.email,
        name: data.account.name,
        role: data.account.role,
        accessToken,
        provider: 'supabase-otp',
      });
      return;
    }

    if (data.onboarded && data.membershipStatus !== 'active') {
      await signOutSupabase();
      throw new Error('Your Inner Circle membership is currently inactive. Contact an administrator.');
    }

    // Verified Supabase user, but requires an administrator-approved invitation code to onboard
    setPendingSession({
      userId: data.user.id,
      email: data.user.email,
      accessToken,
    });
    setEmail(data.user.email);
    setAuthMode('invite');
    setNotice(
      `Email verified for ${data.user.email}. Enter your administrator-approved invitation code to activate your seat.`
    );
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setError('Please enter a valid member email address.');
      return;
    }

    setLoading(true);
    try {
      await sendEmailSignInOtp(cleanedEmail);
      setOtpSent(true);
      setNotice(
        `We sent a magic sign-in link and 6-digit verification code to ${cleanedEmail}. Click the link or enter the code below.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanedToken = otpCode.trim();
    if (cleanedToken.length < 6) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }

    setLoading(true);
    try {
      const session = await verifyEmailSignInOtp(email, cleanedToken);
      await checkMembershipAndProceed(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please request a new code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!pendingSession) {
      setError('Verify your email with a Magic Link or OTP code first before redeeming an invitation.');
      setAuthMode('otp');
      return;
    }

    const code = inviteCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setError('Enter your approved invitation code (for example, MC-A1B2C3D4).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSession.accessToken}`,
        },
        body: JSON.stringify({
          inviteCode: code,
          name: name.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.account) {
        setError(data.error || 'Invitation could not be activated right now.');
        return;
      }

      onAuthenticated({
        userId: data.account.userId,
        email: data.account.email,
        name: data.account.name,
        role: data.account.role,
        accessToken: pendingSession.accessToken,
        provider: 'invite',
      });
    } catch {
      setError('Unable to reach onboarding server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPendingSession = async () => {
    await signOutSupabase();
    setPendingSession(null);
    setOtpSent(false);
    setOtpCode('');
    setNotice(null);
    setError(null);
    setAuthMode('otp');
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

      {/* Right Column: Verified Supabase Authentication Canvas */}
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
            <p className="text-xs font-medium text-gold">Verified Member Access</p>
            <h1 className="text-3xl md:text-4xl font-display font-light text-white text-balance">
              Sign in to the <span className="text-gold italic">Inner Circle</span>
            </h1>
            <p className="text-sm text-white/55">
              Verify your identity via Supabase Email OTP or Magic Link, then activate your administrator-approved invitation.
            </p>
          </div>

          {!supabaseReady && (
            <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 text-xs text-white/85 space-y-1.5">
              <p className="font-semibold text-gold">Supabase Browser Configuration Pending</p>
              <p className="text-white/70 leading-relaxed">
                Configure <code className="font-mono text-gold">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-gold">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment before activating live email OTP sign-in.
              </p>
            </div>
          )}

          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                authMode === 'otp'
                  ? 'bg-white text-elite-black font-semibold'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              Email OTP / Link
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('invite');
                setError(null);
              }}
              className={`py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                authMode === 'invite'
                  ? 'bg-white text-elite-black font-semibold'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              Activate Invite
            </button>
          </div>

          {notice && (
            <div className="text-xs text-white/85 bg-green/10 border border-green/30 rounded-xl px-4 py-3 leading-relaxed">
              {notice}
            </div>
          )}

          {authMode === 'otp' ? (
            <div className="space-y-5">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-white/65">Member Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@moonshinecapital.com"
                      required
                      disabled={!supabaseReady || loading}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!supabaseReady || loading}
                    className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Sending Verification Email...
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Send Magic Link &amp; OTP Code
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-white/75 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setError(null);
                      }}
                      className="text-gold hover:underline shrink-0 ml-3"
                    >
                      Change
                    </button>
                  </div>

                  <label className="space-y-1.5 block">
                    <span className="text-xs text-white/65">6-Digit Verification Code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-base font-mono tracking-[0.35em] text-gold placeholder:text-white/25 focus:outline-none focus:border-gold"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Verifying Code...
                      </>
                    ) : (
                      <>
                        <KeyRound size={14} />
                        Verify &amp; Continue
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="w-full text-xs text-white/55 hover:text-gold transition-colors py-1"
                  >
                    Resend verification email
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Invitation Redemption Step (Requires Verified Supabase Session) */
            <form onSubmit={handleRedeemInvite} className="space-y-4">
              {pendingSession ? (
                <div className="rounded-xl border border-green/30 bg-green/10 px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-green font-medium">Verified Email Session</p>
                    <p className="text-white/80 truncate">{pendingSession.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPendingSession}
                    className="text-white/60 hover:text-white shrink-0"
                  >
                    Switch
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/65 leading-relaxed">
                  To activate an invitation code, first verify your email under{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('otp')}
                    className="text-gold hover:underline font-medium"
                  >
                    Email OTP / Link
                  </button>
                  . Your verified identity must match the email on your approved invitation.
                </div>
              )}

              <label className="space-y-1.5 block">
                <span className="text-xs text-white/65">Approved Invitation Code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="MC-A1B2C3D4"
                  required
                  disabled={!pendingSession || loading}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm font-mono uppercase tracking-wider text-gold placeholder:text-white/30 focus:outline-none focus:border-gold disabled:opacity-50"
                />
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs text-white/65">Full Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Vance"
                  required
                  disabled={!pendingSession || loading}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold disabled:opacity-50"
                />
              </label>

              <p className="text-xs text-white/45 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green shrink-0" />
                <span>Single-use invitation enforced server-side against your verified account UUID.</span>
              </p>

              <button
                type="submit"
                disabled={!pendingSession || loading}
                className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Activating Membership...
                  </>
                ) : (
                  <>
                    Redeem Approved Invite
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
            <span>Supabase Auth JWT · Invitation-gated membership</span>
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
