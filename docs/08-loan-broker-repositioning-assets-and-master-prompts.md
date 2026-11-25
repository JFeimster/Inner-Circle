# 08 — Loan Broker Repositioning, Visual Asset Playbook, Master Prompts & Google Drive OAuth Guide

This guide covers four strategic upgrades for **Moonshine Capital**:
1. Revising site positioning and copy for **aspiring and existing loan brokers** launching their own funding agency as a Moonshine Capital affiliate.
2. Complete **visual asset plan** (stock photography vs. bespoke AI-generated images with exact copy-paste prompts).
3. Ready-to-use **Master Prompts** tailored for **Google AI Studio**, **ChatGPT**, **Codex (+ VS Code)**, **PowerShell**, and **OpenCode**.
4. Step-by-step architecture for wiring **live Google Drive search via Google OAuth** directly inside the portal.

---

## 1. Revising & Optimizing the Site and Copy for Loan Brokers & Funding Agency Affiliates

### Core Positioning Shift (Audit of Current Site)
Right now, several screens (`LandingPage.tsx`, `OAuthLoginPage.tsx`, and the 30-day onboarding modules in `App.tsx`) still carry **luxury residential real estate** language (*"luxury active listings"*, *"property walkthroughs"*, *"escrow"*, *"real estate advisors"*). Repositioning the site for **business & commercial loan brokers** requires shifting every headline, metric, form field, and onboarding deliverable toward **funding agency ownership, lender access, and affiliate commission velocity**.

### Two Core Personas to Speak To Simultaneously
| Persona | Primary Pain Point | Core Promise from Moonshine Capital |
| :--- | :--- | :--- |
| **Aspiring Loan Broker / Agency Founder** | No direct lender relationships, zero underwriting playbook, overwhelmed by compliance, branding, and lead generation. | Launch your own branded funding agency in 30 days with plug-and-play lender access, scripts, CRM pipelines, and senior deal-desk mentorship. |
| **Existing Loan Broker / ISO / Financial Consultant** | Low commission splits, single-product limits (only MCA or only residential), slow back-office processing, or building everything from scratch. | Expand into a full-stack commercial capital catalog (SBA, Term Loans, LOC, Equipment, CRE/DSCR, Working Capital) with higher payouts, AI deal-prep tools, and white-label affiliate infrastructure. |

### High-Converting Copy Rewrites (Section by Section)

#### A. Universal Landing Page (`LandingPage.tsx`)
- **Eyebrow:** `Commercial Funding Affiliate Network · Built for Independent Loan Brokers`
- **Hero H1:** `Launch and scale your own funding agency with institutional lender access.`
- **Hero Subhead:** `Moonshine Capital equips aspiring and established loan brokers with a 30-day agency launch roadmap, 75+ vetted funding programs, senior underwriting desk support, and turnkey AI marketing systems.`
- **Primary CTA:** `Apply for Affiliate Access` (scrolls to intake form)
- **Secondary CTA:** `Broker Sign In`
- **4-Column Quantitative Proof Strip (Replace Real Estate Metrics):**
  - `75+ Lenders` — Direct commercial, SBA, equipment & working-capital programs
  - `30 Days` — Structured track from affiliate onboarding to first funded file
  - `Up to 10%` *(adjust to your real payout)* — Broker commissions & recurring affiliate overrides
  - `1 : 1 Desk` — Dedicated funding manager for deal structuring & submissions
- **4-Week Onboarding Track Rewrite (`ROADMAP_PREVIEW` & `App.tsx`):**
  - **Week 01 — Agency Foundation & Affiliate Setup:** Activate your affiliate partner portal, configure HubSpot borrower pipelines, deploy your co-branded/white-label funding website & pitch deck, and complete ISO compliance + Stripe Connect commission payouts.
  - **Week 02 — Capital Product & Lender Matrix Mastery:** Master underwriting guidelines across Working Capital, Business Lines of Credit, Equipment Financing, SBA 7(a)/504, and Commercial/DSCR programs; review 5 real funded deal packets.
  - **Week 03 — Borrower Outreach & Deal Flow Engine:** Rehearse borrower discovery & bank-statement collection scripts with your funding manager, launch targeted LinkedIn/email outreach to SMB owners, and book your first 5 funding consultations.
  - **Week 04 — Packaging, Submission & First Funded Commission:** Package clean underwriting files (application + 3–6 months business bank statements), submit to the Moonshine Deal Desk, present lender term sheets, and collect your first funded commission.
