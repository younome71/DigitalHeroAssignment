import { createClient } from '@/lib/supabase/server';
import { GalleryGrid } from '@/components/marketing/gallery-grid';

export const metadata = {
  title: 'Live work',
  description:
    'Real jobs shipped across all six Digital Heroes divisions.',
};

export default async function GalleryPage() {
  const supabase = await createClient();

  const [itemsRes, divisionsRes] = await Promise.all([
    supabase
      .from('gallery_items')
      .select('*, division:divisions(slug, name)')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('divisions')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const items = itemsRes.data ?? [];
  const divisions = divisionsRes.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="spec-label">Gallery</p>
        <h1 className="mt-2 font-display text-display-lg">Live work.</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Real jobs shipped across all six divisions. Filter by division to see
          how the production floor handles different materials and finishes.
        </p>
      </div>

      <div className="my-10 spec-divider" />

      <GalleryGrid items={items} divisions={divisions} />
    </div>
  );
}