import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';

const required = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const requiredSchema = {
  users: ['slack_user_id', 'slack_team_id', 'slack_deactivated'],
  status: [],
  slack_messages: [],
};

export function validateDatabaseEnv(env) {
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing local database settings: ${missing.join(', ')}`);
  const port = Number(env.PGPORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PGPORT must be an integer between 1 and 65535.');
  return { ...env, PGPORT: String(port) };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(' ')} failed (${code ?? 'unknown'}).`))
    );
  });
}

const unavailableCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ETIMEDOUT']);

function databaseServerIsUnavailable(error) {
  if (unavailableCodes.has(error?.code)) return true;
  return Array.isArray(error?.errors) && error.errors.some(databaseServerIsUnavailable);
}

export async function missingDatabaseSchema(pool) {
  const tables = Object.keys(requiredSchema);
  const result = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [tables]
  );
  const present = new Map();
  for (const { table_name: tableName, column_name: columnName } of result.rows) {
    const columns = present.get(tableName) ?? new Set();
    columns.add(columnName);
    present.set(tableName, columns);
  }
  const missing = [];
  for (const [table, columns] of Object.entries(requiredSchema)) {
    if (!present.has(table)) {
      missing.push(`table ${table}`);
      continue;
    }
    for (const column of columns) {
      if (!present.get(table).has(column)) missing.push(`column ${table}.${column}`);
    }
  }
  return missing;
}

async function ensureServiceRole(pool) {
  const result = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AS present"
  );
  if (!result.rows[0]?.present) await pool.query('CREATE ROLE service_role NOLOGIN');
}

async function startDocker({ cwd, runCommand }) {
  await runCommand(
    'docker',
    ['compose', '--env-file', '.env.local', 'up', '-d', '--wait', '--wait-timeout', '30'],
    { cwd }
  );
}

export async function assertDockerSocketAccess({
  env = process.env,
  platform = process.platform,
  socketPath = '/var/run/docker.sock',
  access = fs.access,
  stat = fs.stat,
} = {}) {
  if (platform !== 'linux' || env.DOCKER_HOST) return;

  try {
    await stat(socketPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  try {
    await access(socketPath, fsConstants.R_OK | fsConstants.W_OK);
  } catch {
    throw new Error(
      `Cannot access Docker at ${socketPath}. If this account was just added to the docker group, run "newgrp docker" in this terminal or sign out and back in. Then verify access with "docker info".`
    );
  }
}

/** @param {any} [options] */
export async function bootstrapDatabase({
  cwd = process.cwd(),
  env: suppliedEnv = undefined,
  connect = defaultConnect,
  runCommand = run,
  retries = 30,
  retryDelayMs = 1000,
  reset = false,
  checkDockerAccess = assertDockerSocketAccess,
} = {}) {
  const env = validateDatabaseEnv(
    suppliedEnv ?? dotenv.parse(await fs.readFile(path.join(cwd, '.env.local'), 'utf8'))
  );
  if (env.PGHOST !== '127.0.0.1')
    throw new Error('Docker database commands require PGHOST=127.0.0.1.');

  let pool;
  let lastError;
  await checkDockerAccess();
  if (reset) {
    await runCommand('docker', ['compose', '--env-file', '.env.local', 'down', '--volumes'], {
      cwd,
    });
  }
  await startDocker({ cwd, runCommand });

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      pool = await connect(env);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (!databaseServerIsUnavailable(error))
        throw new Error(
          `Cannot connect to PostgreSQL at ${env.PGHOST}:${env.PGPORT}/${env.PGDATABASE}: ${error.message}`
        );
      await delay(retryDelayMs);
    }
  }
  if (!pool) {
    throw new Error(
      `PostgreSQL did not become ready at 127.0.0.1:${env.PGPORT}: ${lastError?.message ?? 'unknown error'}`
    );
  }

  try {
    await ensureServiceRole(pool);
    console.info('Synchronizing local database schema...');
    await runCommand('pnpm', ['exec', 'drizzle-kit', 'push'], {
      cwd,
      env: { ...process.env, ...env },
    });
    const missing = await missingDatabaseSchema(pool);
    if (missing.length)
      throw new Error(`Local database schema is still incomplete: ${missing.join(', ')}.`);
    return { startedDocker: true, synchronized: true };
  } finally {
    await pool.end();
  }
}

async function defaultConnect(env) {
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
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

if (process.argv[1]?.endsWith('scripts/local-database.mjs')) {
  const reset = process.argv.includes('--reset');
  bootstrapDatabase({ reset })
    .then(() => console.info('Local database is ready and its schema synchronization completed.'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
