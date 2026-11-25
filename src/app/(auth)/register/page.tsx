'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      window.location.assign('/dashboard');
      return;
    }

    setInfo('Check your email for a confirmation link to finish signup.');
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm">
      <p className="spec-label mb-3">Create account</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Start a project.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Configure, order and track print jobs across all six divisions.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="fullName" className="spec-label mb-1.5 block">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-base"
            placeholder="Alex Rivers"
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
            placeholder="At least 8 characters"
          />
        </div>

        {error ? (
          <p className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-sm border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
            {info}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}