import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createApiApp, AiGenerator } from '../server/app.ts';
import { createLocalSqliteStore } from '../server/db.ts';
import {
  createBillingWebhookSignature,
  createLocalSignedTokenVerifier,
  issueLocalSignedToken,
} from '../server/auth.ts';
import { assertValidProductionConfig, loadServerConfig } from '../server/config.ts';
import { SlidingWindowRateLimiter } from '../server/rateLimit.ts';

const TEST_SIGNING_SECRET = 'test-local-signing-secret-inner-circle-phase2';
const TEST_WEBHOOK_SECRET = 'whsec_test_inner_circle_phase2_secret';

const ADMIN_UUID = '11111111-1111-4111-8111-111111111111';
const USER_A_UUID = '22222222-2222-4222-8222-222222222222';
const USER_B_UUID = '33333333-3333-4333-8333-333333333333';
const UNINVITED_UUID = '44444444-4444-4444-8444-444444444444';

async function startTestServer(options: {
  aiGenerator?: AiGenerator;
  billingWebhookSecret?: string | null;
  studioMaxPerMin?: number;
  isProductionNoConfig?: boolean;
} = {}) {
  if (options.isProductionNoConfig) {
    const prodConfig = loadServerConfig({
      NODE_ENV: 'production',
      VERCEL: '1',
    });
    const app = createApiApp({ config: prodConfig });
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    return {
      baseUrl: `http://127.0.0.1:${addr.port}`,
      store: null,
      close: async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      },
    };
  }

  const store = await createLocalSqliteStore(':memory:');
  store.seedLocalAccountForTests({
    user_id: ADMIN_UUID,
    email: 'admin@moonshinecapital.com',
    name: 'Admin Partner',
    role: 'admin',
    membership_status: 'active',
    plan_id: 'inner_circle',
    bonus_credits: 0,
    invited_by_code: 'BOOTSTRAP',
  });

  const config = loadServerConfig({
    NODE_ENV: 'test',
    ALLOW_LOCAL_SQLITE: 'true',
    AI_STUDIO_LIVE_ENABLED: 'true',
    GEMINI_API_KEY: 'test-mock-only',
    BILLING_WEBHOOK_SECRET: options.billingWebhookSecret ?? TEST_WEBHOOK_SECRET,
  });

  const defaultMockAi: AiGenerator = {
    async chat(message) {
      return { reply: `Mock reply to: ${message}` };
    },
    async image(_prompt, _aspectRatio) {
      await new Promise((r) => setTimeout(r, 25));
      return { imageUrl: 'data:image/png;base64,AAAA', caption: 'Mock image' };
    },
    async file(_prompt, format) {
      return {
        filename: `mock-file.${format}`,
        title: 'Mock Deliverable',
        summary: 'Mock summary',
        content: 'mock content',
      };
    },
  };

  const app = createApiApp({
    config,
    store,
    authVerifier: createLocalSignedTokenVerifier(TEST_SIGNING_SECRET),
    aiGenerator: options.aiGenerator ?? defaultMockAi,
    studioRateLimiter: new SlidingWindowRateLimiter(options.studioMaxPerMin ?? 50, 60_000),
    publicRateLimiter: new SlidingWindowRateLimiter(50, 60_000),
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    store,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    },
  };
}

function tokenFor(userId: string, email: string, name: string) {
  return issueLocalSignedToken({ userId, email, name }, TEST_SIGNING_SECRET);
}

