import { NewStatus } from '@/db/types';
import { status } from '@/db/schema';
import { db } from '@/db';
import { eq } from 'drizzle-orm';

export const statusService = {
  // GET METHODS
  async getAllStatuses() {
    const allStatuses = await db.select().from(status);
    return allStatuses;
  },

  async getStatusByUserUserId(userID: string) {
    const userStatus = await db.select().from(status).where(eq(status.userID, userID));
    return userStatus;
  },

  // POST METHODS
  async createNewStatus(newStatus: NewStatus) {
    const createdStatus = await db.insert(status).values(newStatus).returning();
    return createdStatus[0];
  },

  // PUT METHOD
  async updateStatusByUserUserId(userID: string, updatedStatus: Partial<NewStatus>) {
    const updated = await db
      .update(status)
      .set(updatedStatus)
      .where(eq(status.userID, userID))
      .returning();
    return updated[0];
  },

  // DELETE METHOD
  async deleteStatusById(id: number) {
    const deleted = await db.delete(status).where(eq(status.id, id)).returning();
    return deleted[0];
  },

  async deleteStatusByUserUserId(userId: string) {
    const deleted = await db.delete(status).where(eq(status.userID, userId)).returning();
    return deleted[0];
  },
};
