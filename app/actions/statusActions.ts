'use server';

import { NewStatus } from '@/db/types';
import { statusService } from '@/lib/services/statusService';

export async function getAllStatusesAction() {
  return await statusService.getAllStatuses();
}

export async function getStatusByUserUserIdAction(userID: string) {
  return await statusService.getStatusByUserUserId(userID);
}

export async function createNewStatusAction(newStatus: NewStatus) {
  return await statusService.createNewStatus(newStatus);
}

export async function updateStatusByUserUserIdAction(
  userID: string,
  updatedStatus: Partial<NewStatus>
) {
  return await statusService.updateStatusByUserUserId(userID, updatedStatus);
}

export async function deleteStatusByIdAction(id: number) {
  return await statusService.deleteStatusById(id);
}

export async function deleteStatusByUserUserIdAction(userID: string) {
  return await statusService.deleteStatusByUserUserId(userID);
}
