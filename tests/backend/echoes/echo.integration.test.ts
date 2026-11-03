import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessages, status, statusEchoes, users } from '@/db/schema';
import type { NewStatus } from '@/db/types';
import { SlackApiError } from '@/lib/slack/client';
import { enqueueSlackEvent } from '@/lib/slack/inbox';
import { runEchoJob, type EchoTransport } from '@/lib/services/echoService';
import { statusService } from '@/lib/services/statusService';
import { copenhagenWallClock } from '@/lib/status/active';

const team = 'TECHO_' + randomUUID().slice(0, 8);
const channel = 'CECHO_' + randomUUID().slice(0, 8);
const anna = randomUUID();
const people = [anna];
const photo = 'https://avatars.slack-edge.com/anna_512.png';

// Monday 2 November 2026 is in winter time, so 08:00 Copenhagen is 07:00 UTC.
const at = (iso: string) => new Date(iso);
const monday = '2026-11-02';

function fakeSlack() {
  let next = 0;
  const posts: Parameters<EchoTransport['post']>[0][] = [];
  const updates: Parameters<EchoTransport['update']>[0][] = [];
  const control = { failing: false };
  const transport: EchoTransport = {
    async post(input) {
      posts.push(input);
      if (control.failing) throw new SlackApiError('Slack chat.postMessage failed', 'fatal_error');
      next += 1;
      return { channel: input.channel, ts: `${1790000000 + next}.000100` };
    },
    async update(input) {
      updates.push(input);
    },
  };
  return { transport, posts, updates, control };
}

const save = (row: Partial<NewStatus>, savedAt: Date, echo = true) =>
  statusService.createNewStatus(
    { userID: anna, status: 'FROM_HOME', time: null, details: null, ...row } as NewStatus,
    { echo, now: savedAt }
  );
const echoOf = async (statusId: number) =>
  (await db.select().from(statusEchoes).where(eq(statusEchoes.statusId, statusId)))[0];
