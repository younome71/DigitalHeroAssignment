import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: job } = await admin
    .from('print_jobs')
    .select('id, file_url, file_type, status')
    .eq('id', jobId)
    .maybeSingle();

  if (!job?.file_url) {
    return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('print-jobs')
    .createSignedUrl(job.file_url, 60 * 60);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: 'Failed to create download URL' },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}