import { z } from 'zod';

const uuid = z.string().uuid();

const CONFIG_SNAPSHOT = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  materialId: z.string().nullable(),
  orientation: z.enum(['landscape', 'portrait']),
  quantity: z.number().int().min(1),
});

export const CreateOrUpdateDesignSchema = z.object({
  id: uuid,
  product_id: uuid,
  template_id: uuid.nullable(),
  name: z.string().min(1).max(100),
  canvas_json: z.unknown(),
  config_snapshot: CONFIG_SNAPSHOT,
  thumbnail_data_url: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'Expected PNG data URL')
    .max(2_000_000, 'Thumbnail too large')
    .nullable(),
  artwork_source: z.enum(['canvas', 'upload']),
  uploaded_artwork_url: z.string().max(512).nullable(),
});

export type CreateOrUpdateDesignInput = z.infer<typeof CreateOrUpdateDesignSchema>;

const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.svg', '.ai', '.png'];

export function validateUploadedArtworkPath(
  path: string | null,
  userId: string,
): boolean {
  if (!path) return true;
  if (!path.startsWith(`${userId}/`)) return false;
  const lower = path.toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}