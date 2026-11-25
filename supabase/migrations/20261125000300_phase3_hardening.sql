-- Inner Circle only (thdnmgmojhhhtjlhbwvn). Apply after 00100 and 00200.
-- Purchased credits are a persistent remaining balance. Monthly plan credits reset;
-- reservations consume plan credits first, then purchased credits. Daily caps still apply.
ALTER TABLE public.usage_ledger
  ADD COLUMN IF NOT EXISTS purchased_credits_used INTEGER NOT NULL DEFAULT 0
  CHECK (purchased_credits_used >= 0 AND purchased_credits_used <= credits_used);
ALTER TABLE public.usage_ledger
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE public.usage_ledger SET expires_at = created_at + INTERVAL '15 minutes'
 WHERE status = 'reserved' AND expires_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_expiry
  ON public.usage_ledger (expires_at) WHERE status = 'reserved';

-- A short fixed window per operation and principal. Callers pass a hash of the IP or UUID.
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expiry ON public.rate_limit_buckets(window_start);
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER
) RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start TIMESTAMPTZ; v_count INTEGER; v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF LENGTH(p_key) > 160 OR p_limit NOT BETWEEN 1 AND 10000 OR p_window_seconds NOT BETWEEN 1 AND 3600 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT';
  END IF;
  v_start := to_timestamp(FLOOR(EXTRACT(EPOCH FROM v_now) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.rate_limit_buckets(bucket_key, window_start, request_count)
  VALUES (p_key, v_start, 1)
  ON CONFLICT (bucket_key, window_start) DO UPDATE
    SET request_count = public.rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_count;
  DELETE FROM public.rate_limit_buckets WHERE window_start < v_now - INTERVAL '2 hours';
  RETURN QUERY SELECT v_count <= p_limit, GREATEST(0, p_limit - v_count),
    CASE WHEN v_count <= p_limit THEN 0 ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM v_start + make_interval(secs => p_window_seconds) - v_now))::INTEGER) END;
END $$;

