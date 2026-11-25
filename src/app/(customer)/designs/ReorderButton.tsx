'use client';

import { useState } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';

export function ReorderButton({
  designId,
  className,
}: {
  designId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReorder() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reorder/${designId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || typeof data?.url !== 'string') {
        throw new Error(data?.error ?? 'Reorder failed');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleReorder}
        disabled={busy}
        className={className ?? 'btn-accent py-2 text-[11px]'}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ShoppingBag className="h-3 w-3" />
        )}
        {busy ? 'Opening…' : 'Reorder'}
      </button>
      {error ? (
        <p className="mt-1 w-full text-[10px] text-danger">{error}</p>
      ) : null}
    </>
  );
}