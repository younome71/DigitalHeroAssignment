import type { ProductRow } from '@/types/database';
import type {
  CartLineInput,
  PricedLine,
  PricedOrder,
  PriceableProduct,
  ValidationIssue,
} from '@/types/pricing';

/**
 * Pure, deterministic pricing engine.
 * Shared by the client calculator and the server checkout route.
 * The server always recomputes — client totals are UX only.
 */

export interface PriceableProductWithMeta extends PriceableProduct {
  name: string;
  divisionSlug: string;
  slug: string;
}

export class PricingError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super('Pricing validation failed');
    this.name = 'PricingError';
    this.issues = issues;
  }
}

/** Convert a raw ProductRow + division slug into the pricing shape. */
export function toPriceableProduct(
  p: ProductRow,
  divisionSlug: string,
): PriceableProductWithMeta {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    divisionSlug,
    basePriceCents: p.base_price_cents,
    minWidthMm: Number(p.min_width_mm),
    maxWidthMm: Number(p.max_width_mm),
    minHeightMm: Number(p.min_height_mm),
    maxHeightMm: Number(p.max_height_mm),
    allowedMaterials: p.allowed_materials,
    vatPercent: Number(p.vat_percent),
    volumeDiscountTiers: p.volume_discount_tiers,
  };
}

export function findDiscountPercent(
  tiers: { min_qty: number; discount_percent: number }[],
  quantity: number,
): number {
  let best = 0;
  for (const tier of tiers) {
    if (quantity >= tier.min_qty && tier.discount_percent > best) {
      best = tier.discount_percent;
    }
  }
  return best;
}

/**
 * Line pricing rules:
 *   areaFactor       = max(1, actualArea / minArea)
 *   areaAdjusted     = round(basePrice × areaFactor)
 *   materialAdjusted = round(areaAdjusted × materialMultiplier)
 *   volumeDiscount   = highest matching tier
 *   unitPrice        = round(materialAdjusted × (1 − discount/100))
 *   lineSubtotal     = unitPrice × quantity (ex-VAT, after discount)
 */
export function priceLine(
  product: PriceableProductWithMeta,
  line: CartLineInput,
): PricedLine {
  const areaMm2 = line.widthMm * line.heightMm;
  const minAreaMm2 = product.minWidthMm * product.minHeightMm;
  const areaFactor = Math.max(1, areaMm2 / minAreaMm2);
  const areaSqm = areaMm2 / 1_000_000;

  const areaAdjustedCents = Math.round(product.basePriceCents * areaFactor);

  const material = line.materialId
    ? product.allowedMaterials.find((m) => m.id === line.materialId) ?? null
    : null;
  const materialMultiplier = material?.priceMultiplier ?? 1.0;
  const materialAdjustedCents = Math.round(
    areaAdjustedCents * materialMultiplier,
  );

  const volumeDiscountPercent = findDiscountPercent(
    product.volumeDiscountTiers,
    line.quantity,
  );
  const discountedUnitPriceCents = Math.round(
    materialAdjustedCents * (1 - volumeDiscountPercent / 100),
  );
  const lineSubtotalCents = discountedUnitPriceCents * line.quantity;

  return {
    productId: product.id,
    productName: product.name,
    divisionSlug: product.divisionSlug,
    quantity: line.quantity,
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    materialId: line.materialId,
    materialLabel: material?.label ?? null,
    materialMultiplier,
    orientation: line.orientation,
    areaSqm: Number(areaSqm.toFixed(4)),
    baseUnitPriceCents: product.basePriceCents,
    areaAdjustedCents,
    materialAdjustedCents,
    volumeDiscountPercent,
    discountedUnitPriceCents,
    lineSubtotalCents,
  };
}

/**
 * Price a whole cart. Throws PricingError on any validation failure.
 * The caller (route handler) is expected to translate that into a 400.
 */
export function priceOrder(
  products: Record<string, PriceableProductWithMeta>,
  lines: CartLineInput[],
): PricedOrder {
  if (lines.length === 0) {
    throw new PricingError([{ kind: 'invalid_quantity', productId: '', quantity: 0 }]);
  }

  const issues: ValidationIssue[] = [];
  const pricedLines: PricedLine[] = [];
  const vatPercents = new Set<number>();

  for (const line of lines) {
    const product = products[line.productId];

    if (!product) {
      issues.push({ kind: 'unknown_product', productId: line.productId });
      continue;
    }

    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      issues.push({
        kind: 'invalid_quantity',
        productId: line.productId,
        quantity: line.quantity,
      });
      continue;
    }

    if (
      line.widthMm < product.minWidthMm ||
      line.widthMm > product.maxWidthMm ||
      line.heightMm < product.minHeightMm ||
      line.heightMm > product.maxHeightMm
    ) {
      issues.push({
        kind: 'dimension_out_of_bounds',
        productId: line.productId,
        widthMm: line.widthMm,
        heightMm: line.heightMm,
      });
      continue;
    }

    if (
      line.materialId !== null &&
      !product.allowedMaterials.some((m) => m.id === line.materialId)
    ) {
      issues.push({
        kind: 'invalid_material',
        productId: line.productId,
        materialId: line.materialId,
      });
      continue;
    }

    if (line.orientation !== 'landscape' && line.orientation !== 'portrait') {
      issues.push({
        kind: 'invalid_orientation',
        productId: line.productId,
        orientation: String(line.orientation),
      });
      continue;
    }

    pricedLines.push(priceLine(product, line));
    vatPercents.add(product.vatPercent);
  }

  if (issues.length > 0) {
    throw new PricingError(issues);
  }

  if (vatPercents.size > 1) {
    throw new PricingError([
      {
        kind: 'mixed_vat',
        products: Array.from(new Set(pricedLines.map((l) => l.productId))),
      },
    ]);
  }

  const vatPercent = Array.from(vatPercents)[0] ?? 0;

  const subtotalCents = pricedLines.reduce(
    (sum, l) => sum + l.materialAdjustedCents * l.quantity,
    0,
  );
  const discountCents = pricedLines.reduce(
    (sum, l) =>
      sum + (l.materialAdjustedCents - l.discountedUnitPriceCents) * l.quantity,
    0,
  );
  const vatCents = Math.round(((subtotalCents - discountCents) * vatPercent) / 100);
  const totalCents = subtotalCents - discountCents + vatCents;

  return {
    currency: 'NZD',
    lines: pricedLines,
    subtotalCents,
    discountCents,
    vatCents,
    totalCents,
    vatPercent,
  };
}

/** Return the next tier the customer could hit for a given qty (for UX nudges). */
export function nextDiscountTier(
  tiers: { min_qty: number; discount_percent: number }[],
  quantity: number,
): { minQty: number; discountPercent: number } | null {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  for (const t of sorted) {
    if (quantity < t.min_qty) {
      return { minQty: t.min_qty, discountPercent: t.discount_percent };
    }
  }
  return null;
}