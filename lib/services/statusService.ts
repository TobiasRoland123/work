import { NewStatus } from '@/db/types';
import { slackMessages, status, statusCorrections } from '@/db/schema';
import { db } from '@/db';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { supabase } from '../supabaseClient';
import { resolvePresenceStatus } from '@/lib/status/active';
import { upcomingStatuses } from '@/lib/status/plan';
import {
  CORRECTION_UNAVAILABLE,
  CorrectionError,
  correctionSchema,
  importedRevision,
  isSuperseded,
  planCorrection,
} from '@/lib/status/correction';
import { blockCorrectedShorthand } from '@/lib/slack/learned-shorthand';
import { pushConfigured } from '@/lib/notifications/push';
import { notificationService } from '@/lib/services/notificationService';

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

  // Declarations that still cover today or a later day
  async getUpcomingStatusesByUserUserId(userID: string) {
    return upcomingStatuses(await this.getStatusByUserUserId(userID));
  },

  // POST METHODS
  async createNewStatus(newStatus: NewStatus) {
    const before = pushConfigured() ? await this.getStatusByUserUserId(newStatus.userID) : [];
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
    if (pushConfigured()) await notificationService.notifyArrival(newStatus.userID, before);
    // Re-fetch the updated user with extras
    return createdStatus[0];
  },

  /**
   * Replace the person's own imported Declaration with a user Declaration for the chosen
   * days, and record the import error once per distinct correction.
   */
  async correctImportedStatus(userID: string, input: unknown, now: Date = new Date()) {
    const parsed = correctionSchema.parse(input);
    const result = await db.transaction(async (tx) => {
      // The row lock serializes repeated submissions for the same imported Declaration.
      const [original] = await tx
        .select()
        .from(status)
        .where(
          and(
            eq(status.id, parsed.statusId),
            eq(status.userID, userID),
            isNotNull(status.sourceMessageKey)
          )
        )
        .for('update');
      if (!original) throw new CorrectionError(CORRECTION_UNAVAILABLE);
      const planned = planCorrection(original, parsed);
      const sourceMessageKey = original.sourceMessageKey!;
      const [message] = await tx
        .select({ revision: slackMessages.revision })
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, sourceMessageKey));
      const sourceRevision = importedRevision(original, message);
      const correction = {
        userId: userID,
        sourceMessageKey,
        sourceRevision,
        correctedStatus: parsed.status,
        fromDate: planned.fromDate!,
        toDate: planned.toDate!,
      };

      const [created] = await tx
        .insert(statusCorrections)
        .values({
          ...correction,
          originalStatusId: original.id,
          originalStatus: original.status,
          originalDetails: original.details,
          createdAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: statusCorrections.id });
      // The message's reading was wrong, so its phrase must not be learned or keep matching.
      if (created)
        await blockCorrectedShorthand(
          tx,
          { messageKey: sourceMessageKey, revision: sourceRevision, correctionId: created.id },
          now
        );
      let recordId = created?.id;
      if (!recordId) {
        const [existing] = await tx
          .select({
            id: statusCorrections.id,
            correctionStatusId: statusCorrections.correctionStatusId,
          })
          .from(statusCorrections)
          .where(
            and(
              eq(statusCorrections.userId, userID),
              eq(statusCorrections.sourceMessageKey, sourceMessageKey),
              sourceRevision === null
                ? isNull(statusCorrections.sourceRevision)
                : eq(statusCorrections.sourceRevision, sourceRevision),
              eq(statusCorrections.correctedStatus, parsed.status),
              eq(statusCorrections.fromDate, correction.fromDate),
              eq(statusCorrections.toDate, correction.toDate)
            )
          )
          .for('update');
        if (!existing) throw new Error('Correction conflict without a stored correction');
        recordId = existing.id;
        const own = await tx.select().from(status).where(eq(status.userID, userID));
        const applied = own.find((row) => row.id === existing.correctionStatusId);
        // A repeat of a correction that still applies changes nothing. If the person removed
        // it or announced something newer since, saving it again re-applies the correction.
        if (applied && !isSuperseded(applied, own, correction.fromDate, correction.toDate))
          return { duplicate: true, changed: false };
      }

      const [declaration] = await tx
        .insert(status)
        .values({ ...planned, userID, announcedAt: now })
        .returning({ id: status.id });
      await tx
        .update(statusCorrections)
        .set({ correctionStatusId: declaration.id })
        .where(eq(statusCorrections.id, recordId));
      return { duplicate: !created, changed: true };
    });
    if (result.changed && supabase) {
      await supabase.channel('status-sync').send({
        type: 'broadcast',
        event: 'status_updated',
        payload: {},
      });
    }
    return result;
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
