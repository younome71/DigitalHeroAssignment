'use client';

import { useMemo, useState } from 'react';
import type { DivisionRow, ProductRow } from '@/types/database';
import { cn } from '@/lib/utils';
import { PriceConfigurator } from './price-configurator';

interface Props {
  divisions: DivisionRow[];
  products: ProductRow[];
  isAuthenticated: boolean;
}

export function PriceCalculator({
  divisions,
  products,
  isAuthenticated,
}: Props) {
  const [divisionSlug, setDivisionSlug] = useState<string>(
    divisions[0]?.slug ?? '',
  );

  const division = useMemo(
    () => divisions.find((d) => d.slug === divisionSlug) ?? divisions[0] ?? null,
    [divisions, divisionSlug],
  );

  const divisionProducts = useMemo(() => {
    if (!division) return [];
    return products.filter((p) => p.division_id === division.id);
  }, [products, division]);

  const [productId, setProductId] = useState<string>(
    divisionProducts[0]?.id ?? '',
  );

  // Ensure product selection stays valid when division changes.
  const resolvedProductId = useMemo(() => {
    if (divisionProducts.some((p) => p.id === productId)) return productId;
    return divisionProducts[0]?.id ?? '';
  }, [divisionProducts, productId]);

  const product = useMemo(
    () => divisionProducts.find((p) => p.id === resolvedProductId) ?? null,
    [divisionProducts, resolvedProductId],
  );

  if (divisions.length === 0) {
    return (
      <p className="rounded-sm border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        No divisions available.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Division pills ---------------------------------------------- */}
      <div>
        <p className="spec-label mb-3">1 — Division</p>
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDivisionSlug(d.slug);
                setProductId('');
              }}
              className={cn(
                'rounded-xs border px-3 py-1.5 text-xs font-medium transition-colors',
                d.slug === divisionSlug
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-ink-soft',
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product selector ------------------------------------------- */}
      {divisionProducts.length > 0 ? (
        <div>
          <p className="spec-label mb-3">2 — Product</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {divisionProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                className={cn(
                  'rounded-sm border p-4 text-left transition-all',
                  p.id === resolvedProductId
                    ? 'border-ink bg-surface shadow-lift'
                    : 'border-line bg-surface hover:border-ink-soft',
                )}
              >
                <p className="font-display text-sm font-semibold leading-tight">
                  {p.name}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-sm border border-line bg-surface px-4 py-4 text-sm text-ink-muted">
          No products available in this division.
        </p>
      )}

      {/* Configurator ------------------------------------------------ */}
      {division && product ? (
        <div>
          <p className="spec-label mb-3">3 — Configure</p>
          <PriceConfigurator
            key={product.id}
            product={product}
            division={division}
            isAuthenticated={isAuthenticated}
          />
        </div>
      ) : null}
    </div>
  );
}