test('1. Health check is non-mutating and missing production config fails securely without leaking secrets', async () => {
  const prod = await startTestServer({ isProductionNoConfig: true });
  try {
    const res = await fetch(`${prod.baseUrl}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'Service temporarily unavailable.');
    assert.equal(JSON.stringify(body).includes('SUPABASE_SECRET_KEY'), false);
    assert.equal(JSON.stringify(body).includes('stack'), false);
  } finally {
    await prod.close();
  }

  const local = await startTestServer();
  try {
    const beforeAccounts = await local.store!.listAccounts();
    const res = await fetch(`${local.baseUrl}/api/health`);
    const body = await res.json();
    const afterAccounts = await local.store!.listAccounts();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'local-sqlite');
    assert.equal(afterAccounts.length, beforeAccounts.length);
  } finally {
    await local.close();
  }
});

test('2. Rejects unverified x-agent-email headers and unsigned identity cookies', async () => {
  const srv = await startTestServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/studio/account`, {
      headers: {
        'x-agent-email': 'admin@moonshinecapital.com',
        Cookie: 'mc_agent_email=admin@moonshinecapital.com',
      },
    });
    assert.equal(res.status, 401);
  } finally {
    await srv.close();
  }
});

test('3. Enforces invitation-based onboarding, admin approval, email matching, and single-use redemption', async () => {
  const srv = await startTestServer();
  try {
    const adminToken = tokenFor(ADMIN_UUID, 'admin@moonshinecapital.com', 'Admin Partner');
    const userAToken = tokenFor(USER_A_UUID, 'alice@brokerage.com', 'Alice Broker');
    const userBToken = tokenFor(USER_B_UUID, 'bob@brokerage.com', 'Bob Broker');
    const uninvitedToken = tokenFor(UNINVITED_UUID, 'stranger@unknown.com', 'Stranger');

    // Uninvited verified user cannot access AI Studio
    const blockedStudio = await fetch(`${srv.baseUrl}/api/studio/account`, {
      headers: { Authorization: `Bearer ${uninvitedToken}` },
    });
    assert.equal(blockedStudio.status, 403);

    // Public invitation submission creates a PENDING invitation
    const inviteRes = await fetch(`${srv.baseUrl}/api/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Broker',
        email: 'alice@brokerage.com',
        market: 'Austin',
        volumeTier: '$10M – $25M',
      }),
    });
    assert.equal(inviteRes.status, 201);
    const inviteData = await inviteRes.json();
    assert.equal(inviteData.status, 'pending');
    const code = inviteData.referenceCode as string;

    // Pending invitation cannot be redeemed before admin approval
    const pendingRedeem = await fetch(`${srv.baseUrl}/api/onboarding/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ inviteCode: code }),
    });
    assert.equal(pendingRedeem.status, 403);

    // Non-admin cannot approve an invitation
    const nonAdminApprove = await fetch(
      `${srv.baseUrl}/api/admin/invitations/${code}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ assignedRole: 'member' }),
      }
    );
    assert.equal(nonAdminApprove.status, 403);

    // Admin approves invitation
    const adminApprove = await fetch(
      `${srv.baseUrl}/api/admin/invitations/${code}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ assignedRole: 'member' }),
      }
    );
    assert.equal(adminApprove.status, 200);

    // Wrong email user cannot redeem Alice's approved invitation
    const wrongEmailRedeem = await fetch(`${srv.baseUrl}/api/onboarding/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ inviteCode: code }),
    });
    assert.equal(wrongEmailRedeem.status, 403);

    // Alice redeems her approved invitation
    const aliceRedeem = await fetch(`${srv.baseUrl}/api/onboarding/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ inviteCode: code, name: 'Alice Broker' }),
    });
    assert.equal(aliceRedeem.status, 200);
    const aliceBody = await aliceRedeem.json();
    assert.equal(aliceBody.onboarded, true);
    assert.equal(aliceBody.account.userId, USER_A_UUID);
    assert.equal(aliceBody.account.role, 'member');

    // Second user cannot reuse an already-redeemed invitation
    const reuseRes = await fetch(`${srv.baseUrl}/api/onboarding/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uninvitedToken}`,
      },
      body: JSON.stringify({ inviteCode: code }),
    });
    assert.equal(reuseRes.status, 409);
  } finally {
    await srv.close();
  }
});

