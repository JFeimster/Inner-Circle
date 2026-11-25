# Inner Circle — Environment Variables & Dashboard Settings

## Required Production Environment Variables (Vercel)

Set these in **Vercel → Project (`inner-circle`) → Settings → Environment Variables** (Production & Preview as needed):

| Variable | Scope | Required | Description / Value Guidance |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Browser (Public) | **Yes** | `https://thdnmgmojhhhtjlhbwvn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser (Public) | **Yes** | Your `inner-circle` publishable key (`sb_publishable_...`) from Supabase Project Settings → API Keys. |
| `SUPABASE_URL` | Server Only | **Yes** | `https://thdnmgmojhhhtjlhbwvn.supabase.co` |
| `SUPABASE_SECRET_KEY` | Server Only | **Yes (Preferred)** | Modern Supabase secret key (`sb_secret_...`) from Supabase Project Settings → API Keys. **Never prefix with `VITE_`.** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Optional Fallback | Legacy compatibility fallback used only if `SUPABASE_SECRET_KEY` is omitted. |
| `APP_URL` | Server Only | Recommended | `https://inner-circle-lac.vercel.app` |
| `GEMINI_API_KEY` | Server Only | Activation Phase | Billing-enabled Gemini API key. Leave unset until activating live AI Studio. |
| `AI_STUDIO_LIVE_ENABLED` | Server Only | Activation Phase | Set to `false` for pre-launch review; set to `true` only when ready to enable live Gemini calls. |
| `BILLING_WEBHOOK_SECRET` | Server Only | Activation Phase | Shared HMAC-SHA256 secret for `POST /api/billing/webhook`. Leave unset until activating live billing. |

> **Not Required:** `POSTGRES_URL` and `DATABASE_URL` are **not** required for normal Inner Circle runtime operation.

### Phase 3 configuration gates

- `SUPABASE_URL` and `VITE_SUPABASE_URL` must both be exactly `https://thdnmgmojhhhtjlhbwvn.supabase.co`. The server rejects any other project URL; the browser declines to initialize auth for one.
- `SUPABASE_SECRET_KEY` is preferred. `SUPABASE_SERVICE_ROLE_KEY` is a legacy fallback when the preferred key is unset. Both remain server only.
- `ALLOW_LOCAL_SQLITE=true` is required for local SQLite and is ignored in production and Vercel. Production does not need PostgreSQL connection strings.
- `AI_STUDIO_LIVE_ENABLED=true` and `GEMINI_API_KEY` are both required for generation in every environment. Keep the flag `false` and key unset for review. Optional `GEMINI_CHAT_MODEL`, `GEMINI_IMAGE_MODEL`, and `GEMINI_FILE_MODEL` override the identifiers in `.env.example`.
- `VITE_ALLOWED_HOSTS` lists exact trusted Vite development or AI Studio preview hostnames, separated by commas. Leave blank for Vite's normal localhost handling.
- Keep `BILLING_WEBHOOK_SECRET` unset during review. No live payment processor is implemented.

Install reproducibly with `npx --yes bun@1.4.5 install --frozen-lockfile`; `bun.lock` is the only dependency lockfile.

## Local Development Only Variables
| Variable | Default | Notes |
| :--- | :--- | :--- |
| `ALLOW_LOCAL_SQLITE` | `true` (non-prod only) | Ignored and hard-blocked whenever `NODE_ENV=production` or `VERCEL=1`. |
| `LOCAL_SQLITE_PATH` | `data/inner-circle-local.db` | Local SQLite database path used only in local dev/testing. |

## Required Supabase Dashboard Settings (`thdnmgmojhhhtjlhbwvn`)
1. **Authentication → URL Configuration:**
   - **Site URL:** `https://inner-circle-lac.vercel.app`
   - **Redirect URLs (Allowlist):**
     - `https://inner-circle-lac.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback` *(for local development)*
     - *(Optional)* `https://*.vercel.app/auth/callback` if testing Vercel preview branches
2. **Authentication → Providers → Email:**
   - Enable **Email** provider.
   - Enable **Email OTP / Magic Link** sign-in.
   - Confirm Email template includes both the Magic Link (`{{ .ConfirmationURL }}`) and the 6-digit OTP (`{{ .Token }}`).
3. **Authentication → Sign Up / Access Controls:**
   - Keep email confirmation enabled so `auth.users.email` is always verified before JWT issuance.
   - *(Note: Even if a user verifies an email in Supabase Auth, Inner Circle's server blocks portal and AI access until an administrator approves and the user redeems an invitation code.)*
4. **API Keys:**
   - Copy the `sb_publishable_...` key -> Vercel `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - Copy the `sb_secret_...` key -> Vercel `SUPABASE_SECRET_KEY` (Server-only; never commit to Git).
