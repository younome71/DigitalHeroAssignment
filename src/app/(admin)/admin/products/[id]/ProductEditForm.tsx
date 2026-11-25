'use client';

import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ProductRow } from '@/types/database';
import { updateProductAction } from './actions';

export function ProductEditForm({ product }: { product: ProductRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(formData: FormData) {
    setError(null);
    start(async () => {
      try {
        await updateProductAction(product.id, formData);
      } catch (e) {
        // Redirect in server action will navigate; only errors land here.
        const msg = (e as Error).message;
        if (!msg.includes('NEXT_REDIRECT')) setError(msg);
      }
    });
  }

  return (
    <form action={handle} className="mt-6 space-y-6">
      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Basics</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={product.name} required />
          <Field label="Slug" name="slug" defaultValue={product.slug} required />
          <Field label="Description" name="description" defaultValue={product.description} />
          <Field
            label="Base price (cents)"
            name="base_price_cents"
            type="number"
            defaultValue={String(product.base_price_cents)}
            required
          />
          <Field
            label="Turnaround days"
            name="turnaround_days"
            type="number"
            defaultValue={String(product.turnaround_days)}
            required
          />
          <Field
            label="Xero account code"
            name="xero_account_code"
            defaultValue={product.xero_account_code}
            required
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product.active}
            value="1"
          />
          Active
        </label>
      </section>

      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Print spec</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Min width (mm)"
            name="min_width_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.min_width_mm)}
            required
          />
          <Field
            label="Max width (mm)"
            name="max_width_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.max_width_mm)}
            required
          />
          <Field
            label="Min height (mm)"
            name="min_height_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.min_height_mm)}
            required
          />
          <Field
            label="Max height (mm)"
            name="max_height_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.max_height_mm)}
            required
          />
          <Field
            label="Bleed (mm)"
            name="bleed_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.bleed_mm)}
            required
          />
          <Field
            label="Safe margin (mm)"
            name="safe_margin_mm"
            type="number"
            step="0.01"
            defaultValue={String(product.safe_margin_mm)}
            required
          />
          <Field
            label="Target DPI"
            name="target_dpi"
            type="number"
            defaultValue={String(product.target_dpi)}
            required
          />
          <Field
            label="VAT %"
            name="vat_percent"
            type="number"
            step="0.01"
            defaultValue={String(product.vat_percent)}
            required
          />
        </div>
      </section>

      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Materials (JSON)</p>
        <textarea
          name="allowed_materials"
          defaultValue={JSON.stringify(product.allowed_materials, null, 2)}
          rows={6}
          className="input-base font-mono text-[11px]"
        />
        <p className="mt-1 text-[10px] text-ink-muted">
          Array of {'{ id, label, priceMultiplier }'} objects.
        </p>
      </section>

      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Volume discount tiers (JSON)</p>
        <textarea
          name="volume_discount_tiers"
          defaultValue={JSON.stringify(product.volume_discount_tiers, null, 2)}
          rows={5}
          className="input-base font-mono text-[11px]"
        />
        <p className="mt-1 text-[10px] text-ink-muted">
          Array of {'{ min_qty, discount_percent }'} objects.
        </p>
      </section>

      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Template fit rules (JSON)</p>
        <textarea
          name="template_fit_rules"
          defaultValue={JSON.stringify(product.template_fit_rules, null, 2)}
          rows={5}
          className="input-base font-mono text-[11px]"
        />
        <p className="mt-1 text-[10px] text-ink-muted">
          {`{ mode, min_font_size, max_font_size, letter_spacing_min, letter_spacing_max }`}
        </p>
      </section>

      <section className="rounded-sm border border-line bg-surface p-5">
        <p className="spec-label mb-3">Allowed orientations</p>
        <div className="flex gap-4 text-xs">
          {(['landscape', 'portrait'] as const).map((o) => (
            <label key={o} className="flex items-center gap-1.5 capitalize">
              <input
                type="checkbox"
                name="orientation"
                value={o}
                defaultChecked={product.allowed_orientations.includes(o)}
              />
              {o}
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-accent py-2.5 text-xs disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  step,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="spec-label mb-1 block text-[9px]">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="input-base text-xs"
      />
    </label>
  );
}