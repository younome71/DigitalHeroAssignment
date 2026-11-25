'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

const NEXT_LABEL: Record<string, string> = {
  quote: 'Advance to Order',
  order: 'Advance to Artwork',
  artwork: 'Advance to Proof',
  proof: 'Advance to Production',
  production: 'Complete order',
  completed: 'Order is complete',
  cancelled: 'Order is cancelled',
};

export function OrderActionsPanel({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    currentStatus === 'completed' || currentStatus === 'cancelled';

  async function advance() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advance: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to advance');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div>
        <p className="text-[11px] text-ink-muted">
          Current stage · <span className="font-medium capitalize">{currentStatus}</span>
        </p>
        {error ? (
          <p className="mt-1 text-[11px] text-danger">{error}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={advance}
        disabled={disabled || busy}
        className="btn-accent py-2 text-xs disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        {NEXT_LABEL[currentStatus] ?? 'Advance'}
      </button>
    </div>
  );
}