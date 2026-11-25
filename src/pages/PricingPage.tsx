import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export type PricingPlanId = 'onboarding' | 'producer' | 'inner_circle';

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  audience: string;
  priceMonthly: number;
  billingCadence: string;
  monthlyCredits: number;
  dailyLimit: number;
  features: string[];
}

export interface PricingTopupPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
}

export interface PricingCatalogResponse {
  plans: PricingPlan[];
  topupPacks: PricingTopupPack[];
  creditCosts: {
    chat: number;
    file: number;
    image: number;
  };
  billing: {
    mode: string;
    livePaymentsEnabled: boolean;
    selfUpgradeAllowed: boolean;
  };
}

const FALLBACK_CATALOG: PricingCatalogResponse = {
  plans: [
    {
      id: 'onboarding',
      name: 'Onboarding Access',
      audience: 'For new agents in their first 30 days',
      priceMonthly: 0,
      billingCadence: 'Included with network membership',
      monthlyCredits: 30,
      dailyLimit: 10,
      features: [
        '30 AI credits per month (10/day cap)',
        'Concierge chat for scripts & market prep (1 credit)',
        'Downloadable client files & templates (2 credits)',
        'Brand image generation previews (5 credits)',
      ],
    },
    {
      id: 'producer',
      name: 'Pro Producer',
      audience: 'For active dealmakers & weekly outreach',
      priceMonthly: 49,
      billingCadence: '$49 / month per agent seat',
      monthlyCredits: 250,
      dailyLimit: 50,
      features: [
        '250 AI credits per month (50/day cap)',
        'Up to 50 custom marketing images or 125 client files',
        'Full Marketing Vault & outreach sequence drafting',
        'Eligible for one-time credit top-up packs',
      ],
    },
    {
      id: 'inner_circle',
      name: 'Inner Circle Studio',
      audience: 'For top producers, partners & luxury teams',
      priceMonthly: 149,
      billingCadence: '$149 / month (or waived at Platinum tier)',
      monthlyCredits: 1000,
      dailyLimit: 150,
      features: [
        '1,000 AI credits per month (150/day cap)',
        'High-volume listing visuals, pitch briefs & CSV trackers',
        'Priority queue & dedicated brokerage cost reporting',
        'Unused top-up credits roll over month to month',
      ],
    },
  ],
  topupPacks: [
    { id: 'pack_100', name: '100 Credit Top-Up', credits: 100, priceUsd: 19 },
    { id: 'pack_300', name: '300 Credit Top-Up', credits: 300, priceUsd: 49 },
  ],
  creditCosts: {
    chat: 1,
    file: 2,
    image: 5,
  },
  billing: {
    mode: 'verified_webhook_required',
    livePaymentsEnabled: false,
    selfUpgradeAllowed: false,
  },
};

const SAFEGUARD_FAQS = [
  {
    question: 'What happens if an AI generation fails or times out?',
    answer:
      'Every request reserves credits atomically before calling the model. If an upstream error or timeout occurs, your reserved credits are automatically refunded to your monthly and daily balance.',
  },
  {
    question: 'Why are there daily safety caps in addition to monthly credits?',
    answer:
      'Daily caps (10, 50, or 150 credits per UTC day) protect your monthly allowance from accidental bursts or runaway sessions and reset automatically at 00:00 UTC.',
  },
  {
    question: 'How does the Platinum tier fee waiver work?',
    answer:
      'Producers who close their first qualified deal or reach Platinum status qualify to have the $149/month Inner Circle Studio subscription fee waived by managing partner approval.',
  },
  {
    question: 'How are plan upgrades and credit top-ups activated?',
    answer:
      'To protect account integrity, tier changes and bonus credit packs are never self-applied from the browser. Upgrades are fulfilled exclusively through verified billing checkout or administrator approval.',
  },
];

