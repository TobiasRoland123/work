import { NewUser } from '@/db/types';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
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
    const hashedPassword = await bcrypt.hash(user.password || '', 10);
    const newUser = {
      ...user,
      password: hashedPassword,
    };
    const createdUser = await db.insert(users).values(newUser).returning();
    return createdUser[0];
  },

  async loginUser(email: string, password: string) {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    return user;
  },

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
