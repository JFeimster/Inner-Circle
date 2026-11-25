import crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { isInnerCircleSupabaseUrl, type ServerConfig } from './config.ts';

export interface VerifiedIdentity {
  userId: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

export interface AuthVerifier {
  verifyBearerToken(token: string): Promise<VerifiedIdentity | null>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization') || req.header('Authorization');
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match || !match[1]) return null;
  return match[1].trim();
}

// --- Supabase JWT Verifier (Production & Staging) ---
export function createSupabaseAuthVerifier(config: ServerConfig): AuthVerifier {
  let cachedClient: SupabaseClient | null = null;

  return {
    async verifyBearerToken(token: string): Promise<VerifiedIdentity | null> {
      if (!isInnerCircleSupabaseUrl(config.supabaseUrl) || !config.supabaseServerKey || !token) {
        return null;
      }

      if (!cachedClient) {
        cachedClient = createClient(config.supabaseUrl, config.supabaseServerKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      }

      const { data, error } = await cachedClient.auth.getUser(token);
      if (error || !data?.user?.id || !data.user.email) {
        return null;
      }

      const metadata = data.user.user_metadata as Record<string, unknown> | undefined;
      const metaName =
        typeof metadata?.full_name === 'string'
          ? metadata.full_name
          : typeof metadata?.name === 'string'
          ? metadata.name
          : undefined;

      return {
        userId: data.user.id,
        email: data.user.email.trim().toLowerCase(),
        name: metaName?.trim() || undefined,
        emailVerified: Boolean(data.user.email_confirmed_at),
      };
    },
  };
}

// --- Signed HMAC Local Dev Token Verifier (Explicit Local Dev / Tests Only) ---
// Replaces unverified email headers and unsigned cookies even in local dev mode.
const EPHEMERAL_LOCAL_SECRET = crypto.randomBytes(32).toString('hex');

interface LocalTokenPayload {
  sub: string;
  email: string;
  name?: string;
  exp: number;
}

export function issueLocalSignedToken(
  identity: VerifiedIdentity,
  secret: string = EPHEMERAL_LOCAL_SECRET,
  ttlSeconds: number = 60 * 60 * 8
): string {
  const payload: LocalTokenPayload = {
    sub: identity.userId,
    email: identity.email.trim().toLowerCase(),
    name: identity.name?.trim() || undefined,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function createLocalSignedTokenVerifier(
  secret: string = EPHEMERAL_LOCAL_SECRET
): AuthVerifier {
  return {
    async verifyBearerToken(token: string): Promise<VerifiedIdentity | null> {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [encoded, providedSig] = parts;
      if (!encoded || !providedSig) return null;

      const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
      const a = Buffer.from(providedSig, 'utf8');
      const b = Buffer.from(expectedSig, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
      }

      try {
        const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<LocalTokenPayload>;
        if (
          typeof parsed.sub !== 'string' ||
          !isValidUuid(parsed.sub) ||
          typeof parsed.email !== 'string' ||
          !parsed.email.includes('@') ||
          typeof parsed.exp !== 'number' ||
          parsed.exp < Math.floor(Date.now() / 1000)
        ) {
          return null;
        }
        return {
          userId: parsed.sub,
          email: parsed.email.trim().toLowerCase(),
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          emailVerified: true,
        };
      } catch {
        return null;
      }
    },
  };
}

// --- Verified Billing Webhook Signature Verification (HMAC-SHA256) ---
export function verifyBillingWebhookSignature(
  rawPayload: string,
  signatureHeader: string | undefined,
  secret: string | null
): boolean {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((segment) => {
      const idx = segment.indexOf('=');
      return idx > 0 ? [segment.slice(0, idx).trim(), segment.slice(idx + 1).trim()] : ['', ''];
    })
  );

  const timestamp = Number(parts.t);
  const sig = parts.v1;
  if (!Number.isFinite(timestamp) || !sig) return false;

  // Reject stale webhook signatures (> 5 minutes skew)
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawPayload}`)
    .digest('hex');

  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createBillingWebhookSignature(
  rawPayload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawPayload}`)
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}
