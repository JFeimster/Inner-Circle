import crypto from 'crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { assertValidProductionConfig, loadServerConfig, type ServerConfig } from './config.ts';
import {
  type AuthVerifier,
  createLocalSignedTokenVerifier,
  createSupabaseAuthVerifier,
  extractBearerToken,
  isValidUuid,
  verifyBillingWebhookSignature,
  type VerifiedIdentity,
} from './auth.ts';
import {
  type AgentAccountRow,
  getConfiguredStore,
  type InnerCircleStore,
  type InvitationStatus,
  type MemberRole,
  type MembershipStatus,
  type PlanId,
} from './db.ts';
import { SlidingWindowRateLimiter } from './rateLimit.ts';

dotenv.config();

// --- Pricing & Credit Plan Definitions (Source of Truth) ---
export interface StudioPlan {
  id: PlanId;
  name: string;
  audience: string;
  priceMonthly: number;
  billingCadence: string;
  monthlyCredits: number;
  dailyLimit: number;
  features: string[];
}

export const STUDIO_PLANS: StudioPlan[] = [
  {
    id: 'onboarding',
    name: 'Onboarding Access',
    audience: 'For new agents in their first 30 days',
    priceMonthly: 0,
    billingCadence: 'Included with network membership',
    monthlyCredits: 30,
    dailyLimit: 10,
    features: [
      '30 AI credits per month (10/day cap)',
      'Concierge chat for scripts & market prep (1 credit)',
      'Downloadable client files & templates (2 credits)',
      'Brand image generation previews (5 credits)',
    ],
  },
  {
    id: 'producer',
    name: 'Pro Producer',
    audience: 'For active dealmakers & weekly outreach',
    priceMonthly: 49,
    billingCadence: '$49 / month per agent seat',
    monthlyCredits: 250,
    dailyLimit: 50,
    features: [
      '250 AI credits per month (50/day cap)',
      'Up to 50 custom marketing images or 125 client files',
      'Full Marketing Vault & outreach sequence drafting',
      'Eligible for one-time credit top-up packs',
    ],
  },
  {
    id: 'inner_circle',
    name: 'Inner Circle Studio',
    audience: 'For top producers, partners & luxury teams',
    priceMonthly: 149,
    billingCadence: '$149 / month (or waived at Platinum tier)',
    monthlyCredits: 1000,
    dailyLimit: 150,
    features: [
      '1,000 AI credits per month (150/day cap)',
      'High-volume listing visuals, pitch briefs & CSV trackers',
      'Priority queue & dedicated brokerage cost reporting',
      'Unused top-up credits roll over month to month',
    ],
  },
];

export const TOPUP_PACKS = [
  { id: 'pack_100', name: '100 Credit Top-Up', credits: 100, priceUsd: 19 },
  { id: 'pack_300', name: '300 Credit Top-Up', credits: 300, priceUsd: 49 },
] as const;

export const CREDIT_COSTS = {
  chat: 1,
  file: 2,
  image: 5,
} as const;

export interface AiGenerator {
  chat(
    message: string,
    history: Array<{ role: 'user' | 'model'; text: string }>
  ): Promise<{ reply: string }>;
  image(
    prompt: string,
    aspectRatio: string
  ): Promise<{ imageUrl: string; caption: string }>;
  file(
    prompt: string,
    format: 'md' | 'csv' | 'txt' | 'html'
  ): Promise<{ filename: string; title: string; summary: string; content: string }>;
}

export interface CreateApiAppOptions {
  config?: ServerConfig;
  store?: InnerCircleStore;
  authVerifier?: AuthVerifier;
  aiGenerator?: AiGenerator;
  studioRateLimiter?: SlidingWindowRateLimiter;
  publicRateLimiter?: SlidingWindowRateLimiter;
}

interface AuthedRequest extends Request {
  identity?: VerifiedIdentity;
  account?: AgentAccountRow;
  rawBody?: string;
}

function getDateKeys() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return {
    monthKey: `${year}-${month}`,
    dayKey: `${year}-${month}-${day}`,
  };
}

function getPlan(planId: string): StudioPlan {
  return STUDIO_PLANS.find((p) => p.id === planId) ?? STUDIO_PLANS[0];
}

