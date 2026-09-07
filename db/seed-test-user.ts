import { db } from '.';
import { users, organisations } from './schema';
import { eq } from 'drizzle-orm';

const seedTestUser = async () => {
  try {
    if (!process.env.SLACK_TEAM_ID)
      throw new Error('Set SLACK_TEAM_ID for the local test workspace');
    // Ensure organisation exists
    let [org] = await db.select().from(organisations).where(eq(organisations.id, 1));
    if (!org) {
      const result = await db
        .insert(organisations)
        .values({ organisationName: 'Test Organisation' })
        .returning();
      org = result[0];
    }

    // Check if the user already exists
    const existing = await db.select().from(users).where(eq(users.userId, 'test-user-uuid'));
    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          slackUserId: 'UTESTE2E',
          slackTeamId: process.env.SLACK_TEAM_ID,
          slackDeactivated: false,
        })
        .where(eq(users.userId, 'test-user-uuid'));
      return;
    }
    // Insert if not exists
    await db.insert(users).values({
      userId: 'test-user-uuid',
      slackUserId: 'UTESTE2E',
      slackTeamId: process.env.SLACK_TEAM_ID,
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      organisationId: org.id,
      mobilePhone: '1234567890',
    });
  } catch (error) {
    console.error('Error seeding test user:', error);
    throw error;
  }
};

seedTestUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  });
