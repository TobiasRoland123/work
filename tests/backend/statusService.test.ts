import { db } from '@/db';
import { users, status } from '@/db/schema';
import { NewStatus, NewUser } from '@/db/types';
import { statusService } from '@/lib/services/statusService';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
});

describe('StatusService Tests', () => {
  const testUser: NewUser = {
    id: 999999999,
    firstName: 'Test',
    lastName: 'User',
    email: 'testuser@example.com',
    systemRole: 'USER',
  };

  const testStatus: NewStatus = {
    userID: testUser.id!,
    status: 'FROM_HOME',
    details: 'Test status details',
    time: new Date().toISOString(),
    fromDate: new Date().toISOString().split('T')[0], // '2023-05-15' format
    toDate: '2025-05-15', // Proper ISO date format (YYYY-MM-DD)
  };

  beforeAll(async () => {
    await db.delete(users).where(eq(users.email, testUser.email));
    await db.delete(status).where(eq(status.userID, testUser.id!));

    await db.insert(users).values(testUser);
    await db.insert(status).values(testStatus);
  });

  afterAll(async () => {
    await db.delete(status).where(eq(status.userID, testUser.id!));
    await db.delete(users).where(eq(users.email, testUser.email));
    await pool.end();
  });

  test('getAllStatuses should return all statuses', async () => {
    const allStatuses = await statusService.getAllStatuses();
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

    const createdStatus = await statusService.createNewStatus(newStatus);
    expect(createdStatus).toBeDefined();
    expect(createdStatus.details).toBe(newStatus.details);
    expect(createdStatus.status).toBe(newStatus.status);
  });

  test('updateStatus should update an existing status', async () => {
    const updatedStatus: Partial<NewStatus> = {
      userID: testUser.id!,
      status: 'IN_OFFICE',
      details: 'Updated status details',
      fromDate: new Date().toISOString().split('T')[0], // '2023-05-15' format
      toDate: '2025-05-15', // Proper ISO date format (YYYY-MM-DD)
    };

    const updatedStatusResponse = await statusService.updateStatusByUserId(
      testUser.id!,
      updatedStatus
    );
    expect(updatedStatusResponse).toBeDefined();
    expect(updatedStatusResponse.details).toBe(updatedStatus.details);
    expect(updatedStatusResponse.status).toBe(updatedStatus.status);
  });
});
