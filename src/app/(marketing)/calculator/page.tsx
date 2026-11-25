import { createClient } from '@/lib/supabase/server';
import { PriceCalculator } from '@/components/marketing/price-calculator';
import { asProducts } from '@/lib/db-cast';

export const metadata = {
  title: 'Instant pricing',
  description:
    'Price any job across all six divisions with live volume discounts and VAT breakdown.',
};

export default async function CalculatorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();


  const [divisionsRes, productsRes] = await Promise.all([
    supabase
      .from('divisions')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true }),
  ]);

  const products = asProducts(productsRes.data ?? []);
  
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="spec-label">Instant pricing</p>
        <h1 className="mt-2 font-display text-display-lg">
          Price any job.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Pick a division and product, set dimensions, lock in volume pricing —
          live totals with VAT breakdown, updated as you type.
        </p>
      </div>

      <div className="my-10 spec-divider" />

      <PriceCalculator
        divisions={divisionsRes.data ?? []}
        products={products}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}