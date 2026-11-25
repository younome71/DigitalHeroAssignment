'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { setUserRoleAction } from './actions';

export function UserRoleToggle({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: 'customer' | 'admin';
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = currentRole === 'admin' ? 'customer' : 'admin';
    start(async () => {
      try {
        await setUserRoleAction(userId, next);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-xs border border-line bg-surface px-2 py-1 text-[10px] font-medium text-ink-soft hover:border-ink disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : currentRole === 'admin' ? (
          'Demote to customer'
        ) : (
          'Promote to admin'
        )}
      </button>
      {error ? <p className="text-[9px] text-danger">{error}</p> : null}
    </div>
  );
}