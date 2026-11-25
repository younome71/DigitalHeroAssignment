import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Params {
  id: string;
}

const PIPELINE: Array<{ key: string; label: string }> = [
  { key: 'quote', label: 'Quote' },
  { key: 'order', label: 'Order' },
  { key: 'artwork', label: 'Artwork' },
  { key: 'proof', label: 'Proof' },
  { key: 'production', label: 'Production' },
  { key: 'completed', label: 'Completed' },
];

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, currency, subtotal_cents, discount_cents, vat_cents, total_cents,
       paid_at, created_at, shipping_address, notes,
       items:order_items(
         id, quantity, width_mm, height_mm, material, orientation,
         unit_price_cents, line_total_cents, production_status,
         product:products(name, division:divisions(name)),
         design:designs(id, name),
         proofs:proofs(id, version, status, created_at)
       )`,
    )
    .eq('id', id)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!order) notFound();

  const items = (order.items ?? []) as unknown as Array<{
    id: string;
    quantity: number;
    width_mm: number;
    height_mm: number;
    material: string | null;
    orientation: string | null;
    unit_price_cents: number;
    line_total_cents: number;
    production_status: string;
    product: { name: string; division: { name: string } | null } | null;
    design: { id: string; name: string } | null;
    proofs: Array<{ id: string; version: number; status: string; created_at: string }>;
  }>;

  const currentIdx = PIPELINE.findIndex((s) => s.key === order.status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            {order.order_number}
          </p>
          <h1 className="mt-1 font-display text-display-md">
            {formatCents(order.total_cents)}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            Placed{' '}
            {new Date(order.created_at).toLocaleDateString('en-NZ', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <a
          href={`/api/invoices/${order.id}`}
          className="btn-ghost text-xs"
          download
        >
          <Download className="h-3.5 w-3.5" /> Download invoice
        </a>
      </div>

      {/* Pipeline stepper */}
      <div className="mt-8 rounded-sm border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {PIPELINE.map((stage, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={stage.key} className="flex items-center gap-1.5">
                <span
                  className={
                    'rounded-xs px-2 py-1 font-mono text-[10px] uppercase tracking-widest ' +
                    (active
                      ? 'bg-accent text-white'
                      : done
                      ? 'bg-ink text-white'
                      : 'bg-canvas text-ink-muted')
                  }
                >
                  {stage.label}
                </span>
                {i < PIPELINE.length - 1 ? (
                  <span className="text-ink-muted">›</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Line items */}
      <section className="mt-6">
        <p className="spec-label">Items</p>
        <ul className="mt-3 divide-y divide-line rounded-sm border border-line bg-surface">
          {items.map((item) => {
            const latestProof = [...item.proofs].sort(
              (a, b) => b.version - a.version,
            )[0];
            return (
              <li key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold">
                      {item.product?.name ?? 'Product'}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {item.product?.division?.name ?? ''} ·{' '}
                      {Math.round(Number(item.width_mm))} ×{' '}
                      {Math.round(Number(item.height_mm))}mm
                      {item.material ? ` · ${item.material}` : ''} ·{' '}
                      {item.quantity} units
                    </p>
                    {item.design ? (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        Design: {item.design.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium tabular">
                      {formatCents(item.line_total_cents)}
                    </p>
                    <p className="text-[10px] text-ink-muted tabular">
                      {formatCents(item.unit_price_cents)} ea
                    </p>
                  </div>
                </div>

                {latestProof ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-ink-muted" />
                      <span className="tag">
                        v{latestProof.version} · {latestProof.status}
                      </span>
                    </div>
                    <Link
                      href={`/orders/${order.id}/proofs/${latestProof.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {latestProof.status === 'pending'
                        ? 'Review proof →'
                        : 'View proof →'}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Totals */}
      <section className="mt-6 rounded-sm border border-line bg-surface p-4">
        <div className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatCents(order.subtotal_cents)} />
          {order.discount_cents > 0 ? (
            <Row
              label="Volume discount"
              value={`-${formatCents(order.discount_cents)}`}
            />
          ) : null}
          <Row label="VAT" value={formatCents(order.vat_cents)} />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="font-medium">Total</span>
            <span className="font-display text-lg font-semibold tabular">
              {formatCents(order.total_cents)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}