import { NewUser, UserWithExtras } from '@/db/types';
import { db } from '@/db';
import {
  users,
  status,
  users_organisation_roles,
  organisation_roles,
  users_business_phone_numbers,
  business_phone_numbers,
  organisations,
} from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { statusService } from './statusService';
import {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { log } from 'console';

const s3 = new S3Client({
  region: 'eu-central',
  endpoint: process.env.HETZNER_BUCKET_URL!,
  credentials: {
    accessKeyId: process.env.HETZNER_BUCKET_ACCESS_KEY!,
    secretAccessKey: process.env.HETZNER_BUCKET_SECRET_KEY!,
  },
});

const userCache = new Map();

const invalidateUserCache = (userId: string) => {
  userCache.delete(userId);
};

export const userService = {
  // Cache invalidation function
  invalidateUserCache,
  // GET METHODS
  async getUserByEmail(email: string) {
    const userArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userArr[0];
    if (!user) return null;

    // Fetch organisation roles for this user
    let organisation = null;
    if (user.organisationId !== null && user.organisationId !== undefined) {
      [organisation] = await db
        .select({ id: organisations.id, organisationName: organisations.organisationName })
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);
    }

    // Fetch latest status row for this user
    const latestStatus = await statusService.getActiveStatusByUserUserId(user.userId);

    // Fetch all organisation roles for this user
    const roles = await db
      .select({ role: organisation_roles.role_name })
      .from(users_organisation_roles)
      .leftJoin(
        organisation_roles,
        eq(users_organisation_roles.organisationRoleId, organisation_roles.id)
      )
      .where(eq(users_organisation_roles.userId, user.userId));

    // Fetch business phone numbers for this user
    const businessPhones = await db
      .select({ businessPhoneNumber: business_phone_numbers.businessPhoneNumber })
      .from(users_business_phone_numbers)
      .leftJoin(
        business_phone_numbers,
        eq(users_business_phone_numbers.businessPhoneNumberId, business_phone_numbers.id)
      )
      .where(eq(users_business_phone_numbers.userId, user.userId));

    const businessPhoneNumber = businessPhones[0]?.businessPhoneNumber ?? null;

    const result = {
      ...user,
      status: latestStatus ?? null,
      organisationRoles: roles
        .map((r) => r.role)
        .filter((role): role is string => typeof role === 'string'),
      businessPhoneNumber,
      organisation: organisation?.organisationName ?? null,
    };
    return result;
  },

  async getUserById(id: string) {
    if (userCache.has(id)) {
      return userCache.get(id);
    }

    const userArr = await db.select().from(users).where(eq(users.userId, id)).limit(1);
    const user = userArr[0];
    if (!user) return null;

    // Fetch organisation roles for this user
    let organisation = null;
    if (user.organisationId !== null && user.organisationId !== undefined) {
      [organisation] = await db
        .select({ id: organisations.id, organisationName: organisations.organisationName })
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);
    }

    // Fetch latest status row for this user
    const latestStatus = await statusService.getActiveStatusByUserUserId(user.userId);

    // Fetch all organisation roles for this user
    const roles = await db
      .select({ role: organisation_roles.role_name })
      .from(users_organisation_roles)
      .leftJoin(
        organisation_roles,
        eq(users_organisation_roles.organisationRoleId, organisation_roles.id)
      )
      .where(eq(users_organisation_roles.userId, user.userId));

    // Fetch business phone numbers for this user
    const businessPhones = await db
      .select({ businessPhoneNumber: business_phone_numbers.businessPhoneNumber })
      .from(users_business_phone_numbers)
      .leftJoin(
        business_phone_numbers,
        eq(users_business_phone_numbers.businessPhoneNumberId, business_phone_numbers.id)
      )
      .where(eq(users_business_phone_numbers.userId, user.userId));

    const businessPhoneNumber = businessPhones[0]?.businessPhoneNumber ?? null;

    const result = {
      ...user,
      status: latestStatus ?? null,
      organisationRoles: roles
        .map((r) => r.role)
        .filter((role): role is string => typeof role === 'string'),
      businessPhoneNumber,
      organisation: organisation?.organisationName ?? null,
    };

    userCache.set(result.userId, result);
    return result;
  },

  async getAllUsers(sortByStatus: boolean = true) {
    // 1. Fetch all users
    const usersList = await db.select().from(users).orderBy(users.firstName, users.lastName);

    if (usersList.length === 0) return [];

    // 2. Gather all userIds and organisationIds
    const userIds = usersList.map((u) => u.userId);
    const organisationIds = usersList
      .map((u) => u.organisationId)
      .filter((id): id is number => typeof id === 'number');

    // 3. Fetch all organisations in one query
    const organisationsList = organisationIds.length
      ? await db
          .select({ id: organisations.id, organisationName: organisations.organisationName })
          .from(organisations)
          .where(inArray(organisations.id, organisationIds))
      : [];
    const orgMap = new Map(organisationsList.map((o) => [o.id, o.organisationName]));

    // 4. Fetch all roles for all users in one query
    const rolesList = await db
      .select({
        userId: users_organisation_roles.userId,
        role: organisation_roles.role_name,
      })
      .from(users_organisation_roles)
      .leftJoin(
        organisation_roles,
        eq(users_organisation_roles.organisationRoleId, organisation_roles.id)
      )
      .where(inArray(users_organisation_roles.userId, userIds));
    const rolesMap = new Map<string, string[]>();
    for (const { userId, role } of rolesList) {
      if (!rolesMap.has(userId)) rolesMap.set(userId, []);
      if (role) rolesMap.get(userId)!.push(role);
    }

    // 5. Fetch all business phone numbers for all users in one query
    const phonesList = await db
      .select({
        userId: users_business_phone_numbers.userId,
        businessPhoneNumber: business_phone_numbers.businessPhoneNumber,
      })
      .from(users_business_phone_numbers)
      .leftJoin(
        business_phone_numbers,
        eq(users_business_phone_numbers.businessPhoneNumberId, business_phone_numbers.id)
      )
      .where(inArray(users_business_phone_numbers.userId, userIds));
    const phoneMap = new Map<string, string>();
    for (const { userId, businessPhoneNumber } of phonesList) {
      if (businessPhoneNumber && !phoneMap.has(userId)) {
        phoneMap.set(userId, businessPhoneNumber);
      }
    }

    // 6. Fetch all statuses for all users in one query
    const statusesList = await db.select().from(status).where(inArray(status.userID, userIds));
    // Pick the latest status per user (assuming createdAt or similar field exists)

    const getActiveStatusByUserUserId = (userId: string) => {
      const usersStatuses = statusesList.filter((s) => s.userID === userId);
      log('Before usersStatuses:', usersStatuses);
      const today = new Date();
      const latestStatus = usersStatuses.map((status) => {
        // Check if the status was made today

        const statusDate = status.createdAt ? new Date(status.createdAt) : null;
        const isToday =
          statusDate &&
          statusDate.getFullYear() === today.getFullYear() &&
          statusDate.getMonth() === today.getMonth() &&
          statusDate.getDate() === today.getDate();

        if (status.fromDate && status.toDate) {
          const fromDate = new Date(status.fromDate);
          const toDate = new Date(status.toDate);
          const isTodayBetween = fromDate <= today && toDate >= today;
          if (isTodayBetween) {
          }
          return isTodayBetween ? status : undefined;
        } else if (isToday) {
          return status;
        } else {
          return undefined;
        }
      });
      if (!latestStatus) return null;
      log('After latestStatus:', latestStatus);
      // If there are multiple statuses, return the newest one based on createdAt
      const filteredStatuses = latestStatus.filter((s) => s !== undefined);
      if (filteredStatuses.length === 0) return null;
      if (filteredStatuses.length === 1) return filteredStatuses[0];
      // Sort by createdAt descending and return the first one
      return filteredStatuses.sort((a, b) => {
        const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })[0];
    };

    // 7. Assemble the final result
    const usersWithExtras = usersList.map((user) => ({
      ...user,
      status: getActiveStatusByUserUserId(user.userId) ?? null,
      organisationRoles: rolesMap.get(user.userId) ?? [],
      businessPhoneNumber: phoneMap.get(user.userId) ?? null,
      organisation: user.organisationId ? (orgMap.get(user.organisationId) ?? null) : null,
    }));

    if (sortByStatus) {
      usersWithExtras.sort((a, b) => {
        if (a.status && !b.status) return -1;
        if (!a.status && b.status) return 1;
        return 0;
      });
    }

    return usersWithExtras;
  },

  // POST METHODS
  // Create user method also goes here
  async createUser(user: NewUser) {
    const existingUser = await this.getUserByEmail(user.email);
    if (existingUser) {
      throw new Error('User already exists');
    }
    const createdUser = await db.insert(users).values(user).returning();
    return createdUser[0];
  },

  async updateUser(userId: string, updateData: Partial<UserWithExtras>) {
    // Only include fields that are actual columns in the users table
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'mobilePhone',
      'userId' /* add more if needed */,
    ];
    const mainUserFields: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updateData) {
        mainUserFields[key] = updateData[key as keyof UserWithExtras];
      }
    }

    // Update main user fields
    if (Object.keys(mainUserFields).length > 0) {
      await db.update(users).set(mainUserFields).where(eq(users.userId, userId));
    }

    // Handle organisationRoles separately
    if (updateData.organisationRoles && Array.isArray(updateData.organisationRoles)) {
      await db.delete(users_organisation_roles).where(eq(users_organisation_roles.userId, userId));
      for (const roleName of updateData.organisationRoles) {
        const [role] = await db
          .select()
          .from(organisation_roles)
          .where(eq(organisation_roles.role_name, roleName))
          .limit(1);
        if (role) {
          await db.insert(users_organisation_roles).values({
            userId,
            organisationRoleId: role.id,
          });
        }
      }
    }

    // Invalidate cache for this user
    invalidateUserCache(userId);

    return this.getUserById(userId);
  },

  async deleteUser(userId: string) {
    // Delete related organisation roles
    await db.delete(users_organisation_roles).where(eq(users_organisation_roles.userId, userId));
    // Delete related business phone numbers
    await db
      .delete(users_business_phone_numbers)
      .where(eq(users_business_phone_numbers.userId, userId));
    // Delete related statuses
    await db.delete(status).where(eq(status.userID, userId));
    // Finally, delete the user
    await db.delete(users).where(eq(users.userId, userId));
    return { userId, deleted: true };
  },

  async uploadAndProcessProfileImage(fileBuffer: Buffer, email: string) {
    // Process image: resize and convert to webp
    const processedBuffer = await sharp(fileBuffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `profile-images/${email}-updatedbyuser-${Date.now()}`;
    let oldImageKey: string | null = null;
    try {
      // Find the current image key for this user
      const listResult = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.HETZNER_BUCKET_NAME!,
          Prefix: 'profile-images/',
        })
      );
      if (Array.isArray(listResult.Contents)) {
        // Get the user from DB to find the current profilePicture URL
        const user = await this.getUserByEmail(email);
        if (user && user.profilePicture) {
          // Extract the key from the URL
          const urlParts = user.profilePicture.split('/');
          const currentKey = urlParts.slice(-2).join('/'); // profile-images/filename
          // Check if this key exists in S3 and is an updatedbyuser image

          const found = listResult.Contents.find(
            (obj: { Key?: string }) =>
              obj.Key === currentKey &&
              obj.Key?.includes(email) &&
              obj.Key?.includes('updatedbyuser')
          );

          if (found && found.Key) {
            oldImageKey = found.Key;
          }
        }
      }

      // Upload the new image
      const result = await s3.send(
        new PutObjectCommand({
          Bucket: process.env.HETZNER_BUCKET_NAME!,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/webp',
          ACL: 'public-read',
        })
      );
      if (result.$metadata.httpStatusCode !== 200) {
        throw new Error('Failed to upload profile image to S3');
      }

      const url = `${process.env.HETZNER_BUCKET_URL!.replace(/\/$/, '')}/${process.env.HETZNER_BUCKET_NAME}/${key}`;
      // Update the user's profileImage field in the database
      const user = await db
        .update(users)
        .set({ profilePicture: url })
        .where(eq(users.email, email))
        .returning();

      // Invalidate the cache for this user
      invalidateUserCache(user[0].userId);

      // Now fetch the updated user
      const updatedUser = await userService.getUserById(user[0].userId);

      // Delete the old image from S3 if it exists and is not the same as the new one
      if (oldImageKey && oldImageKey !== key) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: process.env.HETZNER_BUCKET_NAME!,
            Delete: { Objects: [{ Key: oldImageKey }] },
          })
        );
      }

      return updatedUser;
    } catch (err) {
      throw new Error('Failed to upload profile image to S3', { cause: err });
    }
  },

  /* * * * * * THIS METHDOD HAS BEEN COMMENTED OUT DUE TO NOT NEEDING TO CREATE LOGIN LOGIC CAUSE OF THE ENTRA IMPLEMENTATION * * * * * */
  // async loginUser(email: string, password: string) {
  //   const user = await this.getUserByEmail(email);
  //   if (!user) {
  //     throw new Error('User not found');
  //   }

  //   return user;
  // },

  // PUT METHODS
  // Can be added when the profile picture feature is implemented
  // async changeProfilePicture(userId: number, newProfilePicture: string) {
  //   const user = await db
  //     .update(users)
  //     .set({ profilePicture: newProfilePicture })
  //     .where(eq(users.id, userId));
  //   return user;
  // },
};
