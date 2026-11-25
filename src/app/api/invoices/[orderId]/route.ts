import { NextResponse, type NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MM_TO_PT = 2.83465;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, customer_id, status, currency,
       subtotal_cents, discount_cents, vat_cents, total_cents,
       paid_at, created_at, shipping_address,
       items:order_items(
         quantity, unit_price_cents, line_total_cents, width_mm, height_mm, material,
         product:products(name)
       )`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // RLS already scopes SELECT to owner or admin — still verify explicitly.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, company_name, email, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const isAdmin = profile.role === 'admin';
  if (!isAdmin && order.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: customer } = await supabase
    .from('profiles')
    .select('full_name, company_name, email')
    .eq('id', order.customer_id)
    .maybeSingle();

  const items = (order.items ?? []) as unknown as Array<{
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    width_mm: number;
    height_mm: number;
    material: string | null;
    product: { name: string } | null;
  }>;

  // ---- Build PDF ------------------------------------------------------
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.order_number}`);
  pdf.setProducer('Digital Heroes');
  pdf.setCreator('digital-heroes.app');

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 210 * MM_TO_PT;
  const pageH = 297 * MM_TO_PT;
  const margin = 20 * MM_TO_PT;

  const page = pdf.addPage([pageW, pageH]);

  const ink = rgb(0.078, 0.078, 0.075);
  const muted = rgb(0.48, 0.47, 0.45);
  const accent = rgb(0.910, 0.365, 0.016);
  const line = rgb(0.867, 0.851, 0.82);

  let y = pageH - margin;

  // Header block
  page.drawRectangle({
    x: margin,
    y: y - 36,
    width: 36,
    height: 36,
    color: ink,
  });
  page.drawText('DH', {
    x: margin + 10,
    y: y - 24,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('Digital Heroes', {
    x: margin + 44,
    y: y - 22,
    size: 14,
    font: bold,
    color: ink,
  });
  page.drawText('TAX INVOICE', {
    x: pageW - margin - 100,
    y: y - 22,
    size: 14,
    font: bold,
    color: accent,
  });

  y -= 60;

  // Meta block
  page.drawText(`Invoice: ${order.order_number}`, {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: ink,
  });
  page.drawText(
    `Issued: ${new Date(order.paid_at ?? order.created_at).toLocaleDateString('en-NZ')}`,
    { x: pageW - margin - 180, y, size: 9, font, color: muted },
  );
  y -= 14;

  const billName = customer?.company_name?.trim() || customer?.full_name?.trim() || '—';
  page.drawText('Billed to', { x: margin, y, size: 8, font, color: muted });
  y -= 11;
  page.drawText(billName, { x: margin, y, size: 10, font: bold, color: ink });
  y -= 11;
  if (customer?.email) {
    page.drawText(customer.email, { x: margin, y, size: 9, font, color: muted });
    y -= 11;
  }

  y -= 12;

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 0.5,
    color: line,
  });
  y -= 20;

  // Column headers
  const colQtyX = pageW - margin - 200;
  const colUnitX = pageW - margin - 130;
  const colTotalX = pageW - margin - 65;

  page.drawText('Description', { x: margin, y, size: 8, font: bold, color: muted });
  page.drawText('Qty', { x: colQtyX, y, size: 8, font: bold, color: muted });
  page.drawText('Unit', { x: colUnitX, y, size: 8, font: bold, color: muted });
  page.drawText('Line', { x: colTotalX, y, size: 8, font: bold, color: muted });
  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageW - margin, y },
    thickness: 0.4,
    color: line,
  });
  y -= 14;

  // Items
  for (const it of items) {
    const desc = `${it.product?.name ?? 'Product'} · ${Math.round(Number(it.width_mm))}×${Math.round(Number(it.height_mm))}mm${it.material ? ` · ${it.material}` : ''}`;
    page.drawText(desc, { x: margin, y, size: 9, font, color: ink });
    page.drawText(String(it.quantity), { x: colQtyX, y, size: 9, font, color: ink });
    page.drawText(fmt(it.unit_price_cents), { x: colUnitX, y, size: 9, font, color: ink });
    page.drawText(fmt(it.line_total_cents), { x: colTotalX, y, size: 9, font, color: ink });
    y -= 16;
  }

  y -= 6;
  page.drawLine({
    start: { x: pageW - margin - 260, y },
    end: { x: pageW - margin, y },
    thickness: 0.4,
    color: line,
  });
  y -= 16;

  // Totals
  const subtotal = order.subtotal_cents - order.discount_cents;
  const lines: Array<[string, string, boolean]> = [
    ['Subtotal (ex VAT)', fmt(order.subtotal_cents), false],
  ];
  if (order.discount_cents > 0) {
    lines.push(['Volume discount', `-${fmt(order.discount_cents)}`, false]);
  }
  lines.push([`VAT`, fmt(order.vat_cents), false]);
  lines.push(['Total', fmt(order.total_cents), true]);

  for (const [label, value, isTotal] of lines) {
    page.drawText(label, {
      x: pageW - margin - 200,
      y,
      size: isTotal ? 11 : 9,
      font: isTotal ? bold : font,
      color: ink,
    });
    page.drawText(value, {
      x: pageW - margin - 70,
      y,
      size: isTotal ? 11 : 9,
      font: isTotal ? bold : font,
      color: isTotal ? accent : ink,
    });
    y -= 15;
  }

  y -= 20;
  page.drawText(
    `Net: ${fmt(subtotal)} · VAT: ${fmt(order.vat_cents)} · Gross: ${fmt(order.total_cents)}`,
    { x: margin, y, size: 8, font, color: muted },
  );

  // Footer
  page.drawText(
    'Digital Heroes Ltd · digitalheroes.example · GST 123-456-789',
    { x: margin, y: margin + 20, size: 8, font, color: muted },
  );
  page.drawText(
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    { x: pageW - margin - 110, y: margin + 20, size: 8, font, color: muted },
  );

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="DigitalHeroes_${order.order_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}