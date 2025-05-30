'use server';

import { NewStatus } from '@/db/types';
import { statusService } from '@/lib/services/statusService';

export async function getAllStatusesAction() {
  try {
    return await statusService.getAllStatuses();
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}

export async function getStatusByUserUserIdAction(userID: string) {
  try {
    return await statusService.getStatusByUserUserId(userID);
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}

export async function createNewStatusAction(newStatus: NewStatus) {
  try {
    return await statusService.createNewStatus(newStatus);
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}

export async function updateStatusByUserUserIdAction(
  userID: string,
  updatedStatus: Partial<NewStatus>
) {
  try {
    return await statusService.updateStatusByUserUserId(userID, updatedStatus);
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}

export async function deleteStatusByIdAction(id: number) {
  try {
    return await statusService.deleteStatusById(id);
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}

export async function deleteStatusByUserUserIdAction(userID: string) {
  try {
    return await statusService.deleteStatusByUserUserId(userID);
  } catch (error) {
    // Handle error as needed, e.g., log or rethrow
    throw error;
  }
}
