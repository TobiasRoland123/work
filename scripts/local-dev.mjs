import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';
import { refreshCredentials, usableDevelopmentToken } from './local-credentials.mjs';

const root = process.cwd();
const envPath = path.join(root, '.env.local');
let envText = await fs.readFile(envPath, 'utf8').catch(() => {
  throw new Error('Create .env.local from .env.example before running pnpm local:dev.');
});
let env = dotenv.parse(envText);
if ([env.VERCEL_ENV, env.VERCEL_TARGET_ENV].includes('production'))
  throw new Error('Remove production Vercel environment markers from .env.local.');
if (!usableDevelopmentToken(env.VERCEL_OIDC_TOKEN)) {
  console.log('Refreshing Vercel development credentials...');
  await refreshCredentials();
  envText = await fs.readFile(envPath, 'utf8');
  env = dotenv.parse(envText);
}

const required = [
  'AUTH_SECRET',
  'AUTH_SLACK_ID',
  'AUTH_SLACK_SECRET',
  'SLACK_TEAM_ID',
  'SLACK_CHANNEL_ID',
  'SLACK_SIGNING_SECRET',
  'PGUSER',
];
const missing = required.filter((name) => !env[name]?.trim());
if (missing.length) throw new Error(`Missing required local settings: ${missing.join(', ')}`);
if (!env.SLACK_BOT_TOKEN?.trim())
  console.warn('SLACK_BOT_TOKEN is empty. Slack login and directory sync need the development app installed first.');

const expectedDb = { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'work_dev' };
for (const [name, value] of Object.entries(expectedDb)) {
  if (env[name] !== value) throw new Error(`${name} must be ${value} for local development.`);
}

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
if (await isPortOpen(3000)) throw new Error('Port 3000 is already in use. Stop that process first.');

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
} finally {
  await pool.end();
}

let tunnel;
let next;
let stopping = false;
const killChild = (child) => {
  if (!child?.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
};
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  killChild(tunnel);
  killChild(next);
  setTimeout(() => process.exit(code), 250);
};
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

const tunnelUrl = await new Promise((resolve, reject) => {
  tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:3000', '--no-autoupdate'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let settled = false;
  const onData = (chunk) => {
    const line = chunk.toString();
    process.stderr.write(line);
    const match = line.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
    if (match && !settled) {
      settled = true;
      resolve(match[0].replace(/[),]+$/, ''));
    }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.once('error', (error) => { if (!settled) { settled = true; reject(error); } });
  tunnel.once('exit', (code) => {
    if (!settled) {
      settled = true;
      reject(new Error(`cloudflared exited before creating a tunnel (${code ?? 'unknown'}).`));
    } else if (!stopping) {
      console.error(`cloudflared exited unexpectedly (${code ?? 'unknown'}).`);
      stop(1);
    }
  });
});

const authUrl = tunnelUrl;
const authLine = `AUTH_URL=${authUrl}`;
const updatedEnv = /^AUTH_URL\s*=.*$/m.test(envText)
  ? envText.replace(/^AUTH_URL\s*=.*$/m, authLine)
  : `${authLine}\n${envText}`;
try {
  await fs.writeFile(envPath, updatedEnv);
} catch (error) {
  stop(1);
  throw error;
}

console.log(`Local database ${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE} is reachable.`);
console.log(`Tunnel: ${authUrl}`);
console.log(`Open this URL to sign in: ${authUrl}/login (use the tunnel address, not localhost, so login cookies match the callback).`);
console.log(`Slack callback URL: ${authUrl}/api/auth/callback/slack`);
console.log(`Slack installation callback URL: ${authUrl}/api/slack/install/callback`);
console.log(`Slack events URL: ${authUrl}/api/slack/events`);
console.log('Register both callback URLs and the events URL in the development Slack app when this temporary tunnel changes.');

next = spawn('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: root,
  stdio: 'inherit',
  detached: true,
  env: {
    ...process.env,
    ...env,
    AUTH_URL: authUrl,
    NODE_ENV: 'development',
    PORT: '3000',
    VERCEL_ENV: 'development',
    VERCEL_TARGET_ENV: 'development',
  },
});
next.once('error', (error) => { console.error(`Next.js failed to start: ${error.message}`); stop(1); });
next.once('exit', (code, signal) => stop(signal ? 1 : code ?? 1));
