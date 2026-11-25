# 09 — Feature Backlog & Component Specifications

Use this document to track upcoming portal features, component specifications, data structures, and build priorities for the **Moonshine Capital Loan Broker & Funding Agency Portal**.

---

## Core Requested Dashboard Features (Priority Queue)

### 5.1 Network Leaderboard (`src/components/NetworkLeaderboard.tsx`)
- **Status:** `[ ] Planned`
- **Priority:** High — Drives daily onboarding completion and cohort competition.
- **Objective:** Rank brokers/affiliates across the Moonshine Capital network based on total points earned from completed challenges, onboarding milestones, and funded deal bonuses, displaying the logged-in broker's live global rank.
- **Key UI & UX Elements:**
  - **Top 3 Podium / Highlight Row:** Rank `#1`, `#2`, `#3` with subtle champagne-gold rank indicators, broker avatar, agency name/market, total points (`tabular-nums`), completed milestones count, and tier status (`Foundation`, `Active ISO`, `Senior Broker`, `Platinum Agency`).
  - **Current User Sticky Rank Strip:** Always pins the logged-in broker's global rank (e.g., `#14 of 128 Affiliates · 1,450 pts · 120 pts to Top 10`) even if they are outside the top 10.
  - **Timeframe Filter:** Segmented toggle (`This Week` | `This Month` | `All-Time`).
  - **Reactive Scoring:** Automatically recalculates the logged-in user's points when they check off a roadmap milestone or complete a weekly challenge in `App.tsx`.
- **Data & API Contract:**
  - SQLite table `leaderboard_entries` (`user_email`, `display_name`, `agency_name`, `market`, `points`, `milestones_completed`, `challenges_completed`, `funded_deals`, `updated_at`).
  - `GET /api/leaderboard?range=all|month|week` -> returns sorted rankings + current user's global rank and delta to next rank.
  - `POST /api/leaderboard/sync` -> syncs logged-in broker's milestone & challenge point totals.

---

### 5.2 Notification Center (`src/components/NotificationCenter.tsx`)
- **Status:** `[ ] Planned`
- **Priority:** High — Keeps brokers engaged with real-time leads, underwriting/mentor feedback, and network wins.
- **Objective:** Provide both an unobtrusive **real-time toast overlay** (bottom-right) for incoming events and a **slide-out notification drawer** triggered from a bell icon with unread count indicator in the top navigation bar.
- **Notification Categories:**
  - `lead` — New borrower funding inquiry or HubSpot lead assignment (e.g., *"$250K Working Capital lead assigned — Apex Logistics LLC"*).
  - `mentor` — Senior Deal Desk / mentor feedback on submitted deal packets or script rehearsals.
  - `community` — Cohort milestones, leaderboard rank changes, and live Q&A call reminders.
  - `system` — Commission payout updates (Stripe Connect) and newly added lender programs.
- **Key UI & UX Elements:**
  - **Top Bar Bell Trigger:** Clean icon button with compact numeric unread badge.
  - **Slide-Out Drawer:** Right-anchored obsidian glass drawer (`border-l border-white/10`) with category filter tabs (`All`, `Leads`, `Mentor`, `Community`), `Mark all read`, individual click-to-navigate deep links, and relative timestamps.
  - **Toast Overlay Stack:** Auto-dismissing (5s) hairline-bordered toast cards with subtle progress bar and quick action button (`View Lead`, `Open Feedback`).
- **Data & API Contract:**
  - SQLite table `notifications` (`id`, `user_email`, `category`, `title`, `message`, `action_tab`, `is_read`, `created_at`).
  - `GET /api/notifications` & `PATCH /api/notifications/:id/read` & `POST /api/notifications/read-all`.
  - Optional SSE (`GET /api/notifications/stream`) or 30s lightweight polling for live real-time updates without heavy infrastructure.

---

