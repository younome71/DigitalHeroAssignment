import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center bg-ink text-xs font-bold text-white">
              DH
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Digital Heroes
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs text-ink-muted transition-colors hover:text-ink"
          >
            ← Back to site
          </Link>
        </header>
        <main className="grid flex-1 place-items-center px-6 py-12">
          {children}
        </main>
      </div>
    </div>
  );
}