function createGeminiGenerator(config: ServerConfig): AiGenerator {
  const getClient = (): GoogleGenAI => {
    if (!config.aiGenerationEnabled || !config.geminiApiKey) {
      throw new Error('AI_GENERATION_UNAVAILABLE');
    }
    return new GoogleGenAI({
      apiKey: config.geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  return {
    async chat(message, history) {
      const ai = getClient();
      const contents = [
        ...history.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        { role: 'user' as const, parts: [{ text: message }] },
      ];

      const response = await ai.models.generateContent({
        model: config.geminiChatModel,
        contents,
        config: {
          systemInstruction:
            'You are the Moonshine Capital Executive Concierge—an elite onboarding, commercial funding & capital advisory, sales script, and client communications specialist. Provide crisp, high-trust, actionable guidance tailored for Moonshine Capital partners.',
        },
      });

      const reply = response.text?.trim();
      if (!reply) throw new Error('EMPTY_MODEL_RESPONSE');
      return { reply };
    },

    async image(prompt, aspectRatio) {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: config.geminiImageModel,
        contents: {
          parts: [
            {
              text: `${prompt}. Refined luxury editorial quality suitable for Moonshine Capital private capital advisory and commercial funding marketing.`,
            },
          ],
        },
        config: {
          imageConfig: { aspectRatio },
        },
      });

      let imageUrl: string | null = null;
      let caption = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        throw new Error('EMPTY_IMAGE_RESPONSE');
      }

      return { imageUrl, caption: caption.trim() };
    },

    async file(prompt, format) {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: config.geminiFileModel,
        contents: `Create a polished, ready-to-use .${format} file for a Moonshine Capital funding broker and capital advisory partner based on this request:\n\n${prompt}`,
        config: {
          systemInstruction:
            'You generate clean, executive-ready deliverables for Moonshine Capital partners. Return valid JSON matching the requested schema. Ensure filename uses lowercase kebab-case ending with the requested file extension.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              filename: { type: Type.STRING },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ['filename', 'title', 'summary', 'content'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as {
        filename?: string;
        title?: string;
        summary?: string;
        content?: string;
      };

      const safeFilename = (parsed.filename || `moonshine-deliverable.${format}`)
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-');

      return {
        filename: safeFilename.endsWith(`.${format}`) ? safeFilename : `${safeFilename}.${format}`,
        title: parsed.title || 'Generated Deliverable',
        summary: parsed.summary || '',
        content: parsed.content || '',
      };
    },
  };
}

async function buildAccountSnapshot(store: InnerCircleStore, account: AgentAccountRow) {
  const plan = getPlan(account.plan_id);
  const { monthKey, dayKey } = getDateKeys();

  const [{ monthlyUsed, dailyUsed, monthlyPurchasedUsed }, recentUsage] = await Promise.all([
    store.getUsageTotals(account.user_id, monthKey, dayKey),
    store.getRecentUsage(account.user_id, 15),
  ]);

  const remainingCredits = Math.max(0, plan.monthlyCredits - (monthlyUsed - monthlyPurchasedUsed)) + account.bonus_credits;
  const monthlyAllowance = monthlyUsed + remainingCredits;
  const remainingDaily = Math.max(0, plan.dailyLimit - dailyUsed);

  return {
    userId: account.user_id,
    email: account.email,
    name: account.name,
    role: account.role,
    membershipStatus: account.membership_status,
    plan,
    bonusCredits: account.bonus_credits,
    monthlyAllowance,
    monthlyUsed,
    remainingCredits,
    dailyLimit: plan.dailyLimit,
    dailyUsed,
    remainingDaily,
    recentUsage,
  };
}

function getIdempotencyKey(req: Request): string {
  const raw = req.header('idempotency-key') || req.header('Idempotency-Key');
  if (raw && /^[a-zA-Z0-9._:-]{8,128}$/.test(raw.trim())) {
    return raw.trim();
  }
  return `auto-${crypto.randomUUID()}`;
}

function hasValidIdempotencyKey(req: Request): boolean {
  return /^[a-zA-Z0-9._:-]{8,128}$/.test((req.header('idempotency-key') || '').trim());
}

function mapAiErrorToSafeResponse(err: unknown): { status: number; message: string; reason: string } {
  const raw = err instanceof Error ? err.message : '';
  if (raw === 'AI_GENERATION_UNAVAILABLE') {
    return {
      status: 503,
      message: 'AI Studio generation is currently disabled in this environment.',
      reason: 'ai_generation_disabled',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'AI service is temporarily busy. Please retry shortly.',
      reason: 'upstream_rate_limit',
    };
  }
  return {
    status: 502,
    message: 'Unable to complete the AI request.',
    reason: 'generation_failed',
  };
}

