'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function toggleTemplateActiveAction(
  templateId: string,
  active: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') throw new Error('Forbidden');

  const admin = createAdminClient();
  const { error } = await admin
    .from('templates')
    .update({ active })
    .eq('id', templateId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/templates');
}