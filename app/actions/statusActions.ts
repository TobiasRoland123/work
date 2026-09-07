'use server';
import { NewStatus } from '@/db/types';
import { statusService } from '@/lib/services/statusService';
import { requireUserId } from '@/lib/auth/require-user';
import { manualStatus } from '@/lib/status/manual';

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
