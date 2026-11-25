import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderCompletedEmail } from '@/lib/resend';
import type { OrderStatus } from '@/types/database';

export const runtime = 'nodejs';

const PIPELINE: OrderStatus[] = [
  'quote',
  'order',
  'artwork',
  'proof',
  'production',
  'completed',
];

const BodySchema = z.union([
  z.object({ advance: z.literal(true) }),
  z.object({
    status: z.enum([
      'quote',
      'order',
      'artwork',
      'proof',
      'production',
      'completed',
      'cancelled',
    ]),
  }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params;

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

  const admin = createAdminClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, status, customer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let nextStatus: OrderStatus;
  if ('advance' in parsed.data) {
    const idx = PIPELINE.indexOf(order.status);
    if (idx < 0 || idx >= PIPELINE.length - 1) {
      return NextResponse.json(
        { error: `Order is already at terminal status: ${order.status}` },
        { status: 400 },
      );
    }
    nextStatus = PIPELINE[idx + 1];
  } else {
    nextStatus = parsed.data.status;
  }

  const { error: updateErr } = await admin
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to update order: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // Cascade item production_status
  if (nextStatus === 'production' || nextStatus === 'completed') {
    await admin
      .from('order_items')
      .update({ production_status: nextStatus })
      .eq('order_id', orderId);
  }

  // Completion email
  if (nextStatus === 'completed') {
    const { data: customer } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', order.customer_id)
      .maybeSingle();

    if (customer?.email) {
      await sendOrderCompletedEmail({
        to: customer.email,
        customerName: customer.full_name ?? '',
        orderNumber: order.order_number,
        orderId: order.id,
      });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}