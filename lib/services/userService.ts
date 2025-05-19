import { NewUser } from '@/db/types';
import { db } from '@/db';
import {
  users,
  status,
  users_organisation_roles,
  organisation_roles,
  users_business_phone_numbers,
  business_phone_numbers,
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
    };
  },

  async getUserById(id: string) {
    const userArr = await db.select().from(users).where(eq(users.userId, id)).limit(1);
    const user = userArr[0];
    if (!user) return null;

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
    };
  },

  async getAllUsers() {
    const usersList = await db.select().from(users);

    const usersWithExtras = await Promise.all(
      usersList.map(async (user) => {
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
