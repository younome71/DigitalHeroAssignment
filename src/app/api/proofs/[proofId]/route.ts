import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ proofId: string }> },
) {
  const { proofId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // RLS scopes this to the owning customer or admin.
  const { data: proof, error: proofErr } = await supabase
    .from('proofs')
    .select('*')
    .eq('id', proofId)
    .maybeSingle();

  if (proofErr || !proof) {
    return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
  }

  const { data: logs } = await supabase
    .from('proof_logs')
    .select('id, action, notes, created_at, user:profiles(id, full_name, role)')
    .eq('proof_id', proofId)
    .order('created_at', { ascending: false });

  const { data: signed } = await supabase.storage
    .from('proofs')
    .createSignedUrl(proof.file_url, 60 * 60 * 2);

  return NextResponse.json({
    proof: {
      id: proof.id,
      orderItemId: proof.order_item_id,
      version: proof.version,
      status: proof.status,
      uploadedBy: proof.uploaded_by,
      approvedAt: proof.approved_at,
      createdAt: proof.created_at,
      updatedAt: proof.updated_at,
      signedUrl: signed?.signedUrl ?? null,
    },
    logs: (logs ?? []).map((l) => ({
      id: l.id,
      action: l.action,
      notes: l.notes,
      createdAt: l.created_at,
      user: l.user,
    })),
  });
}