import { NewUser } from '@/db/types';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/db';

// This will be our user service, which will handle all user-related database operations.
// It will be used in the API routes to interact with the database.
export const userService = {
  // GET METHODS
  async getUserByEmail(email: string) {
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user[0];
  },

  async getUserById(id: number) {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user[0];
  },

  async getAllUsers() {
    const usersList = await db.select().from(users);
    return usersList;
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
