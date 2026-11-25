import Link from 'next/link';
import Image from 'next/image';
import { Pencil, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/lib/utils';
import { ReorderButton } from './ReorderButton';

export const dynamic = 'force-dynamic';

interface ConfigSnapshot {
  widthMm?: number;
  heightMm?: number;
  materialId?: string | null;
  orientation?: 'landscape' | 'portrait';
  quantity?: number;
}

export default async function DesignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: designs } = await supabase
    .from('designs')
    .select(
      `id, name, template_id, config_snapshot, thumbnail_url, created_at,
       product:products(id, name, base_price_cents, division:divisions(name))`,
    )
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  const list = (designs ?? []) as unknown as Array<{
    id: string;
    name: string;
    template_id: string | null;
    config_snapshot: ConfigSnapshot;
    thumbnail_url: string | null;
    created_at: string;
    product: {
      id: string;
      name: string;
      base_price_cents: number;
      division: { name: string } | null;
    } | null;
  }>;

  // Sign thumbnails
  const thumbPaths = list
    .map((d) => d.thumbnail_url)
    .filter((p): p is string => Boolean(p));
  const thumbMap = new Map<string, string>();
  if (thumbPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('customer-artworks')
      .createSignedUrls(thumbPaths, 60 * 60 * 2);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) thumbMap.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="spec-label">Designs</p>
      <h1 className="mt-2 font-display text-display-lg">Saved work.</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Your saved designs — edit and iterate in the studio, or re-order the
        exact same spec in one click.
      </p>

      {list.length === 0 ? (
        <p className="mt-8 rounded-sm border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
          No saved designs yet.{' '}
          <Link href="/calculator" className="text-accent hover:underline">
            Start with a quote
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((design) => {
            const thumbUrl = design.thumbnail_url
              ? thumbMap.get(design.thumbnail_url) ?? null
              : null;
            const cfg = design.config_snapshot;
            return (
              <article
                key={design.id}
                className="flex flex-col overflow-hidden rounded-sm border border-line bg-surface"
              >
                <Link
                  href={`/designs/${design.id}`}
                  className="relative block aspect-[4/3] bg-canvas"
                >
                  {thumbUrl ? (
                    <Image
                      src={thumbUrl}
                      alt={design.name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-widest text-ink-muted">
                      No preview
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <p className="font-display text-sm font-semibold">{design.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {design.product?.name ?? 'Product'}
                    {design.product?.division?.name ? ` · ${design.product.division.name}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cfg.widthMm && cfg.heightMm ? (
                      <span className="tag">
                        {Math.round(cfg.widthMm)}×{Math.round(cfg.heightMm)}mm
                      </span>
                    ) : null}
                    {cfg.quantity ? <span className="tag">{cfg.quantity} units</span> : null}
                    {cfg.materialId ? <span className="tag">{cfg.materialId}</span> : null}
                  </div>

                  <div className="mt-auto flex gap-2 pt-4">
                    <Link
                      href={`/designer/${design.product?.id ?? ''}?designId=${design.id}`}
                      className="btn-ghost flex-1 py-2 text-[11px]"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Link>
                    <ReorderButton
                      designId={design.id}
                      className="btn-accent flex-1 py-2 text-[11px]"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Silence unused import — kept for locale reference
void formatCents;
void ShoppingBag;