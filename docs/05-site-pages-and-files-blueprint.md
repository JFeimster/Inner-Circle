# 05 — Complete Blueprint of Additional Pages & Supporting Files

## 1. Public & Authentication Pages (`src/pages/*.tsx`)
- **Universal Landing Page (`LandingPage.tsx` — `/`):** Brand showcase, network value proposition, curated success highlights, and **Member Sign In** / **Apply** CTAs for signed-out visitors.
- **OAuth & Member Login (`LoginPage.tsx` — `/login`):** Google/LinkedIn/Email sign-in screen and invite-code entry.
- **Agent Application (`ApplyPage.tsx` — `/apply`):** Prospective agent intake form syncing to HubSpot/Notion.
- **Pending Approval (`PendingPage.tsx` — `/pending`):** Holding view while an admin verifies membership.
- **Error Pages (`NotFoundPage.tsx`, `UnauthorizedPage.tsx`):** Branded 404 and access-denied screens.

---

## 2. Authenticated Member Portal Pages (`src/pages/portal/*.tsx`)
*(Existing `Dashboard`, `30-Day Roadmap`, and `Resource Vault` views in `src/App.tsx` can also be split into dedicated route files here.)*
- **Connected Stack / Integrations Hub (`IntegrationsPage.tsx` — `/integrations`):** Week 1 setup center for Google Workspace, HubSpot, Slack/Discord, Canva, LinkedIn, Meta, and Stripe Connect.
- **Marketing Vault & Launch Kit (`MarketingPage.tsx` — `/marketing`):** Full Brand Kit downloads, Canva launchers, social publishing, and Mailchimp kit.
- **Mentor & Event Calendar Hub (`MentorsPage.tsx` — `/mentors`):** Mentor matching quiz, assigned partner profile, Google Calendar booking, and network event calendar.
- **Community & Directory (`CommunityPage.tsx` — `/community`):** Elite agent directory, introduction board, Slack/Discord role sync, and full Network Success feed.
- **Swag Kit Store (`SwagPage.tsx` — `/swag`):** Sizing, shipping form, milestone-gated swag tiers, and Printful/Shopify order tracking.
- **Compliance & Payouts (`PayoutsPage.tsx` — `/payouts`):** DocuSign/Dropbox Sign checklist (ICA, NDA, W-9), Stripe Connect onboarding, and commission history.
- **Agent Profile & Settings (`ProfilePage.tsx`, `SettingsPage.tsx`):** Bio, headshot upload, notification preferences, and connected accounts.
- **Support Concierge (`SupportPage.tsx` — `/support`):** FAQs, onboarding concierge ticket form, and escalation contacts.

---

## 3. Admin & Operations Pages (`src/pages/admin/*.tsx`)
- **Admin Dashboard (`AdminOverviewPage.tsx` — `/admin`):** Cohort onboarding completion rates, stalled agents, and milestone metrics.
- **Agent & Invite Manager (`AdminAgentsPage.tsx` — `/admin/agents`):** Approve applicants, assign mentors, issue invite links, and manage roles (`agent` vs. `admin`).
- **Content & Sync Manager (`AdminContentPage.tsx` — `/admin/content`):** Manage Roadmap tasks, Vimeo modules, and Marketing Vault assets (or trigger Notion sync).

---

## 4. Legal & OAuth Verification Pages (`.tsx` + `.md`)
*(Required by Google, Meta, LinkedIn, and HubSpot before approving public OAuth consent screens.)*
- **Privacy Policy** (`/privacy` — `content/legal/privacy.md`)
- **Terms of Service** (`/terms` — `content/legal/terms.md`)
- **Brokerage / Financial Compliance Disclosures** (`/compliance` — `content/legal/compliance.md`)
- **User Data Deletion Instructions** (`/data-deletion` — `content/legal/data-deletion.md`, explicitly required by Meta OAuth)

---

## 5. Supporting Code, Config, Docs & Assets (By File Type)

### TypeScript (`.ts` / `.tsx`)
- `server.ts` — Express backend entry point for OAuth callbacks, session cookies, and webhooks.
- `src/routes/auth.ts` & `src/routes/webhooks.ts` — Self-serve OAuth endpoints and incoming webhooks (HubSpot, Stripe, DocuSign, Printful).
- `src/services/*.ts` — Modular API clients (`google.ts`, `hubspot.ts`, `slack.ts`, `notion.ts`, `stripe.ts`, `vimeo.ts`).
- `src/context/AuthContext.tsx` — Global authentication state and protected route wrapper.

### Markdown (`.md`)
- `README.md` — Project overview, local setup, and environment variable documentation.
- `docs/01-*.md` through `docs/05-*.md` — Ordered architecture, pricing, OAuth, workflow, and site-expansion blueprints.
- `CHANGELOG.md` — Version history across Phases 1–3.

### YAML (`.yaml` / `.yml`)
- `config/integrations.yaml` — Declarative catalog of selected OAuth providers, scopes, phases, and feature flags.
- `.github/workflows/ci.yml` — Automated lint, TypeScript check, and build verification on push.
- `docs/openapi.yaml` — OpenAPI specification for backend `/api/*` endpoints and webhook payloads (useful for Make/Zapier).
- `cloudbuild.yaml` or `docker-compose.yml` — Automated CI/CD or container deployment config.

### HTML, JSON & SEO Assets (`.html`, `.json`, `.txt`, `.xml`)
- `index.html` — Moonshine Capital `<title>`, meta description, OpenGraph share tags (`og:title`, `og:description`), and custom favicon.
- `public/robots.txt` — Allows indexing of public pages (`/`, `/apply`) while blocking `/dashboard`, `/admin`, and `/api`.
- `public/sitemap.xml` — Lists only public marketing and legal URLs.
- `public/manifest.json` — Web App Manifest for installable mobile PWA access.

### Database & Security Files (`.rules` or `.sql`)
- `firestore.rules` & `firestore.indexes.json` *(if using Firebase/Firestore)*
- **Or** `src/db/schema.ts` + `migrations/*.sql` *(if using PostgreSQL or SQLite)*

### Note on `.cs` (C#)
- **Skip `.cs` files:** This application runs on **TypeScript + React + Node.js**. Keeping frontend, backend, and automation scripts in TypeScript avoids maintaining a second server runtime.
