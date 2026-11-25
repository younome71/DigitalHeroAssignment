import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildXeroCsv, buildXeroRows, type XeroExportInput } from '@/lib/xero-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
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

  const admin = createAdminClient();

  // Paid + completed orders not yet exported
  const { data: ordersRaw } = await admin
    .from('orders')
    .select(
      `id, order_number, paid_at, created_at, customer_id,
       customer:profiles!inner(id, full_name, company_name, email),
       items:order_items(
         quantity, unit_price_cents, width_mm, height_mm, material,
         product:products!inner(name, xero_account_code)
       )`,
    )
    .eq('status', 'completed')
    .not('paid_at', 'is', null)
    .is('xero_exported_at', null)
    .order('paid_at', { ascending: true });

  const orders = (ordersRaw ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    paid_at: string | null;
    created_at: string;
    customer_id: string;
    customer: { id: string; full_name: string; company_name: string | null; email: string };
    items: Array<{
      quantity: number;
      unit_price_cents: number;
      width_mm: number;
      height_mm: number;
      material: string | null;
      product: { name: string; xero_account_code: string };
    }>;
  }>;

  if (orders.length === 0) {
    return NextResponse.json(
      { error: 'No exportable orders — nothing has been completed and paid yet.' },
      { status: 404 },
    );
  }

  // Build CSV (per-order — assumes all items in an order share VAT; enforced
  // at checkout by Phase 2's mixed_vat check).
  const allRows = orders.flatMap((order) =>
    buildXeroRows({
      order: {
        id: order.id,
        order_number: order.order_number,
        paid_at: order.paid_at,
        created_at: order.created_at,
      },
      customer: order.customer,
      items: order.items.map((it) => ({
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        width_mm: it.width_mm,
        height_mm: it.height_mm,
        material: it.material,
        product: it.product,
      })),
      vatPercent: 15, // override from product if differing — 15 default per spec
    } satisfies XeroExportInput),
  );

  const csv = buildXeroCsv(allRows);

  // Mark exported
  const ids = orders.map((o) => o.id);
  const { error: updateErr } = await admin
    .from('orders')
    .update({ xero_exported_at: new Date().toISOString() })
    .in('id', ids);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to mark orders exported: ${updateErr.message}` },
      { status: 500 },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="digital-heroes-xero-${stamp}.csv"`,
    },
  });
}