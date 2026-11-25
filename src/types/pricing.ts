/**
 * Digital Heroes — Pricing domain types
 * Shared by the client calculator, the server checkout route,
 * and the print-file generator so all three agree on numbers.
 */
import type {
  MaterialOption,
  TemplateFitRules,
  VolumeDiscountTier,
} from './database';

export type { MaterialOption, TemplateFitRules, VolumeDiscountTier };

// ---------------------------------------------------------------------------
// Pricing engine input / output
// ---------------------------------------------------------------------------

/**
 * The raw product row subset needed to price a line.
 * Deliberately excludes mutable content (name, description) so this
 * interface can be reused server-side with a `.select()` projection.
 */
export interface PriceableProduct {
  id: string;
  basePriceCents: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  allowedMaterials: MaterialOption[];
  vatPercent: number;
  volumeDiscountTiers: VolumeDiscountTier[];
}

/** A single line submitted by the customer (before server validation). */
export interface CartLineInput {
  productId: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  materialId: string | null;
  orientation: 'landscape' | 'portrait';
}

/**
 * The enriched, server-trusted version of a cart line after:
 *   - product lookup,
 *   - dimension / material / orientation validation,
 *   - area + material + volume-discount math.
 */
export interface PricedLine {
  productId: string;
  productName: string;
  divisionSlug: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  materialId: string | null;
  materialLabel: string | null;
  materialMultiplier: number;
  orientation: 'landscape' | 'portrait';
  areaSqm: number;
  baseUnitPriceCents: number;   // base_price_cents
  areaAdjustedCents: number;    // base × area factor (min 1× base)
  materialAdjustedCents: number; // areaAdjusted × materialMultiplier
  volumeDiscountPercent: number;
  discountedUnitPriceCents: number;
  lineSubtotalCents: number;    // discountedUnitPrice × quantity
}

export interface PricedOrder {
  currency: 'NZD';
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
  vatPercent: number; // derived from products; single VAT rate assumed per order
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationIssue =
  | { kind: 'unknown_product';       productId: string }
  | { kind: 'invalid_quantity';      productId: string; quantity: number }
  | { kind: 'dimension_out_of_bounds'; productId: string; widthMm: number; heightMm: number }
  | { kind: 'invalid_material';      productId: string; materialId: string | null }
  | { kind: 'invalid_orientation';   productId: string; orientation: string }
  | { kind: 'mixed_vat';             products: string[] };

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Volume-discount helper contract (implemented in lib/pricing.ts in Phase 2)
// ---------------------------------------------------------------------------

export interface DiscountLookup {
  (tiers: VolumeDiscountTier[], quantity: number): number;
}

// ---------------------------------------------------------------------------
// Client-side quote (UX only — never trusted by the server)
// ---------------------------------------------------------------------------

export interface PriceQuote {
  subtotalCents: number;
  discountCents: number;
  vatCents: number;
  totalCents: number;
  volumeDiscountPercent: number;
  nextTierQty: number | null;
  nextTierDiscountPercent: number | null;
}

// ---------------------------------------------------------------------------
// Fit-rule helper contract (used by the CSV merge engine in Phase 3)
// ---------------------------------------------------------------------------

export interface FitInput {
  text: string;
  rules: TemplateFitRules;
  boundsWidthPx: number;
  boundsHeightPx: number;
  preferredFontSize: number;
  preferredLetterSpacing: number;
}

export interface FitOutput {
  fontSize: number;
  letterSpacing: number;
  scaleX: number;         // horizontal squeeze when mode='stretch'
  lineHeight: number;
  fitsOnSingleLine: boolean;
}