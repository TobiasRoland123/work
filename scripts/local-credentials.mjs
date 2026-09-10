import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const root = process.cwd();
const localPath = path.join(root, '.env.local');
const pulledPath = path.join(root, '.env.vercel-development');

export function tokenClaims(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
  catch { return null; }
}

export function usableDevelopmentToken(token, now = Date.now()) {
  const claims = tokenClaims(token ?? '');
  return Boolean(claims?.environment === 'development' && typeof claims.exp === 'number' && claims.exp * 1000 > now + 30 * 60 * 1000);
}

const runPull = () => new Promise((resolve, reject) => {
  const child = spawn('pnpm', ['dlx', 'vercel@59.15.1', 'env', 'pull', '.env.vercel-development', '--environment=development', '--yes'], { cwd: root, stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Vercel env pull failed (${code ?? 'unknown'}).`)));
});

export async function refreshCredentials() {
  const localText = await fs.readFile(localPath, 'utf8');
  await runPull();
  await fs.chmod(pulledPath, 0o600);
  const pulled = dotenv.parse(await fs.readFile(pulledPath, 'utf8'));
  if (!usableDevelopmentToken(pulled.VERCEL_OIDC_TOKEN)) throw new Error('Vercel env pull did not return a valid development OIDC token.');
  const line = `VERCEL_OIDC_TOKEN=${pulled.VERCEL_OIDC_TOKEN}`;
  const merged = /^VERCEL_OIDC_TOKEN\s*=.*$/m.test(localText) ? localText.replace(/^VERCEL_OIDC_TOKEN\s*=.*$/m, line) : `${localText.replace(/\n?$/, '\n')}${line}\n`;
  await fs.writeFile(localPath, merged);
  await fs.chmod(localPath, 0o600);
}

if (process.argv[1]?.endsWith('scripts/local-credentials.mjs')) refreshCredentials().catch((error) => { console.error(error.message); process.exitCode = 1; });
