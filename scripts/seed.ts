import { db } from '../db';
import { users } from '../db/schema';
import { User, NewUser } from '../db/types';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding database...');

  try {
    // Clear existing data
    await db.delete(users);

    // Create sample users with proper typing
    const sampleUsers: NewUser[] = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        systemRole: 'ADMIN',
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        systemRole: 'USER',
      },
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        systemRole: 'USER',
      },
      {
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@example.com',
        systemRole: 'GUEST',
      },
    ];

    // Insert users with type safety
    await db.insert(users).values(sampleUsers);

    console.log('Seeding completed successfully');

    // Verify seeded data
    const allUsers: User[] = await db.select().from(users);
    console.log(`Seeded ${allUsers.length} users`);
    console.table(allUsers);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seed();
