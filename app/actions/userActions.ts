'use server';
import { userService } from '@/lib/services/userService';
import { requireUserId } from '@/lib/auth/require-user';
export async function getAllUsersAction() {
  await requireUserId();
  return userService.getAllUsers();
}
