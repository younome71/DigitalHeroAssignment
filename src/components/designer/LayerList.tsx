'use client';

import { Eye, EyeOff, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useDesignerStore } from '@/hooks/useDesignerStore';
import { cn } from '@/lib/utils';

export function LayerList() {
  const elements = useDesignerStore((s) => s.elements);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const selectElement = useDesignerStore((s) => s.selectElement);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const removeElement = useDesignerStore((s) => s.removeElement);
  const bringForward = useDesignerStore((s) => s.bringForward);
  const sendBackward = useDesignerStore((s) => s.sendBackward);

  if (elements.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-xs text-ink-muted">
        No layers yet. Add a text element or upload an image.
      </div>
    );
  }

  // Render topmost first (reverse of render order).
  const ordered = [...elements].reverse();

  return (
    <ul className="divide-y divide-line">
      {ordered.map((el) => (
        <li
          key={el.id}
          className={cn(
            'group flex items-center gap-2 px-3 py-2 transition-colors',
            selectedId === el.id ? 'bg-accent-soft' : 'hover:bg-canvas',
          )}
        >
          <button
            type="button"
            onClick={() => selectElement(el.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-xs bg-surface font-mono text-[9px] uppercase text-ink-muted">
              {el.type === 'text' ? 'T' : 'I'}
            </span>
            <span className="truncate text-xs text-ink">
              {el.type === 'text' ? el.text || 'Text layer' : 'Image layer'}
            </span>
          </button>

          <div className="flex items-center">
            <IconAction
              title="Toggle visibility"
              onClick={() =>
                updateElement(el.id, { visible: !el.visible })
              }
            >
              {el.visible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </IconAction>
            <IconAction title="Bring forward" onClick={() => bringForward(el.id)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction title="Send backward" onClick={() => sendBackward(el.id)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction
              title="Delete layer"
              onClick={() => removeElement(el.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" />
            </IconAction>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
    >
      {children}
    </button>
  );
}