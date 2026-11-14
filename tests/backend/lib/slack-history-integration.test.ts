import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as extraction from '@/lib/slack/extraction';
import { Pool } from 'pg';
import { HistoryImporter, type ImportConfig } from '@/lib/slack/history/importer';
import { PARSER_VERSION } from '@/lib/slack/history/windows';

// Opt-in isolated database only; never imports the application database or dotenv.
const url = process.env.SLACK_HISTORY_TEST_DATABASE_URL;
describe.skipIf(!url)('history transaction integration', () => {
  const pool = new Pool({ connectionString: url });
  const config: ImportConfig = {
    teamId: 'T-history-test',
    channelId: 'C-history-test',
    adminUserId: 'history-admin',
    model: 'unused',
    budgetUsd: 0,
    maxRequestUsd: 1,
    parserVersion: PARSER_VERSION,
    mode: 'rehearsal',
    targetIdentity: 'isolated-test',
  };
  const importer = new HistoryImporter(pool, config);
  let runId: string;
  beforeAll(async () => {
    await pool.query("delete from status where source_message_key like 'T-history-test:%'");
    await pool.query("delete from slack_messages where team_id='T-history-test'");
    await pool.query(
      "delete from slack_import_items where run_id in(select id from slack_import_runs where config->>'teamId'='T-history-test')"
    );
    await pool.query("delete from slack_import_runs where config->>'teamId'='T-history-test'");
    await pool.query(
      `insert into users(user_id,email,system_role,slack_team_id,slack_user_id) values('history-admin','history-admin@example.test','ADMIN','T-history-test','U-history') on conflict(user_id) do nothing`
    );
    runId = (
      await importer.init('2026-02-01T00:00:00Z', {
        earliestAvailable: null,
        retentionConfirmed: false,
      })
    ).runId;
    await pool.query(
      `update slack_import_runs set months=jsonb_set(months,'{0,complete}','true') where id=$1`,
      [runId]
    );
  });
  afterAll(async () => {
    await pool.end();
  });
  async function stage(ts: string, revision = ts) {
    const key = `T-history-test:C-history-test:${ts}`;
    await pool.query(
      `insert into slack_import_items(run_id,month,message_key,revision,message_ts,author,source) values($1,'2026-01',$2,$3,$4,'U-history',$5)`,
      [
        runId,
        key,
        revision,
        ts,
        JSON.stringify({
          ts,
          user: 'U-history',
          text: 'WFH',
          ...(revision !== ts ? { edited: { ts: revision } } : {}),
        }),
      ]
    );
    return key;
  }
  it('previews original dates, applies once, and restores absence', async () => {
    const key = await stage('1767265200.000001');
    await importer.preview(runId);
    expect(
      (await pool.query('select count(*)::int n from status where source_message_key=$1', [key]))
        .rows[0].n
    ).toBe(0);
    await importer.apply(runId);
    await importer.apply(runId);
    const rows = (await pool.query('select * from status where source_message_key=$1', [key])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].from_date).toBe('2026-01-01');
    expect(new Date(rows[0].announced_at).getFullYear()).toBe(2026);
    expect((await importer.undo(runId)).undone).toBe(1);
    expect(
      (await pool.query('select count(*)::int n from status where source_message_key=$1', [key]))
        .rows[0].n
    ).toBe(0);
  });
  it('preserves a deletion arriving between preview and apply', async () => {
    const key = await stage('1767351600.000001');
    await importer.preview(runId);
    await pool.query(
      `insert into slack_messages(message_key,team_id,channel_id,message_ts,revision,slack_user_id,state) values($1,$2,$3,$4,$5,'U-history','deleted')`,
      [key, config.teamId, config.channelId, '1767351600.000001', '1767351601.000001']
    );
    await importer.apply(runId);
    expect(
      (await pool.query('select state from slack_messages where message_key=$1', [key])).rows[0]
        .state
    ).toBe('deleted');
    expect(
      (await pool.query('select count(*)::int n from status where source_message_key=$1', [key]))
        .rows[0].n
    ).toBe(0);
  });
  it('updates a safe older revision and undo restores exact old IDs and revision', async () => {
    const ts = '1767438000.000001';
    const key = await stage(ts, '1767438010.000001');
    await pool.query(
      `insert into slack_messages(message_key,team_id,channel_id,message_ts,revision,slack_user_id,state) values($1,$2,$3,$4,$4,'U-history','applied')`,
      [key, config.teamId, config.channelId, ts]
    );
    const old = (
      await pool.query(
        `insert into status(user_id,status,from_date,to_date,source_message_key,announced_at) values('history-admin','IN_OFFICE','2026-01-03','2026-01-03',$1,to_timestamp($2::numeric)) returning *`,
        [key, ts]
      )
    ).rows[0];
    await importer.preview(runId);
    await importer.apply(runId);
    expect(
      (await pool.query('select revision from slack_messages where message_key=$1', [key])).rows[0]
        .revision
    ).toBe('1767438010.000001');
    expect((await importer.undo(runId)).undone).toBe(1);
    expect(
      (await pool.query('select * from status where source_message_key=$1', [key])).rows
    ).toEqual([old]);
    expect(
      (await pool.query('select revision from slack_messages where message_key=$1', [key])).rows[0]
        .revision
    ).toBe(ts);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('recovers an expired cursor using a durable overlapping timestamp and completes short pages', async () => {
    const fetchRun = (
      await importer.init('2026-02-01T00:00:00Z', {
        earliestAvailable: null,
        retentionConfirmed: false,
      })
    ).runId;
    vi.stubEnv('SLACK_IMPORT_BOT_TOKEN', 'test');
    let pages = 0;
    const calls: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, request: RequestInit) => {
        if (url.endsWith('auth.test')) return Response.json({ ok: true, team_id: config.teamId });
        if (url.endsWith('conversations.info'))
          return Response.json({
            ok: true,
            channel: { id: config.channelId, is_member: true, is_private: false },
          });
        const params = new URLSearchParams(String(request.body));
        calls.push(params);
        pages++;
        if (pages === 1)
          return Response.json({
            ok: true,
            messages: [{ ts: '1767351600.000001', user: 'U-history', text: 'WFH' }],
            has_more: true,
            response_metadata: { next_cursor: 'cursor-one' },
          });
        if (pages === 2) return Response.json({ ok: false, error: 'invalid_cursor' });
        return Response.json({
          ok: true,
          messages: [
            { ts: '1767351600.000001', user: 'U-history', text: 'WFH' },
            { ts: '1767265200.000001', user: 'U-history', text: 'WFH' },
          ],
          has_more: false,
        });
      })
    );
    expect(await importer.fetch(fetchRun)).toMatchObject({ complete: false });
    const clearCooldown = () =>
      pool.query(
        `update slack_import_runs set months=jsonb_set(months,'{0,retryAt}','"2000-01-01T00:00:00Z"') where id=$1`,
        [fetchRun]
      );
    await clearCooldown();
    await expect(importer.fetch(fetchRun)).rejects.toThrow('invalid_cursor');
    await clearCooldown();
    expect(await importer.fetch(fetchRun)).toMatchObject({ complete: true });
    expect(calls[1].get('cursor')).toBe('cursor-one');
    expect(calls[2].get('cursor')).toBeNull();
    expect(calls[2].get('latest')).toBe('1767351600.000001');
    expect(
      (
        await pool.query('select count(*)::int n from slack_import_items where run_id=$1', [
          fetchRun,
        ])
      ).rows[0].n
    ).toBe(2);
  });
  it('does not call a paid model when the frozen reservation budget is exhausted', async () => {
    const key = await stage('1767524400.000001');
    let paidRequests = 0;
    vi.spyOn(extraction, 'extractAttendance').mockImplementation(
      async (_text, _instant, observer) => {
        await observer!.onStart('unused');
        paidRequests++;
        return { decision: 'review', reason: 'unsupported', intervals: [] };
      }
    );
    await importer.preview(runId);
    expect(paidRequests).toBe(0);
    expect(
      (
        await pool.query(
          'select outcome,reason from slack_import_items where run_id=$1 and message_key=$2',
          [runId, key]
        )
      ).rows[0]
    ).toMatchObject({ outcome: 'review', reason: 'Run AI budget exhausted' });
  });
  it('applies follow-up context chronologically and undo restores supersession relationships', async () => {
    const first = await stage('1767697200.000001');
    const second = await stage('1767697260.000001');
    vi.spyOn(extraction, 'extractAttendance').mockImplementation(
      async (_text, _instant, _observer, context = []) => ({
        decision: 'apply',
        reason: 'clear',
        replaces: context.map((c) => c.id),
        intervals: [
          {
            status: 'IN_LATE',
            fromDate: '2026-01-06',
            toDate: '2026-01-06',
            startTime: null,
            endTime: context.length ? '11:00' : '10:00',
            startApproximate: false,
            endApproximate: false,
            comment: null,
          },
        ],
      })
    );
    await importer.preview(runId);
    await importer.apply(runId, 1);
    await importer.apply(runId, 1);
    const links = (
      await pool.query(
        'select * from status_supersessions where replacement_status_id in(select id from status where source_message_key=$1)',
        [second]
      )
    ).rows;
    expect(links).toHaveLength(1);
    expect((await importer.undo(runId)).undone).toBe(2);
    expect(
      (
        await pool.query(
          'select count(*)::int n from status where source_message_key=ANY($1::text[])',
          [[first, second]]
        )
      ).rows[0].n
    ).toBe(0);
  });
  it('does not apply a follow-up after its earlier source has a newer live revision', async () => {
    const first = await stage('1767783600.000001');
    const second = await stage('1767783660.000001');
    vi.spyOn(extraction, 'extractAttendance').mockImplementation(
      async (_text, _instant, _observer, context = []) => ({
        decision: 'apply',
        reason: 'clear',
        replaces: context.map((c) => c.id),
        intervals: [
          {
            status: 'FROM_HOME',
            fromDate: '2026-01-07',
            toDate: '2026-01-07',
            startTime: null,
            endTime: null,
            startApproximate: false,
            endApproximate: false,
            comment: null,
          },
        ],
      })
    );
    await importer.preview(runId);
    await importer.apply(runId, 1);
    await pool.query(
      "update slack_messages set revision='1767783620.000001',state='review' where message_key=$1",
      [first]
    );
    await importer.apply(runId, 1);
    expect(
      (
        await pool.query(
          'select outcome,reason from slack_import_items where run_id=$1 and message_key=$2',
          [runId, second]
        )
      ).rows[0]
    ).toMatchObject({ outcome: 'review', reason: 'Earlier context changed after preview' });
    expect((await importer.undo(runId)).conflicts).toBe(1);
  });
});