- **Application Form Fields (`#apply`) — Tailor to Loan Brokers:**
  - `Full Name`
  - `Work Email`
  - `Experience Track` (Dropdown: `Aspiring Broker — Launching My Agency`, `Active Loan Broker / ISO`, `CPA / Business Consultant / Real Estate Pro`, `Existing Funding Agency Owner`)
  - `Target Monthly Funding Volume` (`$0 – $250K (New Launch)`, `$250K – $1M`, `$1M – $3M`, `$3M+`)
- **Case Study & Social Proof Rewrite:**
  - Replace luxury home closing quotes with concrete **SMB funding wins** (e.g., *"Closed a $185K equipment + working capital package in Day 19 using the Moonshine Deal Desk"*, *"Transitioned from solo MCA broker to a 4-product funding agency doing $1.2M/mo"*).

#### B. OAuth Login Screen (`OAuthLoginPage.tsx`)
- **Left Editorial Headline:** `Welcome back to the Deal Desk.`
- **Subcopy:** `Access your lender matrix, active borrower pipelines, AI pitch studio, and 30-day agency launch milestones.`
- **Auth Providers:** Keep **Google Workspace**, **LinkedIn** (huge for B2B loan brokers), and **Microsoft 365** (common among commercial finance shops), plus **Affiliate Invite Code** activation.

#### C. Portal Navigation & Terminology Sweep (`App.tsx`, `Profile.tsx`, `AIStudioPage.tsx`)
- Rename **"Agent"** -> **"Broker Partner"** or **"Affiliate Partner"**
- Rename **"Listings / Inventory"** -> **"Lender Matrix & Funding Programs"**
- Rename **"Property Walkthroughs"** -> **"Live Underwriting & Deal Desk Reviews"**
- Update **AI Studio Quick Prompts** to loan-broker deliverables:
  - *Borrower Cold Outreach Sequence (Trucking, Medical, Construction, E-Commerce)*
  - *Commercial Funding Term-Sheet Explainer & Cover Email*
  - *LinkedIn Authority Post for Business Owners Seeking Working Capital*
  - *Lender Submission Executive Summary / Deal Memo*

---

## 2. Visual Asset Plan — Stock Images vs. Bespoke Generated Images

### Design Direction for Moonshine Capital
Keep the visual identity cohesive with the obsidian (`#0A0A0A`) and champagne-gold (`#D4AF37`) aesthetic: **warm low-key tungsten lighting, dark architectural glass/walnut/marble surfaces, authentic business owners & dealmakers, zero cheesy stock-photo handshakes or bright white corporate clip-art**.

### Part A: Existing Stock Images to Source (Unsplash / Pexels / Adobe Stock)
Best used for **real-world industry verticals, authentic human portraits, and borrower niches** where photography looks immediately credible:

| Placement | Subject / Scene | Recommended Search Keywords | Aspect Ratio |
| :--- | :--- | :--- | :--- |
| **Industry Vertical Cards** (Funding Programs) | Construction / heavy equipment fleet, medical clinic, logistics semi-trucks, modern restaurant kitchen, warehouse operations | `"commercial construction excavator dusk"`, `"modern dental clinic interior dark"`, `"freight logistics warehouse moody"`, `"fine dining kitchen chef lighting"` | `4:3` or `16:9` |
| **Broker & Founder Avatars** (Leaderboard, Testimonials, Mentors) | Authentic diverse professionals in tailored dark attire (smart casual to executive) | `"executive portrait studio dark background"`, `"financial advisor headshot moody lighting"`, `"business founder portrait warm light"` | `1:1` |
| **Module Video Thumbnails** (Training Academy) | Clean laptop desk workspace, financial charts on monitor, phone consultation, whiteboard strategy session | `"minimalist dark desk laptop finance"`, `"business meeting glass conference room evening"` | `16:9` |
| **Community & Events Banner** | Mastermind roundtable, live seminar speaker on dark stage | `"business conference speaker spotlight dark stage"`, `"executive roundtable dinner moody"` | `16:9` |

