import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('serverless entry starts under Node and fails health safely without configuration', () => {
  const sqlitePath = path.join(tmpdir(), `inner-circle-serverless-${process.pid}.db`);
  assert.equal(existsSync(sqlitePath), false);

  const env = { ...process.env, NODE_ENV: 'production', VERCEL: '1', ALLOW_LOCAL_SQLITE: 'true',
    LOCAL_SQLITE_PATH: sqlitePath, AI_STUDIO_LIVE_ENABLED: 'false' };
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY', 'BILLING_WEBHOOK_SECRET']) delete env[key];

  const script = `
    import app from './api/index.js';
    const { loadServerConfig } = await import('./server/config.ts');
    const config = loadServerConfig();
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const port = server.address().port;
      const response = await fetch('http://127.0.0.1:' + port + '/api/health');
      const body = await response.json();
      console.log('SERVERLESS_RESULT ' + JSON.stringify({
        handler: typeof app, status: response.status, body,
        sqliteDisabled: !config.allowLocalSqlite,
        aiDisabled: !config.aiGenerationEnabled,
        billingDisabled: !config.billingWebhookSecret
      }));
    } finally { server.close(); }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(), env, encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const line = child.stdout.split(/\r?\n/).find((part) => part.startsWith('SERVERLESS_RESULT '));
  assert.ok(line, child.stdout);
  const result = JSON.parse(line.slice('SERVERLESS_RESULT '.length));
  assert.equal(result.handler, 'function');
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { ok: false, error: 'Service temporarily unavailable.' });
  assert.equal(result.sqliteDisabled, true);
  assert.equal(result.aiDisabled, true);
  assert.equal(result.billingDisabled, true);
  assert.equal(existsSync(sqlitePath), false);
});
