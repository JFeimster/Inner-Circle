# 01 — Authentication Strategy, Tech Stack & Design Styles

## 1. Adding Member Login, a Universal Landing Page & OAuth

The cleanest path to add real member accounts to the Moonshine Capital onboarding portal is pairing **Firebase Authentication** (or a self-serve OAuth/session backend) with persistent storage (such as **Cloud Firestore** or PostgreSQL), so each agent's completed roadmap steps, milestones, quick-win points, and swag orders save per user.

### 1.1 Universal Landing Page (Signed-Out Experience)
Add an authentication gate at the root of the application that checks whether a viewer is signed in:
- **Not signed in:** Visitors land on a public Moonshine Capital brand page featuring a luxury hero overview, network benefits, high-level agent success highlights, an **"Apply / Request Invitation"** CTA, and a prominent **Member Sign In** button.
- **Signed in:** Members bypass the public showcase and enter directly into the personalized Onboarding Dashboard, 30-Day Roadmap, and Resource Vault—keeping training videos and marketing kits protected.

### 1.2 Dedicated OAuth Login Page
Create a clean `/login` screen (or modal) centered on one-click **Google OAuth** sign-in (with optional Microsoft/LinkedIn OAuth for brokerage emails, or email/password fallback):
- Handles the OAuth handshake securely without exposing client secrets in the browser.
- Automatically populates the agent's name and avatar in the portal header.
- Supports gating entry via an approved-agent allowlist, role check (`agent` vs. `admin`), or invite code.

---

## 2. Current Platform & Tech Stack Advice

### Current Platform
- **Frontend:** React 19 + TypeScript + Vite 6 Single-Page Application (SPA)
- **Styling & Motion:** Tailwind CSS v4 + Motion (`motion/react`) + Lucide Icons
- **Server Capability:** Express and `better-sqlite3` are already installed in `package.json` for adding backend API/OAuth routes when ready.

### Should You Stay or Switch?
- **Stay on React + Vite (Recommended):** Ideal for an interactive, authenticated member portal (dashboards, interactive checklists, video modules, live progress). Adding a landing page, OAuth login, and persistent storage requires no rewrite.
- **Static HTML (Not Recommended):** Managing logins, protected training modules, and interactive user progress in plain static HTML quickly becomes brittle. Only useful for a completely separate, one-page marketing brochure.
- **Next.js (Optional for Heavy SEO Only):** Only worth migrating if you expand the public-facing site into a large SEO-driven marketing site, public blog, or indexable listing directory. For a private, invite-only agent onboarding portal, Next.js adds unnecessary complexity over Vite + React.

---

## 3. Three Additional Design Styles for Site Variations

1. **Private Bank Editorial (Daytime Luxury)**
   - **Palette:** Warm alabaster/ivory surfaces (`#F8F6F1`), deep obsidian charcoal typography, hairline champagne-gold dividers, and bright architectural imagery.
   - **Feel:** Private wealth management briefing or *Architectural Digest* editorial spread.
2. **Sovereign Institutional (Dark Precision)**
   - **Palette:** Matte graphite/slate-black surfaces, hairline metallic borders, restrained emerald and brushed gold indicators.
   - **Typography:** Replaces soft purple glows and serifs with razor-sharp geometric sans-serif headings and tabular monospace numerals for deals, milestones, and commissions.
   - **Feel:** Exclusive family-office or institutional private equity terminal.
3. **Private Members' Club (Emerald & Antique Brass)**
   - **Palette:** Swaps Welcome Purple for deep heritage emerald (`#0D261C`), warm espresso-black surfaces, brushed antique brass accents, and understated cream typography.
   - **Feel:** Invitation-only executive lounge or legacy luxury brokerage society.
