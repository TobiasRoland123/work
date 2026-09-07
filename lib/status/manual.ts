import { z } from 'zod';
import { userStatus } from '@/db/schema';

const schema = z.object({
  status: z.enum(userStatus.enumValues),
  details: z.string().max(2000).nullable().optional(),
  time: z.coerce.date().nullable().optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export function manualStatus(value: unknown) {
  const parsed = schema.parse(value);
  if (parsed.fromDate && parsed.toDate && parsed.fromDate > parsed.toDate)
    throw new Error('Invalid date range');
  // Strip IDs, source attribution, imported intervals and timestamps supplied by clients.
  return parsed;
}
