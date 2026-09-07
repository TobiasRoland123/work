'use server';
import { userService } from '@/lib/services/userService';
import { requireUserId } from '@/lib/auth/require-user';
export async function getAllUsersAction() {
  await requireUserId();
  return userService.getAllUsers();
}

export async function uploadAndProcessProfileImageAction(file: File, email: string) {
  const user = await userService.getUserById(await requireUserId());
  if (!user || user.email !== email) throw new Error('Forbidden');
  if (file.size > 3000000) throw new Error('Image too large');
  return userService.uploadAndProcessProfileImage(Buffer.from(await file.arrayBuffer()), email);
}
