# 07 — AI Studio Packaging, Pricing & Unit Economics Guide

How to package, price, and protect margins for the **Moonshine Capital AI Studio** (Concierge Chat, Image Studio, and Downloadable File Creator) while running server-side with per-agent credit guardrails.

---

## 1. Credit-Based Packaging Model (Implemented in App)

Instead of charging raw API tokens (which confuses agents), abstract all AI features into **Moonshine Studio Credits** enforced server-side in SQLite (`server.ts`):

| Capability | Model Used | Credit Cost | Est. Underlying API Cost |
| :--- | :--- | :--- | :--- |
| **Concierge Chat** (Scripts, Market Prep, Q&A) | `gemini-4-hydrogen` | **1 credit** | ~$0.001 – $0.004 |
| **Downloadable File** (`.md`, `.csv`, `.txt`, `.html`) | `gemini-4-hydrogen` (structured JSON) | **2 credits** | ~$0.003 – $0.008 |
| **Brand Image Generation** (Social & Listing Visuals) | `gemini-3.1-flash-lite-image` | **5 credits** | ~$0.02 – $0.04 |

### Why Credits + Daily Caps Work
- **Predictable Worst-Case Spend:** Every tier enforces BOTH a **monthly credit allowance** and a **daily safety cap** on the server—preventing a single account or script from running up a surprise bill.
- **High Gross Margins (80%+):** Even if a Pro Producer uses 100% of their 250 credits exclusively on the most expensive operation (50 generated images), your underlying API cost is roughly **$1.50–$2.50**, leaving over **90% gross margin** on a $49/month seat.

---

## 2. Recommended Pricing Tiers

| Tier | Target Audience | Price | Monthly Credits | Daily Cap | Positioning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Onboarding Access** | New agents in their first 30 days | **$0 / mo** *(Included)* | **30 credits** | **10 / day** | Removes friction on Day 1 while capping free exposure to ~$0.25/agent/month. |
| **Pro Producer** | Active dealmakers & weekly outreach | **$49 / mo** per agent | **250 credits** | **50 / day** | Core paid add-on; easily justified by a single saved hour or one listing campaign. |
| **Inner Circle Studio** | Top producers, partners & luxury teams | **$149 / mo** *(or Platinum perk)* | **1,000 credits** | **150 / day** | High-volume visual & pitch production; waive fee automatically once an agent closes their first deal to incentivize production. |

### One-Time Credit Top-Up Packs *(Stripe Checkout Add-Ons)*
- **100 Credit Top-Up — $19** *(~$0.19/credit)*
- **300 Credit Top-Up — $49** *(~$0.16/credit)*
- Top-up credits sit in `bonus_credits` and never expire on paid tiers, eliminating upgrade friction during a busy listing launch week.

---

## 3. Three Commercial Packaging Strategies for Moonshine Capital

1. **Performance-Unlocked Perk (Best for Brokerage Recruiting):**
   - Give every new agent **Onboarding Access (30 credits)** free, charge **$49/mo** for **Pro Producer**, and **comp the $149/mo Inner Circle tier** automatically when HubSpot verifies their **First Deal** or Platinum status. This turns AI access into a concrete sales incentive.
2. **Brokerage / Team Desk Fee Pass-Through:**
   - Bundle **Pro Producer** into your existing monthly agent tech/marketing desk fee (e.g., +$35–$49/mo) so there is no separate purchase decision—agents perceive it as an exclusive Moonshine Capital advantage.
3. **Standalone Paid Add-On via Stripe Connect:**
   - Keep core onboarding free and let high-output agents self-upgrade inside **AI Studio → Plans & Credits** via **Stripe Subscriptions** + **Stripe Checkout** for one-time top-up packs, firing a Stripe webhook to `POST /api/webhooks/stripe` to update `plan_id` or increment `bonus_credits`.

---

## 4. Production Hardening Checklist Before Charging Money
- **Replace lightweight email sign-in with verified OAuth / Firebase Auth** so member emails cannot be spoofed in `x-agent-email`.
- **Wire Stripe Webhooks** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) to automatically upgrade/downgrade `agent_accounts.plan_id` and add `bonus_credits`.
- **Add Google Cloud Billing Budget Alerts** at $25 / $50 / $100 so infrastructure spend is monitored alongside Stripe MRR.
