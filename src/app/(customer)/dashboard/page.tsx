import Link from 'next/link';
import {
  ArrowRight,
  FileCheck2,
  PackageSearch,
  Palette,
  Settings2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import { updateProfileAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ profile_saved?: string; profile_error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileRes, ordersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('orders')
      .select(
        `id, order_number, status, total_cents, created_at,
         items:order_items(
           id, quantity, width_mm, height_mm, production_status,
           product:products(name, division:divisions(name)),
           proofs:proofs(id, version, status, created_at)
         )`,
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const profile = profileRes.data;
  const orders = (ordersRes.data ?? []) as unknown as Array<{
    id: string;
    order_number: string;
    status: string;
    total_cents: number;
    created_at: string;
    items: Array<{
      id: string;
      quantity: number;
      width_mm: number;
      height_mm: number;
      production_status: string;
      product: { name: string; division: { name: string } | null } | null;
      proofs: Array<{ id: string; version: number; status: string; created_at: string }>;
    }>;
  }>;

  const pendingProofs = orders.flatMap((o) =>
    o.items.flatMap((it) =>
      it.proofs
        .filter((p) => p.status === 'pending')
        .map((p) => ({ order: o, item: it, proof: p })),
    ),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="spec-label">Account</p>
          <h1 className="mt-2 font-display text-display-lg">
            {profile?.full_name ? `Hello, ${profile.full_name.split(' ')[0]}.` : 'Your workspace.'}
          </h1>
        </div>
        <Link href="/calculator" className="btn-ghost text-xs">
          New job <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {sp.profile_saved ? (
        <p className="mt-6 rounded-sm border border-success/30 bg-success/5 px-4 py-2 text-xs text-success">
          Profile updated.
        </p>
      ) : null}
      {sp.profile_error ? (
        <p className="mt-6 rounded-sm border border-danger/30 bg-danger/5 px-4 py-2 text-xs text-danger">
          {sp.profile_error}
        </p>
      ) : null}

      {pendingProofs.length > 0 ? (
        <section className="mt-8 rounded-sm border border-accent bg-accent-soft p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="font-display text-sm font-semibold">
                {pendingProofs.length} proof{pendingProofs.length === 1 ? '' : 's'} awaiting your review.
              </p>
              <ul className="mt-3 space-y-1.5">
                {pendingProofs.map(({ order, item, proof }) => (
                  <li key={proof.id}>
                    <Link
                      href={`/orders/${order.id}/proofs/${proof.id}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Review v{proof.version} — {item.product?.name} ({order.order_number}) →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="spec-label">Orders</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Recent</h2>
              </div>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
              >
                All orders <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {orders.length === 0 ? (
              <p className="mt-4 rounded-sm border border-line bg-surface px-4 py-8 text-center text-xs text-ink-muted">
                No orders yet. <Link href="/calculator" className="text-accent hover:underline">Start with a quote</Link>.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line rounded-sm border border-line bg-surface">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-canvas"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
                            {order.order_number}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {order.items.length} item{order.items.length === 1 ? '' : 's'} ·{' '}
                            {formatCents(order.total_cents)}
                          </p>
                        </div>
                        <span className="tag capitalize">{order.status}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="spec-label">Designs</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Saved work</h2>
              </div>
              <Link
                href="/designs"
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
              >
                All designs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <QuickCard
                href="/designs"
                icon={<Palette className="h-5 w-5" />}
                label="Browse designs"
              />
              <QuickCard
                href="/calculator"
                icon={<PackageSearch className="h-5 w-5" />}
                label="Price a new job"
              />
            </div>
          </section>
        </div>

        {/* Profile card */}
        <aside>
          <section className="rounded-sm border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-ink-muted" />
              <p className="spec-label">Profile</p>
            </div>
            <form action={updateProfileAction} className="mt-4 space-y-3">
              <div>
                <label className="spec-label mb-1 block text-[9px]">Full name</label>
                <input
                  name="full_name"
                  defaultValue={profile?.full_name ?? ''}
                  required
                  className="input-base text-xs"
                />
              </div>
              <div>
                <label className="spec-label mb-1 block text-[9px]">Company</label>
                <input
                  name="company_name"
                  defaultValue={profile?.company_name ?? ''}
                  className="input-base text-xs"
                />
              </div>
              <div>
                <label className="spec-label mb-1 block text-[9px]">Phone</label>
                <input
                  name="phone"
                  defaultValue={profile?.phone ?? ''}
                  className="input-base text-xs"
                />
              </div>
              <div>
                <label className="spec-label mb-1 block text-[9px]">Email</label>
                <input
                  value={profile?.email ?? ''}
                  disabled
                  className="input-base text-xs opacity-70"
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2 text-xs">
                Save profile
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-sm border border-line bg-surface px-4 py-4 transition-colors hover:border-ink"
    >
      <span className="flex items-center gap-2 text-xs font-medium text-ink">
        {icon}
        {label}
      </span>
      <ArrowRight className="h-3 w-3 text-ink-muted" />
    </Link>
  );
}