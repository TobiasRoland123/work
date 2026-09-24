'use server';
import { ZodError } from 'zod';
import { NewStatus } from '@/db/types';
import { statusService } from '@/lib/services/statusService';
import { requireUserId } from '@/lib/auth/require-user';
import { manualStatus } from '@/lib/status/manual';
import { PlanError, planStatuses } from '@/lib/status/plan';

export async function getAllStatusesAction() {
  await requireUserId();
  return statusService.getAllStatuses();
}
export async function getStatusByUserUserIdAction(userID: string) {
  await requireUserId();
  return statusService.getStatusByUserUserId(userID);
}
export async function createNewStatusAction(newStatus: NewStatus) {
  const userID = await requireUserId();
  return statusService.createNewStatus({ ...manualStatus(newStatus), userID });
}

/** Save a status for today or days ahead, as one Declaration per run of days. */
export async function planStatusAction(input: unknown) {
  const userID = await requireUserId();
  try {
    const planned = planStatuses(input);
    for (const row of planned) await statusService.createNewStatus({ ...row, userID });
    return { ok: true as const, count: planned.length };
  } catch (error) {
    if (error instanceof PlanError) return { ok: false as const, error: error.message };
    if (error instanceof ZodError)
      return { ok: false as const, error: 'Check the form and try again.' };
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, your status was not saved.' };
  }
}

export async function getMyUpcomingStatusesAction() {
  const userID = await requireUserId();
  return statusService.getUpcomingStatusesByUserUserId(userID);
}
export async function updateStatusByUserUserIdAction(
  userID: string,
  updatedStatus: Partial<NewStatus>
) {
  if (userID !== (await requireUserId())) throw new Error('Forbidden');
  // A correction is a new announcement, preserving the original history/source.
  return statusService.createNewStatus({ ...manualStatus(updatedStatus), userID });
}
export async function deleteStatusByIdAction(id: number) {
  const userID = await requireUserId();
  const own = await statusService.getStatusByUserUserId(userID);
  if (!own.some((row) => row.id === id)) throw new Error('Forbidden');
  return statusService.deleteStatusById(id);
}
export async function deleteStatusByUserUserIdAction(userID: string) {
  if (userID !== (await requireUserId())) throw new Error('Forbidden');
  return statusService.deleteStatusByUserUserId(userID);
}
