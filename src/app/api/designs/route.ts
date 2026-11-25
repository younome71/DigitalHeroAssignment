import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CreateOrUpdateDesignSchema,
  validateUploadedArtworkPath,
} from '@/lib/validators/designs';
import { asJson } from '@/types/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ---- Auth -----------------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ---- Validate body --------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateOrUpdateDesignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // ---- Server-side upload path validation ----------------------------
  if (
    input.artwork_source === 'upload' &&
    input.uploaded_artwork_url &&
    !validateUploadedArtworkPath(input.uploaded_artwork_url, user.id)
  ) {
    return NextResponse.json(
      { error: 'Uploaded artwork path is invalid or not owned by you' },
      { status: 400 },
    );
  }

  // ---- Verify product & template belong to each other ----------------
  const admin = createAdminClient();

  const { data: product, error: productError } = await admin
    .from('products')
    .select('id, active')
    .eq('id', input.product_id)
    .eq('active', true)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not available' }, { status: 400 });
  }

  if (input.template_id) {
    const { data: template } = await admin
      .from('templates')
      .select('id, product_id, active')
      .eq('id', input.template_id)
      .eq('product_id', input.product_id)
      .eq('active', true)
      .maybeSingle();

    if (!template) {
      return NextResponse.json({ error: 'Template not available' }, { status: 400 });
    }
  }

  // ---- Ownership check ------------------------------------------------
  const { data: existing } = await admin
    .from('designs')
    .select('id, customer_id')
    .eq('id', input.id)
    .maybeSingle();

  if (existing && existing.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ---- Upload thumbnail (data URL → storage) --------------------------
  let thumbnailPath: string | null = null;
  if (input.thumbnail_data_url) {
    try {
      const base64 = input.thumbnail_data_url.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const objectPath = `${user.id}/${input.id}/thumb-${Date.now()}.png`;
      const { error: uploadError } = await admin.storage
        .from('customer-artworks')
        .upload(objectPath, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });
      if (uploadError) throw uploadError;
      thumbnailPath = objectPath;
    } catch (err) {
      return NextResponse.json(
        { error: `Thumbnail upload failed: ${(err as Error).message}` },
        { status: 500 },
      );
    }
  }

  // ---- Persist --------------------------------------------------------
  const row = {
    customer_id: user.id,
    product_id: input.product_id,
    template_id: input.template_id,
    name: input.name,
    canvas_json: asJson(input.canvas_json),
    config_snapshot: asJson(input.config_snapshot),
    thumbnail_url: thumbnailPath,
    artwork_source: input.artwork_source,
    uploaded_artwork_url: input.uploaded_artwork_url,
  };

  if (existing) {
    const { error: updateError } = await admin
      .from('designs')
      .update(row)
      .eq('id', input.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update design' }, { status: 500 });
    }
  } else {
    const { error: insertError } = await admin
      .from('designs')
      .insert({ id: input.id, ...row });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create design' }, { status: 500 });
    }
  }

  // ---- Sign a fresh thumbnail URL for immediate use ------------------
  let signedThumb: string | null = null;
  if (thumbnailPath) {
    const { data: signed } = await admin.storage
      .from('customer-artworks')
      .createSignedUrl(thumbnailPath, 60 * 60 * 4);
    signedThumb = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    id: input.id,
    thumbnail_url: signedThumb,
  });
}