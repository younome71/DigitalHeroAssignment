'use client';

import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';

export function XeroExportButton({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/exports/xero', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers
          .get('content-disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ?? 'xero-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || busy}
        className="btn-accent py-2 text-xs disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {busy ? 'Generating…' : 'Export to CSV'}
      </button>
      {error ? <p className="text-[10px] text-danger">{error}</p> : null}
    </div>
  );
}