import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('compiled serverless artifact starts with runtime dependencies only', () => {
  const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(vercelConfig.functions['api/index.js'].includeFiles, 'dist-server/**');
  const entry = readFileSync('api/index.js', 'utf8');
  assert.match(entry, /from ['"]\.\.\/dist-server\/server\/app\.js['"]/);
  assert.doesNotMatch(entry, /tsx|\.ts['"]/);
  const root = mkdtempSync(path.join(tmpdir(), 'inner-circle-artifact-'));
  try {
    mkdirSync(path.join(root, 'api'));
    mkdirSync(path.join(root, 'dist-server'), { recursive: true });
    cpSync('api/index.js', path.join(root, 'api/index.js'));
    cpSync('dist-server/server', path.join(root, 'dist-server/server'), { recursive: true });

    const runtimePackages = ['@google/genai', '@supabase/supabase-js', 'dotenv', 'express'];
    const dependencies = Object.fromEntries(runtimePackages.map((name) => {
      const pkg = JSON.parse(readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
      return [name, pkg.version];
    }));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
    const install = spawnSync('npx --yes bun@1.4.5 install --production', {
      cwd: root, shell: true, encoding: 'utf8', timeout: 120_000,
    });
    assert.equal(install.status, 0, install.stderr || install.stdout);
    for (const name of ['tsx', 'esbuild', 'better-sqlite3']) {
      assert.equal(existsSync(path.join(root, 'node_modules', name)), false, `${name} entered the runtime fixture`);
    }

    const sqlitePath = path.join(root, 'unwanted.db');
    const env = { ...process.env, NODE_ENV: 'production', VERCEL: '1', ALLOW_LOCAL_SQLITE: 'true',
      LOCAL_SQLITE_PATH: sqlitePath, AI_STUDIO_LIVE_ENABLED: 'false' };
    for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY', 'BILLING_WEBHOOK_SECRET']) delete env[key];
    const script = `
      import app from './api/index.js';
      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise((resolve) => server.once('listening', resolve));
        const base = 'http://127.0.0.1:' + server.address().port;
        const health = await fetch(base + '/api/health');
        const healthBody = await health.json();
        const member = await fetch(base + '/api/auth/me');
        const admin = await fetch(base + '/api/admin/invitations');
        console.log('ARTIFACT_RESULT ' + JSON.stringify({ handler: typeof app,
          health: health.status, healthBody, member: member.status, admin: admin.status }));
      } finally { server.close(); }
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root, env, encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const line = child.stdout.split(/\r?\n/).find((part) => part.startsWith('ARTIFACT_RESULT '));
    assert.ok(line, child.stdout);
    const result = JSON.parse(line.slice('ARTIFACT_RESULT '.length));
    assert.deepEqual(result, { handler: 'function', health: 503,
      healthBody: { ok: false, error: 'Service temporarily unavailable.' }, member: 401, admin: 401 });
    assert.equal(existsSync(sqlitePath), false);
  } finally {
    assert.ok(root.startsWith(path.join(tmpdir(), 'inner-circle-artifact-')));
    rmSync(root, { recursive: true, force: true });
  }
});
