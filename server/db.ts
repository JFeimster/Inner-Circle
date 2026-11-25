import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isInnerCircleSupabaseUrl, type ServerConfig } from './config.ts';

export type MemberRole = 'member' | 'admin';
export type MembershipStatus = 'active' | 'suspended' | 'revoked';
export type PlanId = 'onboarding' | 'producer' | 'inner_circle';
export type ActionType = 'chat' | 'file' | 'image';
export type LedgerStatus = 'reserved' | 'committed' | 'refunded';
export type InvitationStatus = 'pending' | 'approved' | 'redeemed' | 'revoked' | 'expired';

export interface AgentAccountRow {
  user_id: string;
  email: string;
  name: string;
  role: MemberRole;
  membership_status: MembershipStatus;
  plan_id: PlanId;
  bonus_credits: number;
  invited_by_code: string | null;
  created_at: string;
}

export interface UsageLedgerRow {
  id: number;
  action_type: ActionType;
  credits_used: number;
  status: LedgerStatus;
  idempotency_key: string;
  prompt_summary: string;
  refund_reason: string | null;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  market: string;
  volume_tier: string;
  status: InvitationStatus;
  assigned_role: MemberRole;
  expires_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
}

export interface ReserveCreditsInput {
  userId: string;
  actionType: ActionType;
  cost: number;
  idempotencyKey: string;
  promptSummary: string;
  monthKey: string;
  dayKey: string;
  monthlyBase: number;
  dailyLimit: number;
}

export interface ReserveCreditsResult {
  ok: boolean;
  errorCode:
    | 'INVALID_COST'
    | 'ACCOUNT_NOT_FOUND'
    | 'MEMBERSHIP_INACTIVE'
    | 'DUPLICATE_IDEMPOTENCY_KEY'
    | 'MONTHLY_LIMIT_EXCEEDED'
    | 'DAILY_LIMIT_EXCEEDED'
    | null;
  ledgerId: number | null;
  monthlyUsed: number;
  monthlyAllowance: number;
  dailyUsed: number;
  dailyLimit: number;
}

export interface RedeemInvitationResult {
  ok: boolean;
  errorCode:
    | 'ALREADY_ONBOARDED'
    | 'INVITE_NOT_FOUND'
    | 'INVITE_ALREADY_REDEEMED'
    | 'INVITE_NOT_APPROVED'
    | 'INVITE_EXPIRED'
    | 'INVITE_EMAIL_MISMATCH'
    | null;
  assignedRole: MemberRole | null;
}

export interface BillingEventInput {
  eventId: string;
  provider: string;
  userId: string;
  eventType: string;
  planId: PlanId | null;
  creditsDelta: number;
  payload: Record<string, unknown>;
}

export interface BillingEventResult {
  applied: boolean;
  duplicate: boolean;
}

export interface InnerCircleStore {
  readonly driver: 'supabase' | 'local-sqlite';
  ping(): Promise<void>;
  consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>;
  getAccountByUserId(userId: string): Promise<AgentAccountRow | null>;
  listAccounts(limit?: number): Promise<AgentAccountRow[]>;
  updateMembership(
    userId: string,
    updates: { role?: MemberRole; membershipStatus?: MembershipStatus }
  ): Promise<AgentAccountRow | null>;
  getUsageTotals(
    userId: string,
    monthKey: string,
    dayKey: string
  ): Promise<{ monthlyUsed: number; dailyUsed: number; monthlyPurchasedUsed: number }>;
  getRecentUsage(userId: string, limit?: number): Promise<UsageLedgerRow[]>;
  reserveCredits(input: ReserveCreditsInput): Promise<ReserveCreditsResult>;
  finalizeReservation(ledgerId: number, userId: string): Promise<boolean>;
  refundReservation(ledgerId: number, userId: string, reason: string): Promise<boolean>;
  createInvitation(input: {
    referenceCode: string;
    fullName: string;
    email: string;
    market: string;
    volumeTier: string;
  }): Promise<InvitationRow>;
  listInvitations(status?: InvitationStatus): Promise<InvitationRow[]>;
  approveInvitation(input: {
    referenceCode: string;
    approvedBy: string;
    assignedRole?: MemberRole;
    expiresAt?: string | null;
  }): Promise<InvitationRow | null>;
  revokeInvitation(referenceCode: string): Promise<InvitationRow | null>;
  redeemInvitation(input: {
    userId: string;
    email: string;
    name: string;
    referenceCode: string;
  }): Promise<RedeemInvitationResult>;
  applyVerifiedBillingEvent(input: BillingEventInput): Promise<BillingEventResult>;
}

