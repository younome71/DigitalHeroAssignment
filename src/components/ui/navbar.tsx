
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { cn } from '@/lib/utils';

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Live Work' },
  { href: '/calculator', label: 'Pricing' },
] as const;

const CUSTOMER_LINKS = [
  { href: '/orders', label: 'Orders' },
  { href: '/designs', label: 'Designs' },
] as const;

interface NavbarProps {
  initialProfile: Profile | null;
}

export function Navbar({ initialProfile }: NavbarProps) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [userId, setUserId] = useState<string | null>(initialProfile?.id ?? null);
  const [open, setOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const initialProfileRef = useRef(initialProfile);
  initialProfileRef.current = initialProfile;

  useEffect(() => {
    if (!initialProfile) return;
    setProfile(initialProfile);
    setUserId(initialProfile.id);
  }, [initialProfile]);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setProfile(null);
        return;
      }

      // Ignore empty events. A missing session here is often a transient
      // initial callback, and treating it as sign-out wipes the server profile.
      const nextUserId = session?.user?.id;
      if (!nextUserId) return;

      setUserId(nextUserId);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const activeUserId = userId;
    let active = true;
    const supabase = createClient();

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeUserId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Failed to load profile:', error.message);
        return;
      }

      // Keep a server-rendered profile if this fetch raced the new session.
      if (!data && initialProfileRef.current?.id === activeUserId) return;

      setProfile(data ?? null);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  async function handleSignOut() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Failed to sign out:', error.message);
      return;
    }

    setUserId(null);
    setProfile(null);
    setOpen(false);

    router.refresh();
    router.push('/');
  }

  const signedIn = Boolean(userId);

  const navLinks = signedIn
    ? [...PUBLIC_LINKS, ...CUSTOMER_LINKS]
    : [...PUBLIC_LINKS];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center bg-ink text-xs font-bold text-white">
            DH
          </span>

          <span className="font-display text-lg font-semibold tracking-tight">
            Digital Heroes
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm transition-colors hover:text-ink',
                  active ? 'font-medium text-ink' : 'text-ink-muted',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? (
            <>
              {profile?.role === 'admin' ? (
                <Link href="/admin" className="btn-ghost py-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  Admin
                </Link>
              ) : null}

              <Link href="/dashboard" className="btn-ghost py-2 text-xs">
                <User className="h-3.5 w-3.5" />
                {profile?.full_name?.split(' ')[0] || 'Account'}
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-9 items-center gap-1 rounded-sm px-3 text-xs text-ink-muted transition-colors hover:text-ink"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost py-2 text-xs">
                Sign in
              </Link>

              <Link href="/register" className="btn-accent py-2 text-xs">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-sm text-ink md:hidden"
          aria-label="Toggle menu"
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-canvas md:hidden">
          <div className="space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-sm px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                {link.label}
              </Link>
            ))}

            <div className="spec-divider my-2" />

            {signedIn ? (
              <>
                {profile?.role === 'admin' ? (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="block rounded-sm px-3 py-2 text-sm text-accent hover:bg-surface"
                  >
                    Admin Console
                  </Link>
                ) : null}

                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-sm px-3 py-2 text-sm text-ink hover:bg-surface"
                >
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-ink hover:bg-surface"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-sm px-3 py-2 text-sm text-ink hover:bg-surface"
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="block rounded-sm px-3 py-2 text-sm text-accent hover:bg-surface"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
