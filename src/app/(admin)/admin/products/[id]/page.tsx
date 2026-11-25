import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProductEditForm } from './ProductEditForm';
import { asProduct } from '@/lib/db-cast';

export const dynamic = 'force-dynamic';

export default async function ProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: rawProduct } = await supabase
    .from('products')
    .select('*, division:divisions(name, slug)')
    .eq('id', id)
    .maybeSingle();

  if (!rawProduct) notFound();
  const product = asProduct(rawProduct);

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> Products
      </Link>

      <h1 className="mt-3 font-display text-display-md">{product.name}</h1>
      <p className="mt-1 text-xs text-ink-muted">
        {(product.division as unknown as { name: string })?.name}
      </p>

      {sp.saved ? (
        <p className="mt-4 rounded-sm border border-success/30 bg-success/5 px-4 py-2 text-xs text-success">
          Product updated.
        </p>
      ) : null}
      {sp.error ? (
        <p className="mt-4 rounded-sm border border-danger/30 bg-danger/5 px-4 py-2 text-xs text-danger">
          {sp.error}
        </p>
      ) : null}

      <ProductEditForm product={product} />
    </div>
  );
}