// --- 1. Supabase Store (Production & Staging — zero DDL, zero auto-seeding, zero POSTGRES_URL) ---
export function createSupabaseStore(url: string, serverKey: string): InnerCircleStore {
  if (!isInnerCircleSupabaseUrl(url)) throw new Error('SERVER_CONFIG_INCOMPLETE');
  const supabase: SupabaseClient = createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    driver: 'supabase',

    // Strictly read-only, non-mutating health check
    async ping() {
      const { error } = await supabase
        .from('agent_accounts')
        .select('user_id', { count: 'exact', head: true })
        .limit(1);
      if (error) {
        throw new Error('SUPABASE_HEALTH_FAILED');
      }
    },

    async consumeRateLimit(key, limit, windowSeconds) {
      const { data, error } = await supabase.rpc('consume_rate_limit', {
        p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
      });
      if (error || !Array.isArray(data) || !data[0]) throw new Error('RATE_LIMIT_RPC_ERROR');
      return {
        allowed: Boolean(data[0].allowed),
        remaining: Number(data[0].remaining),
        retryAfterSeconds: Number(data[0].retry_after_seconds),
      };
    },

    async getAccountByUserId(userId: string) {
      const { data, error } = await supabase
        .from('agent_accounts')
        .select(
          'user_id, email, name, role, membership_status, plan_id, bonus_credits, invited_by_code, created_at'
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw new Error('STORE_READ_ERROR');
      return (data as AgentAccountRow | null) ?? null;
    },

    async listAccounts(limit = 100) {
      const { data, error } = await supabase
        .from('agent_accounts')
        .select(
          'user_id, email, name, role, membership_status, plan_id, bonus_credits, invited_by_code, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error('STORE_READ_ERROR');
      return (data ?? []) as AgentAccountRow[];
    },

    async updateMembership(userId, updates) {
      if (!updates.role && !updates.membershipStatus) {
        return this.getAccountByUserId(userId);
      }
      const { data, error } = await supabase.rpc('update_member_status', {
        p_user_id: userId, p_role: updates.role ?? null, p_status: updates.membershipStatus ?? null,
      });
      if (error?.message?.includes('LAST_ACTIVE_ADMIN')) throw new Error('LAST_ACTIVE_ADMIN');
      if (error) throw new Error('STORE_WRITE_ERROR');
      return data ? this.getAccountByUserId(userId) : null;
    },

    async getUsageTotals(userId, monthKey, dayKey) {
      const { data, error } = await supabase.rpc('get_studio_usage_totals', {
        p_user_id: userId, p_month_key: monthKey, p_day_key: dayKey,
      });
      if (error || !Array.isArray(data) || !data[0]) throw new Error('STORE_READ_ERROR');
      return { monthlyUsed: Number(data[0].monthly_used), dailyUsed: Number(data[0].daily_used),
        monthlyPurchasedUsed: Number(data[0].monthly_purchased_used) };
    },

    async getRecentUsage(userId, limit = 15) {
      const { data, error } = await supabase
        .from('usage_ledger')
        .select(
          'id, action_type, credits_used, status, idempotency_key, prompt_summary, refund_reason, created_at'
        )
        .eq('user_id', userId)
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw new Error('STORE_READ_ERROR');
      return ((data ?? []) as UsageLedgerRow[]).map((row) => ({
        ...row,
        id: Number(row.id),
        credits_used: Number(row.credits_used),
      }));
    },

    async reserveCredits(input) {
      const { data, error } = await supabase.rpc('reserve_studio_credits', {
        p_user_id: input.userId,
        p_action_type: input.actionType,
        p_cost: input.cost,
        p_idempotency_key: input.idempotencyKey,
        p_prompt_summary: input.promptSummary,
        p_month_key: input.monthKey,
        p_day_key: input.dayKey,
        p_monthly_base: input.monthlyBase,
        p_daily_limit: input.dailyLimit,
      });

      if (error || !Array.isArray(data) || data.length === 0) {
        throw new Error('RESERVATION_RPC_ERROR');
      }

      const row = data[0] as {
        ok: boolean;
        error_code: ReserveCreditsResult['errorCode'];
        ledger_id: number | null;
        monthly_used: number;
        monthly_allowance: number;
        daily_used: number;
        daily_limit: number;
      };

      return {
        ok: Boolean(row.ok),
        errorCode: row.error_code ?? null,
        ledgerId: row.ledger_id !== null ? Number(row.ledger_id) : null,
        monthlyUsed: Number(row.monthly_used ?? 0),
        monthlyAllowance: Number(row.monthly_allowance ?? 0),
        dailyUsed: Number(row.daily_used ?? 0),
        dailyLimit: Number(row.daily_limit ?? input.dailyLimit),
      };
    },

    async finalizeReservation(ledgerId, userId) {
      const { data, error } = await supabase.rpc('finalize_studio_reservation', {
        p_ledger_id: ledgerId,
        p_user_id: userId,
      });
      if (error) throw new Error('FINALIZE_RPC_ERROR');
      return Boolean(data);
    },

    async refundReservation(ledgerId, userId, reason) {
      const { data, error } = await supabase.rpc('refund_studio_reservation', {
        p_ledger_id: ledgerId,
        p_user_id: userId,
        p_reason: reason,
      });
      if (error) throw new Error('REFUND_RPC_ERROR');
      return Boolean(data);
    },

    async createInvitation(input) {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          reference_code: input.referenceCode,
          full_name: input.fullName,
          email: input.email,
          market: input.market,
          volume_tier: input.volumeTier,
          status: 'pending',
          assigned_role: 'member',
        })
        .select('*')
        .single();

      if (error || !data) throw new Error('STORE_WRITE_ERROR');
      return data as InvitationRow;
    },

    async listInvitations(status) {
      let query = supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw new Error('STORE_READ_ERROR');
      return (data ?? []) as InvitationRow[];
    },

    async approveInvitation({ referenceCode, approvedBy, assignedRole = 'member', expiresAt }) {
      const { data, error } = await supabase
        .from('invitations')
        .update({
          status: 'approved',
          assigned_role: assignedRole,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt ?? null,
        })
        .eq('reference_code', referenceCode.trim().toUpperCase())
        .in('status', ['pending', 'approved'])
        .select('*')
        .maybeSingle();

      if (error) throw new Error('STORE_WRITE_ERROR');
      return (data as InvitationRow | null) ?? null;
    },

    async revokeInvitation(referenceCode) {
      const { data, error } = await supabase
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('reference_code', referenceCode.trim().toUpperCase())
        .in('status', ['pending', 'approved'])
        .select('*')
        .maybeSingle();

      if (error) throw new Error('STORE_WRITE_ERROR');
      return (data as InvitationRow | null) ?? null;
    },

    async redeemInvitation({ userId, email, name, referenceCode }) {
      const { data, error } = await supabase.rpc('redeem_invitation_for_user', {
        p_user_id: userId,
        p_email: email,
        p_name: name,
        p_reference_code: referenceCode,
      });

      if (error || !Array.isArray(data) || data.length === 0) {
        throw new Error('REDEEM_RPC_ERROR');
      }

      const row = data[0] as {
        ok: boolean;
        error_code: RedeemInvitationResult['errorCode'];
        assigned_role: MemberRole | null;
      };

      return {
        ok: Boolean(row.ok),
        errorCode: row.error_code ?? null,
        assignedRole: row.assigned_role ?? null,
      };
    },

    async applyVerifiedBillingEvent(input) {
      const { data, error } = await supabase.rpc('apply_verified_billing_event', {
        p_event_id: input.eventId,
        p_provider: input.provider,
        p_user_id: input.userId,
        p_event_type: input.eventType,
        p_plan_id: input.planId,
        p_credits_delta: input.creditsDelta,
        p_payload: input.payload,
      });

      if (error || !Array.isArray(data) || data.length === 0) {
        if (error?.message?.includes('ACCOUNT_NOT_FOUND')) {
          throw new Error('ACCOUNT_NOT_FOUND');
        }
        throw new Error('BILLING_RPC_ERROR');
      }

      const row = data[0] as { applied: boolean; duplicate: boolean };
      return { applied: Boolean(row.applied), duplicate: Boolean(row.duplicate) };
    },
  };
}

