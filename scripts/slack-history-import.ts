/** Operator-only CLI. Never imports db/index.ts or loads an application's .env file. */
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { z } from 'zod';
import { readMigrations } from '../lib/db-migrations/runner';
import {
  explicitImportTarget,
  inspectImportDatabase,
  assertImportIsolation,
} from '../lib/slack/history/operator';

const settingsSchema = z
  .object({
    teamId: z.string().min(1),
    channelId: z.string().min(1),
    adminUserId: z.string().min(1),
    model: z.string().min(1),
    budgetUsd: z.number().finite().nonnegative(),
    maxRequestUsd: z.number().finite().positive(),
    parserVersion: z.string().min(1),
    mode: z.enum(['rehearsal', 'production']),
    cutoff: z.string().datetime({ offset: true }),
    coverage: z.object({
      earliestAvailable: z.string().nullable(),
      retentionConfirmed: z.boolean(),
    }),
  })
  .strict();

const help = `Usage: pnpm slack:history COMMAND --config PATH [--run UUID] [--limit 10] [--month YYYY-MM]
Commands: preflight, init, fetch, preview, apply, pause, resume, review, report, undo
One invocation performs one bounded batch. Inspect reports before review advances a month.
The JSON configuration contains no credentials. See docs/slack-history-import.md.
`;

function options(args: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--config', '--run', '--limit', '--month'].includes(key) || !args[i + 1] || result[key])
      throw new Error(`Invalid or duplicate argument: ${key}`);
    result[key] = args[i + 1];
  }
  return result;
}

async function sourcePreflight(teamId: string, channelId: string) {
  const token = process.env.SLACK_IMPORT_BOT_TOKEN;
  if (!token) throw new Error('Set SLACK_IMPORT_BOT_TOKEN for read-only Slack requests.');
  const scopes = new Set<string>();
  async function read(method: string, params: Record<string, string> = {}) {
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15_000),
    });
    for (const scope of (response.headers.get('x-oauth-scopes') ?? '').split(','))
      if (scope.trim()) scopes.add(scope.trim());
    if (response.status === 429)
      throw new Error(
        `Slack throttled preflight. Retry after ${response.headers.get('retry-after') ?? '60'} seconds.`
      );
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(`Slack ${method}: ${result.error ?? response.status}`);
    return result;
  }
  const auth = await read('auth.test');
  if (auth.team_id !== teamId) throw new Error('Slack token belongs to a different workspace.');
  const info = await read('conversations.info', { channel: channelId });
  if (info.channel?.id !== channelId || !info.channel.is_member || info.channel.is_private)
    throw new Error('Expected a public channel with the bot as a member.');
  const history = await read('conversations.history', {
    channel: channelId,
    limit: '1',
    oldest: '1767222000.000000',
    inclusive: 'true',
  });
  if (scopes.size && !scopes.has('channels:history'))
    throw new Error('Installed token lacks channels:history.');
  return {
    teamId,
    channelId,
    channelName: info.channel.name,
    installedScopes: [...scopes],
    historyReadable: true,
    retentionLimited: history.is_limited === true,
    sampleMessagePresent: Boolean(history.messages?.length),
    coverageWarning:
      'A successful request does not establish complete retention. Verify earliest available history and workspace retention separately.',
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    console.info(help);
    return;
  }
  if (
    ![
      'preflight',
      'init',
      'fetch',
      'preview',
      'apply',
      'pause',
      'resume',
      'review',
      'report',
      'undo',
    ].includes(command)
  )
    throw new Error(`Unknown command: ${command}`);
  const flags = options(args);
  if (!flags['--config']) throw new Error('--config is required.');
  const settings = settingsSchema.parse(JSON.parse(readFileSync(flags['--config'], 'utf8')));
  const target = explicitImportTarget(process.env);
  const pool = new Pool({
    connectionString: target.connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const database = await inspectImportDatabase(
      pool,
      process.env.SLACK_IMPORT_EXPECT_DATABASE!,
      settings.adminUserId
    );
    const expectedMigration = readMigrations('./db').at(-1)!;
    if (
      database.migration.hash !== expectedMigration.hash ||
      Number(database.migration.created_at) !== expectedMigration.when
    )
      throw new Error(
        `Target migration ledger does not match ${expectedMigration.tag}; inspect schema and apply pending migrations before importing.`
      );
    if (command === 'preflight') {
      console.info(
        JSON.stringify(
          {
            targetIdentity: target.identity,
            ...database,
            slack: await sourcePreflight(settings.teamId, settings.channelId),
          },
          null,
          2
        )
      );
      return;
    }
    assertImportIsolation(process.env, settings.mode);
    if (process.env.SLACK_HISTORY_IMPORT_MODE !== settings.mode)
      throw new Error(
        'SLACK_HISTORY_IMPORT_MODE must match configuration mode; enable it on every affected app/worker instance first.'
      );
    const { HistoryImporter } = await import('../lib/slack/history/importer');
    const { cutoff, coverage, ...config } = settings;
    process.env.SLACK_EXTRACTION_MODEL = settings.model;
    const importer = new HistoryImporter(pool, { ...config, targetIdentity: target.identity });
    let result: unknown;
    if (command === 'init') result = await importer.init(cutoff, coverage);
    else {
      const runId = flags['--run'];
      if (!runId) throw new Error('--run is required.');
      const limit = Number(flags['--limit'] ?? '10');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
        throw new Error('--limit must be 1 through 50.');
      switch (command) {
        case 'fetch':
          result = await importer.fetch(runId);
          break;
        case 'preview':
          result = await importer.preview(runId, limit);
          break;
        case 'apply':
          result = await importer.apply(runId, limit);
          break;
        case 'pause':
          result = await importer.pause(runId);
          break;
        case 'resume':
          result = await importer.resume(runId);
          break;
        case 'review':
          result = await importer.review(runId);
          break;
        case 'report':
          result = await importer.report(runId);
          break;
        case 'undo': {
          const month = flags['--month'];
          if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
            throw new Error('--month must be a recorded YYYY-MM month.');
          result = await importer.undo(runId, month);
          break;
        }
      }
    }
    console.info(JSON.stringify(result ?? { ok: true, command }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // Do not print raw driver errors: connection strings can contain credentials.
  const message = error instanceof Error ? error.message : 'Import command failed';
  console.error(
    message
      .replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database URL redacted]')
      .replace(/xox[baprs]-[A-Za-z0-9-]+/g, '[Slack token redacted]')
  );
  process.exitCode = 1;
});
