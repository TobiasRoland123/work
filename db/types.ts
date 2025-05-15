import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, status } from './schema';

// Type for querying users (SELECT operations)
export type User = InferSelectModel<typeof users>;

// Type for inserting new users (INSERT operations)
export type NewUser = InferInsertModel<typeof users>;

export type Status = InferSelectModel<typeof status>;

export type NewStatus = InferInsertModel<typeof status>;
