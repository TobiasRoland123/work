import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, status, userStatus } from './schema';
import { Status } from '@/components/ui/Status/Status';

// Type for querying users (SELECT operations)
export type User = InferSelectModel<typeof users>;

// Add this type for the status row

// Extended user type for frontend
export type UserWithExtras = NewUser & {
  status?: Status;
  organisation?: string | null;
  organisationRoles: string[] | null;
  businessPhoneNumber?: string | null;
};

// Type for inserting new users (INSERT operations)
export type NewUser = InferInsertModel<typeof users>;

export type Status = InferSelectModel<typeof status>;

export type NewStatus = InferInsertModel<typeof status>;

export type UserStatus = (typeof userStatus.enumValues)[number];
