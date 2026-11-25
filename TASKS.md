# TASKS.md — Inner Circle Execution Tracker

## Phase 2: Supabase Integration & Production Hardening (Complete — Ready for Technical Review)
- [x] Inspect existing Express backend, Vercel serverless adapter, database adapter, onboarding flows, and AI credit accounting.
- [x] Integrate Supabase Auth (Email OTP + Magic Link PKCE flow) in browser via `VITE_SUPABASE_URL` & `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [x] Implement `/auth/callback` (SPA + `/api/auth/callback` redirect helper).
- [x] Remove unverified `x-agent-email` headers and unsigned `mc_agent_email` cookies; enforce verified Bearer JWT + canonical user UUID identity.
- [x] Enforce invitation-based onboarding (`POST /api/onboarding/redeem`) with single-use, email-matched, administrator-approved invitations.
- [x] Implement server-side RBAC (`member` / `admin`), active membership checks, and `/api/admin/*` management routes.
- [x] Modernize database layer (`server/db.ts` + `server/config.ts`) to prefer `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (fallback `SUPABASE_SERVICE_ROLE_KEY`), remove `POSTGRES_URL` runtime dependency, remove production auto-DDL/seeding, and fail closed when misconfigured.
- [x] Author version-controlled SQL migrations in `/supabase/migrations/` (not executed remotely).
- [x] Harden AI Studio with atomic credit reservations, `Idempotency-Key` deduplication, per-user rate limiting, automatic refunds on failed generations, and blocked member self-upgrades (`POST /api/studio/plan` -> `403`).
- [x] Establish HMAC-SHA256 verified billing webhook boundary (`POST /api/billing/webhook`, inactive until configured).
- [x] Implement non-mutating `GET /api/health` and sanitized server error responses.
- [x] Add automated security, isolation, RBAC, onboarding, concurrency, refund, rate-limit, and secret-hygiene tests (`tests/security-and-credits.test.ts`).
- [x] Create/update `AGENTS.md`, `TASKS.md`, `PROJECT_STATUS.md`, `.env.example`, and `/docs/{architecture,security,integrations,environment-variables}.md`.

## Pre-Production Activation Checklist (Operator-Executed Only)
- [ ] Apply `/supabase/migrations/20261125000100_init_inner_circle.sql` and `20261125000200_atomic_credits_and_invitations.sql` to `inner-circle` (`thdnmgmojhhhtjlhbwvn`).
- [ ] Configure Supabase Auth Site URL (`https://inner-circle-lac.vercel.app`) and Redirect URLs (`/auth/callback`).
- [ ] Configure Vercel Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`).
- [ ] Bootstrap the initial `admin` user in `public.agent_accounts` after verifying the founding admin's email in Supabase Auth.
- [ ] Trigger Vercel deployment from `https://github.com/JFeimster/Inner-Circle` and verify `GET /api/health`.
- [ ] *(When ready)* Activate live Gemini (`GEMINI_API_KEY` + `AI_STUDIO_LIVE_ENABLED=true`) and live billing (`BILLING_WEBHOOK_SECRET`).

# Phase 3 targeted hardening

- [x] Local implementation: configuration gates, database migration, distributed rate limits, credit lifecycle, admin workspace, tests, and documentation.
- [ ] Review `20261125000300_phase3_hardening.sql` on a local Supabase instance and run `tests/postgres.integration.ts` against loopback PostgreSQL.
- [ ] Review production environment variables and apply the three migrations to the dedicated Inner Circle project only, after explicit authorization.
- [ ] Activate AI and billing only after separate production approval and integration verification.
