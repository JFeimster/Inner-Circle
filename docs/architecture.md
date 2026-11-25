# Inner Circle — System Architecture

## Overview
Inner Circle is a React 19 + Vite 6 + Tailwind CSS v4 single-page application paired with a hardened Express API (`server/app.ts`) deployed as a Vercel Serverless Function (`api/index.ts`) and backed by a dedicated Supabase project (`inner-circle`, ref `thdnmgmojhhhtjlhbwvn`).

```text
Browser (React SPA + Supabase PKCE Client)
  ├─ VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
  │    └─ Supabase Auth (Email OTP & Magic Link -> /auth/callback)
  └─ HTTPS + Authorization: Bearer <Supabase JWT> + Idempotency-Key
       └─ Vercel Serverless (/api/index.ts -> server/app.ts)
            ├─ server/auth.ts       (Supabase JWT verification + HMAC billing webhook check)
            ├─ server/rateLimit.ts  (Per-user & per-IP sliding-window rate limiter)
            ├─ server/db.ts         (Supabase REST/RPC Store via SUPABASE_SECRET_KEY)
            │    └─ LocalSqliteStore (Explicit local dev/test only — blocked in prod/Vercel)
            └─ Gemini Server Client (Guarded by AI_STUDIO_LIVE_ENABLED + atomic credit reserve/refund)
```

## Canonical Data Model (`/supabase/migrations/`)
1. **`public.agent_accounts`** — Keyed by `user_id UUID PRIMARY KEY REFERENCES auth.users(id)`. Stores `email`, `name`, `role` (`member` | `admin`), `membership_status` (`active` | `suspended` | `revoked`), `plan_id`, `bonus_credits`, and `invited_by_code`.
2. **`public.invitations`** — Stores waitlist & invitation applications (`pending` -> `approved` -> `redeemed` / `revoked` / `expired`), target email, assigned role, expiration, approver UUID, and redeemer UUID.
3. **`public.usage_ledger`** — Records every AI studio request with `user_id`, `action_type`, `credits_used`, `status` (`reserved` | `committed` | `refunded`), `UNIQUE (user_id, idempotency_key)`, `month_key`, `day_key`, and `refund_reason`.
4. **`public.billing_events`** — Append-only audit table keyed by unique `event_id` preventing webhook replay and double-crediting.

## Atomic Database RPC Layer (`20261125000200_atomic_credits_and_invitations.sql`)
All critical state transitions execute inside PostgreSQL `SECURITY DEFINER` transactions with `FOR UPDATE` row locking and execution restricted strictly to `service_role`:
- `reserve_studio_credits(...)`: Serializes concurrent requests per user, checks membership status, checks idempotency key, verifies monthly + daily caps, and inserts a `'reserved'` ledger row.
- `finalize_studio_reservation(...)`: Commits a reserved entry after successful generation.
- `refund_studio_reservation(...)`: Marks a reserved entry `'refunded'` so failed AI calls never consume credits.
- `redeem_invitation_for_user(...)`: Atomically verifies an approved, unexpired, email-matched invitation, provisions `agent_accounts`, and marks the invitation `redeemed`.
- `apply_verified_billing_event(...)`: Idempotently applies verified plan upgrades or credit top-ups.

## Runtime Modes
- **Production / Vercel (`NODE_ENV=production` or `VERCEL=1`):** Requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`). Fails closed with HTTP `503` if incomplete. Never runs automatic DDL or seeding. Does not require `POSTGRES_URL` or `DATABASE_URL`.
- **Local Development / Test:** Uses `SupabaseStore` if dedicated Inner Circle credentials are provided, or uses `LocalSqliteStore` only with `ALLOW_LOCAL_SQLITE=true` outside production and Vercel.

# Phase 3 production boundary

The dedicated `inner-circle` Supabase project (`thdnmgmojhhhtjlhbwvn`) owns authentication, RLS, server-side RPC credit accounting, and rate-limit buckets. API requests verify the Supabase user UUID and active membership before protected reads or writes. Browser reads of `agent_accounts` and `usage_ledger` are permitted only for the active account itself. The admin workspace is a thin client over the existing role-protected API. Purchased pack balance persists across monthly plan resets and is deducted only after monthly plan credits are exhausted. The reviewed Phase 3 migration adds conditional reservation finalization, expiry reconciliation, replay-safe billing writes, and a database guard for the last active administrator.
