import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProofUploadFieldsSchema } from '@/lib/validators/proofs';
import { generatePdf } from '@/lib/print/pdf-generator';
import {
  normalizeCanvasJson,
  type CanvasJson,
} from '@/lib/print/canvas-json';
import { sendProofReadyEmail } from '@/lib/resend';
import { asTemplate } from '@/lib/db-cast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ---- Auth: admin only ------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ---- Parse multipart form -------------------------------------------
  const formData = await request.formData();
  const rawItemId = formData.get('order_item_id');
  const file = formData.get('file');

  const parsedFields = ProofUploadFieldsSchema.safeParse({
    order_item_id: typeof rawItemId === 'string' ? rawItemId : '',
    use_design_preview: formData.get('use_design_preview') ?? undefined,
  });

  if (!parsedFields.success) {
    return NextResponse.json(
      { error: 'Invalid form fields', issues: parsedFields.error.issues },
      { status: 400 },
    );
  }

  const { order_item_id: orderItemId } = parsedFields.data;
  const admin = createAdminClient();

  // ---- Single query for item + order + customer + product + design ----
  const { data: item, error: itemErr } = await admin
    .from('order_items')
    .select(
      'id, order_id, design_id, width_mm, height_mm, product_id, orders!inner(id, order_number, customer:profiles!inner(email, full_name)), products!inner(*, divisions(slug)), designs(*)',
    )
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
  }

  const order = item.orders as unknown as {
    id: string;
    order_number: string;
    customer: { email: string; full_name: string | null };
  };
  const product = item.products as unknown as typeof item.products & {
    divisions: { slug: string } | null;
  };
  const design = item.designs as unknown as
    | { id: string; canvas_json: unknown; template_id: string | null }
    | null;

  // ---- Resolve template in a single query per path -------------------
  const templateId = design?.template_id ?? null;

  let template: NonNullable<Awaited<ReturnType<typeof fetchTemplate>>>;
  if (templateId) {
    const t = await fetchTemplate(admin, { id: templateId });
    if (!t) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 });
    }
    template = t;
  } else {
    const t = await fetchTemplate(admin, { productId: product.id });
    if (!t) {
      return NextResponse.json(
        { error: 'No template available for this product' },
        { status: 400 },
      );
    }
    template = t
  }
  const typedTemplate = asTemplate(template);

  // ---- Prepare proof bytes --------------------------------------------
  let pdfBytes: Uint8Array;

  if (file instanceof File) {
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 30MB' }, { status: 400 });
    }
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isPdf =
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46;
    if (!isPdf) {
      return NextResponse.json(
        { error: 'File must be a valid PDF' },
        { status: 400 },
      );
    }
    pdfBytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const canvasJson: CanvasJson = normalizeCanvasJson(
      design?.canvas_json ?? null,
      typedTemplate.print_area as CanvasJson['print_area'],
      typedTemplate.canvas_width_px,
      typedTemplate.canvas_height_px,
    );

    pdfBytes = await generatePdf({
      canvasJson,
      product: product as unknown as Parameters<typeof generatePdf>[0]['product'],
      template: template as unknown as Parameters<typeof generatePdf>[0]['template'],
      widthMm: Number(item.width_mm),
      heightMm: Number(item.height_mm),
    });
  }

  // ---- Determine next version ----------------------------------------
  const { data: lastProof } = await admin
    .from('proofs')
    .select('version')
    .eq('order_item_id', orderItemId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastProof?.version ?? 0) + 1;
  const storagePath = `${orderItemId}/v${nextVersion}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from('proofs')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // ---- Insert proof (auto-supersedes prior pending via DB trigger) ---
  const { data: proofRow, error: insertErr } = await admin
    .from('proofs')
    .insert({
      order_item_id: orderItemId,
      version: nextVersion,
      file_url: storagePath,
      status: 'pending',
      uploaded_by: user.id,
    })
    .select('id, version, status, created_at')
    .single();

  if (insertErr || !proofRow) {
    await admin.storage.from('proofs').remove([storagePath]);
    return NextResponse.json(
      { error: `Failed to create proof: ${insertErr?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }

  // ---- Advance statuses ----------------------------------------------
  await admin
    .from('order_items')
    .update({ production_status: 'proof' })
    .eq('id', orderItemId);

  await admin
    .from('orders')
    .update({ status: 'proof' })
    .eq('id', order.id);

  // ---- Notify customer (customer data already joined) ----------------
  if (order.customer?.email) {
    await sendProofReadyEmail({
      to: order.customer.email,
      customerName: order.customer.full_name ?? '',
      orderNumber: order.order_number,
      orderId: order.id,
      proofId: proofRow.id,
      version: proofRow.version,
    });
  }

  const { data: signed } = await admin.storage
    .from('proofs')
    .createSignedUrl(storagePath, 60 * 60 * 24);

  return NextResponse.json({
    proofId: proofRow.id,
    orderNumber: order.order_number,
    version: proofRow.version,
    status: proofRow.status,
    createdAt: proofRow.created_at,
    signedUrl: signed?.signedUrl ?? null,
    storagePath,
 });
}

async function fetchTemplate(
  admin: ReturnType<typeof createAdminClient>,
  filter: { id: string } | { productId: string },
) {
  if ('id' in filter) {
    const { data } = await admin
      .from('templates')
      .select('*')
      .eq('id', filter.id)
      .maybeSingle();
    return data;
  }

  const { data } = await admin
    .from('templates')
    .select('*')
    .eq('product_id', filter.productId)
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}