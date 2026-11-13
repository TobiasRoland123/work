import { randomUUID } from 'node:crypto';
import { costProjection, type MonthCostInput } from './report';
import { types, type Pool, type PoolClient } from 'pg';
import { copenhagenDate, extractAttendance, statusRows, type Extraction } from '../extraction';
import type { AttendanceContextEntry } from '../attendance-context';
import { compareTs, monthlyWindows, PARSER_VERSION, type MonthWindow } from './windows';
import { HistoryRetry, ignoredReason, readSlack, type HistoryMessage } from './slack';

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item
  );
}

export type ImportConfig = {
  teamId: string;
  channelId: string;
  adminUserId: string;
  model: string;
  budgetUsd: number;
  maxRequestUsd: number;
  parserVersion: string;
  mode: 'rehearsal' | 'production';
  targetIdentity: string;
};
type Month = MonthWindow & {
  cursor?: string;
  checkpoint?: string;
  pageLatest?: string;
  complete?: boolean;
  reviewed?: boolean;
  retryAt?: string;
  failures?: number;
};
type Run = {
  id: string;
  config: ImportConfig;
  months: Month[];
  month_index: number;
  paused: boolean;
  spent: string;
};
type Item = {
  message_key: string;
  revision: string;
  message_ts: string;
  author: string;
  source: HistoryMessage | null;
  outcome: string;
  proposal: Proposal | null;
  after_state: Snapshot | null;
  before_state: Snapshot | null;
  attempts: number;
};
type Proposal = {
  userId: string;
  inactive: boolean;
  extraction: Extraction;
  rows: ReturnType<typeof statusRows>;
  replaces: string[];
  existing: unknown[];
  baseline?: Snapshot;
  contextKeys: string[];
};
type Snapshot = {
  message: Record<string, unknown>;
  rows: Record<string, unknown>[];
  links: Record<string, unknown>[];
};

