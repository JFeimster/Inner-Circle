import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onOpenLogin: () => void;
}

const HERO_IMAGE = '/src/assets/images/hero_moonshine_penthouse_1795589530565.jpg';
const BOARDROOM_IMAGE = '/src/assets/images/editorial_advisory_boardroom_1795589530751.jpg';
const PARTNER_SARAH_AVATAR = '/src/assets/images/avatar_partner_sarah_1795589533494.jpg';

const ROADMAP_PREVIEW = [
  {
    week: 'Week 01',
    title: 'Foundation & Brand Alignment',
    summary: 'Complete your executive profile, configure HubSpot CRM pipelines, and deploy your Moonshine Capital identity assets.',
    deliverables: [
      'Executive bio & studio portrait publishing',
      'Google Workspace, Drive & HubSpot connection',
      'Compliance agreements & payout readiness check',
    ],
  },
  {
    week: 'Week 02',
    title: 'Product & Market Mastery',
    summary: 'Study active off-market inventory, join two live property walkthroughs, and assemble a local market briefing.',
    deliverables: [
      'Top 5 luxury active listing dossier review',
      'Two senior-partner property walkthroughs',
      'Local high-net-worth valuation briefing',
    ],
  },
  {
    week: 'Week 03',
    title: 'Outreach & Pipeline Momentum',
    summary: 'Rehearse discovery scripts with your assigned partner and launch your first 20 targeted client conversations.',
    deliverables: [
      '1:1 objection & script rehearsal with mentor',
      '20+ qualified prospect list in HubSpot',
      'First 5 private discovery calls booked',
    ],
  },
  {
    week: 'Week 04',
    title: 'Conversion & First Closing',
    summary: 'Execute structured follow-up sequences, coordinate your first private viewing, and review deal terms with partners.',
    deliverables: [
      'Automated follow-up cadence execution',
      'First qualified private property viewing',
      'Escrow & closing review with senior partner',
    ],
  },
];

const PROOF_METRICS = [
  { value: '$1.4B+', label: 'Closed network advisory volume' },
  { value: '30 Days', label: 'Structured onboarding to first deal' },
  { value: '14 Days', label: 'Median time to first qualified lead' },
  { value: '1 : 1', label: 'Senior partner mentorship ratio' },
];