export interface PricingPageProps {
  onBackToLanding: () => void;
  onRequestInvite: () => void;
  onOpenLogin: () => void;
  onOpenStudio?: () => void;
  isAuthenticated?: boolean;
  currentPlanId?: PricingPlanId | null;
  embedded?: boolean;
}

export default function PricingPage({
  onBackToLanding,
  onRequestInvite,
  onOpenLogin,
  onOpenStudio,
  isAuthenticated = false,
  currentPlanId = null,
  embedded = false,
}: PricingPageProps) {
  const [catalog, setCatalog] = useState<PricingCatalogResponse>(FALLBACK_CATALOG);
  const [catalogSource, setCatalogSource] = useState<'live' | 'fallback'>('fallback');
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  // Interactive monthly workload estimator
  const [monthlyChats, setMonthlyChats] = useState(40);
  const [monthlyFiles, setMonthlyFiles] = useState(20);
  const [monthlyImages, setMonthlyImages] = useState(18);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const res = await fetch('/api/pricing');
        if (!res.ok || !active) return;
        const data = (await res.json().catch(() => null)) as PricingCatalogResponse | null;
        if (data && Array.isArray(data.plans) && data.plans.length > 0 && active) {
          setCatalog(data);
          setCatalogSource('live');
        }
      } catch {
        // Retain typed fallback catalog gracefully
      }
    };
    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const estimatedMonthlyCredits = useMemo(() => {
    return (
      monthlyChats * catalog.creditCosts.chat +
      monthlyFiles * catalog.creditCosts.file +
      monthlyImages * catalog.creditCosts.image
    );
  }, [monthlyChats, monthlyFiles, monthlyImages, catalog.creditCosts]);

  const recommendedPlan = useMemo(() => {
    const sorted = [...catalog.plans].sort((a, b) => a.monthlyCredits - b.monthlyCredits);
    return (
      sorted.find((p) => p.monthlyCredits >= estimatedMonthlyCredits) ??
      sorted[sorted.length - 1]
    );
  }, [catalog.plans, estimatedMonthlyCredits]);

  const handlePlanAction = (plan: PricingPlan) => {
    setBillingNotice(null);

    if (isAuthenticated) {
      if (currentPlanId === plan.id) {
        onOpenStudio?.();
        return;
      }
      setBillingNotice(
        `${plan.name} upgrades are applied via verified billing or partner administrator approval. Open AI Studio to review your active usage ledger or contact your managing partner.`
      );
      return;
    }

    if (plan.id === 'onboarding') {
      onRequestInvite();
      return;
    }

    onOpenLogin();
  };

  const handleTopupAction = (pack: PricingTopupPack) => {
    if (!isAuthenticated) {
      onOpenLogin();
      return;
    }
    setBillingNotice(
      `${pack.name} ($${pack.priceUsd}) is fulfilled through verified billing checkout or administrator approval once live payments are activated.`
    );
  };

  const content = (
    <main id="pricing-top" className={embedded ? 'space-y-20' : 'pt-28 pb-20 space-y-24'}>
      {/* HERO SECTION */}
      <section className={embedded ? 'space-y-10' : 'max-w-7xl mx-auto px-6 space-y-12'}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:col-span-8 space-y-4"
          >
            <p className="text-xs font-medium text-gold tracking-wide">
              Moonshine AI Studio · Transparent Credit Packaging
            </p>
            <h1
              className="font-display font-light text-white leading-[1.08] tracking-tight text-balance"
              style={{ fontSize: 'clamp(2.35rem, 4.4vw, 4rem)' }}
            >
              Predictable studio tiers built for{' '}
              <span className="text-gold italic">active dealmakers</span>.
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.06 }}
            className="lg:col-span-4 space-y-5"
          >
            <p className="text-[15px] text-white/65 leading-relaxed">
              Every seat includes server-enforced monthly credits, daily safety caps, and automatic refunds on failed generations—never confusing raw token billing.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={onOpenStudio ?? onBackToLanding}
                  className="px-6 py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  Open AI Studio
                  <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRequestInvite}
                    className="px-6 py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    Request Invitation
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="text-xs font-medium text-white/75 hover:text-gold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                  >
                    Member Sign In
                    <ArrowRight size={13} />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Hairline Credit Cost Strip */}
        <div
          id="credit-matrix"
          className="border-y border-white/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10"
        >
          <div className="py-7 md:pr-6 space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-white">Concierge Chat</p>
              <p className="text-xl font-display text-gold tabular-nums">
                {catalog.creditCosts.chat} credit
              </p>
            </div>
            <p className="text-xs text-white/55 leading-relaxed">
              Cold outreach scripts, objection responses, discovery call prep, and Week 1–4 coaching.
            </p>
          </div>
          <div className="py-7 md:px-6 space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-white">Downloadable File</p>
              <p className="text-xl font-display text-gold tabular-nums">
                {catalog.creditCosts.file} credits
              </p>
            </div>
            <p className="text-xs text-white/55 leading-relaxed">
              Client-ready pitch briefs (`.md`), CRM trackers (`.csv`), scripts (`.txt`), and flyers (`.html`).
            </p>
          </div>
          <div className="py-7 md:pl-6 space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-white">Brand Image Studio</p>
              <p className="text-xl font-display text-gold tabular-nums">
                {catalog.creditCosts.image} credits
              </p>
            </div>
            <p className="text-xs text-white/55 leading-relaxed">
              Bespoke editorial photography, social launch cards, and presentation visuals in PNG.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: 3-TIER PLAN COMPARISON */}
      <section id="plans" className={embedded ? 'space-y-8' : 'max-w-7xl mx-auto px-6 space-y-10'}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-medium text-gold">Membership Tiers</p>
            <h2 className="text-3xl md:text-4xl font-display font-light text-white text-balance">
              Start free during onboarding, scale as deal volume grows.
            </h2>
          </div>
          <p className="text-xs text-white/50 max-w-sm leading-relaxed">
            Platinum producers qualify for a complimentary Inner Circle Studio seat upon verified first closing.
          </p>
        </div>

        {billingNotice && (
          <div className="rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4 text-xs text-white/85 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-gold mt-0.5 shrink-0" />
              <span className="leading-relaxed">{billingNotice}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {onOpenStudio && (
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="text-gold font-semibold hover:underline whitespace-nowrap"
                >
                  Open AI Studio
                </button>
              )}
              <button
                type="button"
                onClick={() => setBillingNotice(null)}
                className="text-white/55 hover:text-white whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {catalog.plans.map((plan) => {
            const isRecommended = plan.id === 'producer';
            const isCurrent = Boolean(isAuthenticated && currentPlanId === plan.id);
            const isEstimatorMatch = recommendedPlan.id === plan.id;

            let ctaLabel = 'Member Sign In';
            if (isCurrent) {
              ctaLabel = 'Open Active Studio';
            } else if (isAuthenticated) {
              ctaLabel = 'Request Tier Change';
            } else if (plan.id === 'onboarding') {
              ctaLabel = 'Request Invitation';
            }

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-8 md:p-9 border flex flex-col justify-between space-y-8 transition-colors ${
                  isCurrent
                    ? 'bg-green/10 border-green/40'
                    : isRecommended
                    ? 'bg-white/[0.04] border-gold/45'
                    : 'bg-white/[0.025] border-white/10'
                }`}
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className={isCurrent ? 'text-green font-medium' : 'text-gold font-medium'}>
                        {isCurrent
                          ? 'Current Active Tier'
                          : isRecommended
                          ? 'Recommended · Core Paid Seat'
                          : plan.id === 'inner_circle'
                          ? 'Performance-Unlocked Option'
                          : 'Included with Membership'}
                      </span>
                      {isEstimatorMatch && !isCurrent && (
                        <span className="text-white/55 tabular-nums">Fits estimate</span>
                      )}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-display text-white">{plan.name}</h3>
                    <p className="text-xs text-white/55 leading-relaxed">{plan.audience}</p>
                  </div>

                  <div className="pb-6 border-b border-white/10 space-y-1">
                    <p className="text-4xl font-display text-white tabular-nums">
                      {plan.priceMonthly === 0 ? '$0' : `$${plan.priceMonthly}`}
                      <span className="text-sm text-white/50 font-sans"> / month</span>
                    </p>
                    <p className="text-xs text-white/50">{plan.billingCadence}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-6 border-b border-white/10 text-xs tabular-nums">
                    <div className="space-y-1">
                      <p className="text-white/45">Monthly Allowance</p>
                      <p className="text-lg font-semibold text-white">
                        {plan.monthlyCredits.toLocaleString()} credits
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white/45">Daily Safety Cap</p>
                      <p className="text-lg font-semibold text-white">
                        {plan.dailyLimit} / day
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-3 text-sm text-white/75">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 leading-relaxed">
                        <Check size={15} className="text-gold mt-1 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanAction(plan)}
                  className={`w-full py-3.5 px-5 rounded-full text-xs font-semibold tracking-wide transition-opacity inline-flex items-center justify-center gap-2 whitespace-nowrap ${
                    isRecommended && !isCurrent
                      ? 'gold-gradient text-elite-black hover:opacity-95'
                      : isCurrent
                      ? 'bg-green/20 text-white border border-green/40 hover:bg-green/30'
                      : 'border border-white/20 text-white hover:border-gold hover:text-gold'
                  }`}
                >
                  <span>{ctaLabel}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: INTERACTIVE WORKLOAD ESTIMATOR + ONE-TIME TOP-UP PACKS */}
      <section id="topups" className={embedded ? 'space-y-8' : 'max-w-7xl mx-auto px-6 space-y-10'}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Interactive Monthly Credit Estimator */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col justify-between space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gold">Monthly Capacity Estimator</p>
              <h2 className="text-2xl md:text-3xl font-display font-light text-white text-balance">
                Model your monthly studio output before choosing a tier.
              </h2>
            </div>

            <div className="space-y-6">
              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/75">Concierge Chat turns / month</span>
                  <span className="font-mono text-white tabular-nums">
                    {monthlyChats} turns · {monthlyChats * catalog.creditCosts.chat} cr
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={250}
                  step={5}
                  value={monthlyChats}
                  onChange={(e) => setMonthlyChats(Number(e.target.value))}
                  className="w-full accent-[#D4AF37] cursor-pointer"
                />
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/75">Downloadable briefs &amp; CSVs / month</span>
                  <span className="font-mono text-white tabular-nums">
                    {monthlyFiles} files · {monthlyFiles * catalog.creditCosts.file} cr
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={monthlyFiles}
                  onChange={(e) => setMonthlyFiles(Number(e.target.value))}
                  className="w-full accent-[#D4AF37] cursor-pointer"
                />
              </label>

              <label className="block space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/75">Brand marketing visuals / month</span>
                  <span className="font-mono text-white tabular-nums">
                    {monthlyImages} images · {monthlyImages * catalog.creditCosts.image} cr
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150}
                  step={2}
                  value={monthlyImages}
                  onChange={(e) => setMonthlyImages(Number(e.target.value))}
                  className="w-full accent-[#D4AF37] cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-white/50">Estimated Monthly Requirement</p>
                <p className="text-2xl font-display text-white tabular-nums">
                  {estimatedMonthlyCredits.toLocaleString()} credits{' '}
                  <span className="text-sm font-sans text-gold">
                    · Best fit: {recommendedPlan.name}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePlanAction(recommendedPlan)}
                className="px-5 py-2.5 rounded-full border border-gold/45 text-gold hover:bg-gold hover:text-elite-black transition-colors text-xs font-semibold whitespace-nowrap shrink-0"
              >
                {recommendedPlan.priceMonthly === 0
                  ? 'Start with Onboarding'
                  : `Select ${recommendedPlan.name}`}
              </button>
            </div>
          </div>

          {/* One-Time Credit Top-Up Packs */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col justify-between space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gold">Flexible Overages</p>
              <h2 className="text-2xl md:text-3xl font-display font-light text-white">
                One-Time Credit Top-Ups
              </h2>
              <p className="text-xs text-white/60 leading-relaxed">
                Need extra capacity during a heavy listing launch or borrower campaign? Bonus credits sit in your balance and roll over month to month on paid tiers.
              </p>
            </div>

            <div className="divide-y divide-white/10">
              {catalog.topupPacks.map((pack) => {
                const perCredit = (pack.priceUsd / pack.credits).toFixed(2);
                return (
                  <div
                    key={pack.id}
                    className="py-5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-base font-medium text-white">{pack.name}</p>
                      <p className="text-xs text-white/50 tabular-nums">
                        +{pack.credits} bonus credits · ~${perCredit} / credit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTopupAction(pack)}
                      className="px-4 py-2 rounded-full border border-white/15 hover:border-gold hover:text-gold text-xs font-semibold text-white tabular-nums transition-colors whitespace-nowrap shrink-0"
                    >
                      ${pack.priceUsd}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-5 border-t border-white/10 text-xs text-white/50 leading-relaxed">
              {catalog.billing.livePaymentsEnabled
                ? 'Verified checkout enabled. Credits post automatically after signed payment confirmation.'
                : 'Verified billing boundary active. Top-up packs are fulfilled via partner administrator approval until live checkout is enabled.'}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: BILLING SAFEGUARDS & FAQ */}
      <section className={embedded ? 'space-y-8' : 'max-w-7xl mx-auto px-6 space-y-10'}>
        <div className="max-w-2xl space-y-2.5">
          <p className="text-xs font-medium text-gold">Account Safeguards</p>
          <h2 className="text-3xl font-display font-light text-white">
            Billing integrity &amp; common questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 border-t border-white/10 pt-8">
          {SAFEGUARD_FAQS.map((item) => (
            <div key={item.question} className="space-y-2">
              <h3 className="text-base font-medium text-white">{item.question}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>

        {!isAuthenticated && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h3 className="text-2xl font-display text-white">
                Ready to join the Moonshine Capital network?
              </h3>
              <p className="text-sm text-white/60">
                Submit an invitation request to receive Onboarding Access and your 30-day execution track.
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={onRequestInvite}
                className="px-6 py-3 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity inline-flex items-center gap-2 whitespace-nowrap"
              >
                Request Invitation
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className="min-h-screen bg-elite-black text-white font-sans selection:bg-gold selection:text-elite-black"
      data-catalog-source={catalogSource}
    >
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="fixed top-0 inset-x-0 z-50 bg-elite-black/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={onBackToLanding}
            className="font-display text-xl tracking-wider text-gold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
          >
            Moonshine Capital
          </button>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/65">
            <button
              type="button"
              onClick={onBackToLanding}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </button>
            <a
              href="#plans"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Plans
            </a>
            <a
              href="#credit-matrix"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Credits
            </a>
            <a
              href="#topups"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Top-Ups
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={isAuthenticated ? (onOpenStudio ?? onBackToLanding) : onOpenLogin}
              className="px-5 py-2.5 rounded-full gold-gradient text-elite-black text-xs font-semibold tracking-wide hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {isAuthenticated ? 'Member Portal' : 'Member Sign In'}
            </button>
          </div>
        </div>
      </header>

      {content}

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-white/45">
          <div className="flex items-center gap-4">
            <span className="font-display text-sm text-gold">Moonshine Capital</span>
            <span aria-hidden="true">·</span>
            <span>© 2026 Moonshine Capital. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onBackToLanding}
              className="hover:text-white transition-colors"
            >
              Overview
            </button>
            <a href="#plans" className="hover:text-white transition-colors">
              Plans
            </a>
            <button
              type="button"
              onClick={onRequestInvite}
              className="hover:text-white transition-colors"
            >
              Apply
            </button>
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
