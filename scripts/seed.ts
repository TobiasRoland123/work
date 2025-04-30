import { db } from '../db';
import {
  users,
  organisations,
  organisation_roles,
  users_organisation_roles,
  status,
} from '../db/schema';
import { NewUser } from '../db/types';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

async function seed() {
  console.log('Seeding database...');

  try {
    // Clear existing data (order matters due to foreign key constraints)
    await db.delete(status);
    await db.delete(users_organisation_roles);
    await db.delete(organisation_roles);
    await db.delete(users);
    await db.delete(organisations);

    // 1. Seed organisations
    console.log('Seeding organisations...');
    const orgIds = await db
      .insert(organisations)
      .values([
        { organisationName: 'Charlie Tango' },
        { organisationName: 'AKQA' },
        { organisationName: 'Dept' },
      ])
      .returning({ id: organisations.id });

    console.log(`Seeded ${orgIds.length} organisations`);

    const saltRounds = 10;
    const plainPassword = '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // 2. Create sample users with proper typing and organisation reference
    console.log('Seeding users...');
    const sampleUsers: NewUser[] = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: hashedPassword,
        systemRole: 'ADMIN',
        organisationId: orgIds[0].id,
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: hashedPassword,
        systemRole: 'USER',
        organisationId: orgIds[0].id,
      },
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        password: hashedPassword,
        systemRole: 'USER',
        organisationId: orgIds[1].id,
      },
      {
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@example.com',
        password: hashedPassword,
        systemRole: 'GUEST',
        organisationId: orgIds[2].id,
      },
    ];

    const userIds = await db.insert(users).values(sampleUsers).returning({ id: users.id });

    // 3. Seed organization roles
    console.log('Seeding organisation roles...');
    const roleIds = await db
      .insert(organisation_roles)
      .values([
        { role_name: 'Developer' },
        { role_name: 'Designer' },
        { role_name: 'Product Manager' },
        { role_name: 'Team Lead' },
      ])
      .returning({ id: organisation_roles.id });

    // 4. Seed users_organisation_roles (connections between users and roles)
    console.log('Seeding user organisation roles...');
    await db.insert(users_organisation_roles).values([
      { userId: userIds[0].id, organisationRoleId: roleIds[3].id }, // John is a Team Lead
      { userId: userIds[1].id, organisationRoleId: roleIds[2].id }, // Jane is a PM
      { userId: userIds[2].id, organisationRoleId: roleIds[0].id }, // Alice is a Developer
      { userId: userIds[3].id, organisationRoleId: roleIds[1].id }, // Bob is a Designer
      { userId: userIds[2].id, organisationRoleId: roleIds[3].id }, // Alice is also a Team Lead
    ]);

    // 5. Seed status records
    console.log('Seeding status records...');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.insert(status).values([
      {
        userID: userIds[0].id,
        status: 'IN_OFFICE',
        details: 'Working on project X',
        time: new Date().toISOString(),
      },
      {
        userID: userIds[1].id,
        status: 'FROM_HOME',
        details: 'Available on Slack',
        time: new Date().toISOString(),
      },
      {
        userID: userIds[2].id,
        status: 'AT_CLIENT',
        details: 'Client meeting',
        time: new Date().toISOString(),
        fromDate: today.toISOString(), // Convert to string
        toDate: tomorrow.toISOString(), // Convert to string
      },
      {
        userID: userIds[3].id,
        status: 'VACATION',
        details: 'Annual leave',
        time: new Date().toISOString(),
        fromDate: today.toISOString(), // Convert to string
        toDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Convert to string
      },
    ]);

    console.log('Seeding completed successfully');

    // Verify seeded data
    const allUsers = await db.select().from(users);
    console.log(`Seeded ${allUsers.length} users`);

    const allOrgs = await db.select().from(organisations);
    console.log(`Seeded ${allOrgs.length} organisations`);

    const allRoles = await db.select().from(organisation_roles);
    console.log(`Seeded ${allRoles.length} roles`);

    const allUserRoles = await db.select().from(users_organisation_roles);
    console.log(`Seeded ${allUserRoles.length} user-role assignments`);

    const allStatuses = await db.select().from(status);
    console.log(`Seeded ${allStatuses.length} status records`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seed();
