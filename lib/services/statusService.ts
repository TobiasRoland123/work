import { userService } from './userService';
import { NewStatus } from '@/db/types';
import { status } from '@/db/schema';
import { db } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { supabase } from '../supabaseClient';

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

  // This gets the latest active status by user
  async getActiveStatusByUserUserId(userID: string) {
    // Get the latest status for the user, order by createdAt desc (fallback to id if needed)
    const userStatuses = await db
      .select()
      .from(status)
      .where(eq(status.userID, userID))
      .orderBy(desc(status.createdAt))
      .limit(1);
    const latestStatus = userStatuses[0];
    if (!latestStatus) return null;

    // Check if the status was made today
    const today = new Date();
    const statusDate = latestStatus.createdAt ? new Date(latestStatus.createdAt) : null;
    const isToday =
      statusDate &&
      statusDate.getFullYear() === today.getFullYear() &&
      statusDate.getMonth() === today.getMonth() &&
      statusDate.getDate() === today.getDate();

    if (latestStatus.fromDate && latestStatus.toDate) {
      const fromDate = new Date(latestStatus.fromDate);
      const toDate = new Date(latestStatus.toDate);
      const isTodayBetween = fromDate <= today && toDate >= today;
      if (isTodayBetween) {
      }
      return isTodayBetween ? latestStatus : undefined;
    } else if (isToday) {
      return latestStatus;
    } else {
      return undefined;
    }
  },

  // POST METHODS
  async createNewStatus(newStatus: NewStatus) {
    const createdStatus = await db.insert(status).values(newStatus).returning();
    if (supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    // Re-fetch the updated user with extras
    const updatedUser = await userService.getUserById(newStatus.userID);
    if (updatedUser) {
      updatedUser.status = createdStatus[0];
      userService.updateUserInAllUsersCache(updatedUser);
    }
    return createdStatus[0];
  },

  // PUT METHOD
  async updateStatusByUserUserId(userID: string, updatedStatus: Partial<NewStatus>) {
    const updated = await db
      .update(status)
      .set(updatedStatus)
      .where(eq(status.userID, userID))
      .returning();
    if (supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    // Re-fetch the updated user with extras
    const updatedUser = await userService.getUserById(userID);
    if (updatedUser) {
      userService.updateUserInAllUsersCache(updatedUser);
    }
    return updated[0];
  },

  // DELETE METHOD
  async deleteStatusById(id: number) {
    const deleted = await db.delete(status).where(eq(status.id, id)).returning();
    if (supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    // Re-fetch the updated user with extras
    const updatedUser = await userService.getUserById(deleted[0].userID);
    if (updatedUser) {
      userService.updateUserInAllUsersCache(updatedUser);
    }
    return deleted[0];
  },

  async deleteStatusByUserUserId(userId: string) {
    const deleted = await db.delete(status).where(eq(status.userID, userId)).returning();
    if (supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    // Re-fetch the updated user with extras
    const updatedUser = await userService.getUserById(deleted[0].userID);
    if (updatedUser) {
      userService.updateUserInAllUsersCache(updatedUser);
    }
    return deleted[0];
  },
};
