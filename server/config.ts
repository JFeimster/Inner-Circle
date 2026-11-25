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
  geminiChatModel: string;
  geminiImageModel: string;
  geminiFileModel: string;
}

export const INNER_CIRCLE_SUPABASE_URL = 'https://thdnmgmojhhhtjlhbwvn.supabase.co';

export function isInnerCircleSupabaseUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.origin === INNER_CIRCLE_SUPABASE_URL &&
      (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  } catch {
    return false;
  }
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
  // Local SQLite requires explicit opt-in, including in automated tests.
  const explicitLocalOptIn = env.ALLOW_LOCAL_SQLITE === 'true';
  const allowLocalSqlite = !isProduction && !isVercel && explicitLocalOptIn;

  const geminiApiKey = (env.GEMINI_API_KEY || '').trim() || null;
  const aiGenerationEnabled = Boolean(geminiApiKey) && env.AI_STUDIO_LIVE_ENABLED === 'true';

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
    geminiChatModel: env.GEMINI_CHAT_MODEL?.trim() || 'gemini-4-hydrogen',
    geminiImageModel: env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image',
    geminiFileModel: env.GEMINI_FILE_MODEL?.trim() || 'gemini-4-hydrogen',
  };
}

export function assertValidProductionConfig(config: ServerConfig): string | null {
  if (config.supabaseUrl && !isInnerCircleSupabaseUrl(config.supabaseUrl)) {
    return 'Server configuration incomplete.';
  }
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
