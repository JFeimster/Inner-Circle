# PROJECT_STATUS.md — Inner Circle

**Status:** Phase 3 implementation committed; local PostgreSQL verification pending
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
| **Database Layer & Migrations** | Prepared (Unapplied) | 3 SQL migrations prepared in `/supabase/migrations/`. PostgreSQL execution and integration verification remain pending. Zero auto-DDL or auto-seeding in production. |
| **AI Studio & Credit Accounting** | Ready (Live Calls Paused) | Atomic row-locked reservations, `Idempotency-Key`, rate limiting, and auto-refunds verified. `AI_STUDIO_LIVE_ENABLED=false` by default in production. |
| **Billing Integration Boundary** | Ready (Inactive by Policy) | Self-upgrades blocked (`403`). HMAC-SHA256 webhook endpoint ready at `POST /api/billing/webhook`; stays `503` until `BILLING_WEBHOOK_SECRET` is configured. |
| **Automated Verification** | Passing locally | `npm run lint`, `npm test` (10/10 against in-memory SQLite + mocked AI/auth verifier), and `npm run build` pass. PostgreSQL integration remains unrun. |
| **Preview & Pre-Migration Resilience** | Prepared | Vite accepts only configured trusted preview hosts; browser auth requires persistent storage. React `ErrorBoundary` remains in place. |

## Technical Review Notes
- **Concurrency tests (`tests/security-and-credits.test.ts`):** Run against in-memory SQLite (`better-sqlite3` `:memory:`) with `IMMEDIATE` transactions and a mocked `AiGenerator`, not against live remote PostgreSQL (remote migrations remain unapplied by policy).
- **Rate limiting:** The Supabase store uses an atomic PostgreSQL bucket RPC; local SQLite tests use `SlidingWindowRateLimiter`. The PostgreSQL RPC has not yet been exercised against a database.
- **Target Review Branch:** Export/sync source changes to non-production branch `phase-2-supabase-hardening` (do not push directly to `main`).

## Remaining Blockers Before Production Activation
1. Operator must review and run the three SQL migrations in `/supabase/migrations/` on `thdnmgmojhhhtjlhbwvn` after local PostgreSQL checks.
2. Operator must configure Supabase Auth URL settings (Site URL + `/auth/callback` redirect allowlist) and SMTP/email delivery if scaling beyond default Auth email limits.
3. Operator must add environment variables in Vercel Project Settings and bootstrap the founding `admin` row in `public.agent_accounts` (see `docs/security.md` §5).
4. Live Gemini (`AI_STUDIO_LIVE_ENABLED=true` + `GEMINI_API_KEY`) and live billing (`BILLING_WEBHOOK_SECRET`) remain intentionally inactive until operator sign-off.

# Phase 3 review status (2026-11-25)

Targeted production hardening is committed locally on `phase-2-supabase-hardening` at `680083678afcf23a6b4fb4b309a898622490906e`. The migration and PostgreSQL integration suite are review artifacts. On 2026-11-25, no Docker, PostgreSQL binaries/service, Supabase CLI, WSL distribution, or listener on ports 5432/54321/54322 was available. No local or remote migration was run. The shortest supported verification path is an isolated local Supabase stack, which requires Docker and Supabase CLI provisioning. This was not installed because the final verification request requires reporting that need first. `npx tsx --test tests/postgres.integration.ts` reported one skipped test. `npm run lint`, `npm test` (10/10 passed), and `npm run build` passed. No application defect was corrected in this verification pass. No push, merge, deployment, paid service activation, or external infrastructure modification occurred. `AI_STUDIO_LIVE_ENABLED` remains `false` in the environment template and `BILLING_WEBHOOK_SECRET` remains blank.
