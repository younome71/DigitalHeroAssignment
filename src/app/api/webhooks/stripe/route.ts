import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderConfirmationEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook receiver.
 * Verified via signature — must NOT be gated by auth middleware
 * (excluded via matcher in src/middleware.ts).
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret is not configured' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Signature verification failed';
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
            case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          session.metadata?.orderId ?? session.client_reference_id;

        if (!orderId) {
          return NextResponse.json(
            { error: 'Session is missing orderId metadata' },
            { status: 400 },
          );
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        const { error: updateError } = await admin
          .from('orders')
          .update({
            status: 'order',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq('id', orderId)
          .eq('status', 'quote'); // idempotency

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update order' },
            { status: 500 },
          );
        }

        // Load customer + totals for the confirmation email.
        const { data: full } = await admin
          .from('orders')
          .select(
            'id, order_number, total_cents, customer:profiles!inner(email, full_name), items:order_items(id)',
          )
          .eq('id', orderId)
          .maybeSingle();

        if (full) {
          const customer = full.customer as unknown as {
            email: string;
            full_name: string | null;
          };
          const itemCount = Array.isArray(full.items) ? full.items.length : 0;
          await sendOrderConfirmationEmail({
            to: customer.email,
            customerName: customer.full_name ?? '',
            orderNumber: full.order_number,
            orderId: full.id,
            itemCount,
            totalCents: full.total_cents,
          });
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId =
          session.metadata?.orderId ?? session.client_reference_id;

        if (orderId) {
          // Cancel the abandoned quote — the customer can re-order cleanly.
          await admin
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('status', 'quote');
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.orderId;

        if (orderId) {
          await admin
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('status', 'quote');
        }
        break;
      }

      default:
        // Acknowledge other events without side effects.
        break;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected webhook handler error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}