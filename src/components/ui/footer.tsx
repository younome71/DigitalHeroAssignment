import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center bg-ink text-xs font-bold text-white">
                DH
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">
                Digital Heroes
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              Six divisions. One production engine. Industrial precision,
              boutique finish.
            </p>
          </div>

          <div>
            <p className="spec-label mb-3">Divisions</p>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/divisions/labels-stickers" className="hover:text-ink">
                  Labels &amp; Stickers
                </Link>
              </li>
              <li>
                <Link href="/divisions/race-event-numbers" className="hover:text-ink">
                  Race &amp; Event Numbers
                </Link>
              </li>
              <li>
                <Link href="/divisions/mtb-boards" className="hover:text-ink">
                  MTB Boards
                </Link>
              </li>
              <li>
                <Link href="/divisions/stamps" className="hover:text-ink">
                  Stamps
                </Link>
              </li>
              <li>
                <Link href="/divisions/trophies" className="hover:text-ink">
                  Trophies
                </Link>
              </li>
              <li>
                <Link href="/divisions/laser-cut" className="hover:text-ink">
                  Laser-Cut Work
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="spec-label mb-3">Account</p>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li>
                <Link href="/calculator" className="hover:text-ink">
                  Instant pricing
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-ink">
                  Live work
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-ink">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-ink">
                  Create account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="spec-divider mt-10 mb-6" />

        <div className="flex flex-col gap-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Digital Heroes. All rights reserved.</p>
          <p className="font-mono">Built for production.</p>
        </div>
      </div>
    </footer>
  );
}