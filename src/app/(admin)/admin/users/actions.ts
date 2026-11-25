'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function setUserRoleAction(userId: string, role: 'customer' | 'admin') {
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
  if (userId === user.id) throw new Error('Cannot change your own role');

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}