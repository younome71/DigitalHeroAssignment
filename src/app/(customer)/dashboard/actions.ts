'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  company_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
});

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const parsed = ProfileUpdateSchema.safeParse({
    full_name: formData.get('full_name') ?? '',
    company_name: formData.get('company_name') || null,
    phone: formData.get('phone') || null,
  });

  if (!parsed.success) {
    redirect(`/dashboard?profile_error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      company_name: parsed.data.company_name,
      phone: parsed.data.phone,
    })
    .eq('id', user.id);

  if (error) {
    redirect(`/dashboard?profile_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?profile_saved=1');
}