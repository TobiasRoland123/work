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

dotenv.config();

async function seed() {
  try {
    // Clear existing data (order matters due to foreign key constraints)
    await db.delete(status);
    await db.delete(users_organisation_roles);
    await db.delete(organisation_roles);
    await db.delete(users);
    await db.delete(organisations);

    // 1. Seed organisations

    const orgIds = await db
      .insert(organisations)
      .values([
        { organisationName: 'Charlie Tango' },
        { organisationName: 'AKQA' },
        { organisationName: 'Dept' },
      ])
      .returning({ id: organisations.id });

    // 2. Create sample users with proper typing and organisation reference

    const sampleUsers: NewUser[] = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',

        systemRole: 'ADMIN',
        organisationId: orgIds[0].id,
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',

        systemRole: 'USER',
        organisationId: orgIds[0].id,
      },
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',

        systemRole: 'USER',
        organisationId: orgIds[1].id,
      },
      {
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@example.com',

        systemRole: 'GUEST',
        organisationId: orgIds[2].id,
      },
    ];

    const userIds = await db.insert(users).values(sampleUsers).returning({ id: users.id });

    // 3. Seed organization roles

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

    await db.insert(users_organisation_roles).values([
      { userId: userIds[0].id, organisationRoleId: roleIds[3].id }, // John is a Team Lead
      { userId: userIds[1].id, organisationRoleId: roleIds[2].id }, // Jane is a PM
      { userId: userIds[2].id, organisationRoleId: roleIds[0].id }, // Alice is a Developer
      { userId: userIds[3].id, organisationRoleId: roleIds[1].id }, // Bob is a Designer
      { userId: userIds[2].id, organisationRoleId: roleIds[3].id }, // Alice is also a Team Lead
    ]);

    // 5. Seed status records

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
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seed();
