import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { bootstrapDatabase, missingDatabaseSchema } from './local-database.mjs';

// Local development runs against the Local Sandbox (/sandbox) instead of Slack.
// See docs/adr/0001-local-sandbox-replaces-slack.md.
const SANDBOX_TEAM_ID = 'T_LOCAL';
const SANDBOX_CHANNEL_ID = 'C_LOCAL';
const root = process.cwd();
const envPath = path.join(root, '.env.local');
const envText = await fs.readFile(envPath, 'utf8').catch(() => {
  throw new Error('Create .env.local from .env.example before running pnpm local:dev.');
});
const env = dotenv.parse(envText);
if ([env.VERCEL_ENV, env.VERCEL_TARGET_ENV].includes('production'))
  throw new Error('Remove production Vercel environment markers from .env.local.');

const required = [
  'AUTH_SECRET',
  'SLACK_TEAM_ID',
  'SLACK_CHANNEL_ID',
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
];
const missing = required.filter((name) => !env[name]?.trim());
if (missing.length) throw new Error(`Missing required local settings: ${missing.join(', ')}`);
// The sandbox never contacts Slack; a real workspace id here means .env.local is pointing at production.
const expectedSandbox = { SLACK_TEAM_ID: SANDBOX_TEAM_ID, SLACK_CHANNEL_ID: SANDBOX_CHANNEL_ID };
for (const [name, value] of Object.entries(expectedSandbox)) {
  if (env[name] !== value)
    throw new Error(
      `${name} must be ${value} for local development. Slack is replaced by /sandbox.`
    );
}
if (!env.AI_GATEWAY_API_KEY?.trim())
  console.warn(
    'AI_GATEWAY_API_KEY is empty. Only shorthand messages such as "wfh" can be interpreted in the sandbox.'
  );

const expectedDb = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'work_dev' };
for (const [name, value] of Object.entries(expectedDb)) {
  if (env[name] !== value) throw new Error(`${name} must be ${value} for local development.`);
}
if (process.argv.includes('--docker')) await bootstrapDatabase({ cwd: root, env });

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
if (await isPortOpen(3000))
  throw new Error('Port 3000 is already in use. Stop that process first.');

const pool = new pg.Pool({
  host: env.PGHOST,
  port: Number(env.PGPORT),
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  connectionTimeoutMillis: 5000,
});
try {
  await pool.query('SELECT 1');
  const missingSchema = await missingDatabaseSchema(pool);
  if (missingSchema.length)
    throw new Error(
      `Local database schema is incomplete (${missingSchema.join(', ')}). Run pnpm local:db first.`
    );
} finally {
  await pool.end();
}

const childEnv = {
  ...process.env,
  ...env,
  AUTH_URL: 'http://127.0.0.1:3000',
  NODE_ENV: 'development',
  PORT: '3000',
  VERCEL_ENV: 'development',
  VERCEL_TARGET_ENV: 'development',
};

// Idempotent: the checked-in Sandbox Profiles are upserted on every start.
await new Promise((resolve, reject) => {
  const seed = spawn('pnpm', ['exec', 'tsx', 'db/seed-sandbox.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: childEnv,
  });
  seed.once('error', reject);
  seed.once('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`Sandbox seeding failed (${code ?? 'unknown'}).`))
  );
});

let next;
let stopping = false;
const killChild = (child) => {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
};
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  killChild(next);
  setTimeout(() => process.exit(code), 250);
};
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

console.info(`Local database ${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE} is reachable.`);
console.info('Local Sandbox: http://127.0.0.1:3000/sandbox (no sign-in needed)');
console.info('Sign in as a Sandbox Profile from that page to see /today, /contact and /profile.');

next = spawn('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: root,
  stdio: 'inherit',
  detached: true,
  env: childEnv,
});
next.once('error', (error) => {
  console.error(`Next.js failed to start: ${error.message}`);
  stop(1);
});
next.once('exit', (code, signal) => stop(signal ? 1 : (code ?? 1)));
