export interface ServerConfig {
  isProduction: boolean;
  isVercel: boolean;
  supabaseUrl: string | null;
  supabaseServerKey: string | null;
  supabaseKeySource: 'secret_key' | 'service_role_key' | null;
  allowLocalSqlite: boolean;
  localSqlitePath: string | null;
  geminiApiKey: string | null;
  aiGenerationEnabled: boolean;
  billingWebhookSecret: string | null;
  appUrl: string | null;
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isVercel = env.VERCEL === '1' || env.VERCEL === 'true';
  const isProduction = env.NODE_ENV === 'production' || isVercel;

  const supabaseUrl = (env.SUPABASE_URL || '').trim() || null;
  const secretKey = (env.SUPABASE_SECRET_KEY || '').trim() || null;
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim() || null;

  const supabaseServerKey = secretKey || serviceRoleKey;
  const supabaseKeySource = secretKey
    ? 'secret_key'
    : serviceRoleKey
    ? 'service_role_key'
    : null;

  // SQLite is strictly prohibited in production or on Vercel.
  // In local dev/test, allow explicit SQLite via ALLOW_LOCAL_SQLITE=true or when Supabase server config is unset.
  const explicitLocalOptIn = env.ALLOW_LOCAL_SQLITE === 'true';
  const explicitLocalOptOut = env.ALLOW_LOCAL_SQLITE === 'false';
  const allowLocalSqlite =
    !isProduction &&
    !isVercel &&
    !explicitLocalOptOut &&
    (explicitLocalOptIn || !supabaseUrl || !supabaseServerKey);

  const geminiApiKey = (env.GEMINI_API_KEY || '').trim() || null;
  // Require explicit opt-in flag in production before enabling paid Gemini calls;
  // in local/staging dev, disabled when AI_STUDIO_LIVE_ENABLED === 'false' or key is unset.
  const aiGenerationEnabled =
    Boolean(geminiApiKey) &&
    env.AI_STUDIO_LIVE_ENABLED !== 'false' &&
    (!isProduction || env.AI_STUDIO_LIVE_ENABLED === 'true');

  const billingWebhookSecret = (env.BILLING_WEBHOOK_SECRET || '').trim() || null;
  const appUrl = (env.APP_URL || '').trim() || null;

  return {
    isProduction,
    isVercel,
    supabaseUrl,
    supabaseServerKey,
    supabaseKeySource,
    allowLocalSqlite,
    localSqlitePath: (env.LOCAL_SQLITE_PATH || '').trim() || null,
    geminiApiKey,
    aiGenerationEnabled,
    billingWebhookSecret,
    appUrl,
  };
}

export function assertValidProductionConfig(config: ServerConfig): string | null {
  if (config.isProduction && (!config.supabaseUrl || !config.supabaseServerKey)) {
    return 'Server configuration incomplete.';
  }
  if (!config.supabaseUrl && !config.allowLocalSqlite) {
    return 'Server configuration incomplete.';
  }
  if (config.supabaseUrl && !config.supabaseServerKey) {
    return 'Server configuration incomplete.';
  }
  return null;
}