### Part B: Bespoke Images to Generate (With Copy-Paste Prompts)
Use AI image generation for **hero visuals, abstract capital textures, dark-mode editorial scenes, and custom marketing kit previews** so your brand looks unmistakable and bespoke.

#### 1. Hero Banner — Funding Agency Command Center (`16:9`)
> **Prompt:** `Editorial architectural photography of a modern private commercial finance office at twilight overlooking a glowing metropolitan financial district skyline, floor-to-ceiling dark steel windows, smoked walnut executive desk with subtle brass lamp casting warm amber light, ultra-clean obsidian and charcoal interior palette, shallow depth of field, shot on Leica SL2 35mm f/1.8, cinematic moody lighting, photorealistic, no text, no watermarks`

#### 2. Deal Desk & Senior Partner Mentorship (`4:3`)
> **Prompt:** `Cinematic editorial photograph inside a private boutique capital advisory boardroom at night, two confident commercial finance executives reviewing a dark-bound funding dossier across a matte black stone table, warm golden desk lamp lighting, dark charcoal wood paneling, glass walls with soft bokeh city lights, shot on 50mm lens, luxury minimalist aesthetic, no text, no logos`

#### 3. OAuth Login Left Showcase — Obsidian Atrium (`3:4`)
> **Prompt:** `Vertical architectural interior photography of a dramatic private financial club lobby, honed black Nero Marquina marble columns, subtle brushed champagne-gold architectural trim, warm indirect recessed lighting, minimalist sculptural ambiance, high contrast shadows, serene institutional prestige, photorealistic, no people, no text`

#### 4. Affiliate Brand Kit & White-Label Showcase (`4:3`)
> **Prompt:** `Overhead flat-lay studio product photography on matte obsidian slate surface, luxury minimalist matte black business cards with subtle gold foil edge, a sleek dark aluminum laptop displaying abstract dark-mode financial analytics charts, heavy brass fountain pen, dramatic directional rim light, ultra-crisp commercial photography, no readable text`

#### 5. Funding Program Feature — Commercial Real Estate & Bridge Capital (`16:9`)
> **Prompt:** `Twilight architectural photography of a contemporary glass-and-concrete mixed-use commercial building with warm interior lights glowing against a deep indigo dusk sky, wet asphalt reflections, clean geometric composition, institutional real estate investment mood, shot on medium format camera, no text`

#### 6. Funding Program Feature — Equipment & Logistics Financing (`16:9`)
> **Prompt:** `Moody industrial commercial photography of a pristine modern fleet of heavy machinery and logistics trailers parked inside an architectural steel depot at dusk, warm golden overhead bay lights contrasting with deep charcoal shadows, cinematic commercial look, high detail, no brand logos, no text`

#### 7. AI Studio / Automation Visual (`4:3`)
> **Prompt:** `Abstract luxury 3D sculptural render of translucent smoked obsidian glass plates layered with fine brushed champagne-gold metallic filaments representing capital flow and underwriting networks, soft volumetric light against a pure #0A0A0A obsidian background, ultra-minimalist editorial design, 8k octane render, no text`

#### 8. Tier Achievement Emblems — Bronze / Silver / Gold / Platinum Broker Badges (`1:1`)
> **Prompt:** `Minimalist geometric luxury crest medallion crafted from matte black anodized titanium and brushed 18k champagne gold inlays, floating centered on a pure #0A0A0A dark background, soft studio specular reflection, precision Swiss watchmaking craftsmanship, clean iconography, no text, no letters`

---

## 3. Master Prompts by Tool

