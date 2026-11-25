'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const destination =
      next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    // Full navigation so the next request carries the new auth cookies
    // and server layouts can render the profile.
    window.location.assign(destination);
  }

  return (
    <div className="w-full max-w-sm">
      <p className="spec-label mb-3">Account access</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Welcome back.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Sign in to configure orders, approve proofs and reorder past work.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="spec-label mb-1.5 block">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
            placeholder="you@company.co.nz"
          />
        </div>
        <div>
          <label htmlFor="password" className="spec-label mb-1.5 block">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        New here?{' '}
        <Link href="/register" className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm h-72" />}>
      <LoginForm />
    </Suspense>
  );
}