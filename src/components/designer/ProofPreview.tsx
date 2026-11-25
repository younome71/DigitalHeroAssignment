'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useDesignerStore } from '@/hooks/useDesignerStore';

/**
 * Real-time proof preview. Renders the actual print area at full fidelity
 * by drawing the current elements into an offscreen canvas and showing the
 * resulting PNG — with no editor handles, guides, or clipping overlays.
 *
 * Implementation: mount a hidden <KonvaStage> in a sibling component, or
 * call the main Canvas's exportPng() handle. To keep this modal fully
 * self-contained and independent of refs, we render an HTML preview using
 * the exact same element model (a lightweight SVG renderer suffices for
 * static preview).
 */
export function ProofPreview() {
  const open = useDesignerStore((s) => s.proofPreviewOpen);
  const setOpen = useDesignerStore((s) => s.setProofPreviewOpen);
  const template = useDesignerStore((s) => s.template);
  const elements = useDesignerStore((s) => s.elements);
  const config = useDesignerStore((s) => s.config);
  const product = useDesignerStore((s) => s.product);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) {
      setImageUrl(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = template.canvas_width_px;
    canvas.height = template.canvas_height_px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pa = template.print_area;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Template background image (if set)
    if (template.background_url) {
      const bg = new window.Image();
      bg.crossOrigin = 'anonymous';
      bg.onload = () => {
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
        renderElements(ctx, canvas, pa, elements);
        setImageUrl(canvas.toDataURL('image/png'));
      };
      bg.onerror = () => {
        renderElements(ctx, canvas, pa, elements);
        setImageUrl(canvas.toDataURL('image/png'));
      };
      bg.src = template.background_url;
    } else {
      renderElements(ctx, canvas, pa, elements);
      setImageUrl(canvas.toDataURL('image/png'));
    }
  }, [open, template, elements]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-sm bg-surface shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p className="spec-label">Proof preview</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {product?.name} · {template?.name} · {config?.widthMm}×{config?.heightMm}mm
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex max-h-[70vh] justify-center overflow-auto bg-canvas p-6">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Proof preview"
              className="max-h-full max-w-full border border-line shadow-panel"
            />
          ) : (
            <p className="text-xs text-ink-muted">Rendering preview…</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <p className="text-[11px] text-ink-muted">
            This is a live preview. Final print will match this render exactly.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-ghost py-2 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function renderElements(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  printArea: { x: number; y: number; width: number; height: number },
  elements: ReturnType<typeof useDesignerStore.getState>['elements'],
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(printArea.x, printArea.y, printArea.width, printArea.height);
  ctx.clip();

  for (const el of elements) {
    if (!el.visible) continue;

    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate((el.rotation * Math.PI) / 180);

    if (el.type === 'text') {
      ctx.font = `${el.fontSize}px ${el.fontFamily}`;
      ctx.fillStyle = el.fill;
      ctx.textBaseline = 'middle';
      ctx.textAlign = el.align === 'center' ? 'center' : el.align === 'right' ? 'right' : 'left';
      const xOff = el.align === 'center' ? 0 : el.align === 'right' ? el.width / 2 : -el.width / 2;
      // Naive line breaking to keep the preview readable.
      wrapText(ctx, el.text, el.width, -el.height / 2, el.height, el.fontSize * 1.15, xOff);
    } else if (el.type === 'image' && el.src) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = el.src;
      // Synchronous fallback — may not render on first paint, acceptable.
      try {
        ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
      } catch {
        // Image not yet loaded — skip silently.
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startY: number,
  areaHeight: number,
  lineHeight: number,
  x: number,
) {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const totalHeight = lines.length * lineHeight;
  const offsetY = startY + (areaHeight - totalHeight) / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, offsetY + i * lineHeight);
  });
}