Keep a single **"Brand & Stack Context Block"** at the top of every prompt, then pair it with the tool-specific wrapper below.

### Shared Context Block (Paste Into Any Tool)
```text
PROJECT: Moonshine Capital — Loan Broker Affiliate & Funding Agency Launchpad
AUDIENCE: Aspiring loan brokers starting their own funding agency + existing ISOs/commercial loan brokers scaling with Moonshine Capital's affiliate network.
CORE OFFERING: 30-day structured launch roadmap, 75+ commercial/SMB/CRE funding programs, dedicated Deal Desk mentorship, HubSpot/Google Workspace/Stripe Connect stack, and server-side Gemini AI Studio for broker outreach, deal memos, and brand visuals.
VISUAL SYSTEM: Obsidian (#0A0A0A), Champagne Gold (#D4AF37), Elevated Charcoal (#121214), Hairline borders (border-white/10), Cormorant Garamond / Playfair display serif + clean sans-serif, tabular numerals, zero cluttered pill badges, executive fintech aesthetic.
TECH STACK: React 19, TypeScript, Vite 6, Tailwind CSS v4, Motion (motion/react), Express (server.ts on port 3000), SQLite (better-sqlite3), @google/genai.
```

---

### 3.1 Google AI Studio (This Thread)
Use this prompt when asking AI Studio to build new pages, components, backend routes, or images directly in the live repo:

```text
ROLE: Senior Full-Stack Engineer & Product Designer working inside the live Moonshine Capital repository.

CONTEXT:
Moonshine Capital is a private affiliate network & 30-day launchpad for aspiring and existing loan brokers starting or scaling their own commercial funding agency. Design aesthetic: Obsidian (#0A0A0A), Champagne Gold (#D4AF37), hairline borders (border-white/10), tabular-nums, high-craft executive fintech UI (no SaaS buzzwords, no cluttered pill tags).

TASK:
[Describe exact page, component, API route, or copy update — e.g., "Rewrite LandingPage.tsx, OAuthLoginPage.tsx, and App.tsx onboarding modules from luxury real estate copy to commercial loan broker & funding agency affiliate copy."]

REQUIREMENTS:
1. Reuse existing Tailwind design tokens in src/index.css and preserve all working routes in server.ts.
2. Persist any new form/state data cleanly in SQLite (data/moonshine.db) via /api/* endpoints in server.ts.
3. Generate bespoke photography/visuals via generate_image into src/assets/images/ with referrerPolicy="no-referrer" and styled fallbacks when new imagery is needed.
4. Keep all AI calls server-side (never add user API key inputs).
5. Compile, run TypeScript lint checks, and restart the dev server if server.ts changes.
```

---

### 3.2 ChatGPT (Strategy, Copywriting, Video Scripts, Ad Campaigns, Lender SOPs)
Use this prompt in ChatGPT for deep marketing copy, email/SMS funnels, Loom/Vimeo training scripts, and social/video storyboards:

```text
Act as a Chief Revenue Officer and Direct-Response Copywriter specializing in B2B commercial finance, SBA/working-capital loan brokering, and affiliate agency recruitment.

Brand: Moonshine Capital (luxury obsidian-and-gold authority positioning — understated, sharp, institutional, zero hype/guru clichés).
Target Audience:
1) Aspiring loan brokers who want a step-by-step blueprint to launch their own funding agency without spending years building lender relationships.
2) Existing loan brokers, ISOs, and financial consultants who want broader funding products (SBA, Term, LOC, Equipment, CRE/DSCR), higher splits, and turnkey AI marketing systems.

Deliverable Requested:
[Insert deliverable: e.g., "Write a 5-email affiliate onboarding sequence", "Write a 90-second VSL / hero explainer video script with B-roll cues", or "Write 10 LinkedIn authority posts for new loan brokers"].

Tone & Rules:
- Concrete commercial finance language (underwriting guidelines, bank statements, DSCR, funding desk, commission splits, residuals, lender matrix).
- Zero empty hype ("10x your life", "get rich quick", "synergy").
- Structure output in clean Markdown ready to paste directly into our /docs folder or Notion workspace.
```

