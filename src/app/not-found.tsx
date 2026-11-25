import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

export const metadata = {
  title: 'Page not found',
  description: 'The page you were looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          404 · Not found
        </span>

        <h1 className="mt-4 font-display text-display-xl text-ink">
          Lost in the
          <br />
          <span className="text-accent">production floor.</span>
        </h1>

        <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
          The page you were looking for doesn&apos;t exist, moved, or was
          never printed in the first place.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-accent">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link href="/gallery" className="btn-ghost">
            <Search className="h-4 w-4" />
            Browse live work
          </Link>
        </div>

        <div className="mt-16 grid w-full max-w-md grid-cols-3 gap-4 border-t border-line pt-8">
          <Link
            href="/calculator"
            className="group flex flex-col items-start text-left"
          >
            <span className="spec-label">Price</span>
            <span className="mt-1 text-xs font-medium text-ink group-hover:text-accent">
              Calculator →
            </span>
          </Link>
          <Link
            href="/login"
            className="group flex flex-col items-start text-left"
          >
            <span className="spec-label">Sign in</span>
            <span className="mt-1 text-xs font-medium text-ink group-hover:text-accent">
              Account →
            </span>
          </Link>
          <Link
            href="/gallery"
            className="group flex flex-col items-start text-left"
          >
            <span className="spec-label">Work</span>
            <span className="mt-1 text-xs font-medium text-ink group-hover:text-accent">
              Gallery →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}