import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import { XeroExportButton } from './XeroExportButton';

export const dynamic = 'force-dynamic';

export default async function AdminExportsPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_cents, paid_at, xero_exported_at')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(50);

  const list = orders ?? [];
  const unexported = list.filter((o) => !o.xero_exported_at && o.status === 'completed');
  const exported = list.filter((o) => o.xero_exported_at);
  const completedNotYet = unexported.length;

  return (
    <div>
      <p className="spec-label">Accounting</p>
      <h1 className="mt-1 font-display text-display-md">Xero exports.</h1>

      <section className="mt-6 rounded-sm border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="spec-label">Ready to export</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular">
              {completedNotYet}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Completed + paid orders not yet marked as exported.
            </p>
          </div>
          <XeroExportButton disabled={completedNotYet === 0} />
        </div>
      </section>

      <section className="mt-6">
        <p className="spec-label">Recent orders</p>
        <div className="mt-3 overflow-x-auto rounded-sm border border-line bg-surface">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-canvas text-left">
                <Th>Order</Th>
                <Th>Total</Th>
                <Th>Paid</Th>
                <Th>Status</Th>
                <Th>Xero</Th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-muted">
                    No paid orders yet.
                  </td>
                </tr>
              ) : (
                list.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0">
                    <Td className="font-mono text-[11px]">{o.order_number}</Td>
                    <Td className="tabular">{formatCents(o.total_cents)}</Td>
                    <Td className="text-[10px] text-ink-muted">
                      {o.paid_at
                        ? new Date(o.paid_at).toLocaleDateString('en-NZ')
                        : '—'}
                    </Td>
                    <Td>
                      <span className="tag capitalize">{o.status}</span>
                    </Td>
                    <Td>
                      {o.xero_exported_at ? (
                        <span className="tag bg-success/10 text-success">
                          Exported
                        </span>
                      ) : (
                        <span className="tag">Pending</span>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {exported.length > 0 ? (
          <p className="mt-2 text-[10px] text-ink-muted">
            {exported.length} order{exported.length === 1 ? '' : 's'} already exported.
          </p>
        ) : null}
      </section>
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
  return <td className={`px-3 py-2.5 ${className ?? ''}`}>{children}</td>;
}