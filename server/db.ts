import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AccountRow {
  email: string;
  name: string;
  role: string;
  plan_id: string;
  bonus_credits: number;
}

export interface UsageEntry {
  id: number;
  action_type: string;
  credits_used: number;
  prompt_summary: string;
  created_at: string;
}

export interface DatabaseAdapter {
  driver: 'supabase' | 'postgres' | 'sqlite';
  getAccount(email: string): Promise<AccountRow | null>;
  ensureAccount(email: string, name: string, role: string): Promise<void>;
  updateAccountPlan(email: string, planId: string): Promise<void>;
  addBonusCredits(email: string, credits: number): Promise<void>;
  getMonthlyUsageTotal(email: string, monthKey: string): Promise<number>;
  getDailyUsageTotal(email: string, dayKey: string): Promise<number>;
  getRecentUsage(email: string, limit?: number): Promise<UsageEntry[]>;
  insertUsage(
    email: string,
    actionType: string,
    creditsUsed: number,
    promptSummary: string,
    monthKey: string,
    dayKey: string
  ): Promise<void>;
  insertInvitation(
    referenceCode: string,
    fullName: string,
    email: string,
    market: string,
    volumeTier: string
  ): Promise<void>;
}

const DEFAULT_SEED_EMAIL = 'jasonfeimster@gmail.com';
const DEFAULT_SEED_NAME = 'Jason Feimster';
const DEFAULT_SEED_ROLE = 'Elite Agent · Inner Circle';

const POSTGRES_SCHEMA_SQL = `
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

  ALTER TABLE public.agent_accounts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
`;

function getSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (url && serviceRoleKey) {
    return { url, serviceRoleKey };
  }
  return null;
}

