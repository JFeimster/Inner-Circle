# AGENTS.md — Inner Circle Engineering Guidelines

This repository hosts **Inner Circle** (Moonshine Capital Agent Onboarding & AI Studio).

## Dedicated Infrastructure Boundaries
- **Supabase Project:** `inner-circle` (`thdnmgmojhhhtjlhbwvn`, `us-east-1`, PostgreSQL 17, Free plan).
- **GitHub Repository:** `https://github.com/JFeimster/Inner-Circle`
- **Vercel Deployment:** `https://inner-circle-lac.vercel.app`
- **Strict Isolation Rule:** Do **NOT** connect Inner Circle to, or modify, the separate Moonshine Capital `platform-core` Supabase project.

## Architectural Rules for All Agents & Contributors
1. **Authentication & Identity**
   - Canonical identity is ALWAYS the verified Supabase `auth.users.id` UUID extracted from a validated `Authorization: Bearer <jwt>` token.
   - Never introduce unverified email headers (`x-agent-email`) or unsigned identity cookies.
   - Enforce invitation-based onboarding (`/api/onboarding/redeem`) and server-side RBAC (`member` / `admin`) + `membership_status === 'active'`.
2. **Database & Migrations**
   - Production uses `@supabase/supabase-js` with `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (with `SUPABASE_SERVICE_ROLE_KEY` as documented fallback).
   - Do **not** require `POSTGRES_URL` or `DATABASE_URL` during normal runtime.
   - Never run automatic DDL, schema creation, or seeding on server startup in production. All schema changes live in version-controlled SQL migrations under `/supabase/migrations/`.
   - Local SQLite (`server/db.ts`) is strictly limited to explicit local development and automated tests (`NODE_ENV !== 'production'` and `!process.env.VERCEL`).
3. **AI Studio & Billing Boundaries**
   - Every AI request MUST reserve credits atomically BEFORE calling Gemini, enforce `Idempotency-Key`, enforce per-user rate limits, finalize on success, and automatically refund on failure.
   - Never allow direct browser self-upgrades or credit additions (`POST /api/studio/plan` must remain blocked for members). Plan and top-up changes occur strictly via verified HMAC-signed billing webhooks (`/api/billing/webhook`) or administrator-authorized endpoints.
   - Keep `AI_STUDIO_LIVE_ENABLED=false` and `BILLING_WEBHOOK_SECRET` unset until explicit production activation.
4. **Secrets & Error Hygiene**
   - Never reference `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `BILLING_WEBHOOK_SECRET` in `/src/`.
   - Keep `/api/health` strictly non-mutating and sanitize all server error responses.
5. **Verification Before Merge**
   - Run `npm run lint`, `npm test`, and `npm run build` before committing changes.
