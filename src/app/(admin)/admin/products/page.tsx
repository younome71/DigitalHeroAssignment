import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from('products')
    .select(
      `id, name, slug, active, base_price_cents, min_width_mm, max_width_mm,
       min_height_mm, max_height_mm, target_dpi, vat_percent, turnaround_days,
       division:divisions(name, slug)`,
    )
    .order('name', { ascending: true });

  const list = products ?? [];

  return (
    <div>
      <p className="spec-label">Products</p>
      <h1 className="mt-1 font-display text-display-md">Catalogue.</h1>

      <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-canvas text-left">
              <Th>Product</Th>
              <Th>Division</Th>
              <Th>Base price</Th>
              <Th>Dimensions</Th>
              <Th>DPI</Th>
              <Th>VAT</Th>
              <Th>Turnaround</Th>
              <Th>Active</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <Td>
                  <p className="font-medium">{p.name}</p>
                  <p className="font-mono text-[10px] text-ink-muted">{p.slug}</p>
                </Td>
                <Td>{(p.division as unknown as { name: string })?.name ?? '—'}</Td>
                <Td className="tabular">{formatCents(p.base_price_cents)}</Td>
                <Td className="tabular text-[11px]">
                  {Number(p.min_width_mm)}–{Number(p.max_width_mm)} ×{' '}
                  {Number(p.min_height_mm)}–{Number(p.max_height_mm)}mm
                </Td>
                <Td className="tabular">{p.target_dpi}</Td>
                <Td className="tabular">{Number(p.vat_percent)}%</Td>
                <Td>{p.turnaround_days}d</Td>
                <Td>
                  <span
                    className={
                      'tag ' +
                      (p.active ? 'bg-success/10 text-success' : 'bg-ink/5')
                    }
                  >
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </Td>
                <Td>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="text-accent hover:underline"
                  >
                    Edit →
                  </Link>
                </Td>
              </tr>
            ))}
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
  return <td className={`px-3 py-2.5 ${className ?? ''}`}>{children}</td>;
}