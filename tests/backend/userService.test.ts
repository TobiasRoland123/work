import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { userService } from '@/lib/services/userService';
import { NewUser } from '@/db/types';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
});

describe('UserService Tests', () => {
  let testUserId: number;
  const testUser: NewUser = {
    userId: 'b0bb8dda-976d-4992-8922-4fef721c4b44',
    firstName: 'Test',
    lastName: 'User',
    email: 'testuuser@example.com',
    systemRole: 'USER',
  };

  beforeAll(async () => {
    // Clear any existing test users
    await db.delete(users).where(eq(users.email, testUser.email));
    // Insert Test User directly
    const inserted = await db.insert(users).values(testUser).returning();
    testUserId = inserted[0].id;
  });

  afterAll(async () => {
    // Clean up the test user
    await db.delete(users).where(eq(users.email, testUser.email));
    await pool.end();
  });

  describe('getUserByEmail', () => {
    test('should retrieve user by email', async () => {
      const user = await userService.getUserByEmail(testUser.email);

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
      expect(user.id).toBe(testUserId);
    });

    test('should return undefined for non-existent email', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    test('should retrieve user by id', async () => {
      const user = await userService.getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe(testUser.email);
    });

    test('should return undefined for non-existent id', async () => {
      const user = await userService.getUserById(9999999);
      expect(user).toBeUndefined();
    });
  });

  describe('getAllUsers', () => {
    test('should retrieve all users', async () => {
      const usersList = await userService.getAllUsers();

      expect(usersList).toBeDefined();
      expect(Array.isArray(usersList)).toBe(true);
      expect(usersList.length).toBeGreaterThan(0);

      // Find our test user in the results
      const foundTestUser = usersList.find((u) => u.id === testUserId);
      expect(foundTestUser).toBeDefined();
    });
  });

  // describe('loginUser', () => {
  //   test('should successfully login with valid credentials', async () => {
  //     const user = await userService.loginUser(testUser.email, testUser.password);

  //     expect(user).toBeDefined();
  //     expect(user.id).toBe(testUserId);
  //   });

  //   test('should throw error with invalid email', async () => {
  //     await expect(userService.loginUser('wrong@example.com', testUser.password)).rejects.toThrow(
  //       'User not found'
  //     );
  //   });

  //   test('should throw error with invalid password', async () => {
  //     await expect(userService.loginUser(testUser.email, 'wrongpassword')).rejects.toThrow(
  //       'Invalid credentials'
  //     );
  //   });
  // });
});