test('4. Enforces account isolation, member RBAC, and suspension lockouts', async () => {
  const srv = await startTestServer();
  try {
    srv.store!.seedLocalAccountForTests({
      user_id: USER_A_UUID,
      email: 'alice@brokerage.com',
      name: 'Alice',
      role: 'member',
      membership_status: 'active',
      plan_id: 'onboarding',
      bonus_credits: 0,
      invited_by_code: 'MC-TESTA',
    });
    srv.store!.seedLocalAccountForTests({
      user_id: USER_B_UUID,
      email: 'bob@brokerage.com',
      name: 'Bob',
      role: 'member',
      membership_status: 'active',
      plan_id: 'onboarding',
      bonus_credits: 0,
      invited_by_code: 'MC-TESTB',
    });

    const adminToken = tokenFor(ADMIN_UUID, 'admin@moonshinecapital.com', 'Admin');
    const aliceToken = tokenFor(USER_A_UUID, 'alice@brokerage.com', 'Alice');
    const bobToken = tokenFor(USER_B_UUID, 'bob@brokerage.com', 'Bob');

    // Alice uses 1 credit
    const chatRes = await fetch(`${srv.baseUrl}/api/studio/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
        'Idempotency-Key': 'chat-isolation-001',
      },
      body: JSON.stringify({ message: 'Draft outreach script' }),
    });
    assert.equal(chatRes.status, 200);

    // Bob's account remains untouched and isolated from Alice's usage ledger
    const bobAccountRes = await fetch(`${srv.baseUrl}/api/studio/account`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.equal(bobAccountRes.status, 200);
    const bobAccount = (await bobAccountRes.json()).account;
    assert.equal(bobAccount.userId, USER_B_UUID);
    assert.equal(bobAccount.monthlyUsed, 0);
    assert.equal(bobAccount.recentUsage.length, 0);

    // Member cannot access admin accounts list
    const memberAdminAttempt = await fetch(`${srv.baseUrl}/api/admin/accounts`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert.equal(memberAdminAttempt.status, 403);

    // Admin suspends Alice -> Alice is immediately blocked from AI Studio
    const suspendRes = await fetch(
      `${srv.baseUrl}/api/admin/accounts/${USER_A_UUID}/membership`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ membershipStatus: 'suspended' }),
      }
    );
    assert.equal(suspendRes.status, 200);

    const suspendedStudio = await fetch(`${srv.baseUrl}/api/studio/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
        'Idempotency-Key': 'chat-after-suspend-001',
      },
      body: JSON.stringify({ message: 'Should be blocked' }),
    });
    assert.equal(suspendedStudio.status, 403);
    const suspendedMe = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const suspendedBody = await suspendedMe.json();
    assert.equal(suspendedBody.account, null);
    assert.equal(suspendedBody.role, null);
  } finally {
    await srv.close();
  }
});

