'use server';
import { after } from 'next/server';
import { ZodError } from 'zod';
import { NewStatus } from '@/db/types';
import { statusService } from '@/lib/services/statusService';
import { syncUserEchoes } from '@/lib/services/echoService';
import { requireUserId } from '@/lib/auth/require-user';
import { getUserRole, isAdmin } from '@/lib/auth/roles';
import { manualStatus } from '@/lib/status/manual';
import { PlanError, planSchema, planStatuses } from '@/lib/status/plan';
import { CorrectionError } from '@/lib/status/correction';

/**
 * After the response, post a due Echo and edit posted ones the change affects. Slack failures
 * never reach the person saving; the scheduled Echo job retries.
 */
function syncEchoesAfterResponse(userID: string) {
  const sync = async () => {
    try {
      await syncUserEchoes(userID);
    } catch {
      console.error('echo_sync', { outcome: 'failed' });
    }
  };
  try {
    after(sync);
  } catch {
    // Outside a request (scripts, tests) the scheduled Echo job catches up instead.
  }
}

export async function getAllStatusesAction() {
  await requireUserId();
  return statusService.getAllStatuses();
}
export async function getStatusByUserUserIdAction(userID: string) {
  await requireUserId();
  return statusService.getStatusByUserUserId(userID);
}
/** Save the signed-in person's own status; it is echoed unless `echo` is false. */
export async function createNewStatusAction(newStatus: NewStatus, options?: { echo?: boolean }) {
  const userID = await requireUserId();
  const created = await statusService.createNewStatus(
    { ...manualStatus(newStatus), userID },
    { echo: options?.echo !== false }
  );
  syncEchoesAfterResponse(userID);
  return created;
}

/**
 * Save the signed-in person's status for today or days ahead, as one Declaration per run of
 * days. Echoed unless the person unticked "Post in #wørk".
 */
export async function planStatusAction(input: unknown) {
  return savePlan(await requireUserId(), input);
}

/**
 * Let an admin save a status on behalf of another active member of the workspace. Never echoed:
 * an Echo under the colleague's name would claim they announced it.
 */
export async function planColleagueStatusAction(colleagueUserId: unknown, input: unknown) {
  const adminUserId = await requireUserId();
  if (!(await isAdmin(adminUserId)))
    return { ok: false as const, error: 'Only admins can change a colleague’s status.' };
  if (typeof colleagueUserId !== 'string' || !(await getUserRole(colleagueUserId)))
    return { ok: false as const, error: 'That person is not an active member of the workspace.' };
  return savePlan(colleagueUserId, input, adminUserId);
}

/** `adminUserId` is set when an admin saves the plan for a colleague; the change is recorded. */
async function savePlan(userID: string, input: unknown, adminUserId?: string) {
  try {
    const planned = planStatuses(input);
    if (adminUserId) await statusService.createColleagueStatuses(adminUserId, userID, planned);
    else {
      const echoed = planSchema.parse(input).echo !== false;
      for (const row of planned)
        await statusService.createNewStatus({ ...row, userID }, { echo: echoed });
    }
    // Also edits this person's posted Echoes whose days the new status replaced.
    syncEchoesAfterResponse(userID);
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

/** Correct the signed-in person's own imported status and record the import error. */
export async function correctImportedStatusAction(input: unknown) {
  const userID = await requireUserId();
  try {
    const { duplicate } = await statusService.correctImportedStatus(userID, input);
    syncEchoesAfterResponse(userID);
    return { ok: true as const, duplicate };
  } catch (error) {
    if (error instanceof CorrectionError) return { ok: false as const, error: error.message };
    if (error instanceof ZodError)
      return { ok: false as const, error: 'Check the correction and try again.' };
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, your correction was not saved.' };
  }
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
  // Removing a Declaration cancels its Echo: a posted one is crossed out, never deleted.
  const deleted = await statusService.deleteStatusById(id);
  syncEchoesAfterResponse(userID);
  return deleted;
}
export async function deleteStatusByUserUserIdAction(userID: string) {
  if (userID !== (await requireUserId())) throw new Error('Forbidden');
  return statusService.deleteStatusByUserUserId(userID);
}
