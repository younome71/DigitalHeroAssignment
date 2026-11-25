'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { toggleTemplateActiveAction } from './actions';

export function TemplateActiveToggle({
  templateId,
  currentActive,
}: {
  templateId: string;
  currentActive: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      try {
        await toggleTemplateActiveAction(templateId, !currentActive);
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
        className={
          'rounded-xs border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ' +
          (currentActive
            ? 'border-success/30 bg-success/10 text-success hover:border-success'
            : 'border-line bg-canvas text-ink-muted hover:border-ink')
        }
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : currentActive ? (
          'Active'
        ) : (
          'Inactive'
        )}
      </button>
      {error ? <p className="text-[9px] text-danger">{error}</p> : null}
    </div>
  );
}