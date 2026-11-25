import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrdersListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orders } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, total_cents, created_at, paid_at,
       items:order_items(
         id, quantity, width_mm, height_mm, production_status,
         product:products(name, division:divisions(name)),
         proofs:proofs(id, version, status)
       )`,
    )
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  const list = (orders ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    created_at: string;
    paid_at: string | null;
    items: Array<{
      id: string;
      quantity: number;
      width_mm: number;
      height_mm: number;
      production_status: string;
      product: { name: string; division: { name: string } | null } | null;
      proofs: Array<{ id: string; version: number; status: string }>;
    }>;
  }>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="spec-label">Orders</p>
      <h1 className="mt-2 font-display text-display-lg">Order history.</h1>

      {list.length === 0 ? (
        <p className="mt-8 rounded-sm border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
          You haven&apos;t placed any orders yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {list.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="block rounded-sm border border-line bg-surface p-5 transition-colors hover:border-ink"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                      {order.order_number}
                    </p>
                    <p className="mt-1 font-display text-base font-semibold">
                      {formatCents(order.total_cents)}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {new Date(order.created_at).toLocaleDateString('en-NZ', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="tag capitalize">{order.status}</span>
                </div>

                <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {it.product?.name ?? 'Product'}
                        </p>
                        <p className="text-ink-muted">
                          {Math.round(Number(it.width_mm))} ×{' '}
                          {Math.round(Number(it.height_mm))}mm · {it.quantity} units
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tag">{it.production_status}</span>
                        <ArrowRight className="h-3 w-3 text-ink-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}