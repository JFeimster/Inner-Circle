import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { getDb } from './db.ts';

dotenv.config();

// --- Pricing & Credit Plan Definitions (Source of Truth) ---
export interface StudioPlan {
  id: 'onboarding' | 'producer' | 'inner_circle';
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
];

export const CREDIT_COSTS = {
  chat: 1,
  file: 2,
  image: 5,
} as const;

// --- Helper Functions ---
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function getActiveEmail(req: Request): string | null {
  const headerEmail = req.header('x-agent-email');
  if (headerEmail && headerEmail.includes('@')) {
    return headerEmail.trim().toLowerCase();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.mc_agent_email && cookies.mc_agent_email.includes('@')) {
    return cookies.mc_agent_email.trim().toLowerCase();
  }
  return null;
}

function getPlan(planId: string): StudioPlan {
  return STUDIO_PLANS.find((p) => p.id === planId) ?? STUDIO_PLANS[0];
}

async function getAccountSnapshot(email: string) {
  const db = await getDb();
  const row = await db.getAccount(email);
  if (!row) return null;

  const plan = getPlan(row.plan_id);
  const { monthKey, dayKey } = getDateKeys();

  const [monthlyUsed, dailyUsed, recentUsage] = await Promise.all([
    db.getMonthlyUsageTotal(email, monthKey),
    db.getDailyUsageTotal(email, dayKey),
    db.getRecentUsage(email, 10),
  ]);

  const monthlyAllowance = plan.monthlyCredits + row.bonus_credits;
  const remainingCredits = Math.max(0, monthlyAllowance - monthlyUsed);
  const remainingDaily = Math.max(0, plan.dailyLimit - dailyUsed);

  return {
    email: row.email,
    name: row.name,
    role: row.role,
    plan,
    bonusCredits: row.bonus_credits,
    monthlyAllowance,
    monthlyUsed,
    remainingCredits,
    dailyLimit: plan.dailyLimit,
    dailyUsed,
    remainingDaily,
    recentUsage,
  };
}

async function checkQuota(
  email: string,
  cost: number
): Promise<{ status: number; error: string } | null> {
  const snapshot = await getAccountSnapshot(email);
  if (!snapshot) {
    return { status: 401, error: 'Please sign in with your Moonshine Capital member account first.' };
  }
  if (snapshot.remainingCredits < cost) {
    return {
      status: 429,
      error: `Monthly credit limit reached (${snapshot.monthlyUsed}/${snapshot.monthlyAllowance} credits used). Upgrade your tier or add a credit top-up pack to continue.`,
    };
  }
  if (snapshot.remainingDaily < cost) {
    return {
      status: 429,
      error: `Daily safety cap reached (${snapshot.dailyUsed}/${snapshot.dailyLimit} credits used today). Your daily guardrail resets at 00:00 UTC, or you can upgrade your tier.`,
    };
  }
  return null;
}

async function recordUsage(
  email: string,
  actionType: keyof typeof CREDIT_COSTS,
  summary: string
) {
  const db = await getDb();
  const cost = CREDIT_COSTS[actionType];
  const { monthKey, dayKey } = getDateKeys();
  await db.insertUsage(email, actionType, cost, summary, monthKey, dayKey);
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'API key permission error. Please verify your billing-enabled GEMINI_API_KEY.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'Upstream model rate limit reached. Please retry shortly or check your API billing tier.',
    };
  }
  return {
    status: 500,
    message: msg || 'Failed to complete AI request.',
  };
}

