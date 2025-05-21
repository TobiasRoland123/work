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
  const testUser: NewUser = {
    userId: 'b0bgfdda-976d-4962-8952-4fef721cddf9',
    firstName: 'Test',
    lastName: 'User',
    email: 'testuuser@example.com',
    systemRole: 'USER',
  };

  beforeAll(async () => {
    // Clear any existing test users
    await db.delete(users).where(eq(users.email, testUser.email));
    // Insert Test User directly
    await db.insert(users).values(testUser).returning();
  });

  afterAll(async () => {
    // Clean up the test user
    await db.delete(users).where(eq(users.email, testUser.email));
    await pool.end();
  });

  describe('getUserByEmail', () => {
    test('should retrieve user by email', async () => {
      const user = await userService.getUserByEmail(testUser.email);

      if (!user) {
        throw new Error('Test user not found in usersList');
      }

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
      expect(user.userId).toBe(testUser.userId);
    });

    test('should return null for non-existent email', async () => {
      const user = await userService.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('getUserById', () => {
    test('should retrieve user by id', async () => {
      const user = await userService.getUserById(testUser.userId);

      if (!user) {
        throw new Error('Test user not found in usersList');
      }

      expect(user).toBeDefined();
      expect(user.userId).toBe(testUser.userId);
      expect(user.email).toBe(testUser.email);
    });

    test('should return null for non-existent id', async () => {
      const user = await userService.getUserById('9999999');
      expect(user).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    test('should retrieve all users with status, organisationRoles, and businessPhoneNumber', async () => {
      const usersList = await userService.getAllUsers();

      expect(usersList).toBeDefined();
      expect(Array.isArray(usersList)).toBe(true);
      expect(usersList.length).toBeGreaterThan(0);

      // Find our test user in the results
      const foundTestUser = usersList.find((u) => u.userId === testUser.userId);
      expect(foundTestUser).toBeDefined();

      if (!foundTestUser) {
        throw new Error('Test user not found in usersList');
      }

      // Check status object (should be null or an object with expected keys)
      expect(foundTestUser).toHaveProperty('status');
      if (foundTestUser.status) {
        expect(foundTestUser.status).toHaveProperty('id');
        expect(foundTestUser.status).toHaveProperty('userID');
        expect(foundTestUser.status).toHaveProperty('status');
        expect(foundTestUser.status).toHaveProperty('details');
        expect(foundTestUser.status).toHaveProperty('time');
        expect(foundTestUser.status).toHaveProperty('fromDate');
        expect(foundTestUser.status).toHaveProperty('toDate');
      } else {
        expect(foundTestUser.status).toBeNull();
      }

      // Check organisationRoles is an array
      expect(foundTestUser).toHaveProperty('organisationRoles');
      expect(Array.isArray(foundTestUser.organisationRoles)).toBe(true);

      // Check businessPhoneNumber property exists (can be null or string)
      expect(foundTestUser).toHaveProperty('businessPhoneNumber');
      expect(
        foundTestUser.businessPhoneNumber === null ||
          typeof foundTestUser.businessPhoneNumber === 'string'
      ).toBe(true);
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