### 5.3 Start Module Video & Syllabus Modal (`src/components/ModulePlayerModal.tsx`)
- **Status:** `[ ] Planned`
- **Priority:** High — Turns static training module cards into an interactive learning academy.
- **Objective:** Open an executive full-focus modal overlay whenever a broker clicks **"Start Module"** (or **"Resume Module"**) on any onboarding or training track card.
- **Key UI & UX Elements:**
  - **Embedded 16:9 Video Player:** Supports Vimeo, Loom, or YouTube embeds (with clean dark poster frame, chapter timestamps, and playback fallback if a module has no external URL yet).
  - **Detailed Module Overview Panel:** Displays module duration, broker points awarded, learning objectives, step-by-step action checklist, and lender/script takeaways.
  - **Downloadable Module Assets:** Direct download/view links for attached PDFs, bank-statement checklists, or Canva/Drive templates for that specific module.
  - **Progress & Completion Controls:** Interactive checkboxes for module action steps plus a primary **"Mark Module Complete (+250 pts)"** button that updates portal progress, Profile stats, and the Network Leaderboard immediately.
  - **Accessibility:** Keyboard `Escape` to close, backdrop click dismissal, focus containment, and responsive mobile scroll layout.
- **Data Model Extension (`src/types.ts`):**
  - Extend `Module` interface with: `videoUrl?: string`, `videoProvider?: 'vimeo' | 'loom' | 'youtube'`, `fullDescription: string`, `keyTakeaways: string[]`, `actionChecklist: string[]`, `attachments?: { label: string; type: string; url: string }[]`, `pointsValue: number`.

---

## Recommended Next-Wave Loan Broker Features (Phase 2 Backlog)

| ID | Feature | Why It Matters for Loan Brokers & Affiliates | Status |
| :--- | :--- | :--- | :--- |
| **5.4** | **Site-Wide Copy & Positioning Refactor** | Update `LandingPage.tsx`, `OAuthLoginPage.tsx`, `App.tsx`, and `AIStudioPage.tsx` from real estate wording to Commercial Loan Broker / Funding Agency Affiliate positioning (see Doc `08`). | `[ ] Planned` |
| **5.5** | **Live Google Drive Asset Browser** | Wire Google OAuth (`drive.readonly`) into Marketing Vault so brokers can search, filter, and download real Moonshine Capital decks, rate sheets, and scripts directly from Google Drive. | `[ ] Planned` |
| **5.6** | **Commission & Funding Split Calculator** | Interactive slider tool letting aspiring/existing brokers model monthly agency income by deal size ($50K–$2M), deals/month, commission split %, and affiliate sub-broker overrides. | `[ ] Planned` |
| **5.7** | **Searchable Lender Matrix & Program Filter** | Filterable directory of Moonshine Capital funding products (SBA, Term, LOC, Equipment, CRE/DSCR, Working Capital) by minimum FICO, time in business, monthly revenue, and max funding amount. | `[ ] Planned` |
| **5.8** | **Deal Desk Submission Intake** | Structured deal submission form (borrower entity, funding product, requested amount, monthly deposits, notes) saved to SQLite with live status tracker (`Submitted` -> `In Underwriting` -> `Offer Out` -> `Funded`). | `[ ] Planned` |
| **5.9** | **Affiliate Referral Link & Sub-Broker Tracker** | Unique partner invite link generator + tracking table showing recruited sub-affiliates, their onboarding completion %, and override commissions earned. | `[ ] Planned` |
| **5.10** | **Admin Cohort & Invitation Manager** | Protected admin view to review `POST /api/invitations` applications from the Landing Page, approve brokers, and issue one-click cohort invite codes. | `[ ] Planned` |

---

## Suggested Build Sequence
1. **Sprint A (Brand & Conversion Alignment):** `5.4` Loan Broker Copy Refactor + Bespoke Commercial Finance Imagery.
2. **Sprint B (Engagement & Learning Core):** `5.3` Start Module Video Modal + `5.1` Network Leaderboard + `5.2` Notification Center.
3. **Sprint C (Broker Utility & Real Assets):** `5.5` Live Google Drive OAuth Search + `5.6` Commission Calculator + `5.7` Lender Matrix.
4. **Sprint D (Operations & Scale):** `5.8` Deal Desk Intake + `5.9` Affiliate Link Tracker + `5.10` Admin Invitation Review.