function handleDbError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : 'Database request failed.';
  const status = msg.includes('not connected') ? 503 : 500;
  res.status(status).json({ error: msg });
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Lightweight health endpoint for Vercel & uptime checks (no secrets exposed)
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      res.json({ ok: true, database: db.driver });
    } catch (err) {
      handleDbError(res, err);
    }
  });

  // Studio metadata & active session lookup
  app.get('/api/studio/account', async (req: Request, res: Response) => {
    try {
      const email = getActiveEmail(req);
      const account = email ? await getAccountSnapshot(email) : null;
      res.json({
        authenticated: Boolean(account),
        account,
        plans: STUDIO_PLANS,
        topupPacks: TOPUP_PACKS,
        creditCosts: CREDIT_COSTS,
      });
    } catch (err) {
      handleDbError(res, err);
    }
  });

  // Member sign-in / account switch for isolated server-side quota enforcement
  app.post('/api/studio/session', async (req: Request, res: Response) => {
    try {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        res.status(400).json({ error: 'Please enter a valid member email address.' });
        return;
      }

      const derivedName =
        rawName ||
        rawEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (ch) => ch.toUpperCase());

      const db = await getDb();
      await db.ensureAccount(rawEmail, derivedName, 'Elite Agent · Member');

      res.cookie('mc_agent_email', rawEmail, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        partitioned: true,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });

      res.json({
        authenticated: true,
        account: await getAccountSnapshot(rawEmail),
      });
    } catch (err) {
      handleDbError(res, err);
    }
  });

  // Sign out of Studio session
  app.post('/api/studio/logout', (_req: Request, res: Response) => {
    res.clearCookie('mc_agent_email', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
    });
    res.json({ authenticated: false });
  });

  // Request Invitation (Universal Landing Page lead capture)
  app.post('/api/invitations', async (req: Request, res: Response) => {
    try {
      const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const market = typeof req.body?.market === 'string' ? req.body.market.trim() : '';
      const volumeTier = typeof req.body?.volumeTier === 'string' ? req.body.volumeTier.trim() : '';

      if (!fullName || fullName.length < 2) {
        res.status(400).json({ error: 'Please provide your full name.' });
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid work email address.' });
        return;
      }
      if (!market) {
        res.status(400).json({ error: 'Please enter your primary market or territory.' });
        return;
      }

      const referenceCode = `MC-${Math.floor(100000 + Math.random() * 900000)}`;
      const db = await getDb();
      await db.insertInvitation(
        referenceCode,
        fullName,
        email,
        market,
        volumeTier || '$10M – $25M'
      );

      res.status(201).json({
        referenceCode,
        fullName,
        email,
        market,
        message: 'Your invitation request has been logged for partner review.',
      });
    } catch (err) {
      handleDbError(res, err);
    }
  });

  // Change plan tier or apply credit top-up pack (Stripe-ready billing hook)
  app.post('/api/studio/plan', async (req: Request, res: Response) => {
    try {
      const email = getActiveEmail(req);
      if (!email) {
        res.status(401).json({ error: 'Sign in with your member account to manage plans.' });
        return;
      }

      const planId = typeof req.body?.planId === 'string' ? req.body.planId : undefined;
      const topupId = typeof req.body?.topupId === 'string' ? req.body.topupId : undefined;
      const db = await getDb();

      if (planId) {
        const targetPlan = STUDIO_PLANS.find((p) => p.id === planId);
        if (!targetPlan) {
          res.status(400).json({ error: 'Invalid plan selected.' });
          return;
        }
        await db.updateAccountPlan(email, targetPlan.id);
      }

      if (topupId) {
        const pack = TOPUP_PACKS.find((p) => p.id === topupId);
        if (!pack) {
          res.status(400).json({ error: 'Invalid credit pack selected.' });
          return;
        }
        await db.addBonusCredits(email, pack.credits);
      }

      res.json({
        account: await getAccountSnapshot(email),
      });
    } catch (err) {
      handleDbError(res, err);
    }
  });

  // 1. AI Concierge Chat (1 credit)
  app.post('/api/studio/chat', async (req: Request, res: Response) => {
    const email = getActiveEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Please sign in to use Moonshine AI Studio.' });
      return;
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

    if (!message) {
      res.status(400).json({ error: 'Prompt message is required.' });
      return;
    }

    try {
      const quotaError = await checkQuota(email, CREDIT_COSTS.chat);
      if (quotaError) {
        res
          .status(quotaError.status)
          .json({ error: quotaError.error, account: await getAccountSnapshot(email) });
        return;
      }

      const ai = getGeminiClient();
      const contents = [
        ...history
          .filter(
            (m: unknown): m is { role: 'user' | 'model'; text: string } =>
              Boolean(m) &&
              typeof m === 'object' &&
              'role' in m &&
              'text' in m &&
              ((m as { role: string }).role === 'user' || (m as { role: string }).role === 'model') &&
              typeof (m as { text: string }).text === 'string'
          )
          .map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
        { role: 'user' as const, parts: [{ text: message }] },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction:
            'You are the Moonshine Capital Executive Concierge—an elite onboarding, commercial funding & capital advisory, sales script, and client communications specialist. Provide crisp, high-trust, actionable guidance tailored for Moonshine Capital brokers and partners.',
        },
      });

      const replyText = response.text?.trim() || 'I could not generate a response for that request.';
      await recordUsage(email, 'chat', message);

      res.json({
        reply: replyText,
        creditsUsed: CREDIT_COSTS.chat,
        account: await getAccountSnapshot(email),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. AI Brand Image Generator (5 credits)
  app.post('/api/studio/image', async (req: Request, res: Response) => {
    const email = getActiveEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Please sign in to generate images.' });
      return;
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const allowedRatios = new Set(['1:1', '16:9', '4:3', '3:4', '9:16']);
    const aspectRatio =
      typeof req.body?.aspectRatio === 'string' && allowedRatios.has(req.body.aspectRatio)
        ? req.body.aspectRatio
        : '16:9';

    if (!prompt) {
      res.status(400).json({ error: 'Image prompt is required.' });
      return;
    }

    try {
      const quotaError = await checkQuota(email, CREDIT_COSTS.image);
      if (quotaError) {
        res
          .status(quotaError.status)
          .json({ error: quotaError.error, account: await getAccountSnapshot(email) });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            {
              text: `${prompt}. Refined luxury editorial quality suitable for Moonshine Capital private capital advisory and commercial funding marketing.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio,
          },
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
        res
          .status(502)
          .json({ error: 'The model did not return an image. Please try refining your prompt.' });
        return;
      }

      await recordUsage(email, 'image', `[${aspectRatio}] ${prompt}`);

      res.json({
        imageUrl,
        aspectRatio,
        caption: caption.trim(),
        creditsUsed: CREDIT_COSTS.image,
        account: await getAccountSnapshot(email),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. AI Downloadable File Creator (2 credits)
  app.post('/api/studio/file', async (req: Request, res: Response) => {
    const email = getActiveEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Please sign in to create downloadable files.' });
      return;
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const allowedFormats = new Set(['md', 'csv', 'txt', 'html']);
    const format =
      typeof req.body?.format === 'string' && allowedFormats.has(req.body.format)
        ? req.body.format
        : 'md';

    if (!prompt) {
      res.status(400).json({ error: 'Describe the file you would like to generate.' });
      return;
    }

    const mimeByFormat: Record<string, string> = {
      md: 'text/markdown',
      csv: 'text/csv',
      txt: 'text/plain',
      html: 'text/html',
    };

    try {
      const quotaError = await checkQuota(email, CREDIT_COSTS.file);
      if (quotaError) {
        res
          .status(quotaError.status)
          .json({ error: quotaError.error, account: await getAccountSnapshot(email) });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a polished, ready-to-use .${format} file for a Moonshine Capital funding broker and capital advisory partner based on this request:\n\n${prompt}`,
        config: {
          systemInstruction:
            'You generate clean, executive-ready deliverables for Moonshine Capital partners. Return valid JSON matching the requested schema. Ensure filename uses lowercase kebab-case ending with the requested file extension.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              filename: {
                type: Type.STRING,
                description: `Lowercase kebab-case filename ending in .${format}`,
              },
              title: {
                type: Type.STRING,
                description: 'Human-readable deliverable title',
              },
              summary: {
                type: Type.STRING,
                description: 'One-sentence summary of what the generated file contains',
              },
              content: {
                type: Type.STRING,
                description: `Complete raw file contents formatted cleanly as .${format}`,
              },
            },
            required: ['filename', 'title', 'summary', 'content'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw) as {
        filename: string;
        title: string;
        summary: string;
        content: string;
      };

      const safeFilename = (parsed.filename || `moonshine-deliverable.${format}`)
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-');

      await recordUsage(email, 'file', `[.${format}] ${parsed.title || prompt}`);

      res.json({
        file: {
          filename: safeFilename.endsWith(`.${format}`) ? safeFilename : `${safeFilename}.${format}`,
          title: parsed.title || 'Generated Deliverable',
          summary: parsed.summary || '',
          format,
          mimeType: mimeByFormat[format] || 'text/plain',
          content: parsed.content || '',
        },
        creditsUsed: CREDIT_COSTS.file,
        account: await getAccountSnapshot(email),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  return app;
}
