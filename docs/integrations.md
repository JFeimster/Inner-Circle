# Inner Circle — Integrations & External Boundaries

## Active & Configured Integrations

### 1. Supabase (Dedicated `inner-circle` Project)
- **Project Reference:** `thdnmgmojhhhtjlhbwvn` (`us-east-1`, PostgreSQL 17, Free plan)
- **URL:** `https://thdnmgmojhhhtjlhbwvn.supabase.co`
- **Role:** Primary Authentication (Email OTP & Magic Link PKCE), PostgreSQL relational data store, Row Level Security, and atomic RPC credit accounting.
- **Browser Client:** Uses `@supabase/supabase-js` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Server Client:** Uses `@supabase/supabase-js` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (fallback: `SUPABASE_SERVICE_ROLE_KEY`). Does **not** require `POSTGRES_URL` or `DATABASE_URL`.
- **Isolation Policy:** Strictly isolated from the separate Moonshine Capital `platform-core` Supabase project.

### 2. Vercel (Hosting & Serverless API)
- **Production URL:** `https://inner-circle-lac.vercel.app`
- **GitHub Repo:** `https://github.com/JFeimster/Inner-Circle`
- **Routing (`vercel.json`):** Static Vite SPA built to `dist/`, `/api/*` routed to `/api/index.ts` (`maxDuration: 60`), and SPA fallback routing `/auth/callback` cleanly to `index.html`.

### 3. Gemini AI Studio (Server-Side — Gated Until Activation)
- **SDK:** `@google/genai` (server-side only in `server/app.ts`)
- **Models:** `gemini-4-hydrogen` (Concierge Chat & Downloadable File Creator), `gemini-3.1-flash-lite-image` (Brand Image Studio).
- **Activation Gate:** Controlled by `AI_STUDIO_LIVE_ENABLED=true` + `GEMINI_API_KEY`. Kept **off by default** in production until operator activation so no accidental paid Gemini calls occur.

### 4. Billing Webhook Integration Boundary (Inactive Until Activation)
- **Endpoint:** `POST /api/billing/webhook`
- **Verification:** Timestamped HMAC-SHA256 signature in `x-billing-signature` (`t=<unix_sec>,v1=<hex_hmac>`) verified against `BILLING_WEBHOOK_SECRET` with constant-time comparison and 5-minute replay tolerance.
- **Idempotency:** Deduplicated via `public.billing_events.event_id`.
- **Activation State:** Returns `503` until `BILLING_WEBHOOK_SECRET` is configured and live checkout/Stripe integration is explicitly enabled.

## Future Planned Integrations (Tracked in `/config/integrations.yaml`)
- HubSpot CRM, Slack/Discord, Google Calendar & Google Drive (client-side OAuth), Stripe Connect payouts, Canva/LinkedIn/Meta, Notion & Vimeo.
