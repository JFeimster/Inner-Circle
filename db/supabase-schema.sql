-- Moonshine Capital — Supabase PostgreSQL Schema
-- Paste and run this once in your Supabase Dashboard -> SQL Editor.
-- Note: If you link Supabase via Vercel Marketplace (which also injects POSTGRES_URL),
-- server/db.ts will also automatically ensure these tables exist on first startup.

CREATE TABLE IF NOT EXISTS public.agent_accounts (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Elite Agent',
  plan_id TEXT NOT NULL DEFAULT 'onboarding',
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_ledger (
  id BIGSERIAL PRIMARY KEY,
  agent_email TEXT NOT NULL REFERENCES public.agent_accounts(email) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL,
  prompt_summary TEXT NOT NULL,
  month_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invitations (
  id BIGSERIAL PRIMARY KEY,
  reference_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  market TEXT NOT NULL,
  volume_tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_agent_month
  ON public.usage_ledger (agent_email, month_key);

CREATE INDEX IF NOT EXISTS idx_usage_agent_day
  ON public.usage_ledger (agent_email, day_key);

-- Lock down direct public/anon browser access via Row Level Security.
-- The server-side API (Vercel /api/*) accesses these tables securely with SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.agent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Seed default member account (idempotent)
INSERT INTO public.agent_accounts (email, name, role, plan_id, bonus_credits)
VALUES ('jasonfeimster@gmail.com', 'Jason Feimster', 'Elite Agent · Inner Circle', 'onboarding', 0)
ON CONFLICT (email) DO NOTHING;
