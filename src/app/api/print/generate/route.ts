import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePdf } from '@/lib/print/pdf-generator';
import { generatePng } from '@/lib/print/png-generator';
import { normalizeCanvasJson, type CanvasJson } from '@/lib/print/canvas-json';
import { buildDateStr } from '@/lib/print/csv-merge';
import { asJson } from '@/types/database';
import { asTemplate } from '@/lib/db-cast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  order_item_id: z.string().uuid(),
  file_type: z.enum(['pdf', 'png']),
});

export async function POST(request: NextRequest) {
  // ---- Auth: admin-only ----------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ---- Validate body -------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { order_item_id: orderItemId, file_type: fileType } = parsed.data;
  const admin = createAdminClient();

  // ====================================================================
  // HARD APPROVAL GATE
  // ====================================================================
  const { data: approvedProof } = await admin
    .from('proofs')
    .select('id, version, status')
    .eq('order_item_id', orderItemId)
    .eq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!approvedProof) {
    return NextResponse.json(
      {
        error:
          'Production files are locked until the customer approves the proof.',
      },
      { status: 403 },
    );
  }

  // ---- Load item, order, product, design ----------------------------
  const { data: item, error: itemErr } = await admin
    .from('order_items')
    .select(
      'id, order_id, design_id, width_mm, height_mm, products!inner(*, divisions(slug)), designs(*), orders!inner(id, order_number)',
    )
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
  }

  const order = item.orders as unknown as { id: string; order_number: string };
  const product = item.products as unknown as {
    id: string;
    slug: string;
    name: string;
    divisions: { slug: string } | null;
    [key: string]: unknown;
  };
  const design = item.designs as unknown as
    | {
        id: string;
        canvas_json: unknown;
        template_id: string | null;
        artwork_source: 'canvas' | 'upload';
        uploaded_artwork_url: string | null;
      }
    | null;

  if (!design) {
    return NextResponse.json(
      { error: 'No design attached to this order item' },
      { status: 400 },
    );
  }

  const dateStr = buildDateStr();

  // ====================================================================
  // Direct-upload design path: skip canvas rendering, copy uploaded file
  // ====================================================================
  if (design.artwork_source === 'upload' && design.uploaded_artwork_url) {
    const uploadedPath = design.uploaded_artwork_url;
    const originalExt = uploadedPath.split('.').pop()?.toLowerCase() ?? 'pdf';
    const safeExt = ['pdf', 'png', 'svg', 'ai'].includes(originalExt)
      ? originalExt
      : 'pdf';

    const fileName = `${order.order_number}_${product.slug}_${dateStr}_Output.${safeExt}`;
    const storagePath = `${orderItemId}/${fileName}`;

    const { data: blob, error: downloadErr } = await admin.storage
      .from('customer-artworks')
      .download(uploadedPath);

    if (downloadErr || !blob) {
      return NextResponse.json(
        { error: 'Failed to download uploaded artwork from storage' },
        { status: 500 },
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType =
      safeExt === 'pdf'
        ? 'application/pdf'
        : safeExt === 'png'
        ? 'image/png'
        : safeExt === 'svg'
        ? 'image/svg+xml'
        : 'application/octet-stream';

    const { error: uploadErr } = await admin.storage
      .from('print-jobs')
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadErr.message}` },
        { status: 500 },
      );
    }

    const jobFileType: 'pdf' | 'png' | 'zip' =
      safeExt === 'png' ? 'png' : 'pdf';

    const { error: jobErr } = await admin.from('print_jobs').insert({
      order_item_id: orderItemId,
      proof_id: approvedProof.id,
      file_type: jobFileType,
      file_url: storagePath,
      status: 'ready',
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      metadata: asJson({
        source: 'direct-upload',
        originalPath: uploadedPath,
        originalExtension: safeExt,
        requestedFileType: fileType,
      }),
    });

    if (jobErr) {
      await admin.storage.from('print-jobs').remove([storagePath]);
      return NextResponse.json(
        { error: `Failed to log print job: ${jobErr.message}` },
        { status: 500 },
      );
    }

    const { data: signed } = await admin.storage
      .from('print-jobs')
      .createSignedUrl(storagePath, 60 * 60 * 24);

    return NextResponse.json({
      ok: true,
      fileType: safeExt,
      fileName,
      storagePath,
      signedUrl: signed?.signedUrl ?? null,
      proofId: approvedProof.id,
      proofVersion: approvedProof.version,
      source: 'direct-upload',
    });
  }

  // ====================================================================
  // Canvas-rendered path (original design)
  // ====================================================================
  const templateId = design.template_id;
  if (!templateId) {
    return NextResponse.json(
      { error: 'Design has no template reference' },
      { status: 400 },
    );
  }

  const { data: template } = await admin
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 400 });
  }

  const typedTemplate = asTemplate(template)

  const canvasJson: CanvasJson = normalizeCanvasJson(
    design.canvas_json,
    typedTemplate.print_area as CanvasJson['print_area'],
    typedTemplate.canvas_width_px,
    typedTemplate.canvas_height_px,
  );

  const fileName = `${order.order_number}_${product.slug}_${dateStr}_Output.${fileType}`;
  const storagePath = `${orderItemId}/${fileName}`;

  try {
    let bytes: Uint8Array | Buffer;
    let metadata: Record<string, unknown> = {};

    if (fileType === 'pdf') {
      const pdf = await generatePdf({
        canvasJson,
        product: product as unknown as Parameters<typeof generatePdf>[0]['product'],
        template: template as unknown as Parameters<typeof generatePdf>[0]['template'],
        widthMm: Number(item.width_mm),
        heightMm: Number(item.height_mm),
      });
      bytes = pdf;
      metadata = {
        pageWidthMm: Number(item.width_mm) + 2 * Number(product.bleed_mm ?? 0),
        pageHeightMm: Number(item.height_mm) + 2 * Number(product.bleed_mm ?? 0),
        bleedMm: Number(product.bleed_mm ?? 0),
      };
    } else {
      const png = await generatePng({
        canvasJson,
        product: product as unknown as Parameters<typeof generatePng>[0]['product'],
        template: template as unknown as Parameters<typeof generatePng>[0]['template'],
        widthMm: Number(item.width_mm),
        heightMm: Number(item.height_mm),
      });
      bytes = png.buffer;
      metadata = {
        widthPx: png.widthPx,
        heightPx: png.heightPx,
        effectiveDpi: png.effectiveDpi,
        bleedMm: Number(product.bleed_mm ?? 0),
      };
    }

    const { error: uploadErr } = await admin.storage
      .from('print-jobs')
      .upload(storagePath, bytes, {
        contentType: fileType === 'pdf' ? 'application/pdf' : 'image/png',
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadErr.message}` },
        { status: 500 },
      );
    }

    const { error: jobErr } = await admin.from('print_jobs').insert({
      order_item_id: orderItemId,
      proof_id: approvedProof.id,
      file_type: fileType,
      file_url: storagePath,
      status: 'ready',
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      metadata: asJson(metadata),
    });

    if (jobErr) {
      await admin.storage.from('print-jobs').remove([storagePath]);
      return NextResponse.json(
        { error: `Failed to log print job: ${jobErr.message}` },
        { status: 500 },
      );
    }

    const { data: signed } = await admin.storage
      .from('print-jobs')
      .createSignedUrl(storagePath, 60 * 60 * 24);

    return NextResponse.json({
      ok: true,
      fileType,
      fileName,
      storagePath,
      signedUrl: signed?.signedUrl ?? null,
      proofId: approvedProof.id,
      proofVersion: approvedProof.version,
      source: 'canvas',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}