function mapReservationFailure(
  errorCode: string | null,
  resData: { monthlyUsed: number; monthlyAllowance: number; dailyUsed: number; dailyLimit: number }
): { status: number; error: string } {
  switch (errorCode) {
    case 'ACCOUNT_NOT_FOUND':
      return { status: 403, error: 'Active Inner Circle membership is required.' };
    case 'MEMBERSHIP_INACTIVE':
      return { status: 403, error: 'Your membership is currently inactive. Contact an administrator.' };
    case 'DUPLICATE_IDEMPOTENCY_KEY':
      return {
        status: 409,
        error: 'Duplicate request detected for this Idempotency-Key. Please submit a fresh request.',
      };
    case 'MONTHLY_LIMIT_EXCEEDED':
      return {
        status: 429,
        error: `Monthly credit limit reached (${resData.monthlyUsed}/${resData.monthlyAllowance} credits used).`,
      };
    case 'DAILY_LIMIT_EXCEEDED':
      return {
        status: 429,
        error: `Daily safety cap reached (${resData.dailyUsed}/${resData.dailyLimit} credits used today). Resets at 00:00 UTC.`,
      };
    default:
      return { status: 400, error: 'Unable to reserve credits for this request.' };
  }
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const config = options.config ?? loadServerConfig();
  const studioLimiter = options.studioRateLimiter ?? new SlidingWindowRateLimiter(30, 60_000);
  const publicLimiter = options.publicRateLimiter ?? new SlidingWindowRateLimiter(15, 60_000);

  const authVerifier: AuthVerifier =
    options.authVerifier ??
    (config.supabaseUrl && config.supabaseServerKey
      ? createSupabaseAuthVerifier(config)
      : createLocalSignedTokenVerifier());

  const aiGenerator: AiGenerator = options.aiGenerator ?? createGeminiGenerator(config);

  const resolveStore = async (): Promise<InnerCircleStore> => {
    const configErr = assertValidProductionConfig(config);
    if (configErr) {
      throw new Error('SERVER_CONFIG_INCOMPLETE');
    }
    if (options.store) return options.store;
    return getConfiguredStore(config);
  };

  const consumeLimit = async (key: string, limit: number, seconds: number) => {
    const store = await resolveStore();
    return store.driver === 'supabase'
      ? store.consumeRateLimit(key, limit, seconds)
      : (key.startsWith('invite:') ? publicLimiter : studioLimiter).consume(key);
  };

  const app = express();
  app.set('trust proxy', 1);

  // Security headers for all API endpoints
  app.use('/api', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Capture raw request body for HMAC webhook verification without mutating JSON parsing
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as AuthedRequest).rawBody = buf.toString('utf8');
      },
    })
  );

  // --- Auth & Membership Middleware ---
  const requireVerifiedAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        res.status(401).json({ error: 'Authentication required. Provide a valid Bearer session token.' });
        return;
      }

      const identity = await authVerifier.verifyBearerToken(token);
      if (!identity || !isValidUuid(identity.userId)) {
        res.status(401).json({ error: 'Invalid or expired authentication session.' });
        return;
      }

      req.identity = identity;
      next();
    } catch {
      res.status(401).json({ error: 'Unable to verify authentication session.' });
    }
  };

  const requireActiveMember = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const identity = req.identity;
      if (!identity) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const store = await resolveStore();
      const account = await store.getAccountByUserId(identity.userId);
      if (!account) {
        res.status(403).json({
          error: 'Invitation-based onboarding is required before accessing Inner Circle.',
          code: 'ONBOARDING_REQUIRED',
        });
        return;
      }
      if (account.membership_status !== 'active') {
        res.status(403).json({
          error: 'Your membership is not active. Contact a Moonshine Capital administrator.',
          code: 'MEMBERSHIP_INACTIVE',
        });
        return;
      }
      req.account = account;
      next();
    } catch {
      res.status(503).json({ error: 'Service temporarily unavailable.' });
    }
  };

  const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.account || req.account.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges are required.' });
      return;
    }
    next();
  };

  const limitAdminMutation = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const rate = await consumeLimit(`admin:${req.account!.user_id}`, 30, 60);
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        res.status(429).json({ error: 'Administrator rate limit exceeded.' });
        return;
      }
      next();
    } catch {
      res.status(503).json({ error: 'Service temporarily unavailable.' });
    }
  };

  // --- 1. Strictly Non-Mutating Health Check ---
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const store = await resolveStore();
      await store.ping();
      res.status(200).json({
        ok: true,
        mode: store.driver,
        authMode: config.supabaseUrl && config.supabaseServerKey ? 'supabase' : 'local-signed',
        aiLiveEnabled: config.aiGenerationEnabled,
        billingWebhookConfigured: Boolean(config.billingWebhookSecret),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        ok: false,
        error: 'Service temporarily unavailable.',
      });
    }
  });

  // --- 1b. Public Pricing Catalog (Strictly Read-Only, Zero DB Dependency) ---
  app.get('/api/pricing', (_req: Request, res: Response) => {
    res.status(200).json({
      plans: STUDIO_PLANS,
      topupPacks: TOPUP_PACKS,
      creditCosts: CREDIT_COSTS,
      billing: {
        mode: 'verified_webhook_required',
        livePaymentsEnabled: Boolean(config.billingWebhookSecret),
        selfUpgradeAllowed: false,
      },
    });
  });

  // --- 2. Authentication Callback Route (Redirects PKCE code cleanly to SPA callback) ---
  app.get('/api/auth/callback', (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const tokenHash = typeof req.query.token_hash === 'string' ? req.query.token_hash.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';

    const params = new URLSearchParams();
    if (code) params.set('code', code);
    if (tokenHash) params.set('token_hash', tokenHash);
    if (type) params.set('type', type);

    const qs = params.toString();
    res.redirect(302, qs ? `/auth/callback?${qs}` : '/auth/callback');
  });

  // --- 3. Authenticated Identity & Membership Inspection ---
  app.get('/api/auth/me', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const identity = req.identity!;
      const store = await resolveStore();
      const account = await store.getAccountByUserId(identity.userId);
      const snapshot = account?.membership_status === 'active'
        ? await buildAccountSnapshot(store, account) : null;

      res.json({
        authenticated: true,
        user: {
          id: identity.userId,
          email: identity.email,
          name: account?.membership_status === 'active' ? account.name : (identity.name ?? identity.email.split('@')[0]),
        },
        onboarded: Boolean(account),
        membershipStatus: account?.membership_status ?? null,
        role: account?.membership_status === 'active' ? account.role : null,
        account: snapshot,
      });
    } catch {
      res.status(503).json({ error: 'Service temporarily unavailable.' });
    }
  });

  // --- 4. Invitation-Based Agent Onboarding ---
  app.post('/api/invitations', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    let rate;
    try { rate = await consumeLimit(`invite:${crypto.createHash('sha256').update(clientIp).digest('hex')}`, 15, 60); }
    catch { res.status(503).json({ error: 'Service temporarily unavailable.' }); return; }
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({ error: 'Too many invitation requests. Please try again shortly.' });
      return;
    }

    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const market = typeof req.body?.market === 'string' ? req.body.market.trim() : '';
    const volumeTier = typeof req.body?.volumeTier === 'string' ? req.body.volumeTier.trim() : '';

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      res.status(400).json({ error: 'Please provide your full name.' });
      return;
    }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid work email address.' });
      return;
    }
    if (!market || market.length > 120) {
      res.status(400).json({ error: 'Please enter your primary market or territory.' });
      return;
    }

    try {
      const store = await resolveStore();
      const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      const referenceCode = `MC-${randomHex}`;

      const invitation = await store.createInvitation({
        referenceCode,
        fullName,
        email,
        market,
        volumeTier: volumeTier.slice(0, 60) || '$10M – $25M',
      });

      res.status(201).json({
        referenceCode: invitation.reference_code,
        fullName: invitation.full_name,
        email: invitation.email,
        market: invitation.market,
        status: invitation.status,
        message: 'Your invitation request has been logged for administrator review.',
      });
    } catch {
      res.status(503).json({ error: 'Unable to submit invitation request right now.' });
    }
  });

  app.post(
    '/api/onboarding/redeem',
    requireVerifiedAuth,
    async (req: AuthedRequest, res: Response) => {
      const identity = req.identity!;
      if (!identity.emailVerified) {
        res.status(403).json({ error: 'Verify your email before redeeming an invitation.' });
        return;
      }
      let rate;
      try { rate = await consumeLimit(`redeem:${identity.userId}`, 10, 60); }
      catch { res.status(503).json({ error: 'Service temporarily unavailable.' }); return; }
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        res.status(429).json({ error: 'Too many redemption attempts. Please wait and retry.' });
        return;
      }

      const inviteCode =
        typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim().toUpperCase() : '';
      const displayName =
        typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : '';

      if (!inviteCode || inviteCode.length < 4 || inviteCode.length > 64) {
        res.status(400).json({ error: 'Please provide your approved invitation code.' });
        return;
      }

      try {
        const store = await resolveStore();
        const result = await store.redeemInvitation({
          userId: identity.userId,
          email: identity.email,
          name: displayName || identity.name || '',
          referenceCode: inviteCode,
        });

        if (!result.ok) {
          switch (result.errorCode) {
            case 'INVITE_ALREADY_REDEEMED':
              res.status(409).json({ error: 'This invitation code has already been redeemed.' });
              return;
            case 'INVITE_EXPIRED':
              res.status(410).json({ error: 'This invitation code has expired.' });
              return;
            case 'INVITE_EMAIL_MISMATCH':
              res.status(403).json({
                error: 'This invitation code is assigned to a different verified email address.',
              });
              return;
            case 'INVITE_NOT_APPROVED':
              res.status(403).json({
                error: 'Your invitation is still pending administrator approval.',
              });
              return;
            default:
              res.status(403).json({ error: 'Invalid or unapproved invitation code.' });
              return;
          }
        }

        const account = await store.getAccountByUserId(identity.userId);
        const snapshot = account ? await buildAccountSnapshot(store, account) : null;

        res.status(200).json({
          onboarded: true,
          account: snapshot,
        });
      } catch {
        res.status(503).json({ error: 'Unable to complete invitation onboarding right now.' });
      }
    }
  );

  // --- 5. Member Studio Account & Catalog ---
  app.get(
    '/api/studio/account',
    requireVerifiedAuth,
    requireActiveMember,
    async (req: AuthedRequest, res: Response) => {
      try {
        const store = await resolveStore();
        const snapshot = await buildAccountSnapshot(store, req.account!);
        res.json({
          authenticated: true,
          account: snapshot,
          plans: STUDIO_PLANS,
          topupPacks: TOPUP_PACKS,
          creditCosts: CREDIT_COSTS,
          aiLiveEnabled: config.aiGenerationEnabled,
          billing: {
            mode: 'verified_webhook_required',
            livePaymentsEnabled: Boolean(config.billingWebhookSecret),
            selfUpgradeAllowed: false,
          },
        });
      } catch {
        res.status(503).json({ error: 'Unable to load account details.' });
      }
    }
  );

  // Explicitly block unauthorized client-side plan upgrades and credit purchases
  app.post(
    '/api/studio/plan',
    requireVerifiedAuth,
    requireActiveMember,
    (_req: AuthedRequest, res: Response) => {
      res.status(403).json({
        error:
          'Direct plan upgrades and credit additions are disabled. Changes require verified billing checkout or administrator approval.',
      });
    }
  );

  // --- 6. Hardened AI Studio Endpoints (Atomic Reservation + Idempotency + Rate Limit + Auto-Refund) ---
  app.post(
    '/api/studio/chat',
    requireVerifiedAuth,
    requireActiveMember,
    async (req: AuthedRequest, res: Response) => {
      const account = req.account!;
      if (!config.aiGenerationEnabled) {
        res.status(503).json({ error: 'AI generation is not enabled.' });
        return;
      }
      if (!hasValidIdempotencyKey(req)) {
        res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
        return;
      }
      let rate;
      try { rate = await consumeLimit(`studio:${account.user_id}`, 30, 60); }
      catch { res.status(503).json({ error: 'Service temporarily unavailable.' }); return; }
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        res.status(429).json({ error: 'Rate limit exceeded. Please pause briefly before sending another request.' });
        return;
      }

      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

      if (!message || message.length > 8000) {
        res.status(400).json({ error: 'Prompt message is required and must be under 8,000 characters.' });
        return;
      }

      const cleanHistory = history.filter(
        (m: unknown): m is { role: 'user' | 'model'; text: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          'role' in m &&
          'text' in m &&
          ((m as { role: string }).role === 'user' || (m as { role: string }).role === 'model') &&
          typeof (m as { text: string }).text === 'string'
      );

      const store = await resolveStore();
      const plan = getPlan(account.plan_id);
      const { monthKey, dayKey } = getDateKeys();
      const idempotencyKey = getIdempotencyKey(req);

      let reservation;
      try {
        reservation = await store.reserveCredits({
          userId: account.user_id,
          actionType: 'chat',
          cost: CREDIT_COSTS.chat,
          idempotencyKey,
          promptSummary: message,
          monthKey,
          dayKey,
          monthlyBase: plan.monthlyCredits,
          dailyLimit: plan.dailyLimit,
        });
      } catch {
        res.status(503).json({ error: 'Unable to reserve credits right now.' });
        return;
      }

      if (!reservation.ok || reservation.ledgerId === null) {
        const mapped = mapReservationFailure(reservation.errorCode, reservation);
        const freshAccount = await store.getAccountByUserId(account.user_id);
        res.status(mapped.status).json({
          error: mapped.error,
          account: freshAccount ? await buildAccountSnapshot(store, freshAccount) : null,
        });
        return;
      }

      try {
        const { reply } = await aiGenerator.chat(message, cleanHistory);
        if (!await store.finalizeReservation(reservation.ledgerId, account.user_id)) {
          throw new Error('FINALIZE_FAILED');
        }
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.json({
          reply,
          creditsUsed: CREDIT_COSTS.chat,
          reservationId: reservation.ledgerId,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      } catch (err) {
        const safe = mapAiErrorToSafeResponse(err);
        const refunded = await store.refundReservation(reservation.ledgerId, account.user_id, safe.reason).catch(() => false);
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.status(safe.status).json({
          error: safe.message,
          refunded,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      }
    }
  );

  app.post(
    '/api/studio/image',
    requireVerifiedAuth,
    requireActiveMember,
    async (req: AuthedRequest, res: Response) => {
      const account = req.account!;
      if (!config.aiGenerationEnabled) {
        res.status(503).json({ error: 'AI generation is not enabled.' });
        return;
      }
      if (!hasValidIdempotencyKey(req)) {
        res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
        return;
      }
      let rate;
      try { rate = await consumeLimit(`studio:${account.user_id}`, 30, 60); }
      catch { res.status(503).json({ error: 'Service temporarily unavailable.' }); return; }
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        res.status(429).json({ error: 'Rate limit exceeded. Please pause briefly before generating another visual.' });
        return;
      }

      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      const allowedRatios = new Set(['1:1', '16:9', '4:3', '3:4', '9:16']);
      const aspectRatio =
        typeof req.body?.aspectRatio === 'string' && allowedRatios.has(req.body.aspectRatio)
          ? req.body.aspectRatio
          : '16:9';

      if (!prompt || prompt.length > 4000) {
        res.status(400).json({ error: 'Image prompt is required and must be under 4,000 characters.' });
        return;
      }

      const store = await resolveStore();
      const plan = getPlan(account.plan_id);
      const { monthKey, dayKey } = getDateKeys();
      const idempotencyKey = getIdempotencyKey(req);

      let reservation;
      try {
        reservation = await store.reserveCredits({
          userId: account.user_id,
          actionType: 'image',
          cost: CREDIT_COSTS.image,
          idempotencyKey,
          promptSummary: `[${aspectRatio}] ${prompt}`,
          monthKey,
          dayKey,
          monthlyBase: plan.monthlyCredits,
          dailyLimit: plan.dailyLimit,
        });
      } catch {
        res.status(503).json({ error: 'Unable to reserve credits right now.' });
        return;
      }

      if (!reservation.ok || reservation.ledgerId === null) {
        const mapped = mapReservationFailure(reservation.errorCode, reservation);
        const freshAccount = await store.getAccountByUserId(account.user_id);
        res.status(mapped.status).json({
          error: mapped.error,
          account: freshAccount ? await buildAccountSnapshot(store, freshAccount) : null,
        });
        return;
      }

      try {
        const { imageUrl, caption } = await aiGenerator.image(prompt, aspectRatio);
        if (!await store.finalizeReservation(reservation.ledgerId, account.user_id)) {
          throw new Error('FINALIZE_FAILED');
        }
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.json({
          imageUrl,
          aspectRatio,
          caption,
          creditsUsed: CREDIT_COSTS.image,
          reservationId: reservation.ledgerId,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      } catch (err) {
        const safe = mapAiErrorToSafeResponse(err);
        const refunded = await store.refundReservation(reservation.ledgerId, account.user_id, safe.reason).catch(() => false);
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.status(safe.status).json({
          error: safe.message,
          refunded,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      }
    }
  );

  app.post(
    '/api/studio/file',
    requireVerifiedAuth,
    requireActiveMember,
    async (req: AuthedRequest, res: Response) => {
      const account = req.account!;
      if (!config.aiGenerationEnabled) {
        res.status(503).json({ error: 'AI generation is not enabled.' });
        return;
      }
      if (!hasValidIdempotencyKey(req)) {
        res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
        return;
      }
      let rate;
      try { rate = await consumeLimit(`studio:${account.user_id}`, 30, 60); }
      catch { res.status(503).json({ error: 'Service temporarily unavailable.' }); return; }
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        res.status(429).json({ error: 'Rate limit exceeded. Please pause briefly before creating another file.' });
        return;
      }

      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      const allowedFormats = new Set(['md', 'csv', 'txt', 'html']);
      const format = (
        typeof req.body?.format === 'string' && allowedFormats.has(req.body.format)
          ? req.body.format
          : 'md'
      ) as 'md' | 'csv' | 'txt' | 'html';

      if (!prompt || prompt.length > 6000) {
        res.status(400).json({ error: 'File description is required and must be under 6,000 characters.' });
        return;
      }

      const mimeByFormat: Record<string, string> = {
        md: 'text/markdown',
        csv: 'text/csv',
        txt: 'text/plain',
        html: 'text/html',
      };

      const store = await resolveStore();
      const plan = getPlan(account.plan_id);
      const { monthKey, dayKey } = getDateKeys();
      const idempotencyKey = getIdempotencyKey(req);

      let reservation;
      try {
        reservation = await store.reserveCredits({
          userId: account.user_id,
          actionType: 'file',
          cost: CREDIT_COSTS.file,
          idempotencyKey,
          promptSummary: `[.${format}] ${prompt}`,
          monthKey,
          dayKey,
          monthlyBase: plan.monthlyCredits,
          dailyLimit: plan.dailyLimit,
        });
      } catch {
        res.status(503).json({ error: 'Unable to reserve credits right now.' });
        return;
      }

      if (!reservation.ok || reservation.ledgerId === null) {
        const mapped = mapReservationFailure(reservation.errorCode, reservation);
        const freshAccount = await store.getAccountByUserId(account.user_id);
        res.status(mapped.status).json({
          error: mapped.error,
          account: freshAccount ? await buildAccountSnapshot(store, freshAccount) : null,
        });
        return;
      }

      try {
        const generated = await aiGenerator.file(prompt, format);
        if (!await store.finalizeReservation(reservation.ledgerId, account.user_id)) {
          throw new Error('FINALIZE_FAILED');
        }
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.json({
          file: {
            ...generated,
            format,
            mimeType: mimeByFormat[format] || 'text/plain',
          },
          creditsUsed: CREDIT_COSTS.file,
          reservationId: reservation.ledgerId,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      } catch (err) {
        const safe = mapAiErrorToSafeResponse(err);
        const refunded = await store.refundReservation(reservation.ledgerId, account.user_id, safe.reason).catch(() => false);
        const freshAccount = (await store.getAccountByUserId(account.user_id)) ?? account;
        res.status(safe.status).json({
          error: safe.message,
          refunded,
          account: await buildAccountSnapshot(store, freshAccount),
        });
      }
    }
  );

  // --- 7. Verified Billing Webhook Boundary (Inactive until BILLING_WEBHOOK_SECRET is configured) ---
  app.post('/api/billing/webhook', async (req: AuthedRequest, res: Response) => {
    if (!config.billingWebhookSecret) {
      res.status(503).json({ error: 'Billing integration is not activated in this environment.' });
      return;
    }

    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const signature = req.header('x-billing-signature');
    if (!verifyBillingWebhookSignature(rawBody, signature, config.billingWebhookSecret)) {
      res.status(401).json({ error: 'Invalid billing webhook signature.' });
      return;
    }

    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim() : 'stripe';
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const eventType = typeof req.body?.eventType === 'string' ? req.body.eventType.trim() : '';
    const planId = typeof req.body?.planId === 'string' ? req.body.planId.trim() : null;
    const topupId = typeof req.body?.topupId === 'string' ? req.body.topupId.trim() : null;

    if (!eventId || !isValidUuid(userId) || !eventType) {
      res.status(400).json({ error: 'Invalid billing event payload.' });
      return;
    }

    let validPlanId: PlanId | null = null;
    if (planId) {
      const found = STUDIO_PLANS.find((p) => p.id === planId);
      if (!found) {
        res.status(400).json({ error: 'Unsupported plan identifier.' });
        return;
      }
      validPlanId = found.id;
    }

    let creditsDelta = 0;
    if (topupId) {
      const pack = TOPUP_PACKS.find((p) => p.id === topupId);
      if (!pack) {
        res.status(400).json({ error: 'Unsupported top-up pack identifier.' });
        return;
      }
      creditsDelta = pack.credits;
    }

    if (!validPlanId && creditsDelta <= 0) {
      res.status(400).json({ error: 'Billing event must specify a valid plan or credit pack.' });
      return;
    }

    try {
      const store = await resolveStore();
      const result = await store.applyVerifiedBillingEvent({
        eventId,
        provider,
        userId,
        eventType,
        planId: validPlanId,
        creditsDelta,
        payload: { eventId, eventType, planId: validPlanId, topupId },
      });

      res.status(200).json({
        received: true,
        applied: result.applied,
        duplicate: result.duplicate,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ACCOUNT_NOT_FOUND') {
        res.status(404).json({ error: 'Target member account not found.' });
        return;
      }
      res.status(503).json({ error: 'Unable to process billing event.' });
    }
  });

  // --- 8. Administrator Endpoints (Server-Side Role Authorization) ---
  app.get(
    '/api/admin/invitations',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    async (req: AuthedRequest, res: Response) => {
      const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
      const allowed = new Set(['pending', 'approved', 'redeemed', 'revoked', 'expired']);
      const status =
        rawStatus && allowed.has(rawStatus) ? (rawStatus as InvitationStatus) : undefined;

      try {
        const store = await resolveStore();
        const invitations = await store.listInvitations(status);
        res.json({ invitations });
      } catch {
        res.status(503).json({ error: 'Unable to load invitations.' });
      }
    }
  );

  app.post(
    '/api/admin/invitations/:referenceCode/approve',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    limitAdminMutation,
    async (req: AuthedRequest, res: Response) => {
      const referenceCode = String(req.params.referenceCode || '').trim().toUpperCase();
      const assignedRole: MemberRole = req.body?.assignedRole === 'admin' ? 'admin' : 'member';
      const expiresInDays =
        typeof req.body?.expiresInDays === 'number' && req.body.expiresInDays > 0
          ? Math.min(90, req.body.expiresInDays)
          : 14;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      try {
        const store = await resolveStore();
        const updated = await store.approveInvitation({
          referenceCode,
          approvedBy: req.account!.user_id,
          assignedRole,
          expiresAt,
        });
        if (!updated) {
          res.status(404).json({ error: 'Invitation not found or cannot be approved.' });
          return;
        }
        res.json({ invitation: updated });
      } catch {
        res.status(503).json({ error: 'Unable to approve invitation.' });
      }
    }
  );

  app.post(
    '/api/admin/invitations/:referenceCode/revoke',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    limitAdminMutation,
    async (req: AuthedRequest, res: Response) => {
      const referenceCode = String(req.params.referenceCode || '').trim().toUpperCase();
      try {
        const store = await resolveStore();
        const updated = await store.revokeInvitation(referenceCode);
        if (!updated) {
          res.status(404).json({ error: 'Invitation not found or already finalized.' });
          return;
        }
        res.json({ invitation: updated });
      } catch {
        res.status(503).json({ error: 'Unable to revoke invitation.' });
      }
    }
  );

  app.get(
    '/api/admin/accounts',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    async (_req: AuthedRequest, res: Response) => {
      try {
        const store = await resolveStore();
        const accounts = await store.listAccounts(100);
        res.json({ accounts });
      } catch {
        res.status(503).json({ error: 'Unable to load member accounts.' });
      }
    }
  );

  app.patch(
    '/api/admin/accounts/:userId/membership',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    limitAdminMutation,
    async (req: AuthedRequest, res: Response) => {
      const targetUserId = String(req.params.userId || '').trim();
      if (!isValidUuid(targetUserId)) {
        res.status(400).json({ error: 'Valid user UUID is required.' });
        return;
      }

      const role =
        req.body?.role === 'admin' || req.body?.role === 'member'
          ? (req.body.role as MemberRole)
          : undefined;
      const membershipStatus =
        req.body?.membershipStatus === 'active' ||
        req.body?.membershipStatus === 'suspended' ||
        req.body?.membershipStatus === 'revoked'
          ? (req.body.membershipStatus as MembershipStatus)
          : undefined;

      if (!role && !membershipStatus) {
        res.status(400).json({ error: 'Provide a valid role or membershipStatus update.' });
        return;
      }

      try {
        const store = await resolveStore();
        const updated = await store.updateMembership(targetUserId, { role, membershipStatus });
        if (!updated) {
          res.status(404).json({ error: 'Member account not found.' });
          return;
        }
        res.json({ account: updated });
      } catch (err) {
        if (err instanceof Error && err.message === 'LAST_ACTIVE_ADMIN') {
          res.status(409).json({ error: 'At least one active administrator is required.' });
          return;
        }
        res.status(503).json({ error: 'Unable to update membership.' });
      }
    }
  );

  app.post(
    '/api/admin/accounts/:userId/billing',
    requireVerifiedAuth,
    requireActiveMember,
    requireAdmin,
    limitAdminMutation,
    async (req: AuthedRequest, res: Response) => {
      if (!hasValidIdempotencyKey(req)) {
        res.status(400).json({ error: 'A valid Idempotency-Key header is required.' });
        return;
      }
      const targetUserId = String(req.params.userId || '').trim();
      if (!isValidUuid(targetUserId)) {
        res.status(400).json({ error: 'Valid user UUID is required.' });
        return;
      }

      const planId = typeof req.body?.planId === 'string' ? req.body.planId : null;
      const topupId = typeof req.body?.topupId === 'string' ? req.body.topupId : null;
      const validPlan = planId ? STUDIO_PLANS.find((p) => p.id === planId)?.id ?? null : null;
      const pack = topupId ? TOPUP_PACKS.find((p) => p.id === topupId) ?? null : null;

      if ((planId && !validPlan) || (topupId && !pack) || (!validPlan && !pack)) {
        res.status(400).json({ error: 'Provide a valid planId or topupId.' });
        return;
      }

      const eventId = `admin-${getIdempotencyKey(req)}`;

      try {
        const store = await resolveStore();
        const result = await store.applyVerifiedBillingEvent({
          eventId,
          provider: 'admin_manual',
          userId: targetUserId,
          eventType: 'admin_adjustment',
          planId: validPlan,
          creditsDelta: pack?.credits ?? 0,
          payload: {
            adminUserId: req.account!.user_id,
            planId: validPlan,
            topupId: pack?.id ?? null,
          },
        });
        const updated = await store.getAccountByUserId(targetUserId);
        res.json({
          applied: result.applied,
          duplicate: result.duplicate,
          account: updated ? await buildAccountSnapshot(store, updated) : null,
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'ACCOUNT_NOT_FOUND') {
          res.status(404).json({ error: 'Member account not found.' });
          return;
        }
        res.status(503).json({ error: 'Unable to apply billing adjustment.' });
      }
    }
  );

  // Sanitized fallback error handler (never leaks stack traces or internals)
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
