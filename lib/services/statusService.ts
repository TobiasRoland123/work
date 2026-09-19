import { NewStatus } from '@/db/types';
import { status } from '@/db/schema';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { supabase } from '../supabaseClient';
import { resolvePresenceStatus } from '@/lib/status/active';

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
    const userStatuses = await db.select().from(status).where(eq(status.userID, userID));
    return resolvePresenceStatus(userStatuses, userID);
  },

  // POST METHODS
  async createNewStatus(newStatus: NewStatus) {
    const createdStatus = await db
      .insert(status)
      .values({ ...newStatus, announcedAt: new Date() })
      .returning();
    if (supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    // Re-fetch the updated user with extras
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
    return deleted[0];
  },
};
