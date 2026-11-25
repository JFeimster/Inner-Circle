-- Migration: 20261125000200_atomic_credits_and_invitations.sql
-- Target Project: inner-circle (thdnmgmojhhhtjlhbwvn)
-- Description: Atomic row-locked RPC functions for concurrent credit reservation,
--              finalization, refunds, invitation redemption, and idempotent billing events.

-- 1. Atomic Credit Reservation (row-level lock prevents concurrent overspend)
CREATE OR REPLACE FUNCTION public.reserve_studio_credits(
  p_user_id UUID,
  p_action_type TEXT,
  p_cost INTEGER,
  p_idempotency_key TEXT,
  p_prompt_summary TEXT,
  p_month_key TEXT,
  p_day_key TEXT,
  p_monthly_base INTEGER,
  p_daily_limit INTEGER
)
RETURNS TABLE (
  ok BOOLEAN,
  error_code TEXT,
  ledger_id BIGINT,
  monthly_used INTEGER,
  monthly_allowance INTEGER,
  daily_used INTEGER,
  daily_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account public.agent_accounts%ROWTYPE;
  v_existing_id BIGINT;
  v_monthly_used INTEGER;
  v_daily_used INTEGER;
  v_allowance INTEGER;
  v_new_ledger_id BIGINT;
BEGIN
  IF p_cost <= 0 THEN
    RETURN QUERY SELECT FALSE, 'INVALID_COST', NULL::BIGINT, 0, 0, 0, p_daily_limit;
    RETURN;
  END IF;

  -- Serialize concurrent credit mutations per user
  SELECT *
    INTO v_account
    FROM public.agent_accounts
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'ACCOUNT_NOT_FOUND', NULL::BIGINT, 0, 0, 0, p_daily_limit;
    RETURN;
  END IF;

  IF v_account.membership_status <> 'active' THEN
    RETURN QUERY SELECT FALSE, 'MEMBERSHIP_INACTIVE', NULL::BIGINT, 0, 0, 0, p_daily_limit;
    RETURN;
  END IF;

  -- Idempotency guard
  SELECT id
    INTO v_existing_id
    FROM public.usage_ledger
   WHERE user_id = p_user_id
     AND idempotency_key = p_idempotency_key;

  SELECT COALESCE(SUM(credits_used), 0)::INTEGER
    INTO v_monthly_used
    FROM public.usage_ledger
   WHERE user_id = p_user_id
     AND month_key = p_month_key
     AND status IN ('reserved', 'committed');

  SELECT COALESCE(SUM(credits_used), 0)::INTEGER
    INTO v_daily_used
    FROM public.usage_ledger
   WHERE user_id = p_user_id
     AND day_key = p_day_key
     AND status IN ('reserved', 'committed');

  v_allowance := p_monthly_base + v_account.bonus_credits;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_IDEMPOTENCY_KEY', v_existing_id, v_monthly_used, v_allowance, v_daily_used, p_daily_limit;
    RETURN;
  END IF;

  IF (v_monthly_used + p_cost) > v_allowance THEN
    RETURN QUERY SELECT FALSE, 'MONTHLY_LIMIT_EXCEEDED', NULL::BIGINT, v_monthly_used, v_allowance, v_daily_used, p_daily_limit;
    RETURN;
  END IF;

  IF (v_daily_used + p_cost) > p_daily_limit THEN
    RETURN QUERY SELECT FALSE, 'DAILY_LIMIT_EXCEEDED', NULL::BIGINT, v_monthly_used, v_allowance, v_daily_used, p_daily_limit;
    RETURN;
  END IF;

  INSERT INTO public.usage_ledger (
    user_id,
    action_type,
    credits_used,
    status,
    idempotency_key,
    prompt_summary,
    month_key,
    day_key
  )
  VALUES (
    p_user_id,
    p_action_type,
    p_cost,
    'reserved',
    p_idempotency_key,
    LEFT(p_prompt_summary, 140),
    p_month_key,
    p_day_key
  )
  RETURNING id INTO v_new_ledger_id;

  RETURN QUERY SELECT
    TRUE,
    NULL::TEXT,
    v_new_ledger_id,
    v_monthly_used + p_cost,
    v_allowance,
    v_daily_used + p_cost,
    p_daily_limit;
END;
$$;

-- 2. Finalize Reserved Credits
CREATE OR REPLACE FUNCTION public.finalize_studio_reservation(
  p_ledger_id BIGINT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.usage_ledger
     SET status = 'committed'
   WHERE id = p_ledger_id
     AND user_id = p_user_id
     AND status = 'reserved';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 3. Refund Reserved Credits on Failed Generation
CREATE OR REPLACE FUNCTION public.refund_studio_reservation(
  p_ledger_id BIGINT,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.usage_ledger
     SET status = 'refunded',
         refund_reason = LEFT(COALESCE(p_reason, 'generation_failed'), 160)
   WHERE id = p_ledger_id
     AND user_id = p_user_id
     AND status = 'reserved';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 4. Atomic Invitation Redemption (enforces approved + matching email + single-use)
CREATE OR REPLACE FUNCTION public.redeem_invitation_for_user(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_reference_code TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  error_code TEXT,
  assigned_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.invitations%ROWTYPE;
  v_existing_account public.agent_accounts%ROWTYPE;
  v_clean_email TEXT := LOWER(TRIM(p_email));
  v_clean_code TEXT := UPPER(TRIM(p_reference_code));
BEGIN
  SELECT *
    INTO v_existing_account
    FROM public.agent_accounts
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'ALREADY_ONBOARDED', v_existing_account.role;
    RETURN;
  END IF;

  SELECT *
    INTO v_invite
    FROM public.invitations
   WHERE UPPER(reference_code) = v_clean_code
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'INVITE_NOT_FOUND', NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'redeemed' THEN
    RETURN QUERY SELECT FALSE, 'INVITE_ALREADY_REDEEMED', NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.status <> 'approved' THEN
    RETURN QUERY SELECT FALSE, 'INVITE_NOT_APPROVED', NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;
    RETURN QUERY SELECT FALSE, 'INVITE_EXPIRED', NULL::TEXT;
    RETURN;
  END IF;

  IF LOWER(TRIM(v_invite.email)) <> v_clean_email THEN
    RETURN QUERY SELECT FALSE, 'INVITE_EMAIL_MISMATCH', NULL::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.agent_accounts (
    user_id,
    email,
    name,
    role,
    membership_status,
    plan_id,
    bonus_credits,
    invited_by_code
  )
  VALUES (
    p_user_id,
    v_clean_email,
    COALESCE(NULLIF(TRIM(p_name), ''), v_invite.full_name),
    v_invite.assigned_role,
    'active',
    'onboarding',
    0,
    v_invite.reference_code
  );

  UPDATE public.invitations
     SET status = 'redeemed',
         redeemed_by = p_user_id,
         redeemed_at = NOW()
   WHERE id = v_invite.id;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_invite.assigned_role;
END;
$$;

-- 5. Idempotent Verified Billing Event Application
CREATE OR REPLACE FUNCTION public.apply_verified_billing_event(
  p_event_id TEXT,
  p_provider TEXT,
  p_user_id UUID,
  p_event_type TEXT,
  p_plan_id TEXT,
  p_credits_delta INTEGER,
  p_payload JSONB
)
RETURNS TABLE (
  applied BOOLEAN,
  duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account public.agent_accounts%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM public.billing_events WHERE event_id = p_event_id) THEN
    RETURN QUERY SELECT FALSE, TRUE;
    RETURN;
  END IF;

  SELECT *
    INTO v_account
    FROM public.agent_accounts
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
  END IF;

  INSERT INTO public.billing_events (
    provider,
    event_id,
    user_id,
    event_type,
    plan_id,
    credits_delta,
    status,
    payload
  )
  VALUES (
    COALESCE(NULLIF(TRIM(p_provider), ''), 'stripe'),
    p_event_id,
    p_user_id,
    p_event_type,
    p_plan_id,
    COALESCE(p_credits_delta, 0),
    'processed',
    COALESCE(p_payload, '{}'::jsonb)
  );

  IF p_plan_id IS NOT NULL THEN
    UPDATE public.agent_accounts
       SET plan_id = p_plan_id
     WHERE user_id = p_user_id;
  END IF;

  IF COALESCE(p_credits_delta, 0) > 0 THEN
    UPDATE public.agent_accounts
       SET bonus_credits = bonus_credits + p_credits_delta
     WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT TRUE, FALSE;
END;
$$;

-- Restrict RPC execution strictly to server-side service role / secret key
REVOKE ALL ON FUNCTION public.reserve_studio_credits(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_studio_reservation(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_studio_reservation(BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_invitation_for_user(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_verified_billing_event(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_studio_credits(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_studio_reservation(BIGINT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_studio_reservation(BIGINT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_for_user(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_billing_event(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, JSONB) TO service_role;
