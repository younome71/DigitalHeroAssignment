import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  Package2,
  LayoutTemplate,
  Users,
  ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Production Queue', icon: Package2 },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/products', label: 'Products', icon: Package2 },
  { href: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/exports', label: 'Xero Exports', icon: FileSpreadsheet },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (me?.role !== 'admin') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar */}
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 lg:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center bg-white text-[10px] font-bold text-ink">
              DH
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">
              Digital Heroes
            </span>
            <span className="ml-2 rounded-xs bg-accent px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-white/60 sm:inline">{me.full_name}</span>
            <Link href="/" className="text-white/80 hover:text-white">
              View site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="hidden lg:block">
            <ul className="space-y-0.5">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between rounded-sm px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </span>
                      <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="min-w-0">
            {/* Mobile nav */}
            <div className="mb-4 flex flex-wrap gap-1 lg:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xs border border-line bg-surface px-2.5 py-1.5 text-[10px] font-medium text-ink-soft"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}