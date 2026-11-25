import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProofDecisionSchema } from '@/lib/validators/proofs';
import type { ProofAction } from '@/types/database';
import { sendProofDecisionEmail } from '@/lib/resend';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proofId: string }> },
) {
  const { proofId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Single query for proof + ownership + order_number + customer email
  const { data: proof, error: proofErr } = await supabase
    .from('proofs')
    .select(
      'id, order_item_id, version, status, order_items!inner(id, order_id, orders!inner(id, order_number, customer_id, customer:profiles!inner(email, full_name)))',
    )
    .eq('id', proofId)
    .maybeSingle();

  if (proofErr || !proof) {
    return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
  }

  const orderItem = proof.order_items as unknown as {
    id: string;
    order_id: string;
    orders: {
      id: string;
      order_number: string;
      customer_id: string;
      customer: { email: string; full_name: string | null };
    };
  };
  const order = orderItem.orders;

  if (order.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: latest } = await supabase
    .from('proofs')
    .select('id, version, status')
    .eq('order_item_id', orderItem.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest || latest.id !== proofId) {
    return NextResponse.json(
      { error: 'Only the latest proof version can be actioned' },
      { status: 400 },
    );
  }

  if (proof.status !== 'pending') {
    return NextResponse.json(
      { error: `Proof is already ${proof.status}` },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ProofDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { decision, notes } = parsed.data;
  const newStatus = decision === 'approved' ? 'approved' : 'rejected';

  const { error: updateErr } = await supabase
    .from('proofs')
    .update({ status: newStatus })
    .eq('id', proofId);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to update proof: ${updateErr.message}` },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  let action: ProofAction;
  if (decision === 'approved') {
    action = 'approved';
  } else if (notes && notes.length > 0) {
    action = 'change_requested';
  } else {
    action = 'rejected';
  }

  const { error: logErr } = await admin.from('proof_logs').insert({
    proof_id: proofId,
    user_id: user.id,
    action,
    notes: notes && notes.length > 0 ? notes : null,
  });

  if (logErr) {
    console.error('[proof decision] log insert failed:', logErr);
  }

  if (decision === 'approved') {
    await admin
      .from('order_items')
      .update({ production_status: 'production' })
      .eq('id', orderItem.id);

    const { data: siblings } = await admin
      .from('order_items')
      .select('production_status')
      .eq('order_id', order.id);

    const allReady = (siblings ?? []).every((s) =>
      ['production', 'completed'].includes(s.production_status),
    );

    if (allReady) {
      await admin
        .from('orders')
        .update({ status: 'production' })
        .eq('id', order.id);
    }
  }

  if (order.customer?.email) {
    await sendProofDecisionEmail({
      toCustomer: order.customer.email,
      customerName: order.customer.full_name ?? '',
      orderNumber: order.order_number,
      orderId: order.id,
      proofId,
      version: proof.version,
      decision,
      notes: notes && notes.length > 0 ? notes : undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    proofId,
    status: newStatus,
    action,
    advancedToProduction: decision === 'approved',
  });
}