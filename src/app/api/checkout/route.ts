import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CheckoutSchema } from '@/lib/validators/checkout';
import {
  PricingError,
  priceOrder,
  toPriceableProduct,
  type PriceableProductWithMeta,
} from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { sendOrderConfirmationEmail } from '@/lib/resend';
import { asProducts } from '@/lib/db-cast';
import { asJson, type OrderSpecSnapshot } from '@/types/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ---- 1. Authenticate ------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }

  // ---- 2. Validate body -----------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid checkout payload',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { lines, shippingAddress, notes } = parsed.data;
  const productIds = Array.from(new Set(lines.map((l) => l.productId)));

  // ---- 3. Load products -----------------------------------------------
  const { data: rawProducts, error: productError } = await supabase
    .from('products')
    .select('*, division:divisions(slug)')
    .in('id', productIds)
    .eq('active', true);

  if (productError || !rawProducts || rawProducts.length !== productIds.length) {
    return NextResponse.json(
      { error: 'One or more products are unavailable' },
      { status: 400 },
    );
  }

  const productRows = asProducts(rawProducts);

  const productMap: Record<string, PriceableProductWithMeta> = {};
  for (const row of productRows) {
    productMap[row.id] = toPriceableProduct(
      row,
      (row as unknown as { division?: { slug: string } | null }).division?.slug ?? '',
    );
  }

  // ---- 4. Verify design ownership -------------------------------------
  const designIds = Array.from(
    new Set(lines.map((l) => l.designId).filter((v): v is string => Boolean(v))),
  );
  const designMap = new Map<string, { product_id: string }>();
  if (designIds.length > 0) {
    const { data: designs } = await supabase
      .from('designs')
      .select('id, product_id, customer_id')
      .in('id', designIds)
      .eq('customer_id', user.id);
    for (const d of designs ?? []) {
      designMap.set(d.id, { product_id: d.product_id });
    }
    if (designMap.size !== designIds.length) {
      return NextResponse.json(
        {
          error:
            'One or more designs could not be found or are not owned by you',
        },
        { status: 400 },
      );
    }
    for (const line of lines) {
      if (!line.designId) continue;
      const ref = designMap.get(line.designId);
      if (!ref || ref.product_id !== line.productId) {
        return NextResponse.json(
          { error: 'Design does not match product for this line' },
          { status: 400 },
        );
      }
    }
  }

  // ---- 5. Recompute price --------------------------------------------
  let priced;
  try {
    priced = priceOrder(productMap, lines);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json(
        { error: 'Pricing validation failed', issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Failed to price order' }, { status: 500 });
  }

  // ---- 6. Persist order + items --------------------------------------
  const admin = createAdminClient();

  const { data: orderRow, error: orderError } = await admin
    .from('orders')
    .insert({
      customer_id: profile.id,
      status: 'quote',
      currency: priced.currency,
      subtotal_cents: priced.subtotalCents,
      discount_cents: priced.discountCents,
      vat_cents: priced.vatCents,
      total_cents: priced.totalCents,
      shipping_address: shippingAddress ?? null,
      notes: notes ?? null,
    })
    .select('*')
    .single();

  if (orderError || !orderRow) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  const snapshotFor = (idx: number): OrderSpecSnapshot => {
    const line = priced.lines[idx];
    const product = productMap[line.productId];
    return {
      productSlug: product.slug,
      productName: product.name,
      divisionSlug: product.divisionSlug,
      material: line.materialId,
      widthMm: line.widthMm,
      heightMm: line.heightMm,
      orientation: line.orientation,
      unitPriceCents: line.discountedUnitPriceCents,
      quantity: line.quantity,
      volumeDiscountPercent: line.volumeDiscountPercent,
      vatPercent: priced.vatPercent,
      templateId: null,
    };
  };

  const itemInserts = priced.lines.map((line, idx) => {
    const sourceLine = lines[idx];
    return {
      order_id: orderRow.id,
      product_id: line.productId,
      design_id: sourceLine.designId ?? null,
      quantity: line.quantity,
      width_mm: line.widthMm,
      height_mm: line.heightMm,
      material: line.materialId,
      orientation: line.orientation,
      unit_price_cents: line.discountedUnitPriceCents,
      line_total_cents: line.discountedUnitPriceCents * line.quantity,
      spec_snapshot: asJson(snapshotFor(idx)),
      production_status: 'order' as const,
    };
  });

  const { error: itemsError } = await admin.from('order_items').insert(itemInserts);

  if (itemsError) {
    await admin.from('orders').delete().eq('id', orderRow.id);
    return NextResponse.json(
      { error: 'Failed to create order items' },
      { status: 500 },
    );
  }

  // ---- 7. Stripe Checkout OR mock fallback ---------------------------
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin;

  const stripe = getStripe();

  if (!stripe) {
    // Mock checkout — mark paid, send email, redirect to dashboard.
    const { error: mockError } = await admin
      .from('orders')
      .update({ status: 'order', paid_at: new Date().toISOString() })
      .eq('id', orderRow.id);

    if (mockError) {
      return NextResponse.json(
        { error: 'Failed to finalize mock order' },
        { status: 500 },
      );
    }

    await sendOrderConfirmationEmail({
      to: profile.email,
      customerName: profile.full_name ?? '',
      orderNumber: orderRow.order_number,
      orderId: orderRow.id,
      itemCount: priced.lines.length,
      totalCents: orderRow.total_cents,
    });

    return NextResponse.json({
      url: `${siteUrl}/dashboard?order=${orderRow.id}&mock_checkout=1`,
      mock: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
    });
  }

  // Real Stripe Checkout — append VAT line item so charged total matches
  // `orders.total_cents`.
  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      priced.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: priced.currency.toLowerCase(),
          unit_amount: line.discountedUnitPriceCents,
          product_data: {
            name: line.productName,
            description: [
              line.materialLabel,
              `${Math.round(line.widthMm)} × ${Math.round(line.heightMm)}mm`,
              line.orientation,
            ]
              .filter(Boolean)
              .join(' · '),
          },
        },
      }));

    if (priced.vatCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: priced.currency.toLowerCase(),
          unit_amount: priced.vatCents,
          product_data: {
            name: `VAT (${priced.vatPercent.toFixed(0)}%)`,
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: profile.email,
      client_reference_id: orderRow.id,
      metadata: {
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        customerId: profile.id,
      },
      line_items: lineItems,
      success_url: `${siteUrl}/dashboard?order=${orderRow.id}&checkout=success`,
      cancel_url: `${siteUrl}/calculator?checkout=cancelled&order=${orderRow.id}`,
      allow_promotion_codes: false,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL' },
        { status: 500 },
      );
    }

    await admin
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', orderRow.id);

    return NextResponse.json({
      url: session.url,
      mock: false,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
    });
  } catch (err) {
    await admin.from('orders').delete().eq('id', orderRow.id);
    const message = err instanceof Error ? err.message : 'Stripe checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}