/** A dedicated pool is mandatory. Never imports the app database, queue, Echo or Realtime clients. */
export class HistoryImporter {
  constructor(
    private pool: Pool,
    private config: ImportConfig
  ) {
    // DATE values must survive snapshots as calendar strings, never local-midnight instants.
    pool.options.types = {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
        if (format === 'binary') return types.getTypeParser(oid, 'binary');
        return oid === 1082 || oid === 1114
          ? (value: string) => value
          : types.getTypeParser(oid, 'text');
      }) as typeof types.getTypeParser,
    };
  }
  private async authorized(client: PoolClient) {
    client.setTypeParser(1082, (value) => value);
    client.setTypeParser(1114, (value) => value);
    if (this.config.parserVersion !== PARSER_VERSION)
      throw new Error(`Expected parserVersion ${PARSER_VERSION}`);
    if (
      !(this.config.budgetUsd >= 0) ||
      !(this.config.maxRequestUsd > 0) ||
      !Number.isFinite(this.config.budgetUsd) ||
      !Number.isFinite(this.config.maxRequestUsd)
    )
      throw new Error('Invalid AI budget');
    const admin = await client.query(
      "select 1 from users where user_id=$1 and system_role='ADMIN' and slack_deactivated=false",
      [this.config.adminUserId]
    );
    if (!admin.rowCount) throw new Error('An active ADMIN identity is required');
  }
  private async locked<T>(
    id: string,
    fn: (client: PoolClient, run: Run, month: Month) => Promise<T>,
    allowPaused = false
  ): Promise<T> {
    const client = await this.pool.connect();
    let acquired = false;
    try {
      await this.authorized(client);
      acquired = (
        await client.query('select pg_try_advisory_lock(hashtext($1)) as acquired', [
          `slack-history:${this.config.teamId}:${this.config.channelId}`,
        ])
      ).rows[0].acquired;
      if (!acquired) throw new Error('Another history command is running');
      const run = (await client.query<Run>('select * from slack_import_runs where id=$1', [id]))
        .rows[0];
      if (!run) throw new Error('Unknown import run');
      if (
        JSON.stringify(run.config, Object.keys(run.config).sort()) !==
        JSON.stringify(this.config, Object.keys(this.config).sort())
      )
        throw new Error('Run configuration changed; use the recorded configuration');
      if (run.paused && !allowPaused) throw new Error('Run is paused');
      return await fn(client, run, run.months[run.month_index]);
    } finally {
      if (acquired)
        await client.query('select pg_advisory_unlock(hashtext($1))', [
          `slack-history:${this.config.teamId}:${this.config.channelId}`,
        ]);
      client.release();
    }
  }
  private async saveMonths(c: PoolClient, run: Run) {
    await c.query('update slack_import_runs set months=$2,updated_at=now() where id=$1', [
      run.id,
      JSON.stringify(run.months),
    ]);
  }
  async init(
    cutoff: string,
    coverage: { earliestAvailable: string | null; retentionConfirmed: boolean }
  ) {
    const c = await this.pool.connect();
    try {
      await this.authorized(c);
      const id = randomUUID();
      await c.query(
        'insert into slack_import_runs(id,config,cutoff,coverage,months) values($1,$2,$3,$4,$5)',
        [
          id,
          JSON.stringify(this.config),
          cutoff,
          JSON.stringify({
            ...coverage,
            rule: 'send-time-only; no pre-January context; missing history never implies office attendance',
            learnedShorthand: 'disabled',
            sourceRetention:
              'bounded raw text until month review; purge terminal source on review; replay requires refetch',
          }),
          JSON.stringify(monthlyWindows(cutoff)),
        ]
      );
      return { runId: id, next: 'fetch', parserVersion: PARSER_VERSION };
    } finally {
      c.release();
    }
  }
  async fetch(id: string) {
    return this.locked(id, async (c, run, month) => {
      if (!month || month.reviewed) throw new Error('Run is complete');
      if (month.complete) return { complete: true, next: 'preview' };
      if (month.retryAt && Date.parse(month.retryAt) > Date.now())
        throw new Error(`Retry after ${month.retryAt}`);
      if ((month.failures ?? 0) >= 5)
        throw new Error(
          'Fetch exhausted retries; inspect failure then resume to reset retry count'
        );
      try {
        const auth = await readSlack<{ team_id: string }>('auth.test');
        const info = await readSlack<{
          channel: { id: string; is_member: boolean; is_private: boolean };
        }>('conversations.info', { channel: this.config.channelId });
        if (
          auth.team_id !== this.config.teamId ||
          info.channel.id !== this.config.channelId ||
          !info.channel.is_member ||
          info.channel.is_private
        )
          throw new Error('Slack workspace/public channel membership mismatch');
        if (!month.cursor) month.pageLatest = month.checkpoint ?? month.latest;
        const result = await readSlack<{
          messages: HistoryMessage[];
          has_more?: boolean;
          response_metadata?: { next_cursor?: string };
        }>('conversations.history', {
          channel: this.config.channelId,
          oldest: month.oldest,
          latest: month.pageLatest ?? month.latest,
          inclusive: 'true',
          limit: '15',
          ...(month.cursor ? { cursor: month.cursor } : {}),
        });
        if (!Array.isArray(result.messages)) throw new Error('Malformed history response');
        const cursor = result.response_metadata?.next_cursor?.trim();
        if (cursor && cursor === month.cursor) throw new Error('Repeated pagination cursor');
        await c.query('BEGIN');
        for (const message of result.messages) {
          if (compareTs(message.ts, month.oldest) < 0 || compareTs(message.ts, month.latest) >= 0)
            continue;
          const reason = ignoredReason(message);
          await c.query(
            `insert into slack_import_items(run_id,month,message_key,revision,message_ts,author,source,outcome,reason) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(run_id,message_key) do update set outcome='review',reason='history_revision_changed' where slack_import_items.revision <> excluded.revision`,
            [
              id,
              month.month,
              `${this.config.teamId}:${this.config.channelId}:${message.ts}`,
              message.edited?.ts ?? message.ts,
              message.ts,
              message.user ?? null,
              reason ? null : JSON.stringify(message),
              reason ? 'ignored' : 'fetched',
              reason,
            ]
          );
        }
        const earliest = result.messages.map((m) => m.ts).sort(compareTs)[0];
        if (!cursor && result.has_more && (!earliest || earliest === month.checkpoint))
          throw new Error('History pagination made no progress');
        month.cursor = cursor;
        month.checkpoint = earliest ?? month.checkpoint;
        month.complete = !cursor && !result.has_more;
        month.failures = 0;
        // A separate historical read each minute leaves capacity for live traffic.
        month.retryAt = new Date(Date.now() + 60000).toISOString();
        await this.saveMonths(c, run);
        await c.query('COMMIT');
        return {
          month: month.month,
          complete: month.complete,
          fetched: result.messages.length,
          retryAt: month.retryAt,
        };
      } catch (error) {
        await c.query('ROLLBACK');
        month.failures = (month.failures ?? 0) + 1;
        if (error instanceof Error && error.message.includes('invalid_cursor'))
          month.cursor = undefined;
        month.retryAt = new Date(
          Date.now() + (error instanceof HistoryRetry ? error.afterSeconds : 60) * 1000
        ).toISOString();
        await this.saveMonths(c, run);
        throw error;
      }
    });
  }
  async preview(id: string, limit = 10) {
    return this.locked(id, async (c, run, month) => {
      if (!month?.complete)
        throw new Error('Finish fetching the month before chronological preview');
      const items = (
        await c.query<Item>(
          `select * from slack_import_items where run_id=$1 and month=$2 and outcome in ('fetched','failed') and attempts<5 order by revision::numeric,message_ts::numeric limit $3`,
          [id, month.month, Math.max(1, Math.min(10, limit))]
        )
      ).rows;
      for (const item of items) {
        await c.query(
          'update slack_import_items set attempts=attempts+1 where run_id=$1 and message_key=$2',
          [id, item.message_key]
        );
        try {
          if (!item.source?.text) throw new Error('Source purged; refetch in a new run');
          const live = (
            await c.query('select * from slack_messages where message_key=$1', [item.message_key])
          ).rows[0];
          let baseline: Snapshot | undefined;
          if (live) {
            if (
              live.state === 'deleted' ||
              compareTs(live.revision, item.revision) >= 0 ||
              live.state === 'pending'
            ) {
              await this.outcome(
                c,
                id,
                item,
                live.state === 'applied' && live.revision === item.revision
                  ? 'duplicate'
                  : 'review',
                live.state === 'deleted' ? 'live_deletion' : 'existing_newer_or_pending_revision'
              );
              continue;
            }
            const priorRows = (
              await c.query('select * from status where source_message_key=$1 order by id', [
                item.message_key,
              ])
            ).rows;
            if (
              await this.hasRelationships(
                c,
                item.message_key,
                priorRows.map((r) => r.id)
              )
            ) {
              await this.outcome(c, id, item, 'review', 'existing_corrections_or_relationships');
              continue;
            }
            baseline = { message: live, rows: priorRows, links: [] };
          }
          const user = (
            await c.query(
              'select user_id,slack_deactivated from users where slack_team_id=$1 and slack_user_id=$2',
              [this.config.teamId, item.author]
            )
          ).rows[0];
          if (!user) {
            await this.outcome(c, id, item, 'review', 'unmapped_author');
            continue;
          }
          const day = copenhagenDate(new Date(Number(item.message_ts) * 1000));
          const later = await c.query(
            `select 1 from slack_messages where team_id=$1 and channel_id=$2 and slack_user_id=$3 and revision::numeric>$4::numeric and (to_timestamp(message_ts::numeric) at time zone 'Europe/Copenhagen')::date=$5::date limit 1`,
            [this.config.teamId, this.config.channelId, item.author, item.revision, day]
          );
          if (later.rowCount) {
            await this.outcome(c, id, item, 'review', 'later_live_context_requires_replay');
            continue;
          }
          const unknownContext = await c.query(
            `select 1 from slack_messages m where team_id=$1 and channel_id=$2 and slack_user_id=$3 and revision::numeric<$4::numeric and message_key<>$6 and state='applied' and (to_timestamp(message_ts::numeric) at time zone 'Europe/Copenhagen')::date=$5::date and not exists(select 1 from slack_import_items i where i.run_id=$7 and i.message_key=m.message_key and i.proposal is not null) limit 1`,
            [
              this.config.teamId,
              this.config.channelId,
              item.author,
              item.revision,
              day,
              item.message_key,
              id,
            ]
          );
          if (unknownContext.rowCount) {
            await this.outcome(c, id, item, 'review', 'earlier_live_context_requires_replay');
            continue;
          }
          const previous = (
            await c.query<Item>(
              `select * from slack_import_items where run_id=$1 and author=$2 and revision::numeric<$3::numeric and (to_timestamp(message_ts::numeric) at time zone 'Europe/Copenhagen')::date=$4::date order by revision::numeric`,
              [id, item.author, item.revision, day]
            )
          ).rows;
          if (previous.some((p) => ['failed', 'fetched', 'review'].includes(p.outcome))) {
            await this.outcome(c, id, item, 'review', 'earlier_context_unresolved');
            continue;
          }
          const context: AttendanceContextEntry[] = previous
            .filter((p) => p.proposal?.rows.length)
            .slice(-8)
            .map((p) => ({
              id: p.message_key,
              messageSentAt: new Date(Number(p.message_ts) * 1000).toISOString(),
              announcedAt: new Date(Number(p.revision) * 1000).toISOString(),
              text: p.source?.text ?? null,
              replaceable:
                p.proposal!.rows.every((r) => r.fromDate === r.toDate) &&
                new Set(p.proposal!.rows.map((r) => r.fromDate)).size === 1,
              intervals: p.proposal!.extraction.intervals.map((r) => ({
                ...r,
                startApproximate: r.startApproximate ?? false,
                endApproximate: r.endApproximate ?? false,
              })),
            }));
          const extraction = await extractAttendance(
            item.source.text,
            new Date(Number(item.message_ts) * 1000),
            {
              onStart: async (model) => {
                if (model !== this.config.model)
                  throw new Error('SLACK_EXTRACTION_MODEL differs from frozen run model');
                const charged = await c.query(
                  'update slack_import_runs set spent=spent+$2 where id=$1 and paused=false and spent+$2<= $3 returning spent',
                  [id, this.config.maxRequestUsd, this.config.budgetUsd]
                );
                if (!charged.rowCount) throw new Error('Run AI budget exhausted');
                await c.query(
                  'update slack_import_items set reserved_usd=reserved_usd+$3 where run_id=$1 and message_key=$2',
                  [id, item.message_key, this.config.maxRequestUsd]
                );
              },
              onFinish: async (usage) => {
                if (usage.costUsd !== null && Number(usage.costUsd) > this.config.maxRequestUsd) {
                  await c.query(
                    'update slack_import_runs set spent=spent+$2,paused=true where id=$1',
                    [id, Number(usage.costUsd) - this.config.maxRequestUsd]
                  );
                  await c.query(
                    'update slack_import_items set reserved_usd=reserved_usd+$3 where run_id=$1 and message_key=$2',
                    [id, item.message_key, Number(usage.costUsd) - this.config.maxRequestUsd]
                  );
                  throw new Error('Request exceeded reservation; run paused');
                }
              },
            },
            context
          );
          const rows = extraction.decision === 'apply' ? statusRows(extraction) : [];
          if (baseline && !rows.length) {
            await this.outcome(c, id, item, 'review', 'existing_revision_without_intervals');
            continue;
          }
          // Explicit mentions need human review, including inactive colleagues. Never drop recipients silently.
          if (rows.length && extraction.intervals.some((r) => r.mentionedUserIds?.length)) {
            await this.outcome(c, id, item, 'review', 'mentioned_colleague_requires_review');
            continue;
          }
          const existing = (
            await c.query(
              'select * from status where user_id=$1 and to_date >= $2 and from_date <= $3',
              [user.user_id, rows[0]?.fromDate ?? day, rows.at(-1)?.toDate ?? day]
            )
          ).rows;
          const proposal: Proposal = {
            baseline,
            contextKeys: context.map((entry) => entry.id),
            userId: user.user_id,
            inactive: user.slack_deactivated,
            extraction,
            rows,
            replaces: extraction.replaces ?? [],
            existing,
          };
          await c.query(
            'update slack_import_items set proposal=$3,outcome=$4,reason=$5,updated_at=now() where run_id=$1 and message_key=$2',
            [
              id,
              item.message_key,
              JSON.stringify(proposal),
              rows.length ? 'proposed' : extraction.decision === 'ignore' ? 'ignored' : 'review',
              user.slack_deactivated ? 'inactive_author' : extraction.reason,
            ]
          );
        } catch (error) {
          await this.outcome(
            c,
            id,
            item,
            error instanceof Error && error.message.toLowerCase().includes('budget')
              ? 'review'
              : 'failed',
            error instanceof Error ? error.message : 'extraction_failed'
          );
          break;
        }
      }
      return {
        ...(await this.reportWith(c, id)),
        batch: (
          await c.query(
            'select message_key,revision,outcome,reason,proposal from slack_import_items where run_id=$1 and message_key=ANY($2::text[]) order by revision::numeric',
            [id, items.map((item) => item.message_key)]
          )
        ).rows,
      };
    });
  }
  private async outcome(c: PoolClient, id: string, item: Item, outcome: string, reason: string) {
    await c.query(
      'update slack_import_items set outcome=$3,reason=$4,updated_at=now() where run_id=$1 and message_key=$2',
      [id, item.message_key, outcome, reason]
    );
  }
  private async hasRelationships(c: PoolClient, key: string, ids: number[]): Promise<boolean> {
    const result = await c.query(
      `select 1 from status_corrections where source_message_key=$1 or original_status_id=ANY($2::int[]) or correction_status_id=ANY($2::int[]) union all select 1 from status_supersessions where target_status_id=ANY($2::int[]) or replacement_status_id=ANY($2::int[]) limit 1`,
      [key, ids]
    );
    return !!result.rowCount;
  }
  async apply(id: string, limit = 10) {
    return this.locked(id, async (c, run, month) => {
      if (!month?.complete) throw new Error('Finish fetching first');
      if (
        (
          await c.query(
            `select 1 from slack_import_items where run_id=$1 and month=$2 and outcome in ('fetched','failed') limit 1`,
            [id, month.month]
          )
        ).rowCount
      )
        throw new Error('Finish preview and resolve failed attempts before applying');
      if ((await c.query(`select 1 from slack_messages where state='pending' limit 1`)).rowCount)
        throw new Error('Live inbox has priority; retry after live work drains');
      const items = (
        await c.query<Item>(
          `select * from slack_import_items where run_id=$1 and month=$2 and outcome='proposed' order by revision::numeric,message_ts::numeric limit $3`,
          [id, month.month, Math.max(1, Math.min(10, limit))]
        )
      ).rows;
      for (const item of items) {
        const proposal = item.proposal!;
        await c.query('BEGIN');
        try {
          await c.query('select user_id from users where user_id=$1 for update', [proposal.userId]);
          const contextDay = copenhagenDate(new Date(Number(item.message_ts) * 1000));
          const unexpected = await c.query(
            `select 1 from slack_messages m where team_id=$1 and channel_id=$2 and slack_user_id=$3 and message_key<>$6 and revision::numeric<$4::numeric and (to_timestamp(message_ts::numeric) at time zone 'Europe/Copenhagen')::date=$5::date and not exists(select 1 from slack_import_items i where i.run_id=$7 and i.message_key=m.message_key and i.outcome='applied') limit 1`,
            [
              this.config.teamId,
              this.config.channelId,
              item.author,
              item.revision,
              contextDay,
              item.message_key,
              id,
            ]
          );
          if (unexpected.rowCount) throw new Error('Earlier live context changed after preview');
          for (const contextKey of proposal.contextKeys) {
            const prior = (
              await c.query<Item>(
                'select * from slack_import_items where run_id=$1 and message_key=$2',
                [id, contextKey]
              )
            ).rows[0];
            const current = (
              await c.query('select * from slack_messages where message_key=$1 for share', [
                contextKey,
              ])
            ).rows[0];
            const currentRows = (
              await c.query(
                'select * from status where source_message_key=$1 order by id for share',
                [contextKey]
              )
            ).rows;
            if (
              prior?.outcome !== 'applied' ||
              canonical(current) !== canonical(prior.after_state?.message) ||
              canonical(currentRows) !== canonical(prior.after_state?.rows)
            )
              throw new Error('Earlier context changed after preview');
          }
          // The unique insert serializes with live intake, including a concurrent deletion tombstone.
          let before: Snapshot | { message: null; rows: never[]; links: never[] } = {
            message: null,
            rows: [],
            links: [],
          };
          if (proposal.baseline) {
            const prior = (
              await c.query('select * from slack_messages where message_key=$1 for update', [
                item.message_key,
              ])
            ).rows[0];
            const priorRows = (
              await c.query(
                'select * from status where source_message_key=$1 order by id for update',
                [item.message_key]
              )
            ).rows;
            if (
              canonical(prior) !== canonical(proposal.baseline.message) ||
              canonical(priorRows) !== canonical(proposal.baseline.rows) ||
              (await this.hasRelationships(
                c,
                item.message_key,
                priorRows.map((r) => r.id)
              ))
            )
              throw new Error('Existing revision changed after preview');
            before = proposal.baseline;
            await c.query('delete from status where source_message_key=$1', [item.message_key]);
          }
          const inserted = await c.query(
            `insert into slack_messages(message_key,team_id,channel_id,message_ts,revision,slack_user_id,state,received_at,processed_at,converted_to_status,outcome) values($1,$2,$3,$4,$5,$6,'applied',now(),now(),true,$7) on conflict(message_key) do update set revision=excluded.revision,state=excluded.state,text=null,review_text=null,processed_at=now(),converted_to_status=true,outcome=excluded.outcome where slack_messages.revision=$8 returning *`,
            [
              item.message_key,
              this.config.teamId,
              this.config.channelId,
              item.message_ts,
              item.revision,
              item.author,
              JSON.stringify({ reason: proposal.extraction.reason, importRunId: id }),
              proposal.baseline?.message.revision ?? null,
            ]
          );
          if (!inserted.rowCount) {
            await this.outcome(c, id, item, 'review', 'live_state_changed');
            await c.query('COMMIT');
            continue;
          }
          const day = copenhagenDate(new Date(Number(item.message_ts) * 1000));
          const later = await c.query(
            `select 1 from slack_messages where team_id=$1 and channel_id=$2 and slack_user_id=$3 and revision::numeric>$4::numeric and (to_timestamp(message_ts::numeric) at time zone 'Europe/Copenhagen')::date=$5::date limit 1`,
            [this.config.teamId, this.config.channelId, item.author, item.revision, day]
          );
          if (later.rowCount) throw new Error('Later live context changed after preview');
          const rows: Record<string, unknown>[] = [];
          for (const row of proposal.rows) {
            rows.push(
              (
                await c.query(
                  `insert into status(user_id,status,details,time,from_date,to_date,source_message_key,starts_at,ends_at,starts_at_approximate,ends_at_approximate,announced_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_timestamp($12::numeric),to_timestamp($12::numeric)) returning *`,
                  [
                    proposal.userId,
                    row.status,
                    row.details,
                    row.time,
                    row.fromDate,
                    row.toDate,
                    item.message_key,
                    row.startsAt,
                    row.endsAt,
                    row.startsAtApproximate,
                    row.endsAtApproximate,
                    item.revision,
                  ]
                )
              ).rows[0]
            );
          }
          const links: Record<string, unknown>[] = [];
          for (const key of proposal.replaces) {
            const predecessor = (
              await c.query<Item>(
                'select * from slack_import_items where run_id=$1 and message_key=$2',
                [id, key]
              )
            ).rows[0];
            if (predecessor?.outcome !== 'applied' || !predecessor.after_state)
              throw new Error('Predecessor changed; preview again');
            const actual = await c.query(
              'select * from status where source_message_key=$1 order by id',
              [key]
            );
            if (canonical(actual.rows) !== canonical(predecessor.after_state.rows))
              throw new Error('Predecessor changed after preview');
            const targets = new Set(predecessor.after_state.rows.map((r) => Number(r.id)));
            const ancestors = await c.query(
              'select target_status_id from status_supersessions where replacement_status_id=ANY($1::int[])',
              [[...targets]]
            );
            ancestors.rows.forEach((r) => targets.add(r.target_status_id));
            for (const target of targets)
              for (const replacement of rows)
                links.push(
                  (
                    await c.query(
                      'insert into status_supersessions(target_status_id,replacement_status_id) values($1,$2) returning *',
                      [target, replacement.id]
                    )
                  ).rows[0]
                );
          }
          const after: Snapshot = { message: inserted.rows[0], rows, links };
          await c.query(
            `update slack_import_items set before_state=$3,after_state=$4,outcome='applied',updated_at=now() where run_id=$1 and message_key=$2`,
            [id, item.message_key, JSON.stringify(before), JSON.stringify(after)]
          );
          await c.query('COMMIT');
        } catch (error) {
          await c.query('ROLLBACK');
          await this.outcome(
            c,
            id,
            item,
            'review',
            error instanceof Error ? error.message : 'apply_failed'
          );
        }
      }
      return this.reportWith(c, id);
    });
  }
  async pause(id: string) {
    return this.locked(
      id,
      async (c) => {
        await c.query('update slack_import_runs set paused=true where id=$1', [id]);
        return { paused: true };
      },
      true
    );
  }
  async resume(id: string) {
    return this.locked(
      id,
      async (c, run, month) => {
        if (month) month.failures = 0;
        await this.saveMonths(c, run);
        await c.query('update slack_import_runs set paused=false where id=$1', [id]);
        await c.query(
          "update slack_import_items set attempts=0 where run_id=$1 and outcome='failed'",
          [id]
        );
        return { paused: false };
      },
      true
    );
  }
  async review(id: string) {
    return this.locked(id, async (c, run, month) => {
      if (!month?.complete) throw new Error('Month fetch incomplete');
      if (
        (
          await c.query(
            `select 1 from slack_import_items where run_id=$1 and month=$2 and outcome in ('fetched','proposed','failed') limit 1`,
            [id, month.month]
          )
        ).rowCount
      )
        throw new Error('Month has unfinished work');
      await c.query('BEGIN');
      try {
        month.reviewed = true;
        await this.saveMonths(c, run);
        await c.query('update slack_import_items set source=null where run_id=$1 and month=$2', [
          id,
          month.month,
        ]);
        await c.query('update slack_import_runs set month_index=month_index+1 where id=$1', [id]);
        await c.query('COMMIT');
      } catch (error) {
        await c.query('ROLLBACK');
        throw error;
      }
      return {
        reviewed: month.month,
        next: run.months[run.month_index + 1]?.month ?? 'complete',
        sourceTextPurged: true,
      };
    });
  }
  async report(id: string) {
    return this.locked(id, (c) => this.reportWith(c, id), true);
  }
  private async reportWith(c: PoolClient, id: string) {
    const run = (await c.query('select * from slack_import_runs where id=$1', [id])).rows[0];
    const counts = (
      await c.query(
        'select month,outcome,reason,count(*)::int as count from slack_import_items where run_id=$1 group by month,outcome,reason order by month,outcome,reason',
        [id]
      )
    ).rows;
    const examples = (
      await c.query(
        'select month,message_key,revision,outcome,reason,proposal from slack_import_items where run_id=$1 order by message_ts::numeric limit 30',
        [id]
      )
    ).rows;
    const costs = (
      await c.query<MonthCostInput>(
        `select month, count(*)::int as total, count(*) filter (where attempts > 0 and outcome not in ('fetched','failed'))::int as processed, count(*) filter (where outcome in ('fetched','failed'))::int as pending, sum(reserved_usd)::float8 as "reservedUsd" from slack_import_items where run_id=$1 group by month order by month`,
        [id]
      )
    ).rows;
    const revisedRecords = Number(
      (
        await c.query(
          "select count(*) as count from slack_import_items where run_id=$1 and outcome='applied' and before_state->'message' <> 'null'::jsonb",
          [id]
        )
      ).rows[0].count
    );
    return {
      run,
      counts,
      examples,
      cost: costProjection(costs, Number(run.config.budgetUsd), Number(run.spent)),
      costPolicy:
        'spent is conservative reserved USD including uncertain/failed requests; no Learned Shorthand reads/training',
      coverageWarning:
        'Incomplete/unavailable/unimported history is unknown attendance, never evidence of office presence',
      newRecords:
        counts.filter((r) => r.outcome === 'applied').reduce((n, r) => n + r.count, 0) -
        revisedRecords,
      revisedRecords,
    };
  }
  async undo(id: string, month?: string) {
    return this.locked(
      id,
      async (c) => {
        const items = (
          await c.query<Item>(
            `select * from slack_import_items where run_id=$1 and outcome='applied' and ($2::text is null or month=$2) order by revision::numeric desc,message_ts::numeric desc`,
            [id, month ?? null]
          )
        ).rows;
        let undone = 0,
          conflicts = 0;
        for (const item of items) {
          await c.query('BEGIN');
          try {
            const message = (
              await c.query('select * from slack_messages where message_key=$1 for update', [
                item.message_key,
              ])
            ).rows[0];
            const rows = (
              await c.query(
                'select * from status where source_message_key=$1 order by id for update',
                [item.message_key]
              )
            ).rows;
            const ids = rows.map((r) => r.id);
            const links = (
              await c.query(
                'select * from status_supersessions where replacement_status_id=ANY($1::int[]) order by target_status_id,replacement_status_id',
                [ids]
              )
            ).rows;
            const corrections = await c.query(
              'select 1 from status_corrections where source_message_key=$1 or original_status_id=ANY($2::int[]) or correction_status_id=ANY($2::int[]) limit 1',
              [item.message_key, ids]
            );
            const laterLinks = await c.query(
              'select 1 from status_supersessions where target_status_id=ANY($1::int[]) and not(replacement_status_id=ANY($1::int[])) limit 1',
              [ids]
            );
            const normalize = canonical;
            const expected = item.after_state!;
            const sortLinks = (v: Record<string, unknown>[]) =>
              [...v].sort(
                (a, b) =>
                  Number(a.target_status_id) - Number(b.target_status_id) ||
                  Number(a.replacement_status_id) - Number(b.replacement_status_id)
              );
            if (
              normalize(message) !== normalize(expected.message) ||
              normalize(rows) !== normalize(expected.rows) ||
              normalize(links) !== normalize(sortLinks(expected.links)) ||
              corrections.rowCount ||
              laterLinks.rowCount
            ) {
              conflicts++;
              await c.query('ROLLBACK');
              continue;
            }
            await c.query('delete from status where source_message_key=$1', [item.message_key]);
            if (item.before_state?.message) {
              const columns = [
                'team_id',
                'channel_id',
                'message_ts',
                'revision',
                'slack_user_id',
                'text',
                'review_text',
                'state',
                'attempts',
                'next_attempt_at',
                'received_at',
                'outcome',
                'converted_to_status',
                'processed_at',
              ];
              await c.query(
                `update slack_messages set (${columns.join(',')})=(select ${columns.join(',')} from jsonb_populate_record(null::slack_messages,$2::jsonb)) where message_key=$1`,
                [item.message_key, JSON.stringify(item.before_state.message)]
              );
              if (item.before_state.rows.length)
                await c.query(
                  'insert into status select * from jsonb_populate_recordset(null::status,$1::jsonb)',
                  [JSON.stringify(item.before_state.rows)]
                );
            } else
              await c.query('delete from slack_messages where message_key=$1', [item.message_key]);
            await this.outcome(c, id, item, 'undone', 'restored_prior_state');
            await c.query('COMMIT');
            undone++;
          } catch (error) {
            await c.query('ROLLBACK');
            throw error;
          }
        }
        return {
          undone,
          conflicts,
          detail:
            'Conflicts preserve later live edits, deletions, Corrections and supersession links; inspect before further action',
        };
      },
      true
    );
  }
}
