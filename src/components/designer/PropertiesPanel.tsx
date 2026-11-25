'use client';

import { useDesignerStore, type DesignerTextElement } from '@/hooks/useDesignerStore';

const FONT_OPTIONS = [
  { label: 'Inter (body)', value: 'Inter, sans-serif' },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
] as const;

const COLOR_SWATCHES = ['#141413', '#FFFFFF', '#E85D04', '#0E7C5A', '#B3261E'];

export function PropertiesPanel() {
  const selectedId = useDesignerStore((s) => s.selectedId);
  const elements = useDesignerStore((s) => s.elements);
  const updateElement = useDesignerStore((s) => s.updateElement);
  const config = useDesignerStore((s) => s.config);
  const setConfig = useDesignerStore((s) => s.setConfig);
  const product = useDesignerStore((s) => s.product);
  const template = useDesignerStore((s) => s.template);
  const availableTemplates = useDesignerStore((s) => s.availableTemplates);
  const switchTemplate = useDesignerStore((s) => s.switchTemplate);

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const textEl = selected && selected.type === 'text' ? (selected as DesignerTextElement) : null;

  return (
    <div className="divide-y divide-line">
      {/* Sale configuration — always visible */}
      {config && product ? (
        <section className="space-y-3 p-4">
          <p className="spec-label">Specification</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="spec-label mb-1 block text-[9px]">Width (mm)</label>
              <input
                type="number"
                min={Number(product.min_width_mm)}
                max={Number(product.max_width_mm)}
                value={config.widthMm}
                onChange={(e) =>
                  setConfig({
                    widthMm: Math.max(
                      Number(product.min_width_mm),
                      Math.min(Number(product.max_width_mm), Number(e.target.value)),
                    ),
                  })
                }
                className="input-base py-2 text-xs tabular"
              />
            </div>
            <div>
              <label className="spec-label mb-1 block text-[9px]">Height (mm)</label>
              <input
                type="number"
                min={Number(product.min_height_mm)}
                max={Number(product.max_height_mm)}
                value={config.heightMm}
                onChange={(e) =>
                  setConfig({
                    heightMm: Math.max(
                      Number(product.min_height_mm),
                      Math.min(Number(product.max_height_mm), Number(e.target.value)),
                    ),
                  })
                }
                className="input-base py-2 text-xs tabular"
              />
            </div>
            <div>
              <label className="spec-label mb-1 block text-[9px]">Quantity</label>
              <input
                type="number"
                min={1}
                value={config.quantity}
                onChange={(e) =>
                  setConfig({ quantity: Math.max(1, Math.floor(Number(e.target.value))) })
                }
                className="input-base py-2 text-xs tabular"
              />
            </div>
            <div>
              <label className="spec-label mb-1 block text-[9px]">Orientation</label>
              <select
                value={config.orientation}
                onChange={(e) =>
                  setConfig({
                    orientation: e.target.value as 'landscape' | 'portrait',
                  })
                }
                className="input-base py-2 text-xs capitalize"
              >
                {product.allowed_orientations.map((o) => (
                  <option key={o} value={o} className="capitalize">
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {product.allowed_materials.length > 0 ? (
            <div>
              <label className="spec-label mb-1 block text-[9px]">Material</label>
              <select
                value={config.materialId ?? ''}
                onChange={(e) => setConfig({ materialId: e.target.value || null })}
                className="input-base py-2 text-xs"
              >
                {product.allowed_materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {availableTemplates.length > 1 ? (
            <div>
              <label className="spec-label mb-1 block text-[9px]">Template</label>
              <select
                value={template?.id ?? ''}
                onChange={(e) => {
                  const next = availableTemplates.find((t) => t.id === e.target.value);
                  if (next) switchTemplate(next);
                }}
                className="input-base py-2 text-xs"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Element-specific properties */}
      {textEl ? (
        <section className="space-y-3 p-4">
          <p className="spec-label">Text</p>

          <div>
            <label className="spec-label mb-1 block text-[9px]">Content</label>
            <textarea
              value={textEl.text}
              onChange={(e) => updateElement(textEl.id, { text: e.target.value })}
              rows={2}
              className="input-base text-xs"
            />
          </div>

          <div>
            <label className="spec-label mb-1 block text-[9px]">Font</label>
            <select
              value={textEl.fontFamily}
              onChange={(e) => updateElement(textEl.id, { fontFamily: e.target.value })}
              className="input-base py-2 text-xs"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="spec-label mb-1 block text-[9px]">Size</label>
              <input
                type="number"
                min={6}
                max={400}
                value={textEl.fontSize}
                onChange={(e) =>
                  updateElement(textEl.id, { fontSize: Number(e.target.value) })
                }
                className="input-base py-2 text-xs tabular"
              />
            </div>
            <div>
              <label className="spec-label mb-1 block text-[9px]">Tracking</label>
              <input
                type="number"
                min={-4}
                max={20}
                step={0.5}
                value={textEl.letterSpacing}
                onChange={(e) =>
                  updateElement(textEl.id, { letterSpacing: Number(e.target.value) })
                }
                className="input-base py-2 text-xs tabular"
              />
            </div>
          </div>

          <div>
            <label className="spec-label mb-1 block text-[9px]">Colour</label>
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateElement(textEl.id, { fill: c })}
                  className={
                    'h-7 w-7 rounded-xs border transition-transform hover:scale-105 ' +
                    (textEl.fill === c ? 'border-ink ring-2 ring-ink/20' : 'border-line')
                  }
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`Colour ${c}`}
                />
              ))}
              <input
                type="color"
                value={textEl.fill}
                onChange={(e) => updateElement(textEl.id, { fill: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded-xs border border-line"
                title="Custom colour"
              />
            </div>
          </div>

          <div>
            <label className="spec-label mb-1 block text-[9px]">Align</label>
            <div className="grid grid-cols-3 gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => updateElement(textEl.id, { align: a })}
                  className={
                    'rounded-xs border py-1.5 text-[10px] capitalize ' +
                    (textEl.align === a
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-surface text-ink-soft')
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {selected && selected.type === 'image' ? (
        <section className="space-y-2 p-4">
          <p className="spec-label">Image</p>
          <p className="text-xs text-ink-muted">
            Drag the handles to resize. Press <kbd className="rounded border border-line px-1">Delete</kbd> in the layer list to remove.
          </p>
        </section>
      ) : null}

      {!selected ? (
        <p className="p-4 text-xs text-ink-muted">
          Select a layer on the canvas or in the Layers tab to edit its properties.
        </p>
      ) : null}
    </div>
  );
}