CREATE OR REPLACE FUNCTION public.get_studio_usage_totals(
  p_user_id UUID, p_month_key TEXT, p_day_key TEXT
) RETURNS TABLE(monthly_used BIGINT, daily_used BIGINT, monthly_purchased_used BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(SUM(credits_used) FILTER (WHERE month_key = p_month_key), 0)::BIGINT,
         COALESCE(SUM(credits_used) FILTER (WHERE day_key = p_day_key), 0)::BIGINT,
         COALESCE(SUM(purchased_credits_used) FILTER (WHERE month_key = p_month_key), 0)::BIGINT
  FROM public.usage_ledger
  WHERE user_id = p_user_id AND status IN ('reserved', 'committed')
    AND (month_key = p_month_key OR day_key = p_day_key);
$$;

-- Reconcile while holding the account lock, matching reservation/finalization ordering.
CREATE OR REPLACE FUNCTION public.reconcile_studio_reservations(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER; v_account public.agent_accounts%ROWTYPE; v_restored INTEGER;
BEGIN
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  WITH expired AS (
    UPDATE public.usage_ledger SET status = 'refunded', refund_reason = 'reservation_expired'
    WHERE user_id = p_user_id AND status = 'reserved' AND expires_at <= clock_timestamp()
    RETURNING purchased_credits_used
  ) SELECT COUNT(*)::INTEGER, COALESCE(SUM(purchased_credits_used), 0)::INTEGER
    INTO v_count, v_restored FROM expired;
  IF v_restored > 0 THEN
    UPDATE public.agent_accounts SET bonus_credits = bonus_credits + v_restored WHERE user_id = p_user_id;
  END IF;
  RETURN v_count;
END $$;

-- Old signature retained for PostgREST compatibility; caller supplied plan limits are ignored.
CREATE OR REPLACE FUNCTION public.reserve_studio_credits(
  p_user_id UUID, p_action_type TEXT, p_cost INTEGER, p_idempotency_key TEXT,
  p_prompt_summary TEXT, p_month_key TEXT, p_day_key TEXT,
  p_monthly_base INTEGER, p_daily_limit INTEGER
) RETURNS TABLE(ok BOOLEAN, error_code TEXT, ledger_id BIGINT, monthly_used INTEGER,
  monthly_allowance INTEGER, daily_used INTEGER, daily_limit INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.agent_accounts%ROWTYPE; v_base INTEGER; v_daily_limit INTEGER;
  v_monthly INTEGER; v_plan_used INTEGER; v_daily INTEGER; v_pack INTEGER; v_existing BIGINT; v_id BIGINT;
BEGIN
  IF p_cost NOT IN (1, 2, 5) OR p_action_type NOT IN ('chat', 'file', 'image')
    OR (p_action_type = 'chat' AND p_cost <> 1)
    OR (p_action_type = 'file' AND p_cost <> 2)
    OR (p_action_type = 'image' AND p_cost <> 5) THEN
    RETURN QUERY SELECT FALSE, 'INVALID_COST', NULL::BIGINT, 0, 0, 0, 0; RETURN;
  END IF;
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'ACCOUNT_NOT_FOUND', NULL::BIGINT, 0, 0, 0, 0; RETURN; END IF;
  IF v_account.membership_status <> 'active' THEN
    RETURN QUERY SELECT FALSE, 'MEMBERSHIP_INACTIVE', NULL::BIGINT, 0, 0, 0, 0; RETURN;
  END IF;
  PERFORM public.reconcile_studio_reservations(p_user_id);
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id;
  v_base := CASE v_account.plan_id WHEN 'onboarding' THEN 30 WHEN 'producer' THEN 250 WHEN 'inner_circle' THEN 1000 ELSE 0 END;
  v_daily_limit := CASE v_account.plan_id WHEN 'onboarding' THEN 10 WHEN 'producer' THEN 50 WHEN 'inner_circle' THEN 150 ELSE 0 END;
  SELECT id INTO v_existing FROM public.usage_ledger WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  SELECT COALESCE(SUM(credits_used), 0)::INTEGER,
         COALESCE(SUM(credits_used - purchased_credits_used), 0)::INTEGER
    INTO v_monthly, v_plan_used FROM public.usage_ledger
   WHERE user_id = p_user_id AND month_key = p_month_key AND status IN ('reserved', 'committed');
  SELECT COALESCE(SUM(credits_used), 0)::INTEGER INTO v_daily FROM public.usage_ledger
   WHERE user_id = p_user_id AND day_key = p_day_key AND status IN ('reserved', 'committed');
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_IDEMPOTENCY_KEY', v_existing, v_monthly,
      v_base + v_account.bonus_credits, v_daily, v_daily_limit; RETURN;
  END IF;
  v_pack := GREATEST(0, p_cost - GREATEST(0, v_base - v_plan_used));
  IF v_pack > v_account.bonus_credits THEN
    RETURN QUERY SELECT FALSE, 'MONTHLY_LIMIT_EXCEEDED', NULL::BIGINT, v_monthly,
      v_base + v_account.bonus_credits, v_daily, v_daily_limit; RETURN;
  END IF;
  IF v_daily + p_cost > v_daily_limit THEN
    RETURN QUERY SELECT FALSE, 'DAILY_LIMIT_EXCEEDED', NULL::BIGINT, v_monthly,
      v_base + v_account.bonus_credits, v_daily, v_daily_limit; RETURN;
  END IF;
  UPDATE public.agent_accounts SET bonus_credits = bonus_credits - v_pack WHERE user_id = p_user_id;
  INSERT INTO public.usage_ledger(user_id, action_type, credits_used, purchased_credits_used, status,
    idempotency_key, prompt_summary, month_key, day_key, expires_at)
  VALUES (p_user_id, p_action_type, p_cost, v_pack, 'reserved', p_idempotency_key,
    LEFT(p_prompt_summary, 140), p_month_key, p_day_key, clock_timestamp() + INTERVAL '15 minutes')
  RETURNING id INTO v_id;
  RETURN QUERY SELECT TRUE, NULL::TEXT, v_id, v_monthly + p_cost,
    v_base + v_account.bonus_credits, v_daily + p_cost, v_daily_limit;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_studio_reservation(p_ledger_id BIGINT, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.agent_accounts%ROWTYPE; v_updated INTEGER;
BEGIN
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.usage_ledger SET status = 'committed' WHERE id = p_ledger_id AND user_id = p_user_id
    AND status = 'reserved' AND expires_at > clock_timestamp();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END $$;

CREATE OR REPLACE FUNCTION public.refund_studio_reservation(p_ledger_id BIGINT, p_user_id UUID, p_reason TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.agent_accounts%ROWTYPE; v_pack INTEGER;
BEGIN
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.usage_ledger SET status = 'refunded', refund_reason = LEFT(COALESCE(p_reason, 'generation_failed'), 160)
    WHERE id = p_ledger_id AND user_id = p_user_id AND status = 'reserved'
    RETURNING purchased_credits_used INTO v_pack;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.agent_accounts SET bonus_credits = bonus_credits + v_pack WHERE user_id = p_user_id;
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.apply_verified_billing_event(
  p_event_id TEXT, p_provider TEXT, p_user_id UUID, p_event_type TEXT,
  p_plan_id TEXT, p_credits_delta INTEGER, p_payload JSONB
) RETURNS TABLE(applied BOOLEAN, duplicate BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_account public.agent_accounts%ROWTYPE; v_id BIGINT;
BEGIN
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  INSERT INTO public.billing_events(provider, event_id, user_id, event_type, plan_id, credits_delta, status, payload)
  VALUES (COALESCE(NULLIF(TRIM(p_provider), ''), 'stripe'), p_event_id, p_user_id, p_event_type,
    p_plan_id, COALESCE(p_credits_delta, 0), 'processed', COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (event_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN QUERY SELECT FALSE, TRUE; RETURN; END IF;
  UPDATE public.agent_accounts SET plan_id = COALESCE(p_plan_id, plan_id),
    bonus_credits = bonus_credits + GREATEST(0, COALESCE(p_credits_delta, 0)) WHERE user_id = p_user_id;
  RETURN QUERY SELECT TRUE, FALSE;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_invitation_for_user(
  p_user_id UUID, p_email TEXT, p_name TEXT, p_reference_code TEXT
) RETURNS TABLE(ok BOOLEAN, error_code TEXT, assigned_role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_auth_email TEXT; v_confirmed TIMESTAMPTZ; v_invite public.invitations%ROWTYPE;
  v_account public.agent_accounts%ROWTYPE;
BEGIN
  SELECT email, email_confirmed_at INTO v_auth_email, v_confirmed
    FROM auth.users WHERE id = p_user_id;
  IF v_confirmed IS NULL OR LOWER(TRIM(v_auth_email)) <> LOWER(TRIM(p_email)) THEN
    RETURN QUERY SELECT FALSE, 'INVITE_EMAIL_MISMATCH', NULL::TEXT; RETURN;
  END IF;
  SELECT * INTO v_account FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND THEN RETURN QUERY SELECT TRUE, 'ALREADY_ONBOARDED', v_account.role; RETURN; END IF;
  SELECT * INTO v_invite FROM public.invitations
    WHERE UPPER(reference_code) = UPPER(TRIM(p_reference_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'INVITE_NOT_FOUND', NULL::TEXT; RETURN; END IF;
  IF v_invite.status = 'redeemed' THEN
    RETURN QUERY SELECT FALSE, 'INVITE_ALREADY_REDEEMED', NULL::TEXT; RETURN;
  END IF;
  IF v_invite.status <> 'approved' THEN
    RETURN QUERY SELECT FALSE, 'INVITE_NOT_APPROVED', NULL::TEXT; RETURN;
  END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < clock_timestamp() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = v_invite.id;
    RETURN QUERY SELECT FALSE, 'INVITE_EXPIRED', NULL::TEXT; RETURN;
  END IF;
  IF LOWER(TRIM(v_invite.email)) <> LOWER(TRIM(v_auth_email)) THEN
    RETURN QUERY SELECT FALSE, 'INVITE_EMAIL_MISMATCH', NULL::TEXT; RETURN;
  END IF;
  INSERT INTO public.agent_accounts(user_id,email,name,role,membership_status,plan_id,bonus_credits,invited_by_code)
  VALUES(p_user_id, LOWER(TRIM(v_auth_email)), COALESCE(NULLIF(TRIM(p_name),''),v_invite.full_name),
    v_invite.assigned_role, 'active', 'onboarding', 0, v_invite.reference_code);
  UPDATE public.invitations SET status = 'redeemed', redeemed_by = p_user_id, redeemed_at = clock_timestamp()
    WHERE id = v_invite.id;
  RETURN QUERY SELECT TRUE, NULL::TEXT, v_invite.assigned_role;
END $$;

-- Serialize administrator changes globally and keep at least one active administrator.
CREATE OR REPLACE FUNCTION public.update_member_status(
  p_user_id UUID, p_role TEXT, p_status TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_old public.agent_accounts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(246801357);
  SELECT * INTO v_old FROM public.agent_accounts WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_old.role = 'admin' AND v_old.membership_status = 'active'
    AND (COALESCE(p_role, v_old.role) <> 'admin' OR COALESCE(p_status, v_old.membership_status) <> 'active')
    AND (SELECT COUNT(*) FROM public.agent_accounts WHERE role = 'admin' AND membership_status = 'active') <= 1 THEN
    RAISE EXCEPTION 'LAST_ACTIVE_ADMIN';
  END IF;
  UPDATE public.agent_accounts SET role = COALESCE(p_role, role),
    membership_status = COALESCE(p_status, membership_status) WHERE user_id = p_user_id;
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.membership_status = 'active' THEN
    IF TG_OP = 'UPDATE' AND NEW.role = 'admin' AND NEW.membership_status = 'active' THEN
      RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(246801357);
    IF (SELECT COUNT(*) FROM public.agent_accounts
        WHERE role = 'admin' AND membership_status = 'active') <= 1 THEN
      RAISE EXCEPTION 'LAST_ACTIVE_ADMIN';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_last_active_admin ON public.agent_accounts;
CREATE TRIGGER trg_protect_last_active_admin BEFORE UPDATE OR DELETE ON public.agent_accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();

-- Authenticated browser access requires an active account. All writes remain server-only.
DROP POLICY IF EXISTS "agent_accounts_select_own" ON public.agent_accounts;
CREATE POLICY "agent_accounts_select_own" ON public.agent_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND membership_status = 'active');
DROP POLICY IF EXISTS "usage_ledger_select_own" ON public.usage_ledger;
CREATE POLICY "usage_ledger_select_own" ON public.usage_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.agent_accounts a WHERE a.user_id = auth.uid() AND a.membership_status = 'active'));
REVOKE ALL ON public.agent_accounts, public.invitations, public.usage_ledger, public.billing_events FROM anon, authenticated;
GRANT SELECT ON public.agent_accounts, public.usage_ledger TO authenticated;
GRANT ALL ON public.agent_accounts, public.invitations, public.usage_ledger, public.billing_events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_studio_usage_totals(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_studio_reservations(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_member_status(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_last_active_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_studio_usage_totals(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_studio_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_member_status(UUID, TEXT, TEXT) TO service_role;
