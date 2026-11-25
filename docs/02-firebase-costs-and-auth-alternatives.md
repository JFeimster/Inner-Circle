# 02 — Firebase Costs, Pass-Through Details & Auth Alternatives

## 1. Firebase Authentication + Cloud Firestore: Costs, Pass-Through & Key Details

### Expected Costs
Firebase operates on two plans:
- **Spark Plan (Free):** No credit card required; enforces strict daily/monthly quotas and pauses operations until reset if exceeded.
- **Blaze Plan (Pay-as-you-go):** Requires a Google Cloud billing account, includes the **exact same free tier quotas first**, and bills only for overages.

#### Firebase Authentication Pricing
- **Email/Password & Social OAuth (Google, Microsoft, GitHub, etc.):** **Free up to 50,000 Monthly Active Users (MAUs)** per project. Above 50K MAUs, pricing starts around ~$0.0055/MAU (and scales down at higher volume).
- **SMS / Phone Sign-In:** **Never free.** Requires the Blaze plan and incurs per-SMS carrier fees (e.g., ~$0.01/SMS in the US, higher internationally).
- **Enterprise SAML / OIDC SSO:** Free for the first **50 MAUs**, then ~$0.015/MAU.

#### Cloud Firestore Pricing (1 Free Database per Project)
- **Stored Data:** 1 GiB free (~$0.18/GiB/month beyond free tier)
- **Document Reads:** 50,000/day free (~$0.06 per 100K reads beyond free tier)
- **Document Writes:** 20,000/day free (~$0.18 per 100K writes beyond free tier)
- **Document Deletes:** 20,000/day free
- **Network Egress:** 10 GiB/month free

#### Realistic Estimate for Moonshine Capital
For an onboarding portal serving hundreds or even several thousand agents checking off roadmap tasks, reading resources, and submitting swag orders, your monthly Firebase Auth + Firestore bill will typically remain **$0/month**.

### Can You Add Expenses as a Pass-Through Expense (e.g., Users Using Their Own Credits)?
- **No direct infrastructure pass-through:** Firebase and Firestore usage is billed strictly to **your** Google Cloud/Firebase project. End users cannot attach personal Google credits to pay for their login or database operations.
- **Business-level pass-through:** To offset platform costs, bundle them into agent dues, brokerage seat fees, or an onboarding fee collected via **Stripe**. *(Bring-Your-Own-Key / BYOK pass-through models only apply to third-party API calls like AI LLMs, not shared application databases.)*

### Do You Have to Use a Gemini API Key?
- **No.** Firebase Authentication and Cloud Firestore are completely independent of the Gemini API. Because this portal does not currently call any AI models, **no Gemini API key is required** and you incur zero AI costs unless you later add AI features.

### Other Key Details to Know
- **Video Hosting:** Do **not** store training videos in Firestore (1 MB document limit). Host videos on Vimeo, Mux, Wistia, Cloudflare Stream, or unlisted YouTube and store only URLs, metadata, and completion flags in Firestore.
- **Security Rules (`firestore.rules`):** Essential because Firestore is queried from the browser; rules enforce that agents can only access their own records while admins manage global content.
- **Budget Alerts:** On the Blaze plan, configure a low Google Cloud budget alert (e.g., $10/month) to guard against accidental runaway reads.

---

## 2. Complete List of Alternatives to Firebase Authentication

### A. Managed Auth-as-a-Service (Drop-in UI, OAuth, MFA & Enterprise SSO)
- **Clerk** — Polished React components, built-in Organizations/RBAC, OAuth, passkeys (free up to 10K MAUs).
- **Auth0 (by Okta)** — Enterprise standard with extensive OAuth/SAML/SSO and customizable auth pipelines.
- **WorkOS (AuthKit)** — Purpose-built for B2B apps needing Enterprise SSO (SAML/OIDC) and Directory Sync.
- **AWS Cognito** — Low cost at large scale and native to AWS, though steeper UI/DX setup.
- **Stytch** — Passwordless-first (magic links, passkeys, OTP, OAuth, B2B organizations).
- **Kinde** — Modern auth combined with roles, feature flags, and optional SaaS billing.
- **Frontegg** — B2B SaaS user management with self-serve tenant admin portals and RBAC.
- **Descope** — Drag-and-drop visual authentication workflow builder with passkeys.
- **FusionAuth** — Cloud-hosted or self-hosted with predictable flat-tier pricing.

### B. All-in-One Backend-as-a-Service (Auth + Database Together)
- **Supabase Auth** — Open-source auth tightly paired with **PostgreSQL** and Row-Level Security (best SQL alternative to Firebase).
- **Appwrite** — Open-source BaaS (Auth, Database, Storage); cloud or self-hosted.
- **Convex Auth** — Built into the Convex real-time TypeScript backend.
- **PocketBase** — Lightweight single-binary open-source backend with SQLite + built-in OAuth/email auth.

### C. Open-Source / Self-Hosted Identity Providers (Full Data Ownership)
- **Keycloak** — Enterprise IAM supporting OAuth2, OIDC, SAML, LDAP, and social logins.
- **Authentik** — Modern, user-friendly self-hosted identity provider.
- **SuperTokens** — Open-source auth framework with pre-built React UI and Express SDK.
- **Logto** — Open-source Auth0 alternative with OIDC/OAuth2 and multi-tenancy.
- **Ory (Kratos & Hydra)** — Modular, headless, cloud-native open-source identity stack.
- **ZITADEL** — Open-source multi-tenant identity infrastructure with audit trails.

### D. Code Libraries / Roll-Your-Own Auth (Directly in Express + SQLite/Postgres)
- **Better Auth** — Modern TypeScript auth library for React/Express supporting OAuth, 2FA, magic links, and organizations.
- **Auth.js (formerly NextAuth.js)** — Supports Express/Node adapters with dozens of OAuth providers.
- **Passport.js** — Classic Express auth middleware with 500+ strategies.
- **Lucia** — Lightweight database session auth patterns.
- **Custom Session/JWT + Argon2/bcrypt** — Full control and zero per-user fees, with full responsibility for security maintenance.

### E. Enterprise Corporate Directories & Specialty Options
- **Microsoft Entra ID / External ID (Azure AD), Okta Workforce, Google Cloud Identity Platform, Ping Identity, OneLogin**
- **Magic.link** or native **WebAuthn Passkeys**
- **Invite-Code / Access-Key Gate** (lightweight non-account gating for basic exclusivity)
