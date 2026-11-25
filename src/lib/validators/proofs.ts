import { z } from 'zod';

export const ProofDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().max(2_000).optional(),
});

export type ProofDecisionInput = z.infer<typeof ProofDecisionSchema>;

export const ProofUploadFieldsSchema = z.object({
  order_item_id: z.string().uuid(),
  // Optional CSV overrides for template placeholders — used by the proof
  // generator when previewing with real variable data (Phase 5).
  use_design_preview: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional(),
});

/** Validate uploaded artwork path convention & extension. */
export const ALLOWED_PROOF_MIME = ['application/pdf'] as const;
export const PROOF_MAX_BYTES = 30 * 1024 * 1024;