const run = (now: Date, transport: EchoTransport, force = false) =>
  runEchoJob({ now, transport, userId: anna, force });

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('Echoes on isolated PostgreSQL', () => {
  beforeAll(async () => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    vi.stubEnv('SLACK_TEAM_ID', team);
    vi.stubEnv('SLACK_CHANNEL_ID', channel);
    await db.insert(users).values({
      userId: anna,
      email: 'anna-' + anna + '@example.com',
      firstName: 'Anna',
      lastName: 'Attendee',
      profilePicture: photo,
      slackTeamId: team,
      slackUserId: 'UECHO1',
    });
  });

  beforeEach(async () => {
    await db.delete(statusEchoes).where(inArray(statusEchoes.userId, people));
    await db.delete(status).where(inArray(status.userID, people));
  });

  afterAll(async () => {
    await db.delete(statusEchoes).where(inArray(statusEchoes.userId, people));
    await db.delete(status).where(inArray(status.userID, people));
    await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
    await db.delete(users).where(inArray(users.userId, people));
    vi.unstubAllEnvs();
    await pool.end();
  });

  it('schedules a person’s own exception, and nothing when unticked or in the office', async () => {
    const saved = at('2026-10-30T10:00:00Z');
    const home = await save({ fromDate: monday, toDate: monday }, saved);
    const unticked = await save({ fromDate: '2026-11-03', toDate: '2026-11-03' }, saved, false);
    const office = await save({ status: 'IN_OFFICE', fromDate: monday, toDate: monday }, saved);
    expect(await echoOf(home.id)).toMatchObject({ postOn: monday, state: 'scheduled' });
    expect(await echoOf(unticked.id)).toBeUndefined();
    expect(await echoOf(office.id)).toBeUndefined();
  });

  it('posts nothing before 08:00 and each Echo exactly once from 08:00, even in parallel runs', async () => {
    const slack = fakeSlack();
    const home = await save(
      { fromDate: monday, toDate: monday, details: 'Plumber & co' },
      at('2026-10-30T10:00:00Z')
    );

    await run(at('2026-11-02T06:59:00Z'), slack.transport);
    expect(slack.posts).toHaveLength(0);

    const now = at('2026-11-02T07:05:00Z');
    await Promise.all([1, 2, 3].map(() => run(now, slack.transport)));
    await run(at('2026-11-02T09:00:00Z'), slack.transport);
    expect(slack.posts).toEqual([
      {
        channel,
        username: 'Anna Attendee',
        iconUrl: photo,
        text: '🏠 *Home* · Mon 2 Nov\n> Plumber &amp; co',
      },
    ]);
    expect(await echoOf(home.id)).toMatchObject({
      state: 'posted',
      channelId: channel,
      ts: '1790000001.000100',
    });
  });

  it('posts at once when saved for today after 08:00', async () => {
    const slack = fakeSlack();
    const savedAt = at('2026-11-02T12:30:00Z');
    await save(
      {
        status: 'LEAVING_EARLY',
        fromDate: monday,
        toDate: monday,
        time: copenhagenWallClock(monday, 15, 0),
      },
      savedAt
    );
    await run(savedAt, slack.transport);
    expect(slack.posts.map((post) => post.text)).toEqual([
      '🚪 *Leaving early* · Mon 2 Nov · until 15:00',
    ]);
  });

  it('never posts ahead of its day, and posts a weekend start on the Monday', async () => {
    const slack = fakeSlack();
    const vacation = await save(
      { status: 'VACATION', fromDate: '2026-11-07', toDate: '2026-11-13' },
      at('2026-11-05T10:00:00Z')
    );
    expect(await echoOf(vacation.id)).toMatchObject({ postOn: '2026-11-09' });
    await run(at('2026-11-06T09:00:00Z'), slack.transport, true);
    expect(slack.posts).toHaveLength(0);
    await run(at('2026-11-09T07:05:00Z'), slack.transport);
    expect(slack.posts.map((post) => post.text)).toEqual([
      '🌴 *Vacation* · Sat 7 Nov – Fri 13 Nov',
    ]);
  });

  it('never posts a Declaration removed before its day', async () => {
    const slack = fakeSlack();
    const home = await save(
      { fromDate: '2026-11-04', toDate: '2026-11-04' },
      at('2026-11-02T10:00:00Z')
    );
    await statusService.deleteStatusById(home.id);
    await run(at('2026-11-04T07:05:00Z'), slack.transport);
    await run(at('2026-11-05T07:05:00Z'), slack.transport);
    expect(slack.posts).toHaveLength(0);
    const [echo] = await db.select().from(statusEchoes).where(eq(statusEchoes.userId, anna));
    expect(echo).toMatchObject({ statusId: null, state: 'withdrawn' });
  });

  it('retries a failed post until its day ends, then tells only the person', async () => {
    const slack = fakeSlack();
    slack.control.failing = true;
    const home = await save({ fromDate: monday, toDate: '2026-11-04' }, at('2026-10-30T10:00:00Z'));
    const saving = statusService.getUpcomingStatusesByUserUserId(anna, at('2026-11-02T06:00:00Z'));
    expect((await saving)[0].echoNotPosted).toBe(false);

    await run(at('2026-11-02T07:05:00Z'), slack.transport);
    await run(at('2026-11-02T07:06:00Z'), slack.transport); // still backing off
    await run(at('2026-11-02T20:30:00Z'), slack.transport); // 21:30 Copenhagen
    expect(slack.posts).toHaveLength(2);
    expect(await echoOf(home.id)).toMatchObject({ state: 'scheduled', lastError: 'fatal_error' });

    slack.control.failing = false;
    await run(at('2026-11-03T07:05:00Z'), slack.transport);
    expect(slack.posts).toHaveLength(2);
    expect(await echoOf(home.id)).toMatchObject({ state: 'failed', ts: null });
    const upcoming = await statusService.getUpcomingStatusesByUserUserId(
      anna,
      at('2026-11-03T08:00:00Z')
    );
    expect(upcoming.map((plan) => [plan.id, plan.echoNotPosted])).toEqual([[home.id, true]]);
  });

  it('posts on a later retry the same day when Slack recovers', async () => {
    const slack = fakeSlack();
    slack.control.failing = true;
    await save({ fromDate: monday, toDate: monday }, at('2026-10-30T10:00:00Z'));
    await run(at('2026-11-02T07:05:00Z'), slack.transport);
    slack.control.failing = false;
    await run(at('2026-11-02T11:00:00Z'), slack.transport);
    await run(at('2026-11-02T14:00:00Z'), slack.transport);
    expect(slack.posts).toHaveLength(2);
    const [echo] = await db.select().from(statusEchoes).where(eq(statusEchoes.userId, anna));
    expect(echo).toMatchObject({ state: 'posted', attempts: 2 });
  });

  it('crosses out replaced days, gives the newer exception its own Echo, and cancels when all are replaced', async () => {
    const slack = fakeSlack();
    const vacation = await save(
      { status: 'VACATION', fromDate: monday, toDate: '2026-11-06' },
      at('2026-10-30T10:00:00Z')
    );
    await run(at('2026-11-02T07:05:00Z'), slack.transport);
    const { ts } = await echoOf(vacation.id);

    const home = await save(
      { fromDate: '2026-11-04', toDate: '2026-11-04' },
      at('2026-11-02T10:00:00Z')
    );
    await run(at('2026-11-02T10:01:00Z'), slack.transport);
    expect(slack.updates).toEqual([
      {
        channel,
        ts,
        text: '🌴 *Vacation* · Mon 2 Nov – Tue 3 Nov, ~Wed 4 Nov~, Thu 5 Nov – Fri 6 Nov',
      },
    ]);
    expect(slack.posts).toHaveLength(1);

    await run(at('2026-11-04T07:05:00Z'), slack.transport);
    expect(slack.posts.map((post) => post.text)).toEqual([
      '🌴 *Vacation* · Mon 2 Nov – Fri 6 Nov',
      '🏠 *Home* · Wed 4 Nov',
    ]);
    expect(await echoOf(home.id)).toMatchObject({ state: 'posted' });

    await save(
      { status: 'SICK', fromDate: monday, toDate: '2026-11-06' },
      at('2026-11-04T09:00:00Z')
    );
    await run(at('2026-11-04T09:01:00Z'), slack.transport);
    expect(slack.updates.slice(1)).toEqual(
      expect.arrayContaining([
        { channel, ts, text: '~🌴 Vacation · Mon 2 Nov – Fri 6 Nov~ · *Cancelled*' },
      ])
    );
    // Running again sends nothing new.
    const sent = slack.updates.length;
    await run(at('2026-11-04T12:00:00Z'), slack.transport);
    expect(slack.updates).toHaveLength(sent);
  });

  it('crosses out and cancels a posted Echo when its Declaration is removed, keeping the message', async () => {
    const slack = fakeSlack();
    const home = await save(
      { fromDate: monday, toDate: monday, details: 'Waiting for a parcel' },
      at('2026-10-30T10:00:00Z')
    );
    await run(at('2026-11-02T07:05:00Z'), slack.transport);
    const { id, ts } = await echoOf(home.id);
    await statusService.deleteStatusById(home.id);
    await run(at('2026-11-02T08:00:00Z'), slack.transport);
    expect(slack.updates).toEqual([
      { channel, ts, text: '~🏠 Home · Mon 2 Nov~ · *Cancelled*\n> ~Waiting for a parcel~' },
    ]);
    const [kept] = await db.select().from(statusEchoes).where(eq(statusEchoes.id, id));
    expect(kept).toMatchObject({ statusId: null, state: 'posted', ts });
  });

  it('ignores an Echo deleted in Slack and leaves its Declaration alone', async () => {
    const slack = fakeSlack();
    const home = await save({ fromDate: monday, toDate: '2026-11-03' }, at('2026-10-30T10:00:00Z'));
    await run(at('2026-11-02T07:05:00Z'), slack.transport);
    const { ts } = await echoOf(home.id);
    const intake = await enqueueSlackEvent({
      type: 'event_callback',
      team_id: team,
      event_id: 'EvECHO1',
      event: {
        type: 'message',
        subtype: 'message_deleted',
        channel,
        deleted_ts: ts,
        event_ts: '1790009999.000100',
        previous_message: { ts, bot_id: 'BWORK', text: 'echo' },
      },
    });
    expect(intake).toEqual({ outcome: 'ignored', reason: 'echo_deleted' });
    expect(await db.select().from(status).where(eq(status.id, home.id))).toHaveLength(1);
    expect(
      await db.select().from(slackMessages).where(eq(slackMessages.teamId, team))
    ).toHaveLength(0);

    await save(
      { fromDate: '2026-11-03', toDate: '2026-11-03', status: 'SICK' },
      at('2026-11-02T10:00:00Z')
    );
    await run(at('2026-11-02T10:01:00Z'), slack.transport);
    expect(slack.updates).toHaveLength(0);
  });
});