test('5. Blocks unauthorized self-upgrades and enforces signed, idempotent billing webhooks', async () => {
  const srv = await startTestServer();
  try {
    srv.store!.seedLocalAccountForTests({
      user_id: USER_A_UUID,
      email: 'alice@brokerage.com',
      name: 'Alice',
      role: 'member',
      membership_status: 'active',
      plan_id: 'onboarding',
      bonus_credits: 0,
      invited_by_code: 'MC-TESTA',
    });

    const aliceToken = tokenFor(USER_A_UUID, 'alice@brokerage.com', 'Alice');

    // Member self-upgrade attempt is rejected
    const selfUpgrade = await fetch(`${srv.baseUrl}/api/studio/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ planId: 'inner_circle', topupId: 'pack_300' }),
    });
    assert.equal(selfUpgrade.status, 403);

    // Unsigned billing webhook is rejected
    const payloadObj = {
      eventId: 'evt_test_001',
      provider: 'stripe',
      userId: USER_A_UUID,
      eventType: 'checkout.session.completed',
      planId: 'producer',
      topupId: 'pack_100',
    };
    const rawPayload = JSON.stringify(payloadObj);

    const badSig = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-billing-signature': 't=12345,v1=invalid',
      },
      body: rawPayload,
    });
    assert.equal(badSig.status, 401);

    // Valid HMAC-signed billing webhook applies upgrade + credits
    const sig = createBillingWebhookSignature(rawPayload, TEST_WEBHOOK_SECRET);
    const goodWebhook = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-billing-signature': sig,
      },
      body: rawPayload,
    });
    assert.equal(goodWebhook.status, 200);
    const goodData = await goodWebhook.json();
    assert.equal(goodData.applied, true);
    assert.equal(goodData.duplicate, false);

    // Replaying exact same signed webhook eventId is idempotent (no double credits)
    const replayWebhook = await fetch(`${srv.baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-billing-signature': sig,
      },
      body: rawPayload,
    });
    assert.equal(replayWebhook.status, 200);
    const replayData = await replayWebhook.json();
    assert.equal(replayData.applied, false);
    assert.equal(replayData.duplicate, true);

    const updated = await srv.store!.getAccountByUserId(USER_A_UUID);
    assert.equal(updated?.plan_id, 'producer');
    assert.equal(updated?.bonus_credits, 100);
  } finally {
    await srv.close();
  }
});

test('6. Atomic concurrent credit reservations prevent overspend, enforce idempotency, refund failures, and apply rate limits', async () => {
  // Part A: Concurrent reservation test (10 daily cap, 5 concurrent x 5 credits => exactly 2 succeed, 3 hit 429)
  const srv = await startTestServer();
  try {
    srv.store!.seedLocalAccountForTests({
      user_id: USER_A_UUID,
      email: 'alice@brokerage.com',
      name: 'Alice',
      role: 'member',
      membership_status: 'active',
      plan_id: 'onboarding', // 30 monthly, 10 daily cap
      bonus_credits: 0,
      invited_by_code: 'MC-CONC',
    });

    const aliceToken = tokenFor(USER_A_UUID, 'alice@brokerage.com', 'Alice');

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        fetch(`${srv.baseUrl}/api/studio/image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aliceToken}`,
            'Idempotency-Key': `img-concurrent-${n}`,
          },
          body: JSON.stringify({ prompt: `Luxury office visual ${n}`, aspectRatio: '16:9' }),
        })
      )
    );

    const statuses = responses.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 200, 429, 429, 429]);

    // Duplicate Idempotency-Key returns 409 Conflict
    const dupRes = await fetch(`${srv.baseUrl}/api/studio/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
        'Idempotency-Key': 'img-concurrent-1',
      },
      body: JSON.stringify({ prompt: 'Replay attempt', aspectRatio: '16:9' }),
    });
    assert.equal(dupRes.status, 409);
  } finally {
    await srv.close();
  }

  // Part B: Failed generation automatically refunds reserved credits
  const failingSrv = await startTestServer({
    aiGenerator: {
      async chat() {
        throw new Error('SIMULATED_UPSTREAM_FAILURE');
      },
      async image() {
        throw new Error('SIMULATED_UPSTREAM_FAILURE');
      },
      async file() {
        throw new Error('SIMULATED_UPSTREAM_FAILURE');
      },
    },
    studioMaxPerMin: 2,
  });

  try {
    failingSrv.store!.seedLocalAccountForTests({
      user_id: USER_B_UUID,
      email: 'bob@brokerage.com',
      name: 'Bob',
      role: 'member',
      membership_status: 'active',
      plan_id: 'onboarding',
      bonus_credits: 0,
      invited_by_code: 'MC-REFUND',
    });

    const bobToken = tokenFor(USER_B_UUID, 'bob@brokerage.com', 'Bob');

    const failRes = await fetch(`${failingSrv.baseUrl}/api/studio/file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
        'Idempotency-Key': 'file-refund-test-001',
      },
      body: JSON.stringify({ prompt: 'Pitch deck brief', format: 'md' }),
    });

    assert.equal(failRes.status, 502);
    const failBody = await failRes.json();
    assert.equal(failBody.refunded, true);
    assert.equal(failBody.account.monthlyUsed, 0);
    assert.equal(failBody.account.dailyUsed, 0);
    assert.equal(failBody.account.recentUsage[0].status, 'refunded');
    assert.equal(JSON.stringify(failBody).includes('SIMULATED_UPSTREAM_FAILURE'), false);

    // Rate limiting check (studioMaxPerMin = 2 -> 2nd request hits AI failure 502, 3rd hits 429 rate limit)
    const secondRes = await fetch(`${failingSrv.baseUrl}/api/studio/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
        'Idempotency-Key': 'rate-limit-002',
      },
      body: JSON.stringify({ message: 'Second call' }),
    });
    assert.equal(secondRes.status, 502);

    const thirdRes = await fetch(`${failingSrv.baseUrl}/api/studio/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
        'Idempotency-Key': 'rate-limit-003',
      },
      body: JSON.stringify({ message: 'Third call should be rate-limited' }),
    });
    assert.equal(thirdRes.status, 429);
  } finally {
    await failingSrv.close();
  }
});

