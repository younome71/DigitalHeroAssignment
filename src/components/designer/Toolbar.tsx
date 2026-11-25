'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Eye,
  Image as ImageIcon,
  Loader2,
  Redo2,
  Save,
  ShoppingBag,
  Type,
  Undo2,
} from 'lucide-react';
import { useDesignerStore } from '@/hooks/useDesignerStore';

interface Props {
  onSave: () => void;
  onCheckout: () => void;
  saving: boolean;
  checkingOut: boolean;
  divisionSlug: string;
  productName: string;
}

export function Toolbar({
  onSave,
  onCheckout,
  saving,
  checkingOut,
  divisionSlug,
  productName,
}: Props) {
  const addTextElement = useDesignerStore((s) => s.addTextElement);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const past = useDesignerStore((s) => s.past);
  const future = useDesignerStore((s) => s.future);
  const designName = useDesignerStore((s) => s.designName);
  const setDesignName = useDesignerStore((s) => s.setDesignName);
  const setProofPreviewOpen = useDesignerStore((s) => s.setProofPreviewOpen);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/divisions/${divisionSlug}`}
            className="flex h-9 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs text-ink-soft transition-colors hover:border-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold leading-tight">
              {productName}
            </p>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              className="truncate text-[11px] text-ink-muted outline-none focus:text-ink"
              placeholder="Untitled design"
              aria-label="Design name"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Add text"
            onClick={addTextElement}
            icon={<Type className="h-4 w-4" />}
          />
          <ToolbarButton
            label="Undo"
            onClick={undo}
            disabled={past.length === 0}
            icon={<Undo2 className="h-4 w-4" />}
          />
          <ToolbarButton
            label="Redo"
            onClick={redo}
            disabled={future.length === 0}
            icon={<Redo2 className="h-4 w-4" />}
          />
          <ToolbarButton
            label="Preview"
            onClick={() => setProofPreviewOpen(true)}
            icon={<Eye className="h-4 w-4" />}
          />

          <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

          <button
            type="button"
            onClick={onSave}
            disabled={saving || checkingOut}
            className="hidden items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50 sm:inline-flex"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={saving || checkingOut}
            className="btn-accent hidden py-2 text-xs sm:inline-flex"
          >
            {checkingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShoppingBag className="h-3.5 w-3.5" />
            )}
            {checkingOut ? 'Opening…' : 'Checkout'}
          </button>
        </div>
      </div>
    </header>
  );
}

function ToolbarButton({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink disabled:opacity-40"
    >
      {icon}
    </button>
  );
}