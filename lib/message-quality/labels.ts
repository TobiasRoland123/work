import type { UserStatus } from '@/db/types';

export const statusLabels: Record<UserStatus, string> = {
  IN_OFFICE: 'In Office',
  FROM_HOME: 'From Home',
  REMOTE: 'Remote',
  AT_CLIENT: 'At Client',
  SICK: 'Sick',
  IN_LATE: 'In Late',
  LEAVING_EARLY: 'Leaving Early',
  VACATION: 'Vacation',
  CHILD_SICK: 'Child Sick',
  ON_LEAVE: 'On Leave',
  AWAY: 'Away',
};

/** Label for an imported status, where null means a note saved without a status. */
export const importedStatusLabel = (status: UserStatus | null) =>
  status ? statusLabels[status] : 'Note only';
