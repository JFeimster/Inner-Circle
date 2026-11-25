# Inner Circle — Security Architecture & Controls

## 1. Authentication & Canonical Identity
- **Verified Supabase Auth:** Browser clients authenticate via Supabase Auth PKCE Magic Links or 6-digit Email OTP (`src/lib/supabase.ts`), completing redirects through `/auth/callback`.
- **Bearer JWT Verification:** Every protected API endpoint extracts `Authorization: Bearer <token>` and validates it server-side via `supabase.auth.getUser(token)`. Legacy unverified `x-agent-email` headers and unsigned `mc_agent_email` cookies have been permanently removed.
- **Canonical UUID Identity:** All database relations, credit reservations, billing events, and RBAC checks key off the verified `auth.users.id` UUID—never user-supplied email strings.

## 2. Invitation-Gated Onboarding & RBAC
- **Waitlist Applications:** Public submissions to `POST /api/invitations` are rate-limited by IP and always created in `status = 'pending'`.
- **Single-Use Approved Redemption:** `POST /api/onboarding/redeem` requires a verified JWT and atomically checks that the invitation is `approved`, unexpired, unused, and addressed to the exact verified email before creating `agent_accounts`.
- **Server-Side Role & Status Enforcement:** Every AI Studio route enforces `membership_status = 'active'`; every `/api/admin/*` route enforces `role = 'admin'`. Suspended or revoked accounts are blocked immediately with `403 Forbidden`.

## 3. Database & Row Level Security (RLS)
- RLS is enabled across `agent_accounts`, `invitations`, `usage_ledger`, and `billing_events`.
- Direct browser mutations (`INSERT`, `UPDATE`, `DELETE`) are revoked for `anon` and `authenticated` roles across all tables; authenticated clients may only `SELECT` their own `agent_accounts` and `usage_ledger` rows.
- All 5 atomic PostgreSQL RPCs (`reserve_studio_credits`, `finalize_studio_reservation`, `refund_studio_reservation`, `redeem_invitation_for_user`, `apply_verified_billing_event`) are `SECURITY DEFINER` with `SET search_path = ''` and fully schema-qualified `public.*` references (preventing `pg_temp` object shadowing). Execution is explicitly revoked from `PUBLIC`, `anon`, and `authenticated` and granted strictly to `service_role`. The `public.set_updated_at()` trigger function also pins `SET search_path = ''`.
- No automatic DDL or seeding occurs in production; schema changes occur only via reviewed SQL migrations in `/supabase/migrations/`.

## 4. AI Credit Integrity, Rate Limiting & Billing Protection
- **Atomic Reservations:** Row-level locks (`FOR UPDATE` in PostgreSQL RPCs / `IMMEDIATE` transactions in local SQLite dev/test) prevent concurrent requests from overspending daily or monthly allowances.
- **Idempotency & Rate Limiting:** Every AI request carries an `Idempotency-Key` enforced by `UNIQUE (user_id, idempotency_key)` in the database, plus per-user/per-IP sliding-window rate limits (`server/rateLimit.ts`). Note: `SlidingWindowRateLimiter` is currently **in-memory per server instance** (not persistent or distributed across serverless cold starts or multiple Vercel instances); database-enforced daily/monthly caps and `Idempotency-Key` uniqueness remain globally authoritative, and distributed Redis/Upstash rate limiting is recommended before high-concurrency launch.
- **Automatic Refunds:** Any upstream generation error, timeout, or disabled live-AI state automatically transitions the reservation from `reserved` to `refunded`.
- **Verified Billing Boundary:** Member self-upgrades (`POST /api/studio/plan`) return `403 Forbidden`. Plan and credit changes require either an HMAC-SHA256 timestamped signature (`x-billing-signature`, 5-minute replay window + `event_id` deduplication) on `POST /api/billing/webhook` or an authenticated `admin` calling `/api/admin/accounts/:userId/billing`.

## 5. Founding Administrator Bootstrap Procedure
Because production disables auto-seeding and restricts `/api/admin/*` to existing `role = 'admin'` accounts, the initial founding administrator must be provisioned out-of-band after migrations are applied:
1. Apply the two SQL migrations in `/supabase/migrations/` to `inner-circle` (`thdnmgmojhhhtjlhbwvn`).
2. Create or verify the founding administrator's identity in **Supabase Auth** (either via Supabase Dashboard -> Authentication -> Users -> Invite/Create User with verified email, or by signing in once through Email OTP so Supabase generates the canonical `auth.users.id` UUID).
3. Copy the verified `auth.users.id` UUID and run a single audited SQL statement in the Supabase SQL Editor (never committed to Git):
   ```sql
   INSERT INTO public.agent_accounts (
     user_id, email, name, role, membership_status, plan_id, bonus_credits
   )
   VALUES (
     '<VERIFIED_AUTH_USER_UUID>',
     '<FOUNDING_ADMIN_EMAIL>',
     '<FOUNDING_ADMIN_NAME>',
     'admin',
     'active',
     'inner_circle',
     0
   )
   ON CONFLICT (user_id) DO UPDATE
     SET role = 'admin', membership_status = 'active';
   ```
4. Verify admin sign-in via Email OTP and confirm `GET /api/admin/invitations` returns `200 OK`. All subsequent admins and members are onboarded through the normal invitation approval and redemption workflow.

## 6. Credential Hygiene & Operational Safety
- Privileged secrets (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `BILLING_WEBHOOK_SECRET`) are strictly server-side (`process.env`) and verified absent from `/src/` by automated test #7.
- `GET /api/health` is strictly non-mutating and returns sanitized errors (`503`) with zero stack traces, SQL details, or secret names when configuration is incomplete or migrations have not yet been applied.
- All `/api/*` responses include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Cache-Control: no-store`.
