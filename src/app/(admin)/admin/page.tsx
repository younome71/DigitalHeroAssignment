import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PIPELINE_LABELS: Record<string, string> = {
  quote: 'Quote',
  order: 'Order',
  artwork: 'Artwork',
  proof: 'Proof',
  production: 'Production',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [allOrdersRes, pendingProofsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total_cents, paid_at, created_at'),
    supabase
      .from('proofs')
      .select('id, status, order_items!inner(order_id, orders!inner(order_number, id))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const allOrders = allOrdersRes.data ?? [];

  const totalOrders = allOrders.length;
  const paidOrders = allOrders.filter((o) => o.paid_at);
  const grossRevenue = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);

  const byStatus: Record<string, number> = {};
  for (const o of allOrders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  const pendingProofs = (pendingProofsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    order_items: { order_id: string; orders: { order_number: string; id: string } };
  }>;

  return (
    <div>
      <p className="spec-label">Overview</p>
      <h1 className="mt-1 font-display text-display-md">Production floor.</h1>

      {/* KPI cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Orders" value={String(totalOrders)} />
        <Kpi label="Paid orders" value={String(paidOrders.length)} />
        <Kpi label="Gross revenue" value={formatCents(grossRevenue)} />
        <Kpi label="Pending proofs" value={String(pendingProofs.length)} />
      </div>

      {/* Pipeline stages */}
      <section className="mt-8">
        <p className="spec-label">Pipeline</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(PIPELINE_LABELS).map((key) => {
            if (key === 'cancelled') return null;
            const count = byStatus[key] ?? 0;
            return (
              <Link
                key={key}
                href={`/admin/orders?status=${key}`}
                className="rounded-sm border border-line bg-surface p-3 transition-colors hover:border-ink"
              >
                <p className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                  {PIPELINE_LABELS[key]}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold tabular">
                  {count}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pending proofs queue */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="spec-label">Awaiting customer</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              Proof queue
            </h2>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            All orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {pendingProofs.length === 0 ? (
          <p className="mt-3 rounded-sm border border-line bg-surface px-4 py-6 text-center text-xs text-ink-muted">
            No proofs awaiting customer decision.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
            {pendingProofs.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/orders/${p.order_items.orders.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-xs transition-colors hover:bg-canvas"
                >
                  <span className="font-mono uppercase tracking-widest text-ink-muted">
                    {p.order_items.orders.order_number}
                  </span>
                  <span className="tag bg-accent text-white">Pending</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <p className="spec-label">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular">
        {value}
      </p>
    </div>
  );
}