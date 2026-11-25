-- Migration: 20261125000100_init_inner_circle.sql
-- Target Project: inner-circle (thdnmgmojhhhtjlhbwvn)
-- Description: Canonical UUID-based schema for agent accounts, invitation-gated onboarding,
--              atomic studio credit ledger, verified billing events, and strict RLS policies.
-- NOTE: Do NOT run against the separate Moonshine Capital platform-core project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Agent Accounts (canonical identity = auth.users.id UUID)
CREATE TABLE IF NOT EXISTS public.agent_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'suspended', 'revoked')),
  plan_id TEXT NOT NULL DEFAULT 'onboarding' CHECK (plan_id IN ('onboarding', 'producer', 'inner_circle')),
  bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  invited_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_accounts_email_lower
  ON public.agent_accounts (LOWER(email));

-- 2. Invitation-Based Agent Onboarding
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  market TEXT NOT NULL,
  volume_tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'redeemed', 'revoked', 'expired')),
  assigned_role TEXT NOT NULL DEFAULT 'member' CHECK (assigned_role IN ('member', 'admin')),
  expires_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_email_lower
  ON public.invitations (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_invitations_status
  ON public.invitations (status, created_at DESC);

-- 3. AI Studio Credit Reservation & Usage Ledger
CREATE TABLE IF NOT EXISTS public.usage_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.agent_accounts(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('chat', 'file', 'image')),
  credits_used INTEGER NOT NULL CHECK (credits_used > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'refunded')),
  idempotency_key TEXT NOT NULL,
  prompt_summary TEXT NOT NULL,
  month_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  refund_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_usage_ledger_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_month_status
  ON public.usage_ledger (user_id, month_key, status);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_day_status
  ON public.usage_ledger (user_id, day_key, status);

-- 4. Verified Billing Events (idempotent webhook & admin billing audit trail)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'stripe',
  event_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES public.agent_accounts(user_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  plan_id TEXT CHECK (plan_id IS NULL OR plan_id IN ('onboarding', 'producer', 'inner_circle')),
  credits_delta INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processed',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user
  ON public.billing_events (user_id, created_at DESC);

-- 5. Updated-at maintenance trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_accounts_updated_at ON public.agent_accounts;
CREATE TRIGGER trg_agent_accounts_updated_at
  BEFORE UPDATE ON public.agent_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invitations_updated_at ON public.invitations;
CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_usage_ledger_updated_at ON public.usage_ledger;
CREATE TRIGGER trg_usage_ledger_updated_at
  BEFORE UPDATE ON public.usage_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Strict Row Level Security (RLS)
-- All writes are mediated through server-side API endpoints using SUPABASE_SECRET_KEY.
-- Authenticated browser sessions may only read their own account and usage rows.
ALTER TABLE public.agent_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_accounts_select_own" ON public.agent_accounts;
CREATE POLICY "agent_accounts_select_own"
  ON public.agent_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_ledger_select_own" ON public.usage_ledger;
CREATE POLICY "usage_ledger_select_own"
  ON public.usage_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Explicit revocation of direct client mutation privileges (defense in depth)
REVOKE INSERT, UPDATE, DELETE ON public.agent_accounts FROM anon, authenticated;
REVOKE ALL ON public.invitations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.usage_ledger FROM anon, authenticated;
REVOKE ALL ON public.billing_events FROM anon, authenticated;
