# PROJECT_STATUS.md — Inner Circle

**Status:** Phase 2 Hardening Complete — Ready for Technical Review (Pre-Activation)  
**Last Updated:** 2026-11-25  

## Infrastructure Reference
- **Supabase Project:** `inner-circle` (`thdnmgmojhhhtjlhbwvn`, `us-east-1`, PostgreSQL 17, Free plan)
- **Supabase URL:** `https://thdnmgmojhhhtjlhbwvn.supabase.co`
- **GitHub Repository:** `https://github.com/JFeimster/Inner-Circle`
- **Vercel URL:** `https://inner-circle-lac.vercel.app`
- **Platform Core Isolation:** Confirmed completely isolated from Moonshine Capital `platform-core`.

## Subsystem Readiness
| Subsystem | State | Notes |
| :--- | :--- | :--- |
| **Supabase Auth (Email OTP / Magic Link)** | Ready (Code Complete) | Browser PKCE client + `/auth/callback` + server Bearer JWT verification. Pending Vercel env vars & Supabase redirect URL config. |
| **Invitation-Based Onboarding & RBAC** | Ready (Verified via Tests) | Pending -> Approved -> Redeemed single-use lifecycle bound to canonical user UUID and verified email. |
| **Database Layer & Migrations** | Ready (Unapplied by Policy) | 2 SQL migrations prepared in `/supabase/migrations/`. Zero auto-DDL or auto-seeding in production. |
| **AI Studio & Credit Accounting** | Ready (Live Calls Paused) | Atomic row-locked reservations, `Idempotency-Key`, rate limiting, and auto-refunds verified. `AI_STUDIO_LIVE_ENABLED=false` by default in production. |
| **Billing Integration Boundary** | Ready (Inactive by Policy) | Self-upgrades blocked (`403`). HMAC-SHA256 webhook endpoint ready at `POST /api/billing/webhook`; stays `503` until `BILLING_WEBHOOK_SECRET` is configured. |
| **Automated Verification** | Passing | `npm run lint`, `npm test` (7/7 against in-memory SQLite + mocked AI/auth verifier), and `npm run build` all pass cleanly. |
| **Preview & Pre-Migration Resilience** | Fixed | Added `server.allowedHosts: true` in `vite.config.ts` / `server.ts` (resolving Vite 6 `403` host block in preview), React `ErrorBoundary`, and iframe-safe Supabase browser storage fallback. |

## Technical Review Notes
- **Concurrency tests (`tests/security-and-credits.test.ts`):** Run against in-memory SQLite (`better-sqlite3` `:memory:`) with `IMMEDIATE` transactions and a mocked `AiGenerator`, not against live remote PostgreSQL (remote migrations remain unapplied by policy).
- **Rate limiting (`server/rateLimit.ts`):** In-memory per server instance (`SlidingWindowRateLimiter`); not distributed across Vercel serverless cold starts/instances. Database credit caps and `Idempotency-Key` uniqueness remain globally enforced in Postgres.
- **Target Review Branch:** Export/sync source changes to non-production branch `phase-2-supabase-hardening` (do not push directly to `main`).

## Remaining Blockers Before Production Activation
1. Operator must run the two SQL migrations in `/supabase/migrations/` on `thdnmgmojhhhtjlhbwvn` (and optionally run a staging concurrency check against real Postgres `FOR UPDATE` RPCs).
2. Operator must configure Supabase Auth URL settings (Site URL + `/auth/callback` redirect allowlist) and SMTP/email delivery if scaling beyond default Auth email limits.
3. Operator must add environment variables in Vercel Project Settings and bootstrap the founding `admin` row in `public.agent_accounts` (see `docs/security.md` §5).
4. Live Gemini (`AI_STUDIO_LIVE_ENABLED=true` + `GEMINI_API_KEY`) and live billing (`BILLING_WEBHOOK_SECRET`) remain intentionally inactive until operator sign-off.
