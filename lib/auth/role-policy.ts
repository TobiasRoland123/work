export const APP_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return APP_ROLES.some((role) => role === value);
}
