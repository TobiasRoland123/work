import { z } from 'zod';

const manifestSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    revisions: z.array(
      z
        .object({
          messageKey: z.string().min(1),
          revision: z.string().regex(/^\d+\.\d{6}$/),
          reason: z.enum(['ambiguous_interpretation', 'unsupported_interpretation']),
        })
        .strict()
    ),
  })
  .strict();

export type WithholdingManifest = z.infer<typeof manifestSchema>;

export function parseWithholdingManifest(value: unknown): WithholdingManifest {
  const manifest = manifestSchema.safeParse(value);
  if (!manifest.success) throw new Error('Invalid source withholding manifest');
  const { revisions } = manifest.data;
  if (new Set(revisions.map((row) => row.messageKey)).size !== revisions.length)
    throw new Error('Duplicate source in withholding manifest');
  return manifest.data;
}

export function assertPreviousHoldsIncluded(
  previous: WithholdingManifest['revisions'],
  revisions: WithholdingManifest['revisions']
) {
  const byKey = new Map(revisions.map((row) => [row.messageKey, row]));
  for (const prior of previous) {
    const row = byKey.get(prior.messageKey);
    if (row?.revision !== prior.revision || row.reason !== prior.reason)
      throw new Error('Manifest must retain every prior withholding decision');
  }
}