test('7. Browser source files never reference privileged server secrets', () => {
  const forbiddenSecrets = [
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'BILLING_WEBHOOK_SECRET',
    'POSTGRES_URL',
  ];

  const srcDir = path.resolve(process.cwd(), 'src');
  const walk = (dir: string): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walk(full));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
    return files;
  };

  for (const file of walk(srcDir)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const secretName of forbiddenSecrets) {
      assert.equal(
        content.includes(secretName),
        false,
        `Forbidden secret identifier ${secretName} found in browser source ${file}`
      );
    }
  }
});

test('8. Configuration rejects wrong projects and defaults AI and SQLite to disabled', () => {
  const empty = loadServerConfig({ NODE_ENV: 'development', GEMINI_API_KEY: 'set' });
  assert.equal(empty.aiGenerationEnabled, false);
  assert.equal(empty.allowLocalSqlite, false);
  const wrong = loadServerConfig({ NODE_ENV: 'production', SUPABASE_URL: 'https://loaowmappekunngjknnx.supabase.co', SUPABASE_SECRET_KEY: 'secret' });
  assert.equal(assertValidProductionConfig(wrong), 'Server configuration incomplete.');
  const right = loadServerConfig({ NODE_ENV: 'production', SUPABASE_URL: 'https://thdnmgmojhhhtjlhbwvn.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'legacy' });
  assert.equal(assertValidProductionConfig(right), null);
  assert.equal(right.supabaseKeySource, 'service_role_key');
});

test('9. Local credit accounting uses current plan, carries purchased balance, and protects last admin', async () => {
  const store = await createLocalSqliteStore(':memory:');
  try {
    store.seedLocalAccountForTests({ user_id: ADMIN_UUID, email: 'admin@test.test', name: 'Admin', role: 'admin', membership_status: 'active', plan_id: 'inner_circle', bonus_credits: 0, invited_by_code: null });
    await assert.rejects(store.updateMembership(ADMIN_UUID, { membershipStatus: 'suspended' }), /LAST_ACTIVE_ADMIN/);
    store.seedLocalAccountForTests({ user_id: USER_A_UUID, email: 'a@test.test', name: 'A', role: 'member', membership_status: 'active', plan_id: 'onboarding', bonus_credits: 100, invited_by_code: null });
    const first = await store.reserveCredits({ userId: USER_A_UUID, actionType: 'image', cost: 5,
      idempotencyKey: 'plan-current-001', promptSummary: 'test', monthKey: '2026-11', dayKey: '2026-11-25',
      monthlyBase: 1000, dailyLimit: 150 });
    assert.equal(first.dailyLimit, 10);
    assert.equal(first.monthlyAllowance, 130);
    assert.equal(await store.finalizeReservation(first.ledgerId!, USER_A_UUID), true);
    assert.equal(await store.finalizeReservation(first.ledgerId!, USER_A_UUID), false);
    const second = await store.reserveCredits({ userId: USER_A_UUID, actionType: 'image', cost: 5,
      idempotencyKey: 'plan-current-002', promptSummary: 'test', monthKey: '2026-11', dayKey: '2026-11-25',
      monthlyBase: 1000, dailyLimit: 150 });
    assert.equal(second.ok, true);
    assert.equal(await store.refundReservation(second.ledgerId!, USER_A_UUID, 'test'), true);
    assert.equal(await store.refundReservation(second.ledgerId!, USER_A_UUID, 'test'), false);
    assert.equal(await store.finalizeReservation(second.ledgerId!, USER_A_UUID), false);
    for (let i = 0; i < 5; i++) {
      const result = await store.reserveCredits({ userId: USER_A_UUID, actionType: 'image', cost: 5,
        idempotencyKey: `finish-plan-${i}`, promptSummary: 'test', monthKey: '2026-11',
        dayKey: `2026-11-${String(26 + Math.floor(i / 2)).padStart(2, '0')}`,
        monthlyBase: 1000, dailyLimit: 150 });
      assert.equal(result.ok, true);
      assert.equal(await store.finalizeReservation(result.ledgerId!, USER_A_UUID), true);
    }
    const fromPack = await store.reserveCredits({ userId: USER_A_UUID, actionType: 'image', cost: 5,
      idempotencyKey: 'pack-consumption-001', promptSummary: 'test', monthKey: '2026-11',
      dayKey: '2026-11-29', monthlyBase: 1000, dailyLimit: 150 });
    assert.equal(fromPack.ok, true);
    assert.equal((await store.getAccountByUserId(USER_A_UUID))!.bonus_credits, 95);
    assert.equal(await store.refundReservation(fromPack.ledgerId!, USER_A_UUID, 'failed'), true);
    assert.equal((await store.getAccountByUserId(USER_A_UUID))!.bonus_credits, 100);
    const nextMonth = await store.reserveCredits({ userId: USER_A_UUID, actionType: 'chat', cost: 1,
      idempotencyKey: 'rollover-2026-12', promptSummary: 'test', monthKey: '2026-12',
      dayKey: '2026-12-01', monthlyBase: 0, dailyLimit: 0 });
    assert.equal(nextMonth.ok, true);
    assert.equal((await store.getAccountByUserId(USER_A_UUID))!.bonus_credits, 100);
  } finally { store.close(); }
});

test('10. Disabled AI never reserves credits and unverified email cannot redeem', async () => {
  const store = await createLocalSqliteStore(':memory:');
  store.seedLocalAccountForTests({ user_id: USER_A_UUID, email: 'a@test.test', name: 'A', role: 'member',
    membership_status: 'active', plan_id: 'onboarding', bonus_credits: 0, invited_by_code: null });
  const app = createApiApp({
    config: loadServerConfig({ NODE_ENV: 'test', ALLOW_LOCAL_SQLITE: 'true', AI_STUDIO_LIVE_ENABLED: 'false' }),
    store,
    authVerifier: { async verifyBearerToken() { return { userId: USER_A_UUID, email: 'a@test.test', emailVerified: false }; } },
    aiGenerator: { async chat() { throw new Error('should not run'); }, async image() { throw new Error('should not run'); }, async file() { throw new Error('should not run'); } },
  });
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const ai = await fetch(`http://127.0.0.1:${port}/api/studio/chat`, { method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', 'Idempotency-Key': 'disabled-001' },
      body: JSON.stringify({ message: 'test' }) });
    assert.equal(ai.status, 503);
    assert.deepEqual(await store.getRecentUsage(USER_A_UUID), []);
    const redeem = await fetch(`http://127.0.0.1:${port}/api/onboarding/redeem`, { method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'TEST-CODE' }) });
    assert.equal(redeem.status, 403);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
  }
});
