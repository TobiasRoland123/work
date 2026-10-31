'use server';
import { requireUserId } from '@/lib/auth/require-user';
import { PinError, pinService } from '@/lib/services/pinService';

export async function pinColleagueAction(colleagueUserId: string) {
  const userId = await requireUserId();
  try {
    await pinService.pin(userId, String(colleagueUserId));
    return { ok: true as const };
  } catch (error) {
    if (error instanceof PinError) return { ok: false as const, error: error.message };
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, the colleague was not pinned.' };
  }
}

export async function unpinColleagueAction(colleagueUserId: string) {
  const userId = await requireUserId();
  try {
    await pinService.unpin(userId, String(colleagueUserId));
    return { ok: true as const };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, the colleague was not unpinned.' };
  }
}
