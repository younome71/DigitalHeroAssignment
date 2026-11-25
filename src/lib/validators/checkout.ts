import { z } from 'zod';

export const CheckoutLineSchema = z.object({
  productId: z.string().uuid(),
  designId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(100_000),
  widthMm: z.number().positive().max(10_000),
  heightMm: z.number().positive().max(10_000),
  materialId: z.string().min(1).max(64).nullable(),
  orientation: z.enum(['landscape', 'portrait']),
});

export const ShippingAddressSchema = z.object({
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(60).optional(),
});

export const CheckoutSchema = z.object({
  lines: z.array(CheckoutLineSchema).min(1).max(50),
  shippingAddress: ShippingAddressSchema.optional(),
  notes: z.string().max(2_000).optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;