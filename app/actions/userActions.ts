'use server';

import { userService } from '@/lib/services/userService';

export async function getAllUsersAction() {
  return await userService.getAllUsers();
}

export async function uploadAndProcessProfileImageAction(file: File, email: string) {
  // Convert File to ArrayBuffer, then to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return await userService.uploadAndProcessProfileImage(buffer, email);
}