export default function LandingPage({ onOpenLogin }: LandingPageProps) {
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [heroImgError, setHeroImgError] = useState(false);
  const [boardroomImgError, setBoardroomImgError] = useState(false);
  const [sarahImgError, setSarahImgError] = useState(false);

  // Invitation form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [market, setMarket] = useState('');
  const [volumeTier, setVolumeTier] = useState('$10M – $25M');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    referenceCode: string;
    fullName: string;
    email: string;
  } | null>(null);

  const activeWeek = ROADMAP_PREVIEW[selectedWeekIdx];

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid work email address.');
      return;
    }
    if (!market.trim()) {
      setFormError('Please enter your primary market.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          market: market.trim(),
          volumeTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Unable to submit invitation request.');
        return;
      }
      setConfirmation({
        referenceCode: data.referenceCode,
        fullName: data.fullName,
        email: data.email,
      });
      setFullName('');
      setEmail('');
      setMarket('');
    } catch {
      setFormError('Connection error while submitting your request. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-elite-black text-white font-sans selection:bg-gold selection:text-elite-black">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="fixed top-0 inset-x-0 z-50 bg-elite-black/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single clean wordmark */}
          <a
            href="#top"
            className="font-display text-xl tracking-wider text-gold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
          >
            Moonshine Capital
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/65">
            <a
              href="#capabilities"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Network
            </a>
            <a
              href="#roadmap-preview"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              30-Day Path
            </a>
            <a
              href="#proof"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Results
            </a>
            <a
              href="#apply"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Apply
            </a>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-5 py-2.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Member Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="pt-28 pb-20">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lg:col-span-8 space-y-5"
            >
              <p className="text-xs font-medium text-gold tracking-wide">
                Private Real Estate &amp; Capital Advisory Network · By Invitation
              </p>
              <h1
                className="font-display font-light text-white leading-[1.08] tracking-tight text-balance"
                style={{ fontSize: 'clamp(2.5rem, 4.6vw, 4.25rem)' }}
              >
                Where independent dealmakers close{' '}
                <span className="text-gold italic">institutional</span> transactions.
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="lg:col-span-4 space-y-6"
            >
              <p className="text-[15px] text-white/65 leading-relaxed">
                Moonshine Capital equips incoming advisors with a 30-day execution track, direct senior-partner pairing, and turnkey marketing and AI production tools from Day 1.
              </p>
              <div className="flex flex-wrap items-center gap-5">
                <a
                  href="#apply"
                  className="px-6 py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  Request Invitation
                  <ArrowRight size={14} />
                </a>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="text-xs font-medium text-white/75 hover:text-gold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                >
                  Member Sign In
                  <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Dominant 16:9 Focal Visual Carrier */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border border-white/10 bg-[#121214]"
          >
            {!heroImgError ? (
              <img
                src={HERO_IMAGE}
                alt="Twilight view of a luxury architectural hillside penthouse overlooking city lights"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#191612] via-[#0e0e10] to-[#1a1026] flex items-center justify-center">
                <span className="font-display text-2xl text-gold/70">Moonshine Capital</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-elite-black/85 via-elite-black/25 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gold font-medium">
                  West Coast &amp; Gateway Luxury Markets
                </p>
                <p className="text-lg md:text-2xl font-display text-white">
                  Direct off-market inventory, private placement decks, and partner-led closing desks.
                </p>
              </div>
              <p className="text-xs text-white/60 whitespace-nowrap shrink-0">
                Q4 2026 Cohort · Limited Seats
              </p>
            </div>
          </motion.div>

          {/* 4-Column Hairline-Divided Quantitative Proof Strip */}
          <div className="border-y border-white/10 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-white/10">
            {PROOF_METRICS.map((metric) => (
              <div key={metric.label} className="py-7 px-5 first:pl-0 last:pr-0 space-y-1.5">
                <p className="text-2xl md:text-3xl font-display text-white tabular-nums">
                  {metric.value}
                </p>
                <p className="text-xs text-white/55">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: ASYMMETRIC BENTO CAPABILITIES + INTERACTIVE 30-DAY PREVIEW */}
        <section id="capabilities" className="max-w-7xl mx-auto px-6 pt-24 space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium text-gold">How the Network Operates</p>
            <h2 className="text-3xl md:text-4xl font-display font-light text-white text-balance">
              Every system required to move from onboarding to your first commission.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* 01. Interactive 30-Day Path Card (Wide Asymmetric Focal Block) */}
            <div
              id="roadmap-preview"
              className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-2xl font-display text-white">
                    01. Structured 30-Day Execution Path
                  </h3>
                  <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
                    {ROADMAP_PREVIEW.map((item, idx) => (
                      <button
                        key={item.week}
                        type="button"
                        onClick={() => setSelectedWeekIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                          selectedWeekIdx === idx
                            ? 'bg-white text-elite-black font-semibold'
                            : 'text-white/65 hover:text-white'
                        }`}
                      >
                        W{idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-gold font-medium">
                    <span>{activeWeek.week}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeWeek.title}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed max-w-xl">
                    {activeWeek.summary}
                  </p>
                  <ul className="pt-2 divide-y divide-white/10 text-sm text-white/80">
                    {activeWeek.deliverables.map((deliverable) => (
                      <li key={deliverable} className="py-3.5 flex items-center gap-3">
                        <CheckCircle2 size={15} className="text-green shrink-0" />
                        <span>{deliverable}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-white/50">
                <span>Live milestone tracking inside Member Portal</span>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="text-gold font-medium hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                >
                  Sign in to view full checklist <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* 02. Senior Partner Mentorship Card with Editorial Photography */}
            <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col justify-between">
              <div className="relative aspect-[4/3] w-full bg-[#121214] overflow-hidden">
                {!boardroomImgError ? (
                  <img
                    src={BOARDROOM_IMAGE}
                    alt="Private capital advisory lounge with dark smoked oak table and brass lamps"
                    referrerPolicy="no-referrer"
                    onError={() => setBoardroomImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1b1713] to-[#0a0a0a]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-elite-black/80 via-transparent to-transparent" />
              </div>
              <div className="p-8 space-y-3">
                <h3 className="text-2xl font-display text-white">
                  02. Direct Senior Partner Pairing
                </h3>
                <p className="text-sm text-white/65 leading-relaxed">
                  Every incoming advisor is paired directly with a 15-year senior partner for live script practice, property walkthroughs, and real-time negotiation counsel on $5M+ transactions.
                </p>
              </div>
            </div>

            {/* 03. Marketing Vault & AI Studio */}
            <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 space-y-4">
              <h3 className="text-2xl font-display text-white">
                03. Marketing Vault &amp; AI Studio
              </h3>
              <p className="text-sm text-white/65 leading-relaxed">
                Deploy approved Brand Identity Kits, luxury presentation decks, bespoke marketing imagery, and downloadable client files without waiting on an agency turnaround.
              </p>
              <div className="pt-3 border-t border-white/10 text-xs text-white/55 flex flex-wrap items-center gap-2">
                <span>Brand Identity Kit</span>
                <span aria-hidden="true">·</span>
                <span>Luxury Pitch Decks</span>
                <span aria-hidden="true">·</span>
                <span>Image &amp; File Studio</span>
              </div>
            </div>

            {/* 04. Connected Brokerage Stack */}
            <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.03] p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <h3 className="text-2xl font-display text-white">
                  04. Connected Brokerage Infrastructure
                </h3>
                <p className="text-sm text-white/65 leading-relaxed max-w-2xl">
                  Built to integrate with the tools top producers already run—syncing calendar walkthroughs, CRM lead stages, community introductions, and commission payouts into one workspace.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gold/90 font-medium">
                <span>Google Workspace</span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span>HubSpot CRM</span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span>Slack &amp; Discord</span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span>Canva &amp; LinkedIn</span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span>Stripe Connect</span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span>Notion &amp; Vimeo</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: ATTRIBUTABLE PROOF OF IMPACT */}
        <section id="proof" className="max-w-7xl mx-auto px-6 pt-24 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <p className="text-xs font-medium text-gold">Member Case Outcome</p>
                <blockquote className="text-2xl md:text-3xl font-display font-light text-white leading-snug">
                  &ldquo;Before joining Moonshine Capital, onboarding at a new brokerage meant six weeks of guesswork. Here, my brand kit and CRM were live by Day 3 and I closed a $2.4M off-market deal in Week 2.&rdquo;
                </blockquote>
              </div>

              <div className="pt-6 border-t border-white/10 flex items-center gap-4">
                {!sarahImgError ? (
                  <img
                    src={PARTNER_SARAH_AVATAR}
                    alt="Sarah Jenkins, Senior Luxury Advisor"
                    referrerPolicy="no-referrer"
                    onError={() => setSarahImgError(true)}
                    className="w-12 h-12 rounded-full object-cover border border-gold/40 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-elite-black font-display font-bold text-sm shrink-0">
                    SJ
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-white">Sarah Jenkins</p>
                  <p className="text-xs text-white/55">
                    Senior Luxury Advisor · Moonshine Capital West Coast
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col justify-between divide-y divide-white/10">
              <div className="pb-6 space-y-1">
                <p className="text-3xl font-display text-gold tabular-nums">$2.4M</p>
                <p className="text-sm text-white">First off-market closing within 14 days</p>
                <p className="text-xs text-white/50">
                  Executed using Week 2 inventory dossiers and senior partner review.
                </p>
              </div>
              <div className="py-6 space-y-1">
                <p className="text-3xl font-display text-white tabular-nums">10 Closings</p>
                <p className="text-sm text-white">Completed in a single quarter</p>
                <p className="text-xs text-white/50">
                  Elena Rodriguez · Platinum Status within 90 days of onboarding.
                </p>
              </div>
              <div className="pt-6 space-y-1">
                <p className="text-3xl font-display text-green tabular-nums">-42%</p>
                <p className="text-sm text-white">Shorter discovery-to-escrow cycle</p>
                <p className="text-xs text-white/50">
                  Driven by pre-built pitch decks and standardized follow-up cadences.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: INTERACTIVE INVITATION REQUEST FORM */}
        <section id="apply" className="max-w-7xl mx-auto px-6 pt-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-medium text-gold">Membership Intake</p>
              <h2 className="text-3xl md:text-4xl font-display font-light text-white text-balance">
                Request an invitation to the upcoming cohort.
              </h2>
              <p className="text-sm text-white/60 leading-relaxed">
                Admissions are reviewed directly by regional managing partners. Approved advisors receive an onboarding invitation code and OAuth workspace credentials within 48 hours.
              </p>
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-white/50 mb-2">Already hold a member account or invite code?</p>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="text-xs font-semibold text-gold hover:underline inline-flex items-center gap-1.5"
                >
                  Proceed to Member Sign In <ArrowRight size={13} />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              {confirmation ? (
                <div className="rounded-2xl border border-green/40 bg-green/10 p-8 space-y-4">
                  <div className="flex items-center gap-2.5 text-green text-sm font-medium">
                    <CheckCircle2 size={18} />
                    <span>Invitation Request Received</span>
                  </div>
                  <h3 className="text-2xl font-display text-white">
                    Thank you, {confirmation.fullName}.
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed">
                    Your inquiry for <span className="text-white">{confirmation.email}</span> has been recorded under reference{' '}
                    <span className="font-mono text-gold">{confirmation.referenceCode}</span>. A managing partner will review your market profile shortly.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="px-5 py-2.5 rounded-full gold-gradient text-elite-black text-xs font-semibold"
                    >
                      Go to Member Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmation(null)}
                      className="text-xs text-white/60 hover:text-white transition-colors"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplySubmit} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 block">
                      <span className="text-xs text-white/65">Full Name</span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jordan Vance"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                      />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-xs text-white/65">Work Email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jordan@advisorygroup.com"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 block">
                      <span className="text-xs text-white/65">Primary Market</span>
                      <input
                        type="text"
                        value={market}
                        onChange={(e) => setMarket(e.target.value)}
                        placeholder="Los Angeles · Miami · New York"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
                      />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="text-xs text-white/65">Annual Deal Volume</span>
                      <select
                        value={volumeTier}
                        onChange={(e) => setVolumeTier(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-sm text-white focus:outline-none focus:border-gold"
                      >
                        <option value="Under $10M">Under $10M</option>
                        <option value="$10M – $25M">$10M – $25M</option>
                        <option value="$25M – $75M">$25M – $75M</option>
                        <option value="$75M+">$75M+</option>
                      </select>
                    </label>
                  </div>

                  {formError && (
                    <p className="text-xs text-red-300">{formError}</p>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-xs text-white/45">
                      Confidential partner review · Response within 48 hours
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-7 py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity inline-flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Application
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-white/45">
          <div className="flex items-center gap-4">
            <span className="font-display text-sm text-gold">Moonshine Capital</span>
            <span aria-hidden="true">·</span>
            <span>© 2026 Moonshine Capital. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#capabilities" className="hover:text-white transition-colors">Network</a>
            <a href="#proof" className="hover:text-white transition-colors">Results</a>
            <a href="#apply" className="hover:text-white transition-colors">Apply</a>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-gold hover:underline font-medium"
            >
              Member Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