---

### 3.3 Codex (+ VS Code)
Use this prompt inside VS Code with Codex / GitHub Copilot Agent Mode when refactoring local repo files, writing unit tests, or building modular components:

```text
You are editing the local Moonshine Capital TypeScript repository (React 19 + Vite 6 + Tailwind v4 + Express server.ts + better-sqlite3).

Before making edits:
1. Inspect package.json, tsconfig.json, src/types.ts, src/App.tsx, and server.ts to match exact coding conventions.
2. Note that tsconfig.json does not assume strictNullChecks — prefer explicit nullable return types over complex discriminated boolean narrowing.

Task:
[Describe specific component/file change, e.g., "Implement src/components/NetworkLeaderboard.tsx and GET /api/leaderboard in server.ts according to /docs/09-feature-backlog-and-component-specs.md"].

Constraints:
- Do not modify unrelated working features or introduce new npm packages unless strictly necessary.
- Use Tailwind utility classes only (no separate CSS files, no inline style hacks).
- Never hardcode secrets or client-side API keys; read secrets from process.env in server.ts.
- After editing, run `npm run lint` and `npm run build` and fix any errors before reporting completion.
```

---

### 3.4 PowerShell (Scaffolding Files, Bulk Asset Optimization, Batch Generation & Git Automation)
Use this prompt when asking an AI to write safe PowerShell scripts for Windows automation (scaffolding folders/pages, batch-renaming/converting stock media to WebP, syncing Notion/Drive exports, or committing releases):

```text
Act as a Windows DevOps & Automation Engineer writing production-grade PowerShell 7+ scripts for the Moonshine Capital web repository.

Goal:
[Describe automation task — e.g., "Create a PowerShell script that scaffolds new component + test + doc files from a template", OR "Batch-resize and convert raw JPG/PNG broker images in ./raw-assets into optimized 16:9 and 1:1 WebP/JPG assets in ./src/assets/images/ with clean snake_case filenames"].

Requirements:
- Use `Set-StrictMode -Version Latest` and `$ErrorActionPreference = 'Stop'`.
- Support `-WhatIf` / dry-run preview before modifying or deleting files.
- Never hardcode API keys; read credentials from `$env:...` or a gitignored `.env.local` file.
- Include clear console progress logs and graceful error handling.
- Output the complete `.ps1` script plus the exact one-line command to run it from the repo root.
```

---

### 3.5 OpenCode (Terminal AI Coding Agent)
Use this prompt inside OpenCode CLI for multi-file feature implementation, automated verification, and doc synchronization:

```text
@docs/09-feature-backlog-and-component-specs.md @src/App.tsx @server.ts

Objective:
Implement [Feature Name — e.g., ModulePlayerModal + NotificationCenter] for Moonshine Capital (Loan Broker Affiliate & Funding Agency Launchpad).

Execution Protocol:
1. Plan the exact file changes first in 3–5 concise bullets (types, API endpoints, React components, state wiring).
2. Keep visual parity with our Obsidian (#0A0A0A) / Champagne Gold (#D4AF37) design system and hairline borders (`border-white/10`).
3. Ensure all SQLite queries in `server.ts` are parameterized and all user inputs are validated.
4. Update `/docs/09-feature-backlog-and-component-specs.md` to mark completed items `[x]`.
5. Run `npx tsc --noEmit` and `npm run build` to verify zero TypeScript or bundler errors.
```

---

## 4. Wiring Up Real Google Drive Asset Search via Google OAuth

### Why Client-Side Token Flow Is Mandatory in AI Studio
In AI Studio preview environments, preview URLs are dynamic. **Never build a server-side Express OAuth redirect flow** (`redirect_uri` callbacks will fail with `Error 400: redirect_uri_mismatch`). Instead, use **Google Workspace Client-Side OAuth (Firebase Auth + `GoogleAuthProvider`)**, obtain the Google OAuth access token in the browser, keep it strictly **in memory** (never in `localStorage`), and call the Google Drive v3 API directly (or pass it to your backend via `Authorization: Bearer <token>`).

