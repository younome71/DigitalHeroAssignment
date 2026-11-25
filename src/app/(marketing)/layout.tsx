import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import type { Profile } from '@/types/database';

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = data ?? null;
  }

  return (
    <>
      <Navbar initialProfile={profile} />
      <main>{children}</main>
      <Footer />
    </>
  );
}