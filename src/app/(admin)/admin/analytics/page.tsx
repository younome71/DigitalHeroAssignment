import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_cents, vat_cents, status, paid_at, created_at'),
    supabase
      .from('order_items')
      .select(
        `quantity, line_total_cents, product:products(name, division:divisions(name, slug))`,
      ),
  ]);

  const orders = ordersRes.data ?? [];
  const items = (itemsRes.data ?? []) as unknown as Array<{
    quantity: number;
    line_total_cents: number;
    product: { name: string; division: { name: string; slug: string } | null } | null;
  }>;

  const paid = orders.filter((o) => o.paid_at);
  const gross = paid.reduce((s, o) => s + o.total_cents, 0);
  const vat = paid.reduce((s, o) => s + o.vat_cents, 0);
  const net = gross - vat;

  const byDivision = new Map<
    string,
    { name: string; orderCount: number; revenue: number; units: number }
  >();
  for (const it of items) {
    const slug = it.product?.division?.slug ?? 'unknown';
    const name = it.product?.division?.name ?? 'Other';
    const entry =
      byDivision.get(slug) ?? { name, orderCount: 0, revenue: 0, units: 0 };
    entry.revenue += it.line_total_cents;
    entry.units += it.quantity;
    byDivision.set(slug, entry);
  }

  const sortedDivisions = Array.from(byDivision.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const maxRevenue = sortedDivisions[0]?.revenue ?? 1;

  return (
    <div>
      <p className="spec-label">Analytics</p>
      <h1 className="mt-1 font-display text-display-md">Throughput & revenue.</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Paid orders" value={String(paid.length)} />
        <Stat label="Gross (VAT-incl.)" value={formatCents(gross)} />
        <Stat label="Net (VAT-excl.)" value={formatCents(net)} />
      </div>

      <section className="mt-8">
        <p className="spec-label">Revenue by division</p>
        <div className="mt-3 space-y-3 rounded-sm border border-line bg-surface p-4">
          {sortedDivisions.length === 0 ? (
            <p className="text-xs text-ink-muted">No data yet.</p>
          ) : (
            sortedDivisions.map((d) => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">{d.name}</span>
                  <span className="tabular text-ink-soft">
                    {formatCents(d.revenue)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-xs bg-canvas">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
                  <span>{d.units} units</span>
                  <span>{formatCents(d.revenue / Math.max(1, d.units))} / unit avg</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <p className="spec-label">VAT breakdown</p>
        <div className="mt-3 rounded-sm border border-line bg-surface p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Net (VAT-exclusive)</span>
            <span className="tabular font-medium">{formatCents(net)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-ink-muted">VAT collected</span>
            <span className="tabular font-medium">{formatCents(vat)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="font-medium">Gross (VAT-inclusive)</span>
            <span className="font-display font-semibold tabular">
              {formatCents(gross)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <p className="spec-label">{label}</p>
      <p className="mt-2 font-display text-xl font-semibold tabular">{value}</p>
    </div>
  );
}