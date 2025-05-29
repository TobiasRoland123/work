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
import { desc, eq } from 'drizzle-orm';

// This will be our user service, which will handle all user-related database operations.
// It will be used in the API routes to interact with the database.
export const userService = {
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
    const [latestStatus] = await db
      .select()
      .from(status)
      .where(eq(status.userID, user.userId))
      .orderBy(desc(status.time))
      .limit(1);

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

    return {
      ...user,
      status: latestStatus ?? null,
      organisationRoles: roles
        .map((r) => r.role)
        .filter((role): role is string => typeof role === 'string'),
      businessPhoneNumber,
      organisation: organisation?.organisationName ?? null,
    };
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
    const [latestStatus] = await db
      .select()
      .from(status)
      .where(eq(status.userID, user.userId))
      .orderBy(desc(status.time))
      .limit(1);

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

    return {
      ...user,
      status: latestStatus ?? null,
      organisationRoles: roles
        .map((r) => r.role)
        .filter((role): role is string => typeof role === 'string'),
      businessPhoneNumber,
      organisation: organisation?.organisationName ?? null,
    };
  },

  async getAllUsers() {
    const usersList = await db.select().from(users);

    const usersWithExtras = await Promise.all(
      usersList.map(async (user) => {
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
        const [latestStatus] = await db
          .select()
          .from(status)
          .where(eq(status.userID, user.userId))
          .orderBy(desc(status.createdAt))
          .limit(1);

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

        return {
          ...user,
          status: latestStatus ?? null,
          organisationRoles: roles
            .map((r) => r.role)
            .filter((role): role is string => typeof role === 'string'),
          businessPhoneNumber,
          organisation: organisation?.organisationName ?? null,
        };
      })
    );

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

    // Handle businessPhoneNumber separately if needed...

    return this.getUserById(userId);
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
