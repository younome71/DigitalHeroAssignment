import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import type { Profile } from '@/types/database';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const resolved: Profile | null = profile ?? null;

  return (
    <>
      <Navbar initialProfile={resolved} />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
    </>
  );
}