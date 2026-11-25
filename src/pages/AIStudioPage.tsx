import React, { useEffect, useState } from 'react';
import {
  Send,
  Image as ImageIcon,
  FileDown,
  CreditCard,
  Loader2,
  Download,
  Copy,
  Check,
  LogOut,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

interface StudioPlan {
  id: 'onboarding' | 'producer' | 'inner_circle';
  name: string;
  audience: string;
  priceMonthly: number;
  billingCadence: string;
  monthlyCredits: number;
  dailyLimit: number;
  features: string[];
}

interface TopupPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
}

interface UsageEntry {
  id: number;
  action_type: 'chat' | 'image' | 'file';
  credits_used: number;
  prompt_summary: string;
  created_at: string;
}

interface AccountSnapshot {
  email: string;
  name: string;
  role: string;
  plan: StudioPlan;
  bonusCredits: number;
  monthlyAllowance: number;
  monthlyUsed: number;
  remainingCredits: number;
  dailyLimit: number;
  dailyUsed: number;
  remainingDaily: number;
  recentUsage: UsageEntry[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface GeneratedImage {
  id: string;
  prompt: string;
  aspectRatio: string;
  imageUrl: string;
  caption: string;
}

interface GeneratedFile {
  id: string;
  filename: string;
  title: string;
  summary: string;
  format: 'md' | 'csv' | 'txt' | 'html';
  mimeType: string;
  content: string;
}

interface AIStudioPageProps {
  defaultEmail: string;
  defaultName: string;
}

type StudioTab = 'chat' | 'image' | 'file' | 'pricing';

const STORAGE_EMAIL_KEY = 'mc_studio_agent_email';

export default function AIStudioPage({ defaultEmail, defaultName }: AIStudioPageProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('chat');
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [plans, setPlans] = useState<StudioPlan[]>([]);
  const [topupPacks, setTopupPacks] = useState<TopupPack[]>([]);
  const [creditCosts, setCreditCosts] = useState({ chat: 1, file: 2, image: 5 });

  // Sign-in gate state
  const [loginEmail, setLoginEmail] = useState(defaultEmail);
  const [loginName, setLoginName] = useState(defaultName);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  // Image Studio state
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:3' | '3:4' | '9:16'>('16:9');
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  // File Creator state
  const [filePrompt, setFilePrompt] = useState('');
  const [fileFormat, setFileFormat] = useState<'md' | 'csv' | 'txt' | 'html'>('md');
  const [fileGenerating, setFileGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Plan update loading
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);

  const getHeaders = (emailOverride?: string): Record<string, string> => {
    const saved = emailOverride ?? account?.email ?? localStorage.getItem(STORAGE_EMAIL_KEY) ?? '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (saved) headers['x-agent-email'] = saved;
    return headers;
  };

  const fetchAccount = async (emailOverride?: string) => {
    try {
      const res = await fetch('/api/studio/account', {
        headers: getHeaders(emailOverride),
        credentials: 'include',
      });
      const data = await res.json();
      setPlans(data.plans ?? []);
      setTopupPacks(data.topupPacks ?? []);
      if (data.creditCosts) setCreditCosts(data.creditCosts);
      setAccount(data.account ?? null);
    } catch {
      setErrorBanner('Unable to reach the Moonshine AI Studio server.');
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    const storedEmail = localStorage.getItem(STORAGE_EMAIL_KEY) || undefined;
    fetchAccount(storedEmail);
  }, []);

  const handleSignIn = async (emailToUse: string, nameToUse: string) => {
    setErrorBanner(null);
    setStatusNote(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/studio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailToUse, name: nameToUse }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Sign-in failed.');
        return;
      }
      localStorage.setItem(STORAGE_EMAIL_KEY, data.account.email);
      setAccount(data.account);
      setStatusNote(`Signed in as ${data.account.email}. Server-side quota enforcement is active.`);
    } catch {
      setErrorBanner('Could not sign in to AI Studio.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem(STORAGE_EMAIL_KEY);
    await fetch('/api/studio/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setAccount(null);
    setChatMessages([]);
    setStatusNote(null);
    setErrorBanner(null);
  };

  const handleSendChat = async (promptOverride?: string) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatSending || !account) return;
    setErrorBanner(null);
    setStatusNote(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatSending(true);

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          history: chatMessages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (data.account) setAccount(data.account);
      if (!res.ok) {
        setErrorBanner(data.error || 'Chat request failed.');
        return;
      }
      setChatMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, role: 'model', text: data.reply },
      ]);
    } catch {
      setErrorBanner('Network error contacting Concierge Chat.');
    } finally {
      setChatSending(false);
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = imagePrompt.trim();
    if (!prompt || imageGenerating || !account) return;
    setErrorBanner(null);
    setStatusNote(null);
    setImageGenerating(true);

    try {
      const res = await fetch('/api/studio/image', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ prompt, aspectRatio }),
      });
      const data = await res.json();
      if (data.account) setAccount(data.account);
      if (!res.ok) {
        setErrorBanner(data.error || 'Image generation failed.');
        return;
      }
      setGeneratedImages((prev) => [
        {
          id: `img-${Date.now()}`,
          prompt,
          aspectRatio: data.aspectRatio,
          imageUrl: data.imageUrl,
          caption: data.caption || '',
        },
        ...prev,
      ]);
      setImagePrompt('');
      setStatusNote(`Image generated (${creditCosts.image} credits deducted).`);
    } catch {
      setErrorBanner('Network error contacting Image Studio.');
    } finally {
      setImageGenerating(false);
    }
  };

  const handleGenerateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = filePrompt.trim();
    if (!prompt || fileGenerating || !account) return;
    setErrorBanner(null);
    setStatusNote(null);
    setFileGenerating(true);

    try {
      const res = await fetch('/api/studio/file', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ prompt, format: fileFormat }),
      });
      const data = await res.json();
      if (data.account) setAccount(data.account);
      if (!res.ok) {
        setErrorBanner(data.error || 'File generation failed.');
        return;
      }
      setGeneratedFiles((prev) => [
        {
          id: `file-${Date.now()}`,
          ...data.file,
        },
        ...prev,
      ]);
      setFilePrompt('');
      setStatusNote(`Created ${data.file.filename} (${creditCosts.file} credits deducted).`);
    } catch {
      setErrorBanner('Network error contacting File Creator.');
    } finally {
      setFileGenerating(false);
    }
  };

  const handlePlanUpdate = async (payload: { planId?: string; topupId?: string }, label: string) => {
    if (!account) return;
    setErrorBanner(null);
    setStatusNote(null);
    setUpdatingPlanId(payload.planId ?? payload.topupId ?? 'plan');
    try {
      const res = await fetch('/api/studio/plan', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Could not update plan.');
        return;
      }
      setAccount(data.account);
      setStatusNote(`${label} applied to ${data.account.email}.`);
    } catch {
      setErrorBanner('Network error updating plan.');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const downloadFile = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: `${file.mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyFileContent = async (file: GeneratedFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFileId(file.id);
      setTimeout(() => setCopiedFileId(null), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const monthlyPct = account
    ? Math.min(100, Math.round((account.monthlyUsed / Math.max(1, account.monthlyAllowance)) * 100))
    : 0;
  const dailyPct = account
    ? Math.min(100, Math.round((account.dailyUsed / Math.max(1, account.dailyLimit)) * 100))
    : 0;

  if (loadingAccount) {
    return (
      <div className="py-24 flex items-center justify-center gap-3 text-sm text-white/60">
        <Loader2 size={18} className="animate-spin text-gold" />
        Loading Moonshine AI Studio...
      </div>
    );
  }

  return (
    <motion.div
      key="studio"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-gold tracking-wide">
            Server-Gated Member Studio · Credit &amp; Daily Quota Protection
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-light text-white text-balance">
            Moonshine <span className="text-gold italic">AI Studio</span>
          </h1>
          <p className="text-sm md:text-base text-white/60 font-light">
            Generate luxury client scripts, branded visuals, and downloadable deliverables under per-member credit allowances and daily spend caps.
          </p>
        </div>

        {account && (
          <div className="flex items-center gap-4 text-xs text-white/70 shrink-0">
            <div className="text-right">
              <p className="font-medium text-white">{account.name}</p>
              <p className="text-white/50">{account.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-full border border-white/15 hover:border-gold/50 hover:text-gold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <LogOut size={13} />
              Switch Member
            </button>
          </div>
        )}
      </div>

      {/* Member Sign-In Gate */}
      {!account ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <section className="lg:col-span-7 glass rounded-3xl p-8 md:p-10 border border-white/10 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-gold">
                <ShieldCheck size={15} />
                Member Account Required
              </div>
              <h2 className="text-2xl md:text-3xl font-display text-white">
                Sign in to unlock your credit allowance
              </h2>
              <p className="text-sm text-white/60 leading-relaxed">
                Every Moonshine Capital agent receives an isolated monthly credit balance and daily guardrail enforced on the server so studio usage stays predictable and auditable.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn(loginEmail, loginName);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                  <span className="text-xs text-white/60">Agent Email</span>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="agent@moonshinecapital.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                  />
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-xs text-white/60">Display Name</span>
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="Jason Feimster"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                  />
                </label>
              </div>

              {errorBanner && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="px-6 py-2.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity disabled:opacity-50 whitespace-nowrap"
                >
                  {authLoading ? 'Signing in...' : 'Continue to AI Studio'}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={() => handleSignIn('sarah.jenkins@moonshinecapital.com', 'Sarah Jenkins')}
                  className="px-5 py-2.5 rounded-full border border-white/15 hover:border-white/35 text-xs text-white/75 hover:text-white transition-colors whitespace-nowrap"
                >
                  Test Separate Agent Quota
                </button>
              </div>
            </form>
          </section>

          <section className="lg:col-span-5 glass rounded-3xl p-8 border border-white/10 space-y-5">
            <h3 className="text-xl font-display text-white">Credit Pricing Overview</h3>
            <p className="text-xs text-white/55 leading-relaxed">
              Every action deducts transparent credits on the server before calling Gemini—eliminating uncontrolled spend.
            </p>
            <div className="divide-y divide-white/10 text-sm">
              <div className="py-3.5 flex items-center justify-between">
                <span className="text-white/80">Concierge Chat Turn</span>
                <span className="font-semibold text-gold tabular-nums">{creditCosts.chat} credit</span>
              </div>
              <div className="py-3.5 flex items-center justify-between">
                <span className="text-white/80">Downloadable File (.md, .csv, .txt, .html)</span>
                <span className="font-semibold text-gold tabular-nums">{creditCosts.file} credits</span>
              </div>
              <div className="py-3.5 flex items-center justify-between">
                <span className="text-white/80">Brand Marketing Image</span>
                <span className="font-semibold text-gold tabular-nums">{creditCosts.image} credits</span>
              </div>
            </div>
            <p className="text-xs text-white/45 pt-2">
              New members start with 30 included credits per month (10/day guardrail).
            </p>
          </section>
        </div>
      ) : (
        <>
          {/* 4-Column Server-Enforced Quota Strip */}
          <section className="glass rounded-3xl border border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-6 space-y-1.5">
              <p className="text-xs text-white/55">Remaining Credits</p>
              <p className="text-3xl font-display text-gold tabular-nums">
                {account.remainingCredits}
                <span className="text-base text-white/40"> / {account.monthlyAllowance}</span>
              </p>
              <p className="text-xs text-white/45">
                {account.bonusCredits > 0
                  ? `Includes ${account.bonusCredits} top-up credits`
                  : 'Resets monthly'}
              </p>
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/55">Monthly Usage</span>
                <span className="text-white font-medium tabular-nums">{monthlyPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    monthlyPct >= 95 ? 'bg-red-500' : monthlyPct >= 75 ? 'bg-gold' : 'bg-green'
                  }`}
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
              <p className="text-xs text-white/50 tabular-nums">
                {account.monthlyUsed} credits consumed this month
              </p>
            </div>

            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/55">Daily Safety Cap</span>
                <span className="text-white font-medium tabular-nums">
                  {account.dailyUsed} / {account.dailyLimit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    dailyPct >= 95 ? 'bg-red-500' : dailyPct >= 75 ? 'bg-gold' : 'bg-green'
                  }`}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
              <p className="text-xs text-white/50 tabular-nums">
                {account.remainingDaily} credits available today
              </p>
            </div>

            <div className="p-6 flex flex-col justify-between space-y-2">
              <div>
                <p className="text-xs text-white/55">Active Tier</p>
                <p className="text-xl font-display text-white mt-0.5">{account.plan.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className="text-xs font-medium text-gold hover:underline text-left"
              >
                Manage Plan or Add Credits
              </button>
            </div>
          </section>

          {/* Feedback Banners */}
          {errorBanner && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              {errorBanner.toLowerCase().includes('credit') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="text-xs font-semibold text-gold hover:underline whitespace-nowrap shrink-0"
                >
                  View Plans
                </button>
              )}
            </div>
          )}

          {statusNote && !errorBanner && (
            <div className="p-3.5 rounded-2xl bg-green/10 border border-green/30 text-xs text-white/85 flex items-center justify-between gap-4">
              <span>{statusNote}</span>
              <button
                type="button"
                onClick={() => setStatusNote(null)}
                className="text-white/50 hover:text-white text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Segmented Mode Control */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 w-fit">
            {(
              [
                { id: 'chat', label: 'Concierge Chat', meta: `${creditCosts.chat} cr`, icon: MessageSquare },
                { id: 'image', label: 'Image Studio', meta: `${creditCosts.image} cr`, icon: ImageIcon },
                { id: 'file', label: 'File Creator', meta: `${creditCosts.file} cr`, icon: FileDown },
                { id: 'pricing', label: 'Plans & Credits', meta: 'Pricing', icon: CreditCard },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-elite-black font-semibold'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  <span className={isActive ? 'text-elite-black/60' : 'text-gold/80'}>
                    · {tab.meta}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: CONCIERGE CHAT */}
          {activeTab === 'chat' && (
            <section className="glass rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-6 md:p-8 min-h-[380px] max-h-[520px] overflow-y-auto space-y-5">
                {chatMessages.length === 0 ? (
                  <div className="py-10 space-y-6 max-w-2xl">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-display text-white">
                        Executive Advisory Concierge
                      </h2>
                      <p className="text-sm text-white/55">
                        Ask for luxury listing positioning, objection-handling scripts, investor outreach drafts, or Week 1–4 onboarding guidance. Each message uses {creditCosts.chat} credit.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'Draft a concise cold outreach email to a $10M+ commercial property owner.',
                        'Give me 3 sharp responses when a luxury seller asks why Moonshine Capital.',
                        'Build a 5-day follow-up cadence after my first property walkthrough.',
                        'Outline talking points for a 15-minute discovery call with a family office.',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSendChat(suggestion)}
                          className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs text-white/80 leading-relaxed transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl rounded-2xl px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-gold/15 border border-gold/30 text-white'
                            : 'bg-white/5 border border-white/10 text-white/85'
                        }`}
                      >
                        <p className="text-[11px] font-medium mb-1.5 text-gold/80">
                          {msg.role === 'user' ? account.name : 'Moonshine Concierge'}
                        </p>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}

                {chatSending && (
                  <div className="flex items-center gap-2.5 text-xs text-white/60">
                    <Loader2 size={14} className="animate-spin text-gold" />
                    Drafting response...
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="p-4 border-t border-white/10 bg-black/30 flex items-center gap-3"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for a sales script, client brief, or deal strategy..."
                  disabled={chatSending}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  className="px-5 py-3 rounded-xl gold-gradient text-elite-black text-xs font-semibold flex items-center gap-2 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Send size={14} />
                  Send ({creditCosts.chat} cr)
                </button>
              </form>
            </section>
          )}

          {/* TAB 2: IMAGE STUDIO */}
          {activeTab === 'image' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <form
                onSubmit={handleGenerateImage}
                className="lg:col-span-5 glass rounded-3xl p-8 border border-white/10 space-y-6"
              >
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-display text-white">Brand Image Studio</h2>
                  <p className="text-xs text-white/55">
                    Create bespoke editorial photography and marketing visuals for listings, social launches, or investor decks ({creditCosts.image} credits per image).
                  </p>
                </div>

                <label className="space-y-2 block">
                  <span className="text-xs text-white/65">Visual Brief</span>
                  <textarea
                    rows={4}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Twilight architectural photograph of a modern glass hillside estate overlooking the Pacific coast, warm interior gold lighting, editorial real estate magazine style..."
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold resize-none"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-xs text-white/65 block">Aspect Ratio</span>
                  <div className="flex flex-wrap gap-2">
                    {(['16:9', '1:1', '4:3', '3:4', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium tabular-nums border transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-white text-elite-black border-white font-semibold'
                            : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={imageGenerating || !imagePrompt.trim()}
                  className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-45"
                >
                  {imageGenerating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Generating Image...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={15} />
                      Generate Visual ({creditCosts.image} credits)
                    </>
                  )}
                </button>
              </form>

              <section className="lg:col-span-7 glass rounded-3xl p-8 border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-display text-white">Generated Assets</h3>
                  <span className="text-xs text-white/45 tabular-nums">
                    {generatedImages.length} created this session
                  </span>
                </div>

                {generatedImages.length === 0 ? (
                  <div className="py-16 text-center space-y-2 border border-dashed border-white/10 rounded-2xl px-6">
                    <p className="text-sm text-white/65">No images generated yet.</p>
                    <p className="text-xs text-white/40">
                      Describe a listing backdrop, social launch card, or event invitation on the left to generate a downloadable PNG.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {generatedImages.map((img) => (
                      <div
                        key={img.id}
                        className="rounded-2xl overflow-hidden border border-white/10 bg-black/40"
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.prompt}
                          className="w-full max-h-[420px] object-contain bg-black"
                        />
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10">
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs text-white/80 line-clamp-2">{img.prompt}</p>
                            <p className="text-[11px] text-white/45 tabular-nums">
                              Ratio {img.aspectRatio}
                            </p>
                          </div>
                          <a
                            href={img.imageUrl}
                            download={`moonshine-studio-${img.id}.png`}
                            className="px-4 py-2 rounded-full border border-gold/40 text-gold hover:bg-gold hover:text-elite-black text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                          >
                            <Download size={13} />
                            Download PNG
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: FILE CREATOR */}
          {activeTab === 'file' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <form
                onSubmit={handleGenerateFile}
                className="lg:col-span-5 glass rounded-3xl p-8 border border-white/10 space-y-6"
              >
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-display text-white">Downloadable File Creator</h2>
                  <p className="text-xs text-white/55">
                    Generate client-ready pitch briefs, CRM prospect CSVs, outreach templates, or single-page HTML flyers ready to export ({creditCosts.file} credits per file).
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-white/65 block">Output Format</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'md', label: 'Markdown Brief (.md)' },
                        { id: 'csv', label: 'CRM / Tracker (.csv)' },
                        { id: 'txt', label: 'Outreach Scripts (.txt)' },
                        { id: 'html', label: 'One-Page Flyer (.html)' },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setFileFormat(fmt.id)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-medium border text-left transition-colors ${
                          fileFormat === fmt.id
                            ? 'bg-white text-elite-black border-white font-semibold'
                            : 'bg-white/5 text-white/70 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="space-y-2 block">
                  <span className="text-xs text-white/65">File Specification</span>
                  <textarea
                    rows={4}
                    value={filePrompt}
                    onChange={(e) => setFilePrompt(e.target.value)}
                    placeholder="Create a Week 3 outreach tracker CSV with 10 luxury real estate prospect columns including stage, estimated deal size, and next follow-up date..."
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold resize-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={fileGenerating || !filePrompt.trim()}
                  className="w-full py-3.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-45"
                >
                  {fileGenerating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Building File...
                    </>
                  ) : (
                    <>
                      <FileDown size={15} />
                      Create .{fileFormat} File ({creditCosts.file} credits)
                    </>
                  )}
                </button>
              </form>

              <section className="lg:col-span-7 glass rounded-3xl p-8 border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-display text-white">Generated Files</h3>
                  <span className="text-xs text-white/45 tabular-nums">
                    {generatedFiles.length} ready to export
                  </span>
                </div>

                {generatedFiles.length === 0 ? (
                  <div className="py-16 text-center space-y-2 border border-dashed border-white/10 rounded-2xl px-6">
                    <p className="text-sm text-white/65">No files created yet.</p>
                    <p className="text-xs text-white/40">
                      Choose a format and describe the deliverable on the left to produce a clean, downloadable file.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {generatedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden"
                      >
                        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{file.title}</p>
                            <p className="text-xs font-mono text-gold/80 truncate">
                              {file.filename}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyFileContent(file)}
                              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 flex items-center gap-1.5"
                            >
                              {copiedFileId === file.id ? (
                                <>
                                  <Check size={12} className="text-green" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  Copy
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadFile(file)}
                              className="px-3.5 py-1.5 rounded-full bg-gold/15 hover:bg-gold hover:text-elite-black text-gold border border-gold/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Download size={12} />
                              Download
                            </button>
                          </div>
                        </div>
                        {file.summary && (
                          <p className="px-4 pt-3 text-xs text-white/55">{file.summary}</p>
                        )}
                        <pre className="p-4 text-xs font-mono text-white/75 max-h-60 overflow-auto whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: PLANS, PACKAGING & CREDITS */}
          {activeTab === 'pricing' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {plans.map((plan) => {
                  const isCurrent = account.plan.id === plan.id;
                  const isRecommended = plan.id === 'producer';
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-3xl p-8 border flex flex-col justify-between space-y-6 ${
                        isCurrent
                          ? 'bg-green/10 border-green/40'
                          : isRecommended
                          ? 'glass border-gold/40'
                          : 'glass border-white/10'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gold font-medium">{plan.audience}</p>
                          <h3 className="text-2xl font-display text-white">{plan.name}</h3>
                        </div>

                        <div className="pb-4 border-b border-white/10">
                          <p className="text-3xl font-display text-white tabular-nums">
                            {plan.priceMonthly === 0 ? '$0' : `$${plan.priceMonthly}`}
                            <span className="text-sm text-white/50 font-sans"> / month</span>
                          </p>
                          <p className="text-xs text-white/50 mt-1">{plan.billingCadence}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                          <div>
                            <p className="text-white/45">Monthly Credits</p>
                            <p className="text-base font-semibold text-white">
                              {plan.monthlyCredits.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/45">Daily Safety Cap</p>
                            <p className="text-base font-semibold text-white">
                              {plan.dailyLimit} / day
                            </p>
                          </div>
                        </div>

                        <ul className="space-y-2 pt-2 text-xs text-white/70">
                          {plan.features.map((feat) => (
                            <li key={feat} className="flex items-start gap-2">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-gold shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrent || updatingPlanId !== null}
                        onClick={() => handlePlanUpdate({ planId: plan.id }, `${plan.name} tier`)}
                        className={`w-full py-3 rounded-full text-xs font-semibold tracking-wide transition-colors ${
                          isCurrent
                            ? 'bg-green/20 text-green border border-green/40 cursor-default'
                            : isRecommended
                            ? 'gold-gradient text-elite-black hover:opacity-95'
                            : 'border border-white/20 text-white hover:border-gold hover:text-gold'
                        }`}
                      >
                        {isCurrent
                          ? 'Current Active Tier'
                          : updatingPlanId === plan.id
                          ? 'Updating...'
                          : `Select ${plan.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Credit Top-Ups & Recent Usage Ledger */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <section className="lg:col-span-5 glass rounded-3xl p-8 border border-white/10 space-y-5">
                  <div>
                    <h3 className="text-xl font-display text-white">One-Time Credit Top-Ups</h3>
                    <p className="text-xs text-white/55 mt-1">
                      Stripe Checkout–ready add-on packs for high-volume launch weeks.
                    </p>
                  </div>
                  <div className="divide-y divide-white/10">
                    {topupPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{pack.name}</p>
                          <p className="text-xs text-white/50 tabular-nums">
                            +${pack.priceUsd} one-time · ${(pack.priceUsd / pack.credits).toFixed(2)}/credit
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={updatingPlanId !== null}
                          onClick={() =>
                            handlePlanUpdate({ topupId: pack.id }, `+${pack.credits} top-up credits`)
                          }
                          className="px-4 py-2 rounded-full border border-gold/40 text-gold hover:bg-gold hover:text-elite-black text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                        >
                          Add +{pack.credits}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="lg:col-span-7 glass rounded-3xl p-8 border border-white/10 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-display text-white">Server Usage Ledger</h3>
                      <p className="text-xs text-white/55 mt-1">
                        Audited credit deductions recorded in SQLite for {account.email}.
                      </p>
                    </div>
                    <span className="text-xs text-white/45 tabular-nums">
                      Last {account.recentUsage.length} actions
                    </span>
                  </div>

                  {account.recentUsage.length === 0 ? (
                    <p className="text-xs text-white/45 py-8 text-center">
                      No studio usage recorded for this account yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-white/45 border-b border-white/10">
                          <tr>
                            <th className="pb-2.5 font-medium">Type</th>
                            <th className="pb-2.5 font-medium">Request Summary</th>
                            <th className="pb-2.5 font-medium text-right">Credits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {account.recentUsage.map((row) => (
                            <tr key={row.id}>
                              <td className="py-3 pr-3 capitalize text-gold font-medium whitespace-nowrap">
                                {row.action_type}
                              </td>
                              <td className="py-3 pr-3 text-white/75 max-w-xs truncate">
                                {row.prompt_summary}
                              </td>
                              <td className="py-3 text-right font-semibold text-white tabular-nums whitespace-nowrap">
                                -{row.credits_used}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