function getPostgresConnectionString(): string | null {
  const candidates = [
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

let cachedAdapterPromise: Promise<DatabaseAdapter> | null = null;
let cachedPgPool: Pool | null = null;
let cachedSupabaseClient: SupabaseClient | null = null;

async function bootstrapPostgresSchema(connectionString: string): Promise<Pool> {
  const needsSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    Boolean(process.env.VERCEL) ||
    process.env.NODE_ENV === 'production';

  if (!cachedPgPool) {
    cachedPgPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  await cachedPgPool.query(POSTGRES_SCHEMA_SQL);
  await cachedPgPool.query(
    `INSERT INTO public.agent_accounts (email, name, role, plan_id, bonus_credits)
     VALUES ($1, $2, $3, 'onboarding', 0)
     ON CONFLICT (email) DO NOTHING`,
    [DEFAULT_SEED_EMAIL, DEFAULT_SEED_NAME, DEFAULT_SEED_ROLE]
  );

  return cachedPgPool;
}

function formatSupabaseError(context: string, err: { message: string; code?: string }): Error {
  if (err.code === '42P01' || err.message.includes('does not exist') || err.message.includes('schema cache')) {
    return new Error(
      `Supabase tables not initialized yet. Run /db/supabase-schema.sql once in your Supabase SQL Editor (${context}).`
    );
  }
  return new Error(`Supabase ${context} failed: ${err.message}`);
}

async function createSupabaseAdapter(url: string, serviceRoleKey: string): Promise<DatabaseAdapter> {
  // If Vercel's Supabase integration also injected POSTGRES_URL, auto-create tables idempotently
  const pgUrl = getPostgresConnectionString();
  if (pgUrl) {
    try {
      await bootstrapPostgresSchema(pgUrl);
    } catch {
      // Non-fatal: tables may already be created manually via /db/supabase-schema.sql
    }
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  const supabase = cachedSupabaseClient;

  // Ensure default seed member exists via PostgREST upsert (ignoreDuplicates)
  const { error: seedError } = await supabase.from('agent_accounts').upsert(
    {
      email: DEFAULT_SEED_EMAIL,
      name: DEFAULT_SEED_NAME,
      role: DEFAULT_SEED_ROLE,
      plan_id: 'onboarding',
      bonus_credits: 0,
    },
    { onConflict: 'email', ignoreDuplicates: true }
  );
  if (seedError) {
    throw formatSupabaseError('initialization', seedError);
  }

  return {
    driver: 'supabase',

    async getAccount(email: string) {
      const { data, error } = await supabase
        .from('agent_accounts')
        .select('email, name, role, plan_id, bonus_credits')
        .eq('email', email)
        .maybeSingle();

      if (error) throw formatSupabaseError('getAccount', error);
      return (data as AccountRow | null) ?? null;
    },

    async ensureAccount(email: string, name: string, role: string) {
      const { error } = await supabase.from('agent_accounts').upsert(
        {
          email,
          name,
          role,
          plan_id: 'onboarding',
          bonus_credits: 0,
        },
        { onConflict: 'email', ignoreDuplicates: true }
      );
      if (error) throw formatSupabaseError('ensureAccount', error);
    },

    async updateAccountPlan(email: string, planId: string) {
      const { error } = await supabase
        .from('agent_accounts')
        .update({ plan_id: planId })
        .eq('email', email);
      if (error) throw formatSupabaseError('updateAccountPlan', error);
    },

    async addBonusCredits(email: string, credits: number) {
      const existing = await this.getAccount(email);
      if (!existing) return;
      const { error } = await supabase
        .from('agent_accounts')
        .update({ bonus_credits: Number(existing.bonus_credits) + credits })
        .eq('email', email);
      if (error) throw formatSupabaseError('addBonusCredits', error);
    },

    async getMonthlyUsageTotal(email: string, monthKey: string) {
      const { data, error } = await supabase
        .from('usage_ledger')
        .select('credits_used')
        .eq('agent_email', email)
        .eq('month_key', monthKey);

      if (error) throw formatSupabaseError('getMonthlyUsageTotal', error);
      return (data ?? []).reduce((sum, row) => sum + Number(row.credits_used ?? 0), 0);
    },

    async getDailyUsageTotal(email: string, dayKey: string) {
      const { data, error } = await supabase
        .from('usage_ledger')
        .select('credits_used')
        .eq('agent_email', email)
        .eq('day_key', dayKey);

      if (error) throw formatSupabaseError('getDailyUsageTotal', error);
      return (data ?? []).reduce((sum, row) => sum + Number(row.credits_used ?? 0), 0);
    },

    async getRecentUsage(email: string, limit = 10) {
      const { data, error } = await supabase
        .from('usage_ledger')
        .select('id, action_type, credits_used, prompt_summary, created_at')
        .eq('agent_email', email)
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw formatSupabaseError('getRecentUsage', error);
      return ((data ?? []) as UsageEntry[]).map((row) => ({
        ...row,
        id: Number(row.id),
        credits_used: Number(row.credits_used),
      }));
    },

    async insertUsage(email, actionType, creditsUsed, promptSummary, monthKey, dayKey) {
      const { error } = await supabase.from('usage_ledger').insert({
        agent_email: email,
        action_type: actionType,
        credits_used: creditsUsed,
        prompt_summary: promptSummary.slice(0, 140),
        month_key: monthKey,
        day_key: dayKey,
      });
      if (error) throw formatSupabaseError('insertUsage', error);
    },

    async insertInvitation(referenceCode, fullName, email, market, volumeTier) {
      const { error } = await supabase.from('invitations').insert({
        reference_code: referenceCode,
        full_name: fullName,
        email,
        market,
        volume_tier: volumeTier,
      });
      if (error) throw formatSupabaseError('insertInvitation', error);
    },
  };
}

async function createPostgresAdapter(connectionString: string): Promise<DatabaseAdapter> {
  const pool = await bootstrapPostgresSchema(connectionString);

  return {
    driver: 'postgres',

    async getAccount(email: string) {
      const result = await pool.query<AccountRow>(
        'SELECT email, name, role, plan_id, bonus_credits FROM public.agent_accounts WHERE email = $1',
        [email]
      );
      return result.rows[0] ?? null;
    },

    async ensureAccount(email: string, name: string, role: string) {
      await pool.query(
        `INSERT INTO public.agent_accounts (email, name, role, plan_id, bonus_credits)
         VALUES ($1, $2, $3, 'onboarding', 0)
         ON CONFLICT (email) DO NOTHING`,
        [email, name, role]
      );
    },

    async updateAccountPlan(email: string, planId: string) {
      await pool.query('UPDATE public.agent_accounts SET plan_id = $1 WHERE email = $2', [
        planId,
        email,
      ]);
    },

    async addBonusCredits(email: string, credits: number) {
      await pool.query(
        'UPDATE public.agent_accounts SET bonus_credits = bonus_credits + $1 WHERE email = $2',
        [credits, email]
      );
    },

    async getMonthlyUsageTotal(email: string, monthKey: string) {
      const result = await pool.query<{ total: string | number }>(
        'SELECT COALESCE(SUM(credits_used), 0) AS total FROM public.usage_ledger WHERE agent_email = $1 AND month_key = $2',
        [email, monthKey]
      );
      return Number(result.rows[0]?.total ?? 0);
    },

    async getDailyUsageTotal(email: string, dayKey: string) {
      const result = await pool.query<{ total: string | number }>(
        'SELECT COALESCE(SUM(credits_used), 0) AS total FROM public.usage_ledger WHERE agent_email = $1 AND day_key = $2',
        [email, dayKey]
      );
      return Number(result.rows[0]?.total ?? 0);
    },

    async getRecentUsage(email: string, limit = 10) {
      const result = await pool.query<UsageEntry>(
        `SELECT id, action_type, credits_used, prompt_summary, created_at::text AS created_at
         FROM public.usage_ledger
         WHERE agent_email = $1
         ORDER BY id DESC
         LIMIT $2`,
        [email, limit]
      );
      return result.rows;
    },

    async insertUsage(email, actionType, creditsUsed, promptSummary, monthKey, dayKey) {
      await pool.query(
        `INSERT INTO public.usage_ledger (agent_email, action_type, credits_used, prompt_summary, month_key, day_key)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [email, actionType, creditsUsed, promptSummary.slice(0, 140), monthKey, dayKey]
      );
    },

    async insertInvitation(referenceCode, fullName, email, market, volumeTier) {
      await pool.query(
        `INSERT INTO public.invitations (reference_code, full_name, email, market, volume_tier)
         VALUES ($1, $2, $3, $4, $5)`,
        [referenceCode, fullName, email, market, volumeTier]
      );
    },
  };
}

async function createSqliteAdapter(): Promise<DatabaseAdapter> {
  // Dynamic import keeps native better-sqlite3 out of Vercel serverless deployments
  const { default: Database } = await import('better-sqlite3');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dataDir = path.resolve(__dirname, '..', 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(path.join(dataDir, 'moonshine.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_accounts (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Elite Agent',
      plan_id TEXT NOT NULL DEFAULT 'onboarding',
      bonus_credits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_email TEXT NOT NULL,
      action_type TEXT NOT NULL,
      credits_used INTEGER NOT NULL,
      prompt_summary TEXT NOT NULL,
      month_key TEXT NOT NULL,
      day_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_email) REFERENCES agent_accounts(email)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      market TEXT NOT NULL,
      volume_tier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_usage_agent_month
      ON usage_ledger (agent_email, month_key);
    CREATE INDEX IF NOT EXISTS idx_usage_agent_day
      ON usage_ledger (agent_email, day_key);
  `);

  db.prepare(
    `INSERT OR IGNORE INTO agent_accounts (email, name, role, plan_id, bonus_credits)
     VALUES (?, ?, ?, 'onboarding', 0)`
  ).run(DEFAULT_SEED_EMAIL, DEFAULT_SEED_NAME, DEFAULT_SEED_ROLE);

  return {
    driver: 'sqlite',

    async getAccount(email: string) {
      const row = db
        .prepare('SELECT email, name, role, plan_id, bonus_credits FROM agent_accounts WHERE email = ?')
        .get(email) as AccountRow | undefined;
      return row ?? null;
    },

    async ensureAccount(email: string, name: string, role: string) {
      db.prepare(
        `INSERT OR IGNORE INTO agent_accounts (email, name, role, plan_id, bonus_credits)
         VALUES (?, ?, ?, 'onboarding', 0)`
      ).run(email, name, role);
    },

    async updateAccountPlan(email: string, planId: string) {
      db.prepare('UPDATE agent_accounts SET plan_id = ? WHERE email = ?').run(planId, email);
    },

    async addBonusCredits(email: string, credits: number) {
      db.prepare('UPDATE agent_accounts SET bonus_credits = bonus_credits + ? WHERE email = ?').run(
        credits,
        email
      );
    },

    async getMonthlyUsageTotal(email: string, monthKey: string) {
      const row = db
        .prepare(
          'SELECT COALESCE(SUM(credits_used), 0) AS total FROM usage_ledger WHERE agent_email = ? AND month_key = ?'
        )
        .get(email, monthKey) as { total: number };
      return Number(row?.total ?? 0);
    },

    async getDailyUsageTotal(email: string, dayKey: string) {
      const row = db
        .prepare(
          'SELECT COALESCE(SUM(credits_used), 0) AS total FROM usage_ledger WHERE agent_email = ? AND day_key = ?'
        )
        .get(email, dayKey) as { total: number };
      return Number(row?.total ?? 0);
    },

    async getRecentUsage(email: string, limit = 10) {
      return db
        .prepare(
          `SELECT id, action_type, credits_used, prompt_summary, created_at
           FROM usage_ledger
           WHERE agent_email = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(email, limit) as UsageEntry[];
    },

    async insertUsage(email, actionType, creditsUsed, promptSummary, monthKey, dayKey) {
      db.prepare(
        `INSERT INTO usage_ledger (agent_email, action_type, credits_used, prompt_summary, month_key, day_key)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(email, actionType, creditsUsed, promptSummary.slice(0, 140), monthKey, dayKey);
    },

    async insertInvitation(referenceCode, fullName, email, market, volumeTier) {
      db.prepare(
        `INSERT INTO invitations (reference_code, full_name, email, market, volume_tier)
         VALUES (?, ?, ?, ?, ?)`
      ).run(referenceCode, fullName, email, market, volumeTier);
    },
  };
}

export async function getDb(): Promise<DatabaseAdapter> {
  if (!cachedAdapterPromise) {
    cachedAdapterPromise = (async () => {
      const supabaseCfg = getSupabaseConfig();
      if (supabaseCfg) {
        return createSupabaseAdapter(supabaseCfg.url, supabaseCfg.serviceRoleKey);
      }
      const pgUrl = getPostgresConnectionString();
      if (pgUrl) {
        return createPostgresAdapter(pgUrl);
      }
      if (process.env.VERCEL) {
        throw new Error(
          'Supabase database is not connected. Link your Supabase project in Vercel (injecting SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY or POSTGRES_URL).'
        );
      }
      return createSqliteAdapter();
    })().catch((err) => {
      cachedAdapterPromise = null;
      throw err;
    });
  }
  return cachedAdapterPromise;
}
