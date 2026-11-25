'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MaterialOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  priceMultiplier: z.number().positive(),
});

const VolumeTierSchema = z.object({
  min_qty: z.number().int().positive(),
  discount_percent: z.number().min(0).max(100),
});

const FitRulesSchema = z.object({
  mode: z.enum(['shrink', 'fit', 'stretch']),
  min_font_size: z.number().positive(),
  max_font_size: z.number().positive(),
  letter_spacing_min: z.number(),
  letter_spacing_max: z.number(),
});

const ProductUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).default(''),
  base_price_cents: z.number().int().nonnegative(),
  turnaround_days: z.number().int().positive(),
  xero_account_code: z.string().min(1).max(20),
  active: z.boolean(),
  min_width_mm: z.number().positive(),
  max_width_mm: z.number().positive(),
  min_height_mm: z.number().positive(),
  max_height_mm: z.number().positive(),
  bleed_mm: z.number().nonnegative(),
  safe_margin_mm: z.number().nonnegative(),
  target_dpi: z.number().int().min(72).max(1200),
  vat_percent: z.number().min(0).max(100),
  allowed_materials: z.array(MaterialOptionSchema),
  volume_discount_tiers: z.array(VolumeTierSchema),
  template_fit_rules: FitRulesSchema,
  allowed_orientations: z.array(z.enum(['landscape', 'portrait'])).min(1),
});

function parseNum(v: FormDataEntryValue | null): number {
  if (typeof v !== 'string') return NaN;
  return Number(v);
}

function safeJson<T>(raw: string, schema: z.ZodSchema<T>): T {
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}

export async function updateProductAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') {
    redirect(`/admin/products/${id}?error=${encodeURIComponent('Forbidden')}`);
  }

  try {
    const orientations = formData.getAll('orientation').filter((v): v is string =>
      v === 'landscape' || v === 'portrait',
    ) as Array<'landscape' | 'portrait'>;

    const payload = {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      description: String(formData.get('description') ?? ''),
      base_price_cents: parseNum(formData.get('base_price_cents')),
      turnaround_days: parseNum(formData.get('turnaround_days')),
      xero_account_code: String(formData.get('xero_account_code') ?? '200'),
      active: formData.get('active') === '1',
      min_width_mm: parseNum(formData.get('min_width_mm')),
      max_width_mm: parseNum(formData.get('max_width_mm')),
      min_height_mm: parseNum(formData.get('min_height_mm')),
      max_height_mm: parseNum(formData.get('max_height_mm')),
      bleed_mm: parseNum(formData.get('bleed_mm')),
      safe_margin_mm: parseNum(formData.get('safe_margin_mm')),
      target_dpi: parseNum(formData.get('target_dpi')),
      vat_percent: parseNum(formData.get('vat_percent')),
      allowed_materials: safeJson(
        String(formData.get('allowed_materials') ?? '[]'),
        z.array(MaterialOptionSchema),
      ),
      volume_discount_tiers: safeJson(
        String(formData.get('volume_discount_tiers') ?? '[]'),
        z.array(VolumeTierSchema),
      ),
      template_fit_rules: safeJson(
        String(formData.get('template_fit_rules') ?? '{}'),
        FitRulesSchema,
      ),
      allowed_orientations: orientations,
    };

    const validated = ProductUpdateSchema.parse(payload);

    const admin = createAdminClient();
    const { error } = await admin
      .from('products')
      .update({
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        base_price_cents: validated.base_price_cents,
        turnaround_days: validated.turnaround_days,
        xero_account_code: validated.xero_account_code,
        active: validated.active,
        min_width_mm: validated.min_width_mm,
        max_width_mm: validated.max_width_mm,
        min_height_mm: validated.min_height_mm,
        max_height_mm: validated.max_height_mm,
        bleed_mm: validated.bleed_mm,
        safe_margin_mm: validated.safe_margin_mm,
        target_dpi: validated.target_dpi,
        vat_percent: validated.vat_percent,
        allowed_materials: validated.allowed_materials,
        volume_discount_tiers: validated.volume_discount_tiers,
        template_fit_rules: validated.template_fit_rules,
        allowed_orientations: validated.allowed_orientations,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${id}`);
  } catch (e) {
    redirect(
      `/admin/products/${id}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  redirect(`/admin/products/${id}?saved=1`);
}