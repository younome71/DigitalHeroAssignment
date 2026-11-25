import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ReorderButton } from '../ReorderButton';

export const dynamic = 'force-dynamic';

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: design } = await supabase
    .from('designs')
    .select(
      `id, name, template_id, config_snapshot, thumbnail_url, artwork_source, created_at, updated_at,
       product:products(id, name, min_width_mm, max_width_mm, min_height_mm, max_height_mm, allowed_materials, division:divisions(name))`,
    )
    .eq('id', id)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!design) notFound();

  const product = design.product as unknown as {
    id: string;
    name: string;
    allowed_materials: Array<{ id: string; label: string }>;
    division: { name: string } | null;
  } | null;

  let thumbUrl: string | null = null;
  if (design.thumbnail_url) {
    const { data: signed } = await supabase.storage
      .from('customer-artworks')
      .createSignedUrl(design.thumbnail_url, 60 * 60 * 2);
    thumbUrl = signed?.signedUrl ?? null;
  }

  const cfg = (design.config_snapshot ?? {}) as {
    widthMm?: number;
    heightMm?: number;
    materialId?: string | null;
    orientation?: string;
    quantity?: number;
  };

  const materialLabel = product?.allowed_materials.find(
    (m) => m.id === cfg.materialId,
  )?.label;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/designs"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> All designs
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-sm border border-line bg-surface p-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xs border border-line bg-canvas">
            {thumbUrl ? (
              <Image
                src={thumbUrl}
                alt={design.name}
                fill
                className="object-contain"
              />
            ) : (
              <p className="grid h-full w-full place-items-center text-xs text-ink-muted">
                No preview
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="spec-label">Design</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {design.name}
            </h1>
            <p className="mt-1 text-xs text-ink-muted">
              {product?.name} · {product?.division?.name}
            </p>
          </div>

          <div className="rounded-sm border border-line bg-surface p-4">
            <p className="spec-label mb-2">Saved spec</p>
            <dl className="space-y-1.5 text-xs">
              <Row
                label="Dimensions"
                value={`${Math.round(Number(cfg.widthMm))} × ${Math.round(Number(cfg.heightMm))}mm`}
              />
              <Row label="Quantity" value={String(cfg.quantity ?? '—')} />
              <Row label="Material" value={materialLabel ?? 'Standard'} />
              <Row label="Orientation" value={cfg.orientation ?? '—'} />
              <Row label="Artwork source" value={design.artwork_source} />
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href={`/designer/${product?.id ?? ''}?designId=${design.id}`}
              className="btn-ghost py-2.5 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit in designer
            </Link>
            <ReorderButton
              designId={design.id}
              className="btn-accent py-2.5 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}