import 'server-only';
import { Resend } from 'resend';
import { formatCents } from './utils';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'orders@digitalheroes.example';
const ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL ?? null;

let cached: Resend | null | undefined;

function getClient(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY;
  cached = key ? new Resend(key) : null;
  return cached;
}

export interface SendResult {
  ok: boolean;
  delivered: boolean;
  id?: string;
  error?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    console.log('[resend:fallback]', {
      to,
      subject,
      preview: html.replace(/\s+/g, ' ').slice(0, 240),
    });
    return { ok: false, delivered: false, error: 'no-api-key' };
  }
  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to: [to],
      subject,
      html,
    });
    if (error) return { ok: false, delivered: false, error: error.message };
    return { ok: true, delivered: true, id: data?.id };
  } catch (err) {
    return { ok: false, delivered: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Shared HTML skeleton (Boutique-Industrial tone)
// ---------------------------------------------------------------------------
function shell(title: string, body: string, ctaUrl: string, ctaLabel: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F5F0;font-family:Inter,Helvetica,Arial,sans-serif;color:#141413;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F5F0;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #DDD9D1;">
          <tr><td style="padding:24px 24px 0;">
            <p style="margin:0;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#7A7974;">Digital Heroes</p>
            <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;letter-spacing:-0.02em;">${title}</h1>
          </td></tr>
          <tr><td style="padding:16px 24px;font-size:14px;line-height:1.6;color:#3D3C38;">${body}</td></tr>
          <tr><td style="padding:8px 24px 28px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#E85D04;color:#FFFFFF;text-decoration:none;padding:12px 20px;font-size:13px;font-weight:600;">${ctaLabel}</a>
          </td></tr>
          <tr><td style="border-top:1px solid #DDD9D1;padding:14px 24px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#7A7974;">
            Industrial print. Boutique finish.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// Order confirmation
// ---------------------------------------------------------------------------
export async function sendOrderConfirmationEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  itemCount: number;
  totalCents: number;
}): Promise<SendResult> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';;
  return send({
    to: args.to,
    subject: `Order ${args.orderNumber} confirmed — Digital Heroes`,
    html: shell(
      `Order ${args.orderNumber} is confirmed.`,
      `<p>Hi ${args.customerName || 'there'},</p>
       <p>Payment received. Your order — <strong>${args.itemCount} line item${args.itemCount === 1 ? '' : 's'}</strong> totalling <strong>${formatCents(args.totalCents)}</strong> — is now in our production queue.</p>
       <p>We'll email you again the moment your first proof is ready for review.</p>`,
      `${siteUrl}/orders/${args.orderId}`,
      'View order',
    ),
  });
}

// ---------------------------------------------------------------------------
// Proof ready
// ---------------------------------------------------------------------------
export async function sendProofReadyEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  proofId: string;
  version: number;
}): Promise<SendResult> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';;
  return send({
    to: args.to,
    subject: `Proof v${args.version} ready for your review — ${args.orderNumber}`,
    html: shell(
      `Proof v${args.version} is ready.`,
      `<p>Hi ${args.customerName || 'there'},</p>
       <p>Production has uploaded <strong>v${args.version}</strong> of your proof for order <strong>${args.orderNumber}</strong>.</p>
       <p>Please review and either approve, or send us change requests. Production starts as soon as you approve.</p>`,
      `${siteUrl}/orders/${args.orderId}/proofs/${args.proofId}`,
      'Review proof',
    ),
  });
}

// ---------------------------------------------------------------------------
// Proof decision
// ---------------------------------------------------------------------------
export async function sendProofDecisionEmail(args: {
  toCustomer: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  proofId: string;
  version: number;
  decision: 'approved' | 'rejected';
  notes?: string;
}): Promise<{ customer: SendResult; admin: SendResult | null }> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';;
  const verb = args.decision === 'approved' ? 'approved' : 'rejected';

  const customer = await send({
    to: args.toCustomer,
    subject: `Proof v${args.version} ${verb} — ${args.orderNumber}`,
    html: shell(
      `You ${verb} proof v${args.version}.`,
      `<p>Hi ${args.customerName || 'there'},</p>
       <p>We've logged your decision on <strong>proof v${args.version}</strong> for order <strong>${args.orderNumber}</strong>.</p>
       ${
         args.decision === 'approved'
           ? '<p>Production is now underway. We\'ll notify you when your order is ready to ship.</p>'
           : '<p>Our team will incorporate your feedback and upload a new proof version shortly.</p>'
       }
       ${args.notes ? `<p><em>Your notes:</em> ${escapeHtml(args.notes)}</p>` : ''}`,
      `${siteUrl}/orders/${args.orderId}`,
      'View order',
    ),
  });

  let admin: SendResult | null = null;
  if (ADMIN_EMAIL) {
    admin = await send({
      to: ADMIN_EMAIL,
      subject: `[Action] ${args.orderNumber} — customer ${verb} v${args.version}`,
      html: shell(
        `Customer ${verb} proof v${args.version}.`,
        `<p>Order <strong>${args.orderNumber}</strong>. ${args.decision === 'approved' ? 'Proceed to production.' : 'Upload revised proof.'}</p>
         ${args.notes ? `<p><em>Notes:</em> ${escapeHtml(args.notes)}</p>` : ''}`,
        `${siteUrl}/admin/orders/${args.orderId}`,
        'Open order',
      ),
    });
  }

  return { customer, admin };
}

// ---------------------------------------------------------------------------
// Order completed
// ---------------------------------------------------------------------------
export async function sendOrderCompletedEmail(args: {
  to: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
}): Promise<SendResult> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';;
  return send({
    to: args.to,
    subject: `Order ${args.orderNumber} completed — Digital Heroes`,
    html: shell(
      `Order ${args.orderNumber} is complete.`,
      `<p>Hi ${args.customerName || 'there'},</p>
       <p>Your order is finished and leaving our floor. Thank you for trusting Digital Heroes with your production.</p>
       <p>You can re-order any saved design in one click from your dashboard.</p>`,
      `${siteUrl}/designs`,
      'Reorder a design',
    ),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}