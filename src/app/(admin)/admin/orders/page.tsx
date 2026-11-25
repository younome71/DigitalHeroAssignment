import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  'all',
  'quote',
  'order',
  'artwork',
  'proof',
  'production',
  'completed',
  'cancelled',
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? 'all';
  const searchQuery = (sp.q ?? '').trim();
  const showArchived = sp.archived === '1';

  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select(
      `id, order_number, status, total_cents, paid_at, created_at, customer_id,
       customer:profiles!inner(full_name, email, company_name),
       items:order_items(
         id, quantity,
         product:products(name, division:divisions(name)),
         proofs:proofs(id, version, status, created_at)
       )`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter as OrderStatus);
  }
  if (!showArchived && statusFilter === 'all') {
    // By default show everything except completed when no filter is set
    // to keep the "action" view focused. Use ?archived=1 to see completed.
    query = query.neq('status', 'completed');
  }
  if (searchQuery.length > 0) {
    query = query.ilike('order_number', `%${searchQuery}%`);
  }

  const { data: orders } = await query;

  const rows = (orders ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    paid_at: string | null;
    created_at: string;
    customer: { full_name: string | null; email: string; company_name: string | null };
    items: Array<{
      id: string;
      quantity: number;
      product: { name: string; division: { name: string } | null } | null;
      proofs: Array<{ id: string; version: number; status: string; created_at: string }>;
    }>;
  }>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="spec-label">Production queue</p>
          <h1 className="mt-1 font-display text-display-md">Orders.</h1>
        </div>
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mt-4 flex flex-wrap items-center gap-2 rounded-sm border border-line bg-surface p-3"
      >
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search order number…"
            className="input-base max-w-[220px] py-1.5 text-xs"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="input-base max-w-[160px] py-1.5 text-xs capitalize"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s === 'all' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={showArchived}
            />
            Include completed
          </label>
        </div>
        <button type="submit" className="btn-ghost py-1.5 text-xs">
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-sm border border-line bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-canvas text-left">
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Items</Th>
              <Th>Status</Th>
              <Th>Proof</Th>
              <Th>Total</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-muted">
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const allApproved =
                  o.items.length > 0 &&
                  o.items.every((it) => {
                    const latest = [...it.proofs].sort(
                      (a, b) => b.version - a.version,
                    )[0];
                    return latest?.status === 'approved';
                  });
                const anyPending = o.items.some((it) => {
                  const latest = [...it.proofs].sort(
                    (a, b) => b.version - a.version,
                  )[0];
                  return latest?.status === 'pending';
                });
                return (
                  <tr key={o.id} className="border-b border-line/60 last:border-0">
                    <Td>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {o.order_number}
                      </span>
                      <p className="mt-0.5 text-[10px] text-ink-muted">
                        {new Date(o.created_at).toLocaleDateString('en-NZ')}
                      </p>
                    </Td>
                    <Td>
                      <p className="font-medium">
                        {o.customer.company_name || o.customer.full_name || '—'}
                      </p>
                      <p className="text-[10px] text-ink-muted">{o.customer.email}</p>
                    </Td>
                    <Td>
                      {o.items.length} item{o.items.length === 1 ? '' : 's'}
                    </Td>
                    <Td>
                      <span className="tag capitalize">{o.status}</span>
                    </Td>
                    <Td>
                      {allApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-xs bg-success/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-success">
                          Unlocked
                        </span>
                      ) : anyPending ? (
                        <span className="inline-flex items-center gap-1 rounded-xs bg-accent/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-accent">
                          Awaiting
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xs bg-ink/5 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
                          Locked
                        </span>
                      )}
                    </Td>
                    <Td className="tabular">{formatCents(o.total_cents)}</Td>
                    <Td>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-accent hover:underline"
                      >
                        Open →
                      </Link>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-top ${className ?? ''}`}>{children}</td>;
}