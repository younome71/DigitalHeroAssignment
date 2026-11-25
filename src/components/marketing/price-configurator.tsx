'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Layers,
  Ruler,
  Sparkles,
  RotateCw,
  Info,
} from 'lucide-react';
import type { ProductRow, DivisionRow } from '@/types/database';
import {
  nextDiscountTier,
  priceLine,
  toPriceableProduct,
} from '@/lib/pricing';
import { cn, formatCents, formatMm } from '@/lib/utils';

interface Props {
  product: ProductRow;
  division: Pick<DivisionRow, 'slug' | 'name' | 'accent_color'>;
  isAuthenticated: boolean;
}

const DEFAULT_QUANTITY = 100;

export function PriceConfigurator({ product, division, isAuthenticated }: Props) {
  const router = useRouter();
  const priceable = useMemo(
    () => toPriceableProduct(product, division.slug),
    [product, division.slug],
  );

  const [widthMm, setWidthMm] = useState<number>(
    Math.min(priceable.maxWidthMm, Math.max(priceable.minWidthMm, priceable.minWidthMm * 2)),
  );
  const [heightMm, setHeightMm] = useState<number>(
    Math.min(priceable.maxHeightMm, Math.max(priceable.minHeightMm, priceable.minHeightMm * 2)),
  );
  const [materialId, setMaterialId] = useState<string | null>(
    product.allowed_materials[0]?.id ?? null,
  );
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    product.allowed_orientations[0] ?? 'landscape',
  );
  const [quantity, setQuantity] = useState<number>(DEFAULT_QUANTITY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priced = useMemo(
    () =>
      priceLine(priceable, {
        productId: priceable.id,
        quantity,
        widthMm,
        heightMm,
        materialId,
        orientation,
      }),
    [priceable, quantity, widthMm, heightMm, materialId, orientation],
  );

  const subtotal = priced.discountedUnitPriceCents * quantity;
  const vat = Math.round((subtotal * priceable.vatPercent) / 100);
  const total = subtotal + vat;
  const nextTier = nextDiscountTier(
    priceable.volumeDiscountTiers,
    quantity,
  );

  function clampWidth(v: number) {
    if (Number.isNaN(v)) return;
    setWidthMm(Math.min(priceable.maxWidthMm, Math.max(priceable.minWidthMm, v)));
  }

  function clampHeight(v: number) {
    if (Number.isNaN(v)) return;
    setHeightMm(Math.min(priceable.maxHeightMm, Math.max(priceable.minHeightMm, v)));
  }

  function clampQuantity(v: number) {
    if (Number.isNaN(v)) return;
    setQuantity(Math.min(100_000, Math.max(1, Math.floor(v))));
  }

  function handleOrder() {
    setError(null);
    const params = new URLSearchParams({
      width: String(widthMm),
      height: String(heightMm),
      orientation,
      qty: String(quantity),
      ...(materialId ? { material: materialId } : {}),
    });
    const designerUrl = `/designer/${product.id}?${params.toString()}`;

    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(designerUrl)}`);
      return;
    }
    setLoading(true);
    router.push(designerUrl);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* Controls ---------------------------------------------------------- */}
      <div className="card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="spec-label">Configure</p>
            <h3 className="mt-1 font-display text-xl font-semibold">
              {product.name}
            </h3>
          </div>
          <div className="text-right">
            <p className="spec-label">From</p>
            <p className="font-display text-lg font-semibold tabular">
              {formatCents(
                Math.round(
                  priceable.basePriceCents *
                    (materialId
                      ? priceable.allowedMaterials.find((m) => m.id === materialId)
                          ?.priceMultiplier ?? 1
                      : 1),
                ),
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="width" className="spec-label mb-1.5 flex items-center gap-1">
              <Ruler className="h-3 w-3" /> Width (mm)
            </label>
            <input
              id="width"
              type="number"
              inputMode="decimal"
              value={widthMm}
              min={priceable.minWidthMm}
              max={priceable.maxWidthMm}
              step={1}
              onChange={(e) => clampWidth(Number(e.target.value))}
              className="input-base tabular"
            />
            <p className="mt-1 text-[10px] text-ink-muted tabular">
              {formatMm(priceable.minWidthMm)} – {formatMm(priceable.maxWidthMm)}
            </p>
          </div>

          <div>
            <label htmlFor="height" className="spec-label mb-1.5 flex items-center gap-1">
              <Ruler className="h-3 w-3 rotate-90" /> Height (mm)
            </label>
            <input
              id="height"
              type="number"
              inputMode="decimal"
              value={heightMm}
              min={priceable.minHeightMm}
              max={priceable.maxHeightMm}
              step={1}
              onChange={(e) => clampHeight(Number(e.target.value))}
              className="input-base tabular"
            />
            <p className="mt-1 text-[10px] text-ink-muted tabular">
              {formatMm(priceable.minHeightMm)} – {formatMm(priceable.maxHeightMm)}
            </p>
          </div>

          {product.allowed_materials.length > 0 ? (
            <div>
              <label htmlFor="material" className="spec-label mb-1.5 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Material
              </label>
              <select
                id="material"
                value={materialId ?? ''}
                onChange={(e) => setMaterialId(e.target.value || null)}
                className="input-base"
              >
                {product.allowed_materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.priceMultiplier !== 1
                      ? ` (×${m.priceMultiplier.toFixed(2)})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="orientation" className="spec-label mb-1.5 flex items-center gap-1">
              <RotateCw className="h-3 w-3" /> Orientation
            </label>
            <select
              id="orientation"
              value={orientation}
              onChange={(e) =>
                setOrientation(e.target.value as 'landscape' | 'portrait')
              }
              className="input-base capitalize"
            >
              {product.allowed_orientations.map((o) => (
                <option key={o} value={o} className="capitalize">
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="quantity" className="spec-label mb-1.5 block">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              value={quantity}
              min={1}
              step={1}
              onChange={(e) => clampQuantity(Number(e.target.value))}
              className="input-base tabular"
            />
            {nextTier ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent">
                <Sparkles className="h-3 w-3" />
                Add {nextTier.minQty - quantity} more for {nextTier.discountPercent}% off
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {/* Live price panel ------------------------------------------------ */}
      <div className="flex flex-col rounded-sm border border-line bg-ink text-white shadow-lift">
        <div className="border-b border-white/10 p-6">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-mono">
            Live price
          </p>
          <p className="mt-1 font-display text-4xl font-semibold tabular">
            {formatCents(total)}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {quantity} × {formatCents(priced.discountedUnitPriceCents)} ex VAT
          </p>
        </div>

        <div className="flex-1 space-y-3 p-6 text-sm">
          <Row
            label="Dimensions"
            value={`${Math.round(widthMm)} × ${Math.round(heightMm)} mm`}
          />
          <Row
            label="Area"
            value={`${priced.areaSqm.toFixed(3)} m²`}
          />
          <Row
            label="Material"
            value={priced.materialLabel ?? 'Standard'}
          />
          <Row label="Orientation" value={orientation} capitalize />

          <div className="border-t border-white/10 pt-3">
            <Row
              label="Unit price (pre-discount)"
              value={formatCents(priced.materialAdjustedCents)}
            />
            {priced.volumeDiscountPercent > 0 ? (
              <div className="mt-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-xs bg-accent px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-white">
                  <Sparkles className="h-3 w-3" />
                  {priced.volumeDiscountPercent}% volume discount
                </span>
                <span className="text-xs tabular text-white/80">
                  −{formatCents(priced.materialAdjustedCents - priced.discountedUnitPriceCents)}
                </span>
              </div>
            ) : null}
            <Row
              label="Unit price (final)"
              value={formatCents(priced.discountedUnitPriceCents)}
            />
          </div>

          <div className="border-t border-white/10 pt-3">
            <Row label="Subtotal (ex VAT)" value={formatCents(subtotal)} />
            <Row
              label={`VAT (${priceable.vatPercent.toFixed(0)}%)`}
              value={formatCents(vat)}
            />
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-medium">Total</span>
              <span className="font-display text-lg font-semibold tabular">
                {formatCents(total)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-6">
          <button
            type="button"
            onClick={handleOrder}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-sm bg-accent px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <span>{loading ? 'Redirecting…' : 'Design & Order'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-white/50">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            You will be able to attach artwork or design in the studio before
            payment is captured.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      <span
        className={cn('font-medium tabular', capitalize && 'capitalize')}
      >
        {value}
      </span>
    </div>
  );
}