import { describe, expect, test, beforeAll, afterAll, vi } from 'vitest';
import { userService } from '@/lib/services/userService';
import { NewUser } from '@/db/types';
import { db } from '@/db';
import { organisation_roles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import sharp from 'sharp';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';

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

  describe('updateUser', () => {
    test('should update user fields', async () => {
      const updatedFirstName = 'UpdatedFirst';
      const updatedLastName = 'UpdatedLast';

      await userService.updateUser(testUser.userId, {
        firstName: updatedFirstName,
        lastName: updatedLastName,
      });

      const updatedUser = await userService.getUserById(testUser.userId);
      expect(updatedUser?.firstName).toBe(updatedFirstName);
      expect(updatedUser?.lastName).toBe(updatedLastName);
    });

    test('should update organisationRoles', async () => {
      const newRole = 'TEST_ROLE';

      await db.insert(organisation_roles).values({ role_name: newRole }).onConflictDoNothing?.();

      await userService.updateUser(testUser.userId, {
        organisationRoles: [newRole],
      });

      const updatedUser = await userService.getUserById(testUser.userId);
      expect(updatedUser?.organisationRoles).toContain(newRole);
    });
  });

  describe('createUser', () => {
    test('should create a new user', async () => {
      const newUser: NewUser = {
        userId: 'new-user-id',
        firstName: 'New',
        lastName: 'User',
        email: 'new-user@test.com',
        systemRole: 'USER',
      };
      const createdUser = await userService.createUser(newUser);
      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(newUser.email);
      expect(createdUser.userId).toBe(newUser.userId);
      // Clean up created user
      await db.delete(users).where(eq(users.userId, newUser.userId));
      await db.delete(users).where(eq(users.email, newUser.email));
    });
    test('should throw error when creating user with existing email', async () => {
      const existingUser: NewUser = {
        userId: 'existing-user-id',
        firstName: 'Existing',
        lastName: 'User',
        email: 'new-user@test.com',
        systemRole: 'USER',
      };
      await db.insert(users).values(existingUser).onConflictDoNothing?.();
      await expect(userService.createUser(existingUser)).rejects.toThrow('User already exists');
      // Clean up created user
      await db.delete(users).where(eq(users.userId, existingUser.userId));
      await db.delete(users).where(eq(users.email, existingUser.email));
    });
  });

  describe('updateUserProfilePicture', () => {
    test('should update user profile picture', async () => {
      // ...existing code...

      // Arrange
      const email = testUser.email;
      const fakeBuffer = Buffer.from('fake image data');
      const processedBuffer = Buffer.from('processed image data');

      // Mock sharp
      vi.spyOn(sharp.prototype, 'resize').mockReturnThis();
      vi.spyOn(sharp.prototype, 'webp').mockReturnThis();
      vi.spyOn(sharp.prototype, 'toBuffer').mockResolvedValue(processedBuffer);

      // Mock S3 list, put, and delete
      vi.spyOn(S3.prototype, 'send').mockImplementation(async (cmd) => {
        if (cmd instanceof ListObjectsV2Command) {
          return { Contents: [] };
        }
        if (cmd instanceof PutObjectCommand) {
          return { $metadata: { httpStatusCode: 200 } };
        }
        if (cmd instanceof DeleteObjectsCommand) {
          return {};
        }
        return {};
      });

      // Act
      const updatedUser = await userService.uploadAndProcessProfileImage(fakeBuffer, email);

      // Assert
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.profilePicture).toContain('profile-images/');
      expect(updatedUser?.profilePicture).toContain(email);

      // Clean up: reset mocks
      vi.restoreAllMocks();
    });
    // ...existing code...
  });
});
