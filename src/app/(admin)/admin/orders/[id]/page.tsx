import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Lock, Unlock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import { OrderActionsPanel } from './OrderActionsPanel';
import { OrderItemProductionPanel } from '@/components/admin/OrderItemProductionPanel';

export const dynamic = 'force-dynamic';

const PIPELINE: Array<{ key: string; label: string }> = [
  { key: 'quote', label: 'Quote' },
  { key: 'order', label: 'Order' },
  { key: 'artwork', label: 'Artwork' },
  { key: 'proof', label: 'Proof' },
  { key: 'production', label: 'Production' },
  { key: 'completed', label: 'Completed' },
];

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, order_number, status, subtotal_cents, discount_cents, vat_cents, total_cents,
       paid_at, created_at, notes,
       customer:profiles!inner(full_name, email, company_name),
       items:order_items(
         id, quantity, width_mm, height_mm, material, orientation,
         unit_price_cents, line_total_cents, production_status,
         product:products(name, slug, division:divisions(name)),
         design:designs(id, name, canvas_json, thumbnail_url),
         proofs:proofs(id, version, status, file_url, created_at, approved_at),
         print_jobs:print_jobs(id, file_type, file_url, status, created_at)
       )`,
    )
    .eq('id', id)
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
    product: { name: string; slug: string; division: { name: string } | null } | null;
    design: { id: string; name: string; canvas_json: unknown; thumbnail_url: string | null } | null;
    proofs: Array<{
      id: string;
      version: number;
      status: string;
      file_url: string;
      created_at: string;
      approved_at: string | null;
    }>;
    print_jobs: Array<{
      id: string;
      file_type: 'pdf' | 'png' | 'zip';
      file_url: string | null;
      status: string;
      created_at: string;
    }>;
  }>;

  const customer = order.customer as unknown as {
    full_name: string | null;
    email: string;
    company_name: string | null;
  };

  const currentIdx = PIPELINE.findIndex((s) => s.key === order.status);

  return (
    <div>
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> Production queue
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            {order.order_number}
          </p>
          <h1 className="mt-1 font-display text-display-md">
            {formatCents(order.total_cents)}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {customer.company_name || customer.full_name} · {customer.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/invoices/${order.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost py-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Invoice PDF
          </a>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div className="mt-6 rounded-sm border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
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

        <OrderActionsPanel orderId={order.id} currentStatus={order.status} />
      </div>

      {/* Items */}
      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const latestProof = [...item.proofs].sort(
            (a, b) => b.version - a.version,
          )[0];
          const approved = latestProof?.status === 'approved';
          return (
            <section
              key={item.id}
              className="rounded-sm border border-line bg-surface"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
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
                </div>
                <div className="flex items-center gap-2">
                  {approved ? (
                    <span className="inline-flex items-center gap-1 rounded-xs bg-success/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-success">
                      <Unlock className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-xs bg-ink/5 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
              </header>

              <OrderItemProductionPanel
                orderItemId={item.id}
                proofs={item.proofs}
                printJobs={item.print_jobs}
                latestProofApproved={approved}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}