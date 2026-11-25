# 04 — Automated Onboarding Workflows & Selected Stack

## 1. Selected Core Tool Stack

| Category | Selected Provider(s) |
| :--- | :--- |
| 1. CRM & Pipeline | **HubSpot** |
| 2. Community & Network Proof | **Slack**, **Discord** |
| 3. Calendar & Scheduling | **Google Calendar** |
| 4. Marketing Vault & Social | **Google Drive**, **Canva**, **LinkedIn**, **Meta** |
| 5. E-Signatures *(Optional)* | **DocuSign** or **Dropbox Sign** |
| 6. Commissions & Payouts | **Stripe Connect** |
| 7. Swag Kit Fulfillment | **Printful** or **Shopify** |
| 8. Video Training & CMS | **Vimeo**, **Notion** |
| 9. Email & Outreach | **Gmail**, **Mailchimp** |

> **Key Advantage:** A single **Google OAuth** connection covers four capabilities at once—Member Login, Google Calendar, Google Drive, and Gmail.

---

## 2. High-Impact Automated Onboarding Workflows

### 4-in-1 Google Onboarding Flow (Auth + Drive + Calendar + Gmail)
- **Drive:** Auto-clones a personal *"Moonshine Agent Starter Folder"* (Brand Identity Kit + Elite Presentation Deck) into the agent's Google Drive on Day 1.
- **Calendar:** Subscribes agents to the Moonshine Master Event Calendar and enables direct Mentor and Property Walkthrough booking.
- **Gmail:** Pre-loads Week 3 approved outreach scripts as ready-to-send Gmail drafts so agents can execute their first 20 outreach touchpoints immediately.

### Zero-Touch Milestones (HubSpot → Portal + Slack/Discord)
- When an agent logs their first contact or closes a deal in **HubSpot**, the portal automatically marks **First Lead** / **First Deal** complete, awards Quick-Win points, and posts a celebratory shoutout in **Slack/Discord** `#wins`—updating the live **Network Success** ticker at the same time.

### No-Code Content Management (Notion + Vimeo)
- **Notion** acts as the internal admin CMS for *30-Day Roadmap Tasks*, *Top 5 Active Listings*, and *Resource Vault* entries—allowing ops updates without touching code.
- **Vimeo** playback webhooks verify when an agent finishes *"Founder's Welcome"* or training modules, automatically awarding Quick-Win points and certification badges.

### Guided "Launch Day" Campaign (Canva + LinkedIn + Meta + Mailchimp)
- Bundle the Marketing Vault into a 3-step launch wizard:
  1. Customize a *"Just Joined Moonshine Capital"* graphic in **Canva**.
  2. Publish directly to **LinkedIn** and **Meta (Instagram/Facebook)**.
  3. Trigger a co-branded announcement to their sphere of influence via **Mailchimp**.

### Milestone-Gated Swag Tiers (Printful / Shopify + HubSpot)
- Turn **Claim Your Swag Kit** into a progressive reward engine:
  - *Week 1 Completed* → Unlocks Welcome Swag Box (auto-shipped via Printful/Shopify).
  - *First Deal Closed (HubSpot)* → Unlocks an exclusive *"Inner Circle"* luxury gift/apparel tier.

### "Commission-Ready" Compliance Gate (DocuSign/Dropbox Sign + Stripe Connect)
- Group ICA, NDA, and W-9 signing with **Stripe Connect** payout setup into one Week 1 checklist so agents face zero administrative delays on their **First Commission**.

---

## 3. Additional Complementary Tools & Ideas

- **Workflow Glue (Make, Zapier, or n8n):** Emit clean webhooks from the portal (`agent_signed_up`, `roadmap_step_completed`, `swag_ordered`) into Make/Zapier to connect HubSpot, Slack, Discord, Mailchimp, Notion, Printful, and DocuSign rapidly without maintaining 12 custom API clients upfront.
- **DocSend:** Host the *Elite Presentation Deck* with live view notifications so agents know the moment a high-net-worth prospect opens or forwards their deck.
- **Loom:** Let new agents record 60-second community intros or mock sales pitches for asynchronous **Mentor** review during Week 3 *"Script Practice."*
- **Cal.com:** Open-source scheduling layer over Google Calendar with self-serve OAuth so senior mentors share clean booking slots with buffer rules.
- **Typeform / Tally:** 2-minute onboarding intake quiz (market, specialty, deal size goals) to automate **Mentor Matching** and write profiles into HubSpot and Notion.
- **Twilio / OpenPhone:** High-touch automated welcome SMS from the Founder or assigned Mentor upon activation or milestone completion.
- **In-App "Connected Stack" Readiness Meter:** A Week 1 Setup Hub showing each integration card turning **Achievement Green** once linked, feeding directly into the 30-Day progress tracker.

---

## 4. Recommended 3-Phase Rollout

1. **Phase 1 — Foundation & Access:** Universal Landing Page + **Google OAuth** (Login, Calendar, Drive, Gmail) + **Notion** (CMS) + **Vimeo** (Videos) + **Slack/Discord** (Community).
2. **Phase 2 — Pipeline & Marketing:** **HubSpot** (automated milestones) + **Canva / LinkedIn / Meta / Mailchimp** (Launch Day toolkit) + **Printful/Shopify** (swag fulfillment).
3. **Phase 3 — Deal Flow & Payouts:** **DocuSign / Dropbox Sign** (agreements) + **Stripe Connect** (commissions) + **DocSend / Loom** (sales enablement).
