// Run only against a local Supabase database with migrations already applied:
// LOCAL_PG_TEST_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
// npx tsx --test tests/postgres.integration.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.LOCAL_PG_TEST_URL;
if (connectionString && !['localhost', '127.0.0.1', '::1'].includes(new URL(connectionString).hostname)) {
  throw new Error('PostgreSQL integration tests require a loopback database host.');
}
const enabled = Boolean(connectionString);

test('PostgreSQL credit, billing, invitation, and RLS contracts', { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString, max: 8 });
  const userId = randomUUID();
  const otherId = randomUUID();
  const invitedId = randomUUID();
  const email = `phase3-${userId}@example.test`;
  const otherEmail = `phase3-${otherId}@example.test`;
  const invitedEmail = `phase3-${invitedId}@example.test`;
  const code = `TEST-${randomUUID()}`;
  const reserve = (key: string, action = 'image', cost = 5, month = '2026-11', day = '2026-11-25') =>
    pool.query('SELECT * FROM public.reserve_studio_credits($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [userId, action, cost, key, 'integration test', month, day, 1000, 150]).then(r => r.rows[0]);
  try {
    await pool.query(`INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at)
      VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'',now()),
             ('00000000-0000-0000-0000-000000000000',$3,'authenticated','authenticated',$4,'',now()),
             ('00000000-0000-0000-0000-000000000000',$5,'authenticated','authenticated',$6,'',now())`,
      [userId, email, otherId, otherEmail, invitedId, invitedEmail]);
    await pool.query(`INSERT INTO public.agent_accounts(user_id,email,name,role,membership_status,plan_id,bonus_credits)
      VALUES ($1,$2,'Test Member','member','active','onboarding',0),
             ($3,$4,'Test Member','member','active','onboarding',0)`, [userId, email, otherId, otherEmail]);

    // Concurrent requests serialize on the account row; the caller's fake 1000/150 limits are ignored.
    const simultaneous = await Promise.all(Array.from({ length: 8 }, (_, i) => reserve(`parallel-${randomUUID()}-${i}`)));
    assert.equal(simultaneous.filter(r => r.ok).length, 2); // 10/day, 5/image
    assert.equal((await reserve(`parallel-${randomUUID()}`)).daily_limit, 10);
    assert.equal((await reserve('duplicate-key-aaaaaaaa', 'chat', 1, '2026-12', '2026-12-01')).ok, true);
    assert.equal((await reserve('duplicate-key-aaaaaaaa', 'chat', 1, '2026-12', '2026-12-01')).error_code, 'DUPLICATE_IDEMPOTENCY_KEY');

    // Plan change is read inside the next locked transaction.
    await pool.query(`UPDATE public.agent_accounts SET plan_id = 'producer' WHERE user_id = $1`, [userId]);
    const afterPlanChange = await reserve(`plan-${randomUUID()}`);
    assert.equal(afterPlanChange.ok, true);
    assert.equal(afterPlanChange.daily_limit, 50);
    assert.equal((await pool.query('SELECT public.finalize_studio_reservation($1,$2) AS ok', [afterPlanChange.ledger_id, userId])).rows[0].ok, true);
    assert.equal((await pool.query('SELECT public.finalize_studio_reservation($1,$2) AS ok', [afterPlanChange.ledger_id, userId])).rows[0].ok, false);
    assert.equal((await pool.query('SELECT public.refund_studio_reservation($1,$2,$3) AS ok', [afterPlanChange.ledger_id, userId, 'late'])).rows[0].ok, false);

    const expiring = await reserve(`expire-${randomUUID()}`);
    await pool.query(`UPDATE public.usage_ledger SET expires_at = now() - interval '1 second' WHERE id = $1`, [expiring.ledger_id]);
    assert.equal((await pool.query('SELECT public.reconcile_studio_reservations($1) AS count', [userId])).rows[0].count, 1);
    assert.equal((await pool.query('SELECT public.finalize_studio_reservation($1,$2) AS ok', [expiring.ledger_id, userId])).rows[0].ok, false);

    const eventId = `event-${randomUUID()}`;
    const billing = () => pool.query(`SELECT * FROM public.apply_verified_billing_event($1,'test',$2,'topup',NULL,100,'{}'::jsonb)`, [eventId, userId]);
    const replays = await Promise.all([billing(), billing()]);
    assert.equal(replays.filter(r => r.rows[0].applied).length, 1);
    assert.equal((await pool.query('SELECT bonus_credits FROM public.agent_accounts WHERE user_id=$1', [userId])).rows[0].bonus_credits, 100);
    const bucket = `phase3-${randomUUID()}`;
    const rates = await Promise.all(Array.from({ length: 4 }, () => pool.query(
      'SELECT * FROM public.consume_rate_limit($1,2,60)', [bucket])));
    assert.equal(rates.filter(r => r.rows[0].allowed).length, 2);

    await pool.query(`INSERT INTO public.invitations(reference_code,full_name,email,market,volume_tier,status)
      VALUES($1,'Invited Member',$2,'Test','test','approved')`, [code, invitedEmail]);
    await pool.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [invitedId]);
    assert.equal((await pool.query('SELECT * FROM public.redeem_invitation_for_user($1,$2,$3,$4)',
      [invitedId, invitedEmail, 'Invited Member', code])).rows[0].ok, false);
    await pool.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [invitedId]);
    const wrongEmail = await pool.query('SELECT * FROM public.redeem_invitation_for_user($1,$2,$3,$4)', [invitedId, otherEmail, 'Invited Member', code]);
    assert.equal(wrongEmail.rows[0].error_code, 'INVITE_EMAIL_MISMATCH');
    const redeem = await pool.query('SELECT * FROM public.redeem_invitation_for_user($1,$2,$3,$4)', [invitedId, invitedEmail, 'Invited Member', code]);
    assert.equal(redeem.rows[0].ok, true);
    assert.equal((await pool.query('SELECT * FROM public.redeem_invitation_for_user($1,$2,$3,$4)', [invitedId, invitedEmail, 'Invited Member', code])).rows[0].error_code, 'ALREADY_ONBOARDED');

    const guard = await pool.connect();
    try {
      await guard.query('BEGIN');
      await guard.query(`UPDATE public.agent_accounts SET role='admin' WHERE user_id=$1`, [userId]);
      await assert.rejects(guard.query(`UPDATE public.agent_accounts SET membership_status='suspended' WHERE user_id=$1`, [userId]), /LAST_ACTIVE_ADMIN/);
    } finally { await guard.query('ROLLBACK'); guard.release(); }

    // Explicit grants and RLS both deny browser access to inactive account data.
    await pool.query(`UPDATE public.agent_accounts SET membership_status = 'suspended' WHERE user_id=$1`, [otherId]);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('request.jwt.claim.sub',$1,true)`, [otherId]);
      assert.equal((await client.query('SELECT * FROM public.agent_accounts WHERE user_id=$1', [otherId])).rowCount, 0);
      assert.equal((await client.query('SELECT * FROM public.usage_ledger WHERE user_id=$1', [otherId])).rowCount, 0);
      const grants = await client.query(`SELECT has_table_privilege('authenticated','public.invitations','SELECT') AS invitations,
        has_table_privilege('authenticated','public.agent_accounts','UPDATE') AS account_update,
        has_function_privilege('authenticated','public.reserve_studio_credits(uuid,text,integer,text,text,text,text,integer,integer)','EXECUTE') AS reserve`);
      assert.deepEqual(grants.rows[0], { invitations: false, account_update: false, reserve: false });
      await assert.rejects(client.query('SELECT * FROM public.reserve_studio_credits($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [otherId, 'chat', 1, randomUUID(), 'test', '2026-11', '2026-11-25', 30, 10]), /permission denied/);
    } finally { await client.query('ROLLBACK'); client.release(); }
  } finally {
    await pool.query('DELETE FROM public.invitations WHERE reference_code=$1', [code]).catch(() => {});
    await pool.query('DELETE FROM public.agent_accounts WHERE user_id IN ($1,$2,$3)', [userId, otherId, invitedId]).catch(() => {});
    await pool.query('DELETE FROM auth.users WHERE id IN ($1,$2,$3)', [userId, otherId, invitedId]).catch(() => {});
    await pool.end();
  }
});
