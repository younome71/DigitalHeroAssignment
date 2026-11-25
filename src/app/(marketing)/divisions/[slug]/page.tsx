import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DivisionGrid } from '@/components/marketing/division-grid';
import { asProducts } from '@/lib/db-cast';

interface Params {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: division } = await supabase
    .from('divisions')
    .select('name, tagline')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!division) return { title: 'Division not found' };
  return { title: division.name, description: division.tagline };
}

export default async function DivisionPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: division } = await supabase
    .from('divisions')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!division) notFound();

  const { data: productsRes } = await supabase
    .from('products')
    .select('*')
    .eq('division_id', division.id)
    .eq('active', true)
    .order('name', { ascending: true });
  
  const products = asProducts(productsRes ?? []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> All divisions
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="spec-label">Division</p>
          <h1 className="mt-2 font-display text-display-lg">{division.name}</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            {division.description}
          </p>
        </div>
        <div className="rounded-sm border border-line bg-surface px-5 py-4">
          <p className="spec-label">Products</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular">
            {products?.length ?? 0}
          </p>
        </div>
      </div>

      <div className="my-10 spec-divider" />

      <DivisionGrid
        division={division}
        products={products ?? []}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}