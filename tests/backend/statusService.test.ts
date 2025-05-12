import { db } from '@/db';
import { users, status } from '@/db/schema';
import { NewStatus, NewUser } from '@/db/types';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
});

describe('StatusService Tests', () => {
  const testUser: NewUser = {
    id: 999999999,
    firstName: 'Test',
    lastName: 'User',
    email: 'testuser@example.com',
    password: 'password123',
    systemRole: 'USER',
  };

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
    await db.insert(users).values(testUser);
  });

  afterAll(async () => {
    await db.delete(status).where(eq(status.userID, testUser.id!));
    await db.delete(users).where(eq(users.email, testUser.email));
    await pool.end();
  });

  test('getAllStatuses should return all statuses', async () => {
    const allStatuses = await db.select().from(status);
    expect(allStatuses).toBeDefined();
    expect(allStatuses.length).toBeGreaterThan(0);
  });

  test('createNewStatus should create a new status', async () => {
    const newStatus: NewStatus = {
      userID: testUser.id!,
      status: 'FROM_HOME',
      details: 'Test status details',
      time: new Date().toISOString(),
      fromDate: new Date().toISOString().split('T')[0], // '2023-05-15' format
      toDate: '2025-05-15', // Proper ISO date format (YYYY-MM-DD)
    };

    const createdStatus = await db.insert(status).values(newStatus).returning();
    expect(createdStatus[0]).toBeDefined();
    expect(createdStatus[0].details).toBe(newStatus.details);
    expect(createdStatus[0].status).toBe(newStatus.status);
  });
});
