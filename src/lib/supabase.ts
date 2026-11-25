import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || '';

let browserClient: SupabaseClient | null = null;
let browserInitFailed = false;

function createSafeBrowserStorage() {
  const memoryStore = new Map<string, string>();
  let useLocalStorage = false;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probeKey = '__mc_storage_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      useLocalStorage = true;
    }
  } catch {
    useLocalStorage = false;
  }

  return {
    getItem(key: string): string | null {
      if (useLocalStorage) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          useLocalStorage = false;
        }
      }
      return memoryStore.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (useLocalStorage) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch {
          useLocalStorage = false;
        }
      }
      memoryStore.set(key, value);
    },
    removeItem(key: string): void {
      if (useLocalStorage) {
        try {
          window.localStorage.removeItem(key);
          return;
        } catch {
          useLocalStorage = false;
        }
      }
      memoryStore.delete(key);
    },
  };
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) && !browserInitFailed;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseBrowserConfigured()) {
    return null;
  }
  if (!browserClient) {
    try {
      browserClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: createSafeBrowserStorage(),
        },
      });
    } catch {
      browserInitFailed = true;
      return null;
    }
  }
  return browserClient;
}

export async function sendEmailSignInOtp(email: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      'Supabase authentication is not configured in this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to send verification link or code.');
  }
}

export async function verifyEmailSignInOtp(email: string, token: string): Promise<Session> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error('Supabase authentication is not configured in this environment.');
  }

  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  if (error || !data.session) {
    throw new Error(error?.message || 'Invalid or expired verification code.');
  }

  return data.session;
}

export async function completeAuthCallbackFromUrl(): Promise<Session | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    window.history.replaceState({}, document.title, '/');
    if (error) {
      throw new Error('Authentication link expired or invalid. Please request a new sign-in email.');
    }
    return data.session ?? null;
  }

  if (tokenHash && (type === 'magiclink' || type === 'email' || type === 'signup')) {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    window.history.replaceState({}, document.title, '/');
    if (error) {
      throw new Error('Verification link expired or invalid. Please request a new sign-in email.');
    }
    return data.session ?? null;
  }

  if (url.pathname === '/auth/callback') {
    const { data } = await client.auth.getSession();
    window.history.replaceState({}, document.title, '/');
    return data.session ?? null;
  }

  return null;
}

export async function getVerifiedAccessToken(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  await client.auth.signOut();
}
