import { db } from '@/db';
import { users, status } from '@/db/schema';
import { NewStatus, NewUser } from '@/db/types';
import { statusService } from '@/lib/services/statusService';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { addDays, format } from 'date-fns';

const fromDate = new Date().toLocaleDateString();
const toDate = addDays(new Date(), 7).toLocaleDateString();

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
    userId: 'b0bgfdda-976d-4962-8942-4fef721cddf9',
    firstName: 'Test',
    lastName: 'User',
    email: 'testuserBE@example.com',
    systemRole: 'USER',
  };

  const testStatus: NewStatus = {
    userID: testUser.userId!,
    status: 'FROM_HOME',
    details: 'Test status details',
    time: new Date(Date.now()),
    fromDate: format(fromDate, 'yyyy-MM-dd'),
    toDate: format(toDate, 'yyyy-MM-dd'),
  };

  beforeAll(async () => {
    await db.delete(users).where(eq(users.userId, testUser.userId));
    await db.delete(status).where(eq(status.userID, testUser.userId!));
    await db.insert(users).values(testUser);
    await db.insert(status).values(testStatus);
  });

  afterAll(async () => {
    await db.delete(status).where(eq(status.userID, testUser.userId!));
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
      userID: testUser.userId!,
      status: 'FROM_HOME',
      details: 'Test status details',
      time: new Date(Date.now()),
      fromDate: fromDate,
      toDate: toDate,
    };

    const createdStatus = await statusService.createNewStatus(newStatus);
    expect(createdStatus).toBeDefined();
    expect(createdStatus.details).toBe(newStatus.details);
    expect(createdStatus.status).toBe(newStatus.status);
  });

  test('updateStatus should update an existing status', async () => {
    const updatedStatus: Partial<NewStatus> = {
      userID: testUser.userId!,
      status: 'IN_OFFICE',
      details: 'Updated status details',
      fromDate: fromDate,
      toDate: toDate,
    };

    const updatedStatusResponse = await statusService.updateStatusByUserUserId(
      testUser.userId!,
      updatedStatus
    );
    expect(updatedStatusResponse).toBeDefined();
    expect(updatedStatusResponse.details).toBe(updatedStatus.details);
    expect(updatedStatusResponse.status).toBe(updatedStatus.status);
  });
});
