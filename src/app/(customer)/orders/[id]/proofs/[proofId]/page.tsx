import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProofApproval, type ProofLogEntry } from '@/components/customer/ProofApproval';

interface Params {
  id: string;
  proofId: string;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { proofId } = await params;
  return { title: `Proof ${proofId.slice(0, 8)}` };
}

export default async function ProofPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: orderId, proofId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/orders/${orderId}/proofs/${proofId}`)}`,
    );
  }

  // ---- Load proof (RLS scopes to owner or admin) --------------------
  const { data: proof } = await supabase
    .from('proofs')
    .select(
      `id, order_item_id, version, status, file_url, uploaded_by, approved_at, created_at, updated_at,
       order_items!inner(
         id, order_id, width_mm, height_mm, quantity,
         products!inner(name, slug, division:divisions(name, slug)),
         orders!inner(id, order_number, customer_id)
       )`,
    )
    .eq('id', proofId)
    .maybeSingle();

  if (!proof) notFound();

  const item = proof.order_items as unknown as {
    id: string;
    order_id: string;
    width_mm: number;
    height_mm: number;
    quantity: number;
    products: { name: string; slug: string; division: { name: string } | null };
    orders: { id: string; order_number: string; customer_id: string };
  };

  // Defence-in-depth ownership check (RLS already enforces via joins).
  if (item.orders.customer_id !== user.id) notFound();
  if (item.orders.id !== orderId) notFound();

  // ---- Latest proof check ------------------------------------------
  const { data: latest } = await supabase
    .from('proofs')
    .select('id, version, status')
    .eq('order_item_id', proof.order_item_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isLatestPending = latest?.id === proof.id && proof.status === 'pending';

  // ---- Logs --------------------------------------------------------
  const { data: logsRaw } = await supabase
    .from('proof_logs')
    .select('id, action, notes, created_at, user:profiles(full_name, role)')
    .eq('proof_id', proofId)
    .order('created_at', { ascending: false });

  const logs: ProofLogEntry[] = (logsRaw ?? []).map((log) => {
    const u = log.user as unknown as
      | { full_name: string | null; role: 'customer' | 'admin' | null }
      | null;
    return {
      id: log.id,
      action: log.action,
      notes: log.notes,
      createdAt: log.created_at,
      userName: u?.full_name ?? null,
      userRole: u?.role ?? null,
    };
  });

  // ---- Signed URL --------------------------------------------------
  const { data: signed } = await supabase.storage
    .from('proofs')
    .createSignedUrl(proof.file_url, 60 * 60 * 2);

  return (
    <ProofApproval
      proofId={proof.id}
      version={proof.version}
      status={proof.status}
      signedUrl={signed?.signedUrl ?? null}
      createdAt={proof.created_at}
      logs={logs}
      isLatestPending={isLatestPending}
      orderId={item.orders.id}
      orderNumber={item.orders.order_number}
      productName={item.products.name}
    />
  );
}