import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  priceOrder,
  toPriceableProduct,
  PricingError,
  type PriceableProductWithMeta,
} from '@/lib/pricing';
import { getStripe } from '@/lib/stripe';
import { sendOrderConfirmationEmail } from '@/lib/resend';
import { asProduct } from '@/lib/db-cast';
import { asJson } from '@/types/database';
import type { CartLineInput } from '@/types/pricing';
import type { OrderSpecSnapshot } from '@/types/database';

export const runtime = 'nodejs';

interface ConfigSnapshotShape {
  widthMm?: number;
  heightMm?: number;
  materialId?: string | null;
  orientation?: 'landscape' | 'portrait';
  quantity?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ designId: string }> },
) {
  const { designId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }

  const { data: design } = await supabase
    .from('designs')
    .select('id, customer_id, product_id, config_snapshot')
    .eq('id', designId)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 });
  }

  const cfg = (design.config_snapshot ?? {}) as ConfigSnapshotShape;
  if (
    typeof cfg.widthMm !== 'number' ||
    typeof cfg.heightMm !== 'number' ||
    typeof cfg.quantity !== 'number' ||
    (cfg.orientation !== 'landscape' && cfg.orientation !== 'portrait')
  ) {
    return NextResponse.json(
      { error: 'Design is missing a valid config_snapshot' },
      { status: 400 },
    );
  }

  const { data: rawProduct } = await supabase
    .from('products')
    .select('*, division:divisions(slug)')
    .eq('id', design.product_id)
    .eq('active', true)
    .maybeSingle();

  if (!rawProduct) {
    return NextResponse.json(
      { error: 'Product is no longer available' },
      { status: 400 },
    );
  }

  const product = asProduct(rawProduct);
  const divisionSlug =
    (rawProduct as unknown as { division?: { slug: string } | null }).division
      ?.slug ?? '';

  const priceable = toPriceableProduct(product, divisionSlug);
  const productMap: Record<string, PriceableProductWithMeta> = {
    [product.id]: priceable,
  };

  const line: CartLineInput = {
    productId: product.id,
    quantity: cfg.quantity,
    widthMm: cfg.widthMm,
    heightMm: cfg.heightMm,
    materialId: cfg.materialId ?? null,
    orientation: cfg.orientation,
  };

  let priced;
  try {
    priced = priceOrder(productMap, [line]);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json(
        { error: 'Pricing validation failed', issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Failed to price order' }, { status: 500 });
  }

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      customer_id: profile.id,
      status: 'quote',
      currency: priced.currency,
      subtotal_cents: priced.subtotalCents,
      discount_cents: priced.discountCents,
      vat_cents: priced.vatCents,
      total_cents: priced.totalCents,
    })
    .select('id, order_number')
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  const line0 = priced.lines[0];
  const snapshot: OrderSpecSnapshot = {
    productSlug: priceable.slug,
    productName: priceable.name,
    divisionSlug: priceable.divisionSlug,
    material: line0.materialId,
    widthMm: line0.widthMm,
    heightMm: line0.heightMm,
    orientation: line0.orientation,
    unitPriceCents: line0.discountedUnitPriceCents,
    quantity: line0.quantity,
    volumeDiscountPercent: line0.volumeDiscountPercent,
    vatPercent: priced.vatPercent,
    templateId: null,
  };

  const { error: itemsErr } = await admin.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    design_id: design.id,
    quantity: line0.quantity,
    width_mm: line0.widthMm,
    height_mm: line0.heightMm,
    material: line0.materialId,
    orientation: line0.orientation,
    unit_price_cents: line0.discountedUnitPriceCents,
    line_total_cents: line0.discountedUnitPriceCents * line0.quantity,
    spec_snapshot: asJson(snapshot),
    production_status: 'order',
  });

  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id);
    return NextResponse.json(
      { error: 'Failed to create order item' },
      { status: 500 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin;

  const stripe = getStripe();

  if (!stripe) {
    await admin
      .from('orders')
      .update({ status: 'order', paid_at: new Date().toISOString() })
      .eq('id', order.id);

    await sendOrderConfirmationEmail({
      to: profile.email,
      customerName: profile.full_name ?? '',
      orderNumber: order.order_number,
      orderId: order.id,
      itemCount: 1,
      totalCents: priced.totalCents,
    });

    return NextResponse.json({
      url: `${siteUrl}/orders/${order.id}?mock_checkout=1`,
      mock: true,
      orderId: order.id,
    });
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: line0.quantity,
      price_data: {
        currency: priced.currency.toLowerCase(),
        unit_amount: line0.discountedUnitPriceCents,
        product_data: {
          name: line0.productName,
          description: `${Math.round(line0.widthMm)} × ${Math.round(line0.heightMm)}mm · ${line0.orientation}`,
        },
      },
    },
  ];

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
    client_reference_id: order.id,
    metadata: {
      orderId: order.id,
      orderNumber: order.order_number,
      customerId: profile.id,
      reorderOf: designId,
    },
    line_items: lineItems,
    success_url: `${siteUrl}/orders/${order.id}?checkout=success`,
    cancel_url: `${siteUrl}/designs/${designId}?checkout=cancelled`,
    allow_promotion_codes: false,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
  });

  if (!session.url) {
    await admin.from('orders').delete().eq('id', order.id);
    return NextResponse.json(
      { error: 'Stripe did not return a URL' },
      { status: 500 },
    );
  }

  await admin
    .from('orders')
    .update({ stripe_session_id: session.id })
    .eq('id', order.id);

  return NextResponse.json({ url: session.url, mock: false, orderId: order.id });
}