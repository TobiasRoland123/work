import { NewStatus } from '@/db/types';
import { status } from '@/db/schema';
import { db } from '@/db';

export const statusService = {
  // GET METHODS
  async getAllStatuses() {
    const allStatuses = await db.select().from(status);
    return allStatuses;
  },

  // POST METHODS
  async createNewStatus(newStatus: NewStatus) {
    const createdStatus = await db.insert(status).values(newStatus).returning();
    return createdStatus[0];
  },
};
