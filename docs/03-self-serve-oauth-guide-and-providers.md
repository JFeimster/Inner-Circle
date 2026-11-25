# 03 — Self-Serve OAuth 2.0 Setup Guide & Provider Catalog

## 1. How to Use "Enable OAuth Manually: Self-Serve Authentication"

Self-serve (manual) OAuth means you register your own OAuth 2.0 app directly with an external provider and run the authorization handshake through your Express backend—without relying on a third-party auth broker.

### Step-by-Step Implementation Pattern
1. **Register an OAuth 2.0 App at the Provider:**
   Create a new OAuth application in the provider's developer console to obtain a **Client ID** and **Client Secret**.
2. **Add Exact Authorized Callback / Redirect URIs:**
   Register your exact environment callback endpoints (never use `localhost` for deployed/preview containers):
   - **Development Callback:** `https://ais-dev-g4iyhhj5beqjw3urn4qxbq-35146424509.us-west1.run.app/auth/callback`
   - **Shared / Deployed Callback:** `https://ais-pre-g4iyhhj5beqjw3urn4qxbq-35146424509.us-west1.run.app/auth/callback`
3. **Store Credentials as Server-Side Secrets:**
   Save `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in environment secrets—never expose client secrets in frontend React code.
4. **Use a Popup + Backend Handshake (Required for Iframe Compatibility):**
   - **Server (`GET /api/auth/url`):** Builds and returns the provider's direct authorization URL using `APP_URL` for the redirect URI.
   - **Client (`window.open`):** Opens the **provider's URL directly** in a popup window (avoid full-page redirects or opening local routes inside the popup).
   - **Server Callback (`GET /auth/callback` and `/auth/callback/`):** Exchanges the authorization `code` for tokens, sets a session cookie with `httpOnly: true`, `secure: true`, and `sameSite: 'none'`, and returns a minimal HTML page calling `window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*')` before closing the popup.
   - **Session Verification (`GET /api/auth/me`):** React checks this endpoint on load to toggle between the public landing page and the authenticated agent dashboard.

---

## 2. Self-Serve OAuth 2.0 Provider Catalog

### Primary Member Login Providers
- **Google** *(Google Cloud Console)* — Universal personal & Google Workspace accounts.
- **Microsoft / Entra ID** *(Azure Portal)* — Ideal for Outlook / Microsoft 365 brokerage emails.
- **LinkedIn** *(LinkedIn Developer Portal)* — Strong fit for real estate & capital professionals.
- **Apple** *(Apple Developer Portal — Sign in with Apple)*.
- **Okta / Custom OIDC** — Connects directly to an existing corporate identity provider.

---

### Community, CRM & Tool Integrations — Mapped to Current Portal Modules

#### 1. CRM & Pipeline *(Milestones: First Lead / First Deal, CRM Training, Week 3 Outreach)*
- **HubSpot** — Syncs leads, tracks deal stages to auto-complete milestones, and links Week 3 email sequences.
- **Salesforce** — Enterprise brokerage pipeline and luxury deal tracking.
- **GoHighLevel (HighLevel)** — Real estate pipelines, SMS/email follow-up sequences, and lead routing.
- **Pipedrive / Zoho CRM** — Lightweight deal-stage and outreach tracking.
- **Follow Up Boss** — Real estate lead routing and call-tracking verification.

#### 2. Community & Network Proof *(Community Portal, Quick Wins, Network Success Feed)*
- **Slack** — Verifies "Join Community" quick-win, posts `#introductions`, and pulls `#wins` into the Social Proof Feed.
- **Discord** — Assigns verified "Elite Agent" roles and unlocks private tier channels automatically.
- **Circle** — Private elite community directory, courses, and live events with OAuth/SSO.

#### 3. Mentor Matching, Walkthroughs & Events *(Mentor Match, Event Calendar, Weeks 2–4)*
- **Google Calendar** / **Microsoft Outlook & Teams** — Syncs Event Calendar, property walkthroughs, and 1-on-1 mentor meetings.
- **Calendly** — One-click mentor session booking with automatic roadmap completion.
- **Zoom** — Auto-generates meeting rooms for mentor calls, discovery calls, and group workshops.

#### 4. Marketing Vault & Brand Assets *(Brand Identity Kit, Templates, Presentation Decks)*
- **Canva (Canva Connect API)** — Launches pre-branded Moonshine templates pre-filled with the agent's details.
- **Google Drive / Dropbox** — Copies Brand Identity Kits, listing packets, and local market reports into the agent's workspace.
- **LinkedIn & Meta (Instagram / Facebook)** — Publishes approved launch announcements and listing graphics directly.

---

### Self-Serve OAuth Options for Future Workflows

#### 5. Agent Onboarding Paperwork & Deal Closing *(ICA, NDA, Escrow)*
- **DocuSign** — Automates Week 1 onboarding agreements (ICA, NDA, W-9) and verifies executed deal contracts.
- **Dropbox Sign / PandaDoc** — Streamlined e-signatures and branded client proposals.

#### 6. Commissions, Payouts & Dues *(Milestone: First Commission)*
- **Stripe Connect** — Handles commission payouts, referral bonuses, or dues and unlocks the **First Commission** milestone.
- **QuickBooks Online / Xero** — Brokerage accounting and commission statements.

#### 7. Automated Swag Kit Fulfillment *(Claim Your Swag Kit)*
- **Printful / Shopify** — Automates branded Moonshine apparel orders and welcome box shipping with live tracking.

#### 8. Gated Video Training & Operations CMS *(Resource Vault & 30-Day Roadmap)*
- **Vimeo** — Hosts private, domain-restricted training videos with watch-completion tracking.
- **Notion / Airtable** — Lets ops teams update active listings, roadmap steps, and training links without code deploys.

#### 9. Outreach & Email Marketing *(Week 3 Outreach & Follow-Up Sequences)*
- **Gmail / Microsoft Graph Mail** — Pre-loads approved outreach templates and tracks outreach progress.
- **Mailchimp / ActiveCampaign** — Syncs agent spheres of influence into co-branded luxury newsletters.
