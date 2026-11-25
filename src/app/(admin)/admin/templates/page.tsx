import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TemplateActiveToggle } from './TemplateActiveToggle';

export const dynamic = 'force-dynamic';

export default async function AdminTemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('templates')
    .select(
      `id, name, active, canvas_width_px, canvas_height_px, print_area,
       product:products(id, name, division:divisions(name))`,
    )
    .order('name', { ascending: true });

  const list = (templates ?? []) as unknown as Array<{
    id: string;
    name: string;
    active: boolean;
    canvas_width_px: number;
    canvas_height_px: number;
    print_area: { width: number; height: number };
    product: { id: string; name: string; division: { name: string } | null } | null;
  }>;

  return (
    <div>
      <p className="spec-label">Templates</p>
      <h1 className="mt-1 font-display text-display-md">Print templates.</h1>

      <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-canvas text-left">
              <Th>Name</Th>
              <Th>Product</Th>
              <Th>Division</Th>
              <Th>Canvas</Th>
              <Th>Print area</Th>
              <Th>Active</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0">
                <Td>{t.name}</Td>
                <Td>
                  {t.product ? (
                    <Link
                      href={`/admin/products/${t.product.id}`}
                      className="text-accent hover:underline"
                    >
                      {t.product.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{t.product?.division?.name ?? '—'}</Td>
                <Td className="tabular text-[11px]">
                  {t.canvas_width_px}×{t.canvas_height_px}px
                </Td>
                <Td className="tabular text-[11px]">
                  {Math.round(t.print_area?.width ?? 0)}×
                  {Math.round(t.print_area?.height ?? 0)}px
                </Td>
                <Td>
                  <TemplateActiveToggle
                    templateId={t.id}
                    currentActive={t.active}
                  />
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