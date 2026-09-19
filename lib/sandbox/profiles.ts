import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { organisations, status, users } from '@/db/schema';
import { copenhagenDate, localInstant } from '@/lib/slack/extraction';
import { SANDBOX_TEAM_ID } from './enabled';

/**
 * Checked-in Sandbox Profiles. Each exists to make one interesting intake case cheap.
 * Avatars stay null: getSlackImageUrl only accepts Slack CDN hosts.
 */
export const SANDBOX_FIXTURES = [
  {
    userId: 'sandbox-anna',
    slackUserId: 'U_LOCAL_ANNA',
    firstName: 'Anna',
    lastName: 'Attendee',
    email: 'anna@sandbox.local',
    slackDeactivated: false,
    note: 'Plain attendee who writes in English.',
  },
  {
    userId: 'sandbox-mads',
    slackUserId: 'U_LOCAL_MADS',
    firstName: 'Mads',
    lastName: 'Madsen',
    email: 'mads@sandbox.local',
    slackDeactivated: false,
    note: 'Writes Declarations in Danish.',
  },
  {
    userId: 'sandbox-freja',
    slackUserId: 'U_LOCAL_FREJA',
    firstName: 'Freja',
    lastName: 'Hjemme',
    email: 'freja@sandbox.local',
    slackDeactivated: false,
    note: 'Seeded with a FROM_HOME Declaration for today.',
    seededStatus: 'FROM_HOME' as const,
  },
  {
    userId: 'sandbox-dag',
    slackUserId: 'U_LOCAL_DAG',
    firstName: 'Dag',
    lastName: 'Deaktiveret',
    email: 'dag@sandbox.local',
    slackDeactivated: true,
    note: 'Deactivated in Slack: messages hit unmapped_user and sign-in is refused.',
  },
];

/** A Slack user id with no Sandbox Profile at all, to reach the unmapped_user branch. */
export const UNMAPPED_AUTHOR = {
  slackUserId: 'U_LOCAL_UNMAPPED',
  label: 'Unmapped Slack user (no profile)',
};

/** Ready-made Sandbox Messages. The last one uses Slack wire format, which nothing unescapes. */
export const SAMPLE_MESSAGES = [
  { label: 'Shorthand', text: 'wfh' },
  { label: 'Late arrival', text: 'in later, going to dentist' },
  { label: 'Danish, tomorrow', text: 'hjemmefra i morgen' },
  { label: 'Approximate', text: 'In around 10 today' },
  { label: 'Multi-day', text: 'Vacation Monday to Wednesday next week' },
  { label: 'Not attendance', text: 'Anyone up for lunch at the new place?' },
  {
    label: 'Slack wire format',
    text: 'WFH today &amp; tomorrow, see <https://example.com/cal|calendar> cc <@U_LOCAL_ANNA>',
  },
];

export async function seedSandboxProfiles() {
  let [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.organisationName, 'Local Sandbox'))
    .limit(1);
  if (!organisation)
    [organisation] = await db
      .insert(organisations)
      .values({ organisationName: 'Local Sandbox' })
      .returning();
  const seededStatuses: string[] = [];
  for (const fixture of SANDBOX_FIXTURES) {
    const { note, seededStatus, ...profile } = fixture;
    void note;
    await db
      .insert(users)
      .values({ ...profile, slackTeamId: SANDBOX_TEAM_ID, organisationId: organisation.id })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          slackUserId: profile.slackUserId,
          slackTeamId: SANDBOX_TEAM_ID,
          slackDeactivated: profile.slackDeactivated,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      });
    if (!seededStatus) continue;
    const [existing] = await db
      .select({ id: status.id })
      .from(status)
      .where(and(eq(status.userID, profile.userId), isNull(status.sourceMessageKey)))
      .limit(1);
    if (existing) continue;
    const day = copenhagenDate(new Date());
    const nextDay = new Date(new Date(`${day}T12:00:00Z`).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    await db.insert(status).values({
      userID: profile.userId,
      status: seededStatus,
      fromDate: day,
      toDate: day,
      startsAt: localInstant(day, '00:00'),
      endsAt: localInstant(nextDay, '00:00'),
      announcedAt: new Date(),
    });
    seededStatuses.push(profile.userId);
  }
  return { profiles: SANDBOX_FIXTURES.length, seededStatuses };
}