// --- 2. Explicit Local-Only SQLite Store (Local Development & Automated Tests Only) ---
export async function createLocalSqliteStore(
  sqlitePath: string = 'data/inner-circle-local.db'
): Promise<InnerCircleStore & { seedLocalAccountForTests(account: Omit<AgentAccountRow, 'created_at'>): void; close(): void }> {
  // Dynamic import prevents native better-sqlite3 from loading in Vercel/Supabase production
  const { default: Database } = await import('better-sqlite3');
  let resolvedPath = sqlitePath;

  if (sqlitePath !== ':memory:') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, '..');
    resolvedPath = path.resolve(repoRoot, sqlitePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  if (sqlitePath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      bucket_key TEXT NOT NULL, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL,
      PRIMARY KEY (bucket_key, window_start)
    );
    CREATE TABLE IF NOT EXISTS agent_accounts (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
      membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'suspended', 'revoked')),
      plan_id TEXT NOT NULL DEFAULT 'onboarding' CHECK (plan_id IN ('onboarding', 'producer', 'inner_circle')),
      bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
      invited_by_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      market TEXT NOT NULL,
      volume_tier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'redeemed', 'revoked', 'expired')),
      assigned_role TEXT NOT NULL DEFAULT 'member' CHECK (assigned_role IN ('member', 'admin')),
      expires_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      redeemed_by TEXT,
      redeemed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL CHECK (action_type IN ('chat', 'file', 'image')),
      credits_used INTEGER NOT NULL CHECK (credits_used > 0),
      status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'refunded')),
      purchased_credits_used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      idempotency_key TEXT NOT NULL,
      prompt_summary TEXT NOT NULL,
      month_key TEXT NOT NULL,
      day_key TEXT NOT NULL,
      refund_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, idempotency_key),
      FOREIGN KEY (user_id) REFERENCES agent_accounts(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS billing_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL DEFAULT 'stripe',
      event_id TEXT NOT NULL UNIQUE,
      user_id TEXT,
      event_type TEXT NOT NULL,
      plan_id TEXT,
      credits_delta INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processed',
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const ledgerColumns = new Set((db.pragma('table_info(usage_ledger)') as Array<{ name: string }>).map(row => row.name));
  if (!ledgerColumns.has('purchased_credits_used')) {
    db.exec('ALTER TABLE usage_ledger ADD COLUMN purchased_credits_used INTEGER NOT NULL DEFAULT 0');
  }
  if (!ledgerColumns.has('expires_at')) {
    db.exec('ALTER TABLE usage_ledger ADD COLUMN expires_at TEXT');
    db.exec(`UPDATE usage_ledger SET expires_at = datetime(created_at, '+15 minutes') WHERE status = 'reserved'`);
  }

  const reserveTx = db.transaction((input: ReserveCreditsInput): ReserveCreditsResult => {
    if (input.cost !== ({ chat: 1, file: 2, image: 5 } as const)[input.actionType]) {
      return {
        ok: false,
        errorCode: 'INVALID_COST',
        ledgerId: null,
        monthlyUsed: 0,
        monthlyAllowance: 0,
        dailyUsed: 0,
        dailyLimit: input.dailyLimit,
      };
    }

    const account = db
      .prepare('SELECT * FROM agent_accounts WHERE user_id = ?')
      .get(input.userId) as AgentAccountRow | undefined;

    const planLimits = {
      onboarding: { monthly: 30, daily: 10 },
      producer: { monthly: 250, daily: 50 },
      inner_circle: { monthly: 1000, daily: 150 },
    };

    if (!account) {
      return {
        ok: false,
        errorCode: 'ACCOUNT_NOT_FOUND',
        ledgerId: null,
        monthlyUsed: 0,
        monthlyAllowance: 0,
        dailyUsed: 0,
        dailyLimit: input.dailyLimit,
      };
    }

    if (account.membership_status !== 'active') {
      return {
        ok: false,
        errorCode: 'MEMBERSHIP_INACTIVE',
        ledgerId: null,
        monthlyUsed: 0,
        monthlyAllowance: 0,
        dailyUsed: 0,
        dailyLimit: input.dailyLimit,
      };
    }

    const expired = db.prepare(`SELECT COALESCE(SUM(purchased_credits_used), 0) AS total
      FROM usage_ledger WHERE user_id = ? AND status = 'reserved' AND expires_at <= datetime('now')`)
      .get(input.userId) as { total: number };
    db.prepare(`UPDATE usage_ledger SET status = 'refunded', refund_reason = 'reservation_expired'
      WHERE user_id = ? AND status = 'reserved' AND expires_at <= datetime('now')`).run(input.userId);
    if (expired.total > 0) {
      db.prepare('UPDATE agent_accounts SET bonus_credits = bonus_credits + ? WHERE user_id = ?')
        .run(expired.total, input.userId);
      account.bonus_credits += expired.total;
    }

    const existing = db
      .prepare('SELECT id FROM usage_ledger WHERE user_id = ? AND idempotency_key = ?')
      .get(input.userId, input.idempotencyKey) as { id: number } | undefined;

    const monthRow = db
      .prepare(
        `SELECT COALESCE(SUM(credits_used), 0) AS total
         FROM usage_ledger
         WHERE user_id = ? AND month_key = ? AND status IN ('reserved', 'committed')`
      )
      .get(input.userId, input.monthKey) as { total: number };

    const dayRow = db
      .prepare(
        `SELECT COALESCE(SUM(credits_used), 0) AS total
         FROM usage_ledger
         WHERE user_id = ? AND day_key = ? AND status IN ('reserved', 'committed')`
      )
      .get(input.userId, input.dayKey) as { total: number };

    const monthlyUsed = Number(monthRow?.total ?? 0);
    const dailyUsed = Number(dayRow?.total ?? 0);
    const limits = planLimits[account.plan_id];
    const monthlyAllowance = limits.monthly + Number(account.bonus_credits);
    const planUsedRow = db.prepare(`SELECT COALESCE(SUM(credits_used - purchased_credits_used), 0) AS total
      FROM usage_ledger WHERE user_id = ? AND month_key = ? AND status IN ('reserved', 'committed')`)
      .get(input.userId, input.monthKey) as { total: number };
    const purchasedCost = Math.max(0, input.cost - Math.max(0, limits.monthly - planUsedRow.total));

    if (existing) {
      return {
        ok: false,
        errorCode: 'DUPLICATE_IDEMPOTENCY_KEY',
        ledgerId: existing.id,
        monthlyUsed,
        monthlyAllowance,
        dailyUsed,
        dailyLimit: input.dailyLimit,
      };
    }

    if (purchasedCost > account.bonus_credits) {
      return {
        ok: false,
        errorCode: 'MONTHLY_LIMIT_EXCEEDED',
        ledgerId: null,
        monthlyUsed,
        monthlyAllowance,
        dailyUsed,
        dailyLimit: input.dailyLimit,
      };
    }

    if (dailyUsed + input.cost > limits.daily) {
      return {
        ok: false,
        errorCode: 'DAILY_LIMIT_EXCEEDED',
        ledgerId: null,
        monthlyUsed,
        monthlyAllowance,
        dailyUsed,
        dailyLimit: limits.daily,
      };
    }

    const insertRes = db
      .prepare(
        `INSERT INTO usage_ledger (user_id, action_type, credits_used, purchased_credits_used, expires_at, status, idempotency_key, prompt_summary, month_key, day_key)
         VALUES (?, ?, ?, ?, datetime('now', '+15 minutes'), 'reserved', ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.actionType,
        input.cost,
        purchasedCost,
        input.idempotencyKey,
        input.promptSummary.slice(0, 140),
        input.monthKey,
        input.dayKey
      );
    db.prepare('UPDATE agent_accounts SET bonus_credits = bonus_credits - ? WHERE user_id = ?')
      .run(purchasedCost, input.userId);

    return {
      ok: true,
      errorCode: null,
      ledgerId: Number(insertRes.lastInsertRowid),
      monthlyUsed: monthlyUsed + input.cost,
      monthlyAllowance,
      dailyUsed: dailyUsed + input.cost,
      dailyLimit: limits.daily,
    };
  });

  const redeemTx = db.transaction(
    (input: {
      userId: string;
      email: string;
      name: string;
      referenceCode: string;
    }): RedeemInvitationResult => {
      const cleanEmail = input.email.trim().toLowerCase();
      const cleanCode = input.referenceCode.trim().toUpperCase();

      const existing = db
        .prepare('SELECT role FROM agent_accounts WHERE user_id = ?')
        .get(input.userId) as { role: MemberRole } | undefined;

      if (existing) {
        return { ok: true, errorCode: 'ALREADY_ONBOARDED', assignedRole: existing.role };
      }

      const invite = db
        .prepare('SELECT * FROM invitations WHERE UPPER(reference_code) = ?')
        .get(cleanCode) as InvitationRow | undefined;

      if (!invite) {
        return { ok: false, errorCode: 'INVITE_NOT_FOUND', assignedRole: null };
      }

      if (invite.status === 'redeemed') {
        return { ok: false, errorCode: 'INVITE_ALREADY_REDEEMED', assignedRole: null };
      }

      if (invite.status !== 'approved') {
        return { ok: false, errorCode: 'INVITE_NOT_APPROVED', assignedRole: null };
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        db.prepare(`UPDATE invitations SET status = 'expired' WHERE id = ?`).run(invite.id);
        return { ok: false, errorCode: 'INVITE_EXPIRED', assignedRole: null };
      }

      if (invite.email.trim().toLowerCase() !== cleanEmail) {
        return { ok: false, errorCode: 'INVITE_EMAIL_MISMATCH', assignedRole: null };
      }

      db.prepare(
        `INSERT INTO agent_accounts (user_id, email, name, role, membership_status, plan_id, bonus_credits, invited_by_code)
         VALUES (?, ?, ?, ?, 'active', 'onboarding', 0, ?)`
      ).run(
        input.userId,
        cleanEmail,
        input.name.trim() || invite.full_name,
        invite.assigned_role,
        invite.reference_code
      );

      db.prepare(
        `UPDATE invitations SET status = 'redeemed', redeemed_by = ?, redeemed_at = datetime('now') WHERE id = ?`
      ).run(input.userId, invite.id);

      return { ok: true, errorCode: null, assignedRole: invite.assigned_role };
    }
  );

  const billingTx = db.transaction((input: BillingEventInput): BillingEventResult => {
    const existing = db
      .prepare('SELECT id FROM billing_events WHERE event_id = ?')
      .get(input.eventId);
    if (existing) {
      return { applied: false, duplicate: true };
    }

    const account = db
      .prepare('SELECT user_id FROM agent_accounts WHERE user_id = ?')
      .get(input.userId);
    if (!account) {
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    db.prepare(
      `INSERT INTO billing_events (provider, event_id, user_id, event_type, plan_id, credits_delta, status, payload)
       VALUES (?, ?, ?, ?, ?, ?, 'processed', ?)`
    ).run(
      input.provider,
      input.eventId,
      input.userId,
      input.eventType,
      input.planId,
      input.creditsDelta,
      JSON.stringify(input.payload ?? {})
    );

    if (input.planId) {
      db.prepare('UPDATE agent_accounts SET plan_id = ? WHERE user_id = ?').run(
        input.planId,
        input.userId
      );
    }
    if (input.creditsDelta > 0) {
      db.prepare('UPDATE agent_accounts SET bonus_credits = bonus_credits + ? WHERE user_id = ?').run(
        input.creditsDelta,
        input.userId
      );
    }

    return { applied: true, duplicate: false };
  });

  return {
    driver: 'local-sqlite',

    async consumeRateLimit(key, limit, windowSeconds) {
      const now = Math.floor(Date.now() / 1000);
      const start = Math.floor(now / windowSeconds) * windowSeconds;
      const tx = db.transaction(() => {
        db.prepare(`INSERT INTO rate_limit_buckets (bucket_key, window_start, request_count)
          VALUES (?, ?, 1) ON CONFLICT(bucket_key, window_start) DO UPDATE SET request_count = request_count + 1`)
          .run(key, start);
        db.prepare('DELETE FROM rate_limit_buckets WHERE window_start < ?').run(now - 7200);
        return (db.prepare('SELECT request_count FROM rate_limit_buckets WHERE bucket_key = ? AND window_start = ?')
          .get(key, start) as { request_count: number }).request_count;
      });
      const count = tx.immediate();
      return { allowed: count <= limit, remaining: Math.max(0, limit - count),
        retryAfterSeconds: count <= limit ? 0 : start + windowSeconds - now };
    },

    async ping() {
      db.prepare('SELECT 1 AS ok').get();
    },

    async getAccountByUserId(userId: string) {
      const row = db
        .prepare('SELECT * FROM agent_accounts WHERE user_id = ?')
        .get(userId) as AgentAccountRow | undefined;
      return row ?? null;
    },

    async listAccounts(limit = 100) {
      return db
        .prepare('SELECT * FROM agent_accounts ORDER BY created_at DESC LIMIT ?')
        .all(limit) as AgentAccountRow[];
    },

    async updateMembership(userId, updates) {
      db.transaction(() => {
        const current = db.prepare('SELECT role, membership_status FROM agent_accounts WHERE user_id = ?')
          .get(userId) as { role: MemberRole; membership_status: MembershipStatus } | undefined;
        if (!current) return;
        if (current.role === 'admin' && current.membership_status === 'active' &&
          (updates.role === 'member' || (updates.membershipStatus && updates.membershipStatus !== 'active'))) {
          const count = (db.prepare(`SELECT COUNT(*) AS count FROM agent_accounts WHERE role = 'admin' AND membership_status = 'active'`)
            .get() as { count: number }).count;
          if (count <= 1) throw new Error('LAST_ACTIVE_ADMIN');
        }
        db.prepare('UPDATE agent_accounts SET role = COALESCE(?, role), membership_status = COALESCE(?, membership_status) WHERE user_id = ?')
          .run(updates.role ?? null, updates.membershipStatus ?? null, userId);
      }).immediate();
      return this.getAccountByUserId(userId);
    },

    async getUsageTotals(userId, monthKey, dayKey) {
      const monthRow = db
        .prepare(
          `SELECT COALESCE(SUM(credits_used), 0) AS total
           FROM usage_ledger
           WHERE user_id = ? AND month_key = ? AND status IN ('reserved', 'committed')`
        )
        .get(userId, monthKey) as { total: number };
      const dayRow = db
        .prepare(
          `SELECT COALESCE(SUM(credits_used), 0) AS total
           FROM usage_ledger
           WHERE user_id = ? AND day_key = ? AND status IN ('reserved', 'committed')`
        )
        .get(userId, dayKey) as { total: number };
      const packRow = db.prepare(`SELECT COALESCE(SUM(purchased_credits_used), 0) AS total FROM usage_ledger
        WHERE user_id = ? AND month_key = ? AND status IN ('reserved', 'committed')`)
        .get(userId, monthKey) as { total: number };
      return {
        monthlyUsed: Number(monthRow?.total ?? 0),
        dailyUsed: Number(dayRow?.total ?? 0),
        monthlyPurchasedUsed: Number(packRow?.total ?? 0),
      };
    },

    async getRecentUsage(userId, limit = 15) {
      return db
        .prepare(
          `SELECT id, action_type, credits_used, status, idempotency_key, prompt_summary, refund_reason, created_at
           FROM usage_ledger
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(userId, limit) as UsageLedgerRow[];
    },

    async reserveCredits(input) {
      return reserveTx.immediate(input);
    },

    async finalizeReservation(ledgerId, userId) {
      const res = db
        .prepare(
          `UPDATE usage_ledger SET status = 'committed' WHERE id = ? AND user_id = ? AND status = 'reserved' AND expires_at > datetime('now')`
        )
        .run(ledgerId, userId);
      return res.changes > 0;
    },

    async refundReservation(ledgerId, userId, reason) {
      return db.transaction(() => {
        const row = db.prepare(`SELECT purchased_credits_used FROM usage_ledger WHERE id = ? AND user_id = ? AND status = 'reserved'`)
          .get(ledgerId, userId) as { purchased_credits_used: number } | undefined;
        if (!row) return false;
        db.prepare(`UPDATE usage_ledger SET status = 'refunded', refund_reason = ? WHERE id = ?`)
          .run(reason.slice(0, 160), ledgerId);
        db.prepare('UPDATE agent_accounts SET bonus_credits = bonus_credits + ? WHERE user_id = ?')
          .run(row.purchased_credits_used, userId);
        return true;
      }).immediate();
    },

    async createInvitation(input) {
      const { randomUUID } = await import('crypto');
      const id = randomUUID();
      db.prepare(
        `INSERT INTO invitations (id, reference_code, full_name, email, market, volume_tier, status, assigned_role)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'member')`
      ).run(
        id,
        input.referenceCode,
        input.fullName,
        input.email,
        input.market,
        input.volumeTier
      );
      return db.prepare('SELECT * FROM invitations WHERE id = ?').get(id) as InvitationRow;
    },

    async listInvitations(status) {
      if (status) {
        return db
          .prepare('SELECT * FROM invitations WHERE status = ? ORDER BY created_at DESC LIMIT 100')
          .all(status) as InvitationRow[];
      }
      return db
        .prepare('SELECT * FROM invitations ORDER BY created_at DESC LIMIT 100')
        .all() as InvitationRow[];
    },

    async approveInvitation({ referenceCode, approvedBy, assignedRole = 'member', expiresAt }) {
      const code = referenceCode.trim().toUpperCase();
      db.prepare(
        `UPDATE invitations
         SET status = 'approved', assigned_role = ?, approved_by = ?, approved_at = datetime('now'), expires_at = ?
         WHERE UPPER(reference_code) = ? AND status IN ('pending', 'approved')`
      ).run(assignedRole, approvedBy, expiresAt ?? null, code);
      const row = db
        .prepare('SELECT * FROM invitations WHERE UPPER(reference_code) = ?')
        .get(code) as InvitationRow | undefined;
      return row ?? null;
    },

    async revokeInvitation(referenceCode) {
      const code = referenceCode.trim().toUpperCase();
      db.prepare(
        `UPDATE invitations SET status = 'revoked' WHERE UPPER(reference_code) = ? AND status IN ('pending', 'approved')`
      ).run(code);
      const row = db
        .prepare('SELECT * FROM invitations WHERE UPPER(reference_code) = ?')
        .get(code) as InvitationRow | undefined;
      return row ?? null;
    },

    async redeemInvitation(input) {
      return redeemTx.immediate(input);
    },

    async applyVerifiedBillingEvent(input) {
      return billingTx.immediate(input);
    },

    seedLocalAccountForTests(account) {
      db.prepare(
        `INSERT OR REPLACE INTO agent_accounts (user_id, email, name, role, membership_status, plan_id, bonus_credits, invited_by_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        account.user_id,
        account.email.toLowerCase(),
        account.name,
        account.role,
        account.membership_status,
        account.plan_id,
        account.bonus_credits,
        account.invited_by_code
      );
    },

    close() {
      db.close();
    },
  };
}

let cachedStorePromise: Promise<InnerCircleStore> | null = null;

export async function getConfiguredStore(config: ServerConfig): Promise<InnerCircleStore> {
  if (!cachedStorePromise) {
    cachedStorePromise = (async () => {
      if (config.supabaseUrl && config.supabaseServerKey) {
        return createSupabaseStore(config.supabaseUrl, config.supabaseServerKey);
      }
      if (config.allowLocalSqlite) {
        return createLocalSqliteStore(config.localSqlitePath ?? 'data/inner-circle-local.db');
      }
      throw new Error('SERVER_CONFIG_INCOMPLETE');
    })().catch((err) => {
      cachedStorePromise = null;
      throw err;
    });
  }
  return cachedStorePromise;
}

export function resetCachedStoreForTests() {
  cachedStorePromise = null;
}