### Step-by-Step Implementation Path

#### Step 1 — Provision Google OAuth with Least-Privilege Drive Scope
When you are ready to build this in AI Studio, simply say:
> *"Connect Google Drive read-only search to the Marketing Vault / Asset Browser."*

AI Studio will trigger the Google Workspace OAuth setup card for the least-privilege scope:
- **Recommended Scope:** `https://www.googleapis.com/auth/drive.readonly` (lets authenticated brokers search, filter, preview thumbnails, and download files across shared Moonshine Capital Drive folders without risking accidental edits/deletes).
- *(Optional tighter scope if you only want user-picked files via Google Picker)*: `https://www.googleapis.com/auth/drive.file` + `https://www.googleapis.com/auth/drive.metadata.readonly`.

#### Step 2 — Client-Side Auth Utility (`src/lib/googleDriveAuth.ts`)
- Reuse the auto-provisioned `firebase-applet-config.json`.
- Configure `GoogleAuthProvider` with `provider.addScope('https://www.googleapis.com/auth/drive.readonly')`.
- Authenticate via `signInWithPopup(auth, provider)` on an official **"Sign in with Google"** button click.
- Cache `credential.accessToken` in an **in-memory module variable** (cleared automatically inside `onAuthStateChanged` on sign-out).

#### Step 3 — Query Real Drive Files (`src/lib/googleDriveApi.ts`)
Call Google Drive REST API v3 directly with query filters for folder scoping, keyword search, and MIME types:

```typescript
export interface DriveAsset {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
}

export async function searchMoonshineDriveAssets(
  accessToken: string,
  options: { query?: string; folderId?: string; category?: 'all' | 'pdf' | 'slides' | 'images' | 'docs' }
): Promise<DriveAsset[]> {
  const filters: string[] = ['trashed = false'];

  if (options.folderId) {
    filters.push(`'${options.folderId}' in parents`);
  }
  if (options.query?.trim()) {
    const safeQ = options.query.trim().replace(/'/g, "\\'");
    filters.push(`(name contains '${safeQ}' or fullText contains '${safeQ}')`);
  }
  if (options.category === 'pdf') filters.push(`mimeType = 'application/pdf'`);
  if (options.category === 'slides') filters.push(`mimeType = 'application/vnd.google-apps.presentation'`);
  if (options.category === 'images') filters.push(`mimeType contains 'image/'`);
  if (options.category === 'docs') filters.push(`mimeType = 'application/vnd.google-apps.document'`);

  const params = new URLSearchParams({
    q: filters.join(' and '),
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new Error('GOOGLE_TOKEN_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`Drive search failed (${res.status})`);
  }

  const data = await res.json();
  return data.files ?? [];
}
```

#### Step 4 — Organize Your Moonshine Capital Drive Folder for Instant Portal Filtering
Create a single shared folder (e.g., **`Moonshine Capital — Broker Asset Vault`**) and store its folder ID as `VITE_MOONSHINE_DRIVE_FOLDER_ID`. Inside, use clean subfolders or filename prefixes:
- `[PITCH]` — Borrower funding pitch decks & agency overview slides
- `[LENDERS]` — Lender rate sheets, guidelines & underwriting matrices
- `[SCRIPTS]` — Cold call, LinkedIn DM, and bank-statement follow-up scripts
- `[BRAND]` — Logos, Canva templates, social banners, and co-brandable PDFs

#### Step 5 — UX & Security Guardrails
- **Token Expiration Handling:** If Drive returns HTTP `401`, smoothly prompt a one-click **"Reconnect Google Drive"** button rather than showing a raw error.
- **Read-Only First:** Because you only request `drive.readonly`, affiliates can browse, search, preview, and download assets safely without ever mutating master templates.
- **No Destructive Calls Without Confirmation:** If you later expand to upload/delete files, always require an explicit confirmation modal before any mutating Drive API call.
