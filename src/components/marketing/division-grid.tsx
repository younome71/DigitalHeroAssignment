'use client';

import { useState } from 'react';
import type { DivisionRow, ProductRow } from '@/types/database';
import { ProductCard } from './product-card';
import { PriceConfigurator } from './price-configurator';

interface Props {
  division: DivisionRow;
  products: ProductRow[];
  isAuthenticated: boolean;
}

export function DivisionGrid({ division, products, isAuthenticated }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    products[0]?.id ?? null,
  );
  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null;

  if (products.length === 0) {
    return (
      <p className="rounded-sm border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        No products available in this division yet.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            selected={product.id === selected?.id}
            onSelect={() => setSelectedId(product.id)}
          />
        ))}
      </div>

      {selected ? (
        <section id="configurator">
          <PriceConfigurator
            key={selected.id}
            product={selected}
            division={division}
            isAuthenticated={isAuthenticated}
          />
        </section>
      ) : null}
    </div>
  );
}