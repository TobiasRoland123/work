import { NewUser, Status, UserWithExtras } from '@/db/types';
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
import { resolvePresenceStatus } from '@/lib/status/active';
const invalidateUserCache = (userId: string) => {
  // Kept as a compatibility hook for callers; reads are intentionally uncached
  // because timed statuses can become active or expire without a write event.
  void userId;
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

    return result;
  },

  async getAllUsers(sortByStatus: boolean = true) {
    // 1. Fetch all users
    const usersList = await db
      .select()
      .from(users)
      .where(eq(users.slackDeactivated, false))
      .orderBy(users.firstName, users.lastName);

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
    const statusMap = new Map<string, Status[]>();
    for (const s of statusesList) {
      const userStatuses = statusMap.get(s.userID) ?? [];
      userStatuses.push(s);
      statusMap.set(s.userID, userStatuses);
    }

    // 7. Assemble the final result
    const usersWithExtras = usersList.map((user) => ({
      ...user,
      status: resolvePresenceStatus(statusMap.get(user.userId) ?? [], user.userId),
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

  /* * * * * * THIS METHDOD HAS BEEN COMMENTED OUT DUE TO NOT NEEDING TO CREATE LOGIN LOGIC CAUSE OF THE ENTRA IMPLEMENTATION * * * * * */
  // async loginUser(email: string, password: string) {
  //   const user = await this.getUserByEmail(email);
  //   if (!user) {
  //     throw new Error('User not found');
  //   }

  //   return user;
  // },
};
