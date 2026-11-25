'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { DivisionRow, GalleryItemRow } from '@/types/database';

interface GalleryItemWithDivision extends GalleryItemRow {
  division: Pick<DivisionRow, 'slug' | 'name'> | null;
}

interface Props {
  items: GalleryItemWithDivision[];
  divisions: DivisionRow[];
}

export function GalleryGrid({ items, divisions }: Props) {
  const [activeSlug, setActiveSlug] = useState<string>('all');

  const filtered = useMemo(() => {
    if (activeSlug === 'all') return items;
    return items.filter((i) => i.division?.slug === activeSlug);
  }, [items, activeSlug]);

  // Only show division filters that actually have items.
  const availableDivisions = useMemo(
    () =>
      divisions.filter((d) =>
        items.some((i) => i.division?.slug === d.slug),
      ),
    [divisions, items],
  );

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center gap-2">
        <FilterButton
          active={activeSlug === 'all'}
          onClick={() => setActiveSlug('all')}
        >
          All ({items.length})
        </FilterButton>
        {availableDivisions.map((d) => {
          const count = items.filter((i) => i.division?.slug === d.slug).length;
          return (
            <FilterButton
              key={d.id}
              active={activeSlug === d.slug}
              onClick={() => setActiveSlug(d.slug)}
            >
              {d.name} ({count})
            </FilterButton>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-sm border border-line bg-surface px-4 py-10 text-center text-sm text-ink-muted">
          No gallery items in this division yet.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="group overflow-hidden rounded-sm border border-line bg-surface"
            >
              <div className="relative aspect-[4/3] bg-canvas">
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                {item.featured ? (
                  <span className="absolute left-3 top-3 rounded-xs bg-accent px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
                    Featured
                  </span>
                ) : null}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <span className="tag">{item.division?.name ?? 'Work'}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold leading-tight">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {item.description}
                </p>
                {item.customer_name ? (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                    {item.customer_name}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xs border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-ink-soft hover:border-ink-soft',
      )}
    >
      {children}
    </button>
  );
}