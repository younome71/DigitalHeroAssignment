
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { csvMergeToZip, buildDateStr } from '@/lib/print/csv-merge';
import { normalizeCanvasJson, type CanvasJson } from '@/lib/print/canvas-json';
import { asProduct, asTemplate } from '@/lib/db-cast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // ---- Auth: admin-only ----------------------------------------------
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ---- Parse multipart form -----------------------------------------
  const formData = await request.formData();
  const orderItemId = formData.get('order_item_id');
  const csvFile = formData.get('file');

  if (typeof orderItemId !== 'string' || orderItemId.length === 0) {
    return NextResponse.json(
      { error: 'order_item_id is required' },
      { status: 400 },
    );
  }

  if (!(csvFile instanceof File)) {
    return NextResponse.json(
      { error: 'CSV file is required' },
      { status: 400 },
    );
  }

  if (csvFile.size > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: 'CSV exceeds 5MB' },
      { status: 400 },
    );
  }

  const lowerName = csvFile.name.toLowerCase();

  if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
    return NextResponse.json(
      { error: 'File must be .csv' },
      { status: 400 },
    );
  }

  const csvText = await csvFile.text();

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

  // ---- Load item, order, product, design, template -------------------
  const { data: item, error: itemErr } = await admin
    .from('order_items')
    .select(
      'id, order_id, design_id, width_mm, height_mm, products!inner(*, divisions(slug)), designs(*), orders!inner(id, order_number)',
    )
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemErr || !item) {
    return NextResponse.json(
      { error: 'Order item not found' },
      { status: 404 },
    );
  }

  const order = item.orders as unknown as {
    id: string;
    order_number: string;
  };

  const product = item.products as unknown as typeof item.products & {
    divisions: { slug: string } | null;
  };

  const typedProduct = asProduct(product);

  const design = item.designs as unknown as
    | {
        id: string;
        canvas_json: unknown;
        template_id: string | null;
      }
    | null;

  if (!design?.template_id) {
    return NextResponse.json(
      { error: 'Design has no template reference' },
      { status: 400 },
    );
  }

  const { data: template } = await admin
    .from('templates')
    .select('*')
    .eq('id', design.template_id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 400 },
    );
  }

  const typedTemplate = asTemplate(template);

  const canvasJson: CanvasJson = normalizeCanvasJson(
    design.canvas_json,
    typedTemplate.print_area,
    typedTemplate.canvas_width_px,
    typedTemplate.canvas_height_px,
  );

  // ---- Merge --------------------------------------------------------
  try {
    const dateStr = buildDateStr();

    const mergeResult = await csvMergeToZip({
      csvText,
      canvasJson,
      product: typedProduct,
      template: typedTemplate,
      widthMm: Number(item.width_mm),
      heightMm: Number(item.height_mm),
      orderNumber: order.order_number,
      productSlug: typedProduct.slug,
      dateStr,
    });

    const zipFileName = `${order.order_number}_${typedProduct.slug}_${dateStr}_Output.zip`;
    const storagePath = `${orderItemId}/${zipFileName}`;

    const { error: uploadErr } = await admin.storage
      .from('print-jobs')
      .upload(storagePath, mergeResult.zipBuffer, {
        contentType: 'application/zip',
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
      file_type: 'zip',
      file_url: storagePath,
      status: 'ready',
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      metadata: {
        fileCount: mergeResult.fileCount,
        skippedRows: mergeResult.skippedRows,
        totalRows: mergeResult.totalRows,
        folderName: mergeResult.folderName,
      },
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
      fileName: zipFileName,
      storagePath,
      signedUrl: signed?.signedUrl ?? null,
      fileCount: mergeResult.fileCount,
      skippedRows: mergeResult.skippedRows,
      totalRows: mergeResult.totalRows,
      folderName: mergeResult.folderName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CSV merge failed';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
