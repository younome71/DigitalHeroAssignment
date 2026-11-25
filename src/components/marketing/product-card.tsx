'use client';

import { CheckCircle2 } from 'lucide-react';
import type { ProductRow } from '@/types/database';
import { cn, formatCents, formatMm } from '@/lib/utils';

interface Props {
  product: ProductRow;
  selected: boolean;
  onSelect: () => void;
}

export function ProductCard({ product, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex h-full flex-col rounded-sm border bg-surface p-5 text-left transition-all',
        selected
          ? 'border-ink shadow-lift'
          : 'border-line hover:border-ink-soft',
      )}
    >
      {selected ? (
        <CheckCircle2 className="absolute right-4 top-4 h-4 w-4 text-accent" />
      ) : null}

      <p className="spec-label">Product</p>
      <h3 className="mt-1 font-display text-lg font-semibold leading-tight">
        {product.name}
      </h3>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">
        {product.description}
      </p>

      <div className="mt-auto pt-5">
        <div className="grid grid-cols-2 gap-3 text-[11px] tabular">
          <SpecLine
            label="Size range"
            value={`${formatMm(Number(product.min_width_mm))} × ${formatMm(Number(product.min_height_mm))} min`}
          />
          <SpecLine
            label="Max"
            value={`${formatMm(Number(product.max_width_mm))} × ${formatMm(Number(product.max_height_mm))}`}
          />
          <SpecLine
            label="Materials"
            value={`${product.allowed_materials.length}`}
          />
          <SpecLine
            label="Turnaround"
            value={`${product.turnaround_days} days`}
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="spec-label">From</span>
          <span className="font-display text-base font-semibold tabular">
            {formatCents(product.base_price_cents)}
          </span>
        </div>
      </div>
    </button>
  );
}

function SpecLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-ink-muted font-mono">
        {label}
      </p>
      <p className="mt-0.5 text-ink-soft">{value}</p>
    </div>
  );
}