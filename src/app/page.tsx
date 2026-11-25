import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import type { Profile } from '@/types/database';

export const metadata = {
  title: 'Digital Heroes — Precision Print',
  description:
    'Six divisions. One production engine. Labels, race numbers, MTB boards, stamps, trophies and laser-cut work — designed and print-ready.',
};

export default async function HomePage() {
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

  const [divisionsRes, galleryRes] = await Promise.all([
    supabase
      .from('divisions')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('gallery_items')
      .select('*, division:divisions(slug, name)')
      .eq('active', true)
      .eq('featured', true)
      .order('sort_order', { ascending: true })
      .limit(6),
  ]);

  const divisions = divisionsRes.data ?? [];
  const gallery = galleryRes.data ?? [];

  return (
    <>
      <Navbar initialProfile={profile} />
      <main>
        {/* Hero -------------------------------------------------------- */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="grid-bg absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-xs border border-line bg-surface px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                  Six divisions · One production engine
                </span>
              </div>

              <h1 className="mt-6 font-display text-display-xl text-ink">
                Industrial print.
                <br />
                <span className="text-accent">Boutique finish.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
                Configure, price and order precision print across labels, race
                numbers, MTB boards, stamps, trophies and laser-cut work — from
                a single production floor.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link href="/calculator" className="btn-accent">
                  Instant pricing <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/gallery" className="btn-ghost">
                  See live work
                </Link>
              </div>

              <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-8">
                <Stat label="Divisions" value="6" />
                <Stat label="Production" value="48h+" />
                <Stat label="Delivery" value="NZ-wide" />
              </dl>
            </div>
          </div>
        </section>

        {/* Divisions --------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="spec-label">Catalogue</p>
              <h2 className="mt-2 font-display text-display-lg">
                Six divisions.
              </h2>
            </div>
            <Link
              href="/calculator"
              className="hidden text-sm text-ink-muted hover:text-ink sm:inline-flex sm:items-center sm:gap-1"
            >
              Price any job <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {divisions.map((division, idx) => (
              <Link
                key={division.id}
                href={`/divisions/${division.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-sm border border-line bg-surface p-6 transition-all hover:border-ink hover:shadow-lift"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs text-ink-muted tabular">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <h3 className="mt-8 font-display text-2xl font-semibold leading-tight">
                  {division.name}
                </h3>
                <p className="mt-2 text-sm text-ink-soft">{division.tagline}</p>
                <p className="mt-auto line-clamp-2 pt-8 text-xs leading-relaxed text-ink-muted">
                  {division.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured live work ------------------------------------------ */}
        {gallery.length > 0 ? (
          <section className="border-t border-line bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="spec-label">Live work</p>
                  <h2 className="mt-2 font-display text-display-lg">
                    On the floor.
                  </h2>
                </div>
                <Link
                  href="/gallery"
                  className="hidden text-sm text-ink-muted hover:text-ink sm:inline-flex sm:items-center sm:gap-1"
                >
                  Full gallery <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.map((item) => (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-sm border border-line bg-canvas"
                  >
                    <div className="relative aspect-[4/3] bg-canvas">
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <div className="p-5">
                      <span className="tag">{item.division?.name}</span>
                      <h3 className="mt-3 font-display text-lg font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Closing CTA ------------------------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-sm bg-ink p-10 sm:p-16">
            <div className="grid-bg absolute inset-0 opacity-10" />
            <div className="relative max-w-2xl">
              <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/60">
                <Sparkles className="h-3 w-3 text-accent" />
                Instant pricing
              </p>
              <h2 className="mt-4 font-display text-display-md text-white">
                Price a job in under a minute.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
                Pick a division, set dimensions, lock in volume pricing — no
                back-and-forth quotes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/calculator" className="btn-accent">
                  Open calculator <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-5 py-3 text-sm font-medium text-white transition-colors hover:border-white"
                >
                  Browse work
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="spec-label">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular">
        {value}
      </dd>
    </div>
  );
}