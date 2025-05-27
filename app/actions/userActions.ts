'use server';

import { userService } from '@/lib/services/userService';

export async function getAllUsersAction() {
  return await userService.getAllUsers();
}
