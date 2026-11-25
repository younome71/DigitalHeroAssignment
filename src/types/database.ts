/**
 * Digital Heroes — Database types
 *
 * Source: `database.generated.ts` (Supabase CLI).
 *
 * This shim re-exports the generated types AND narrows specific `jsonb`
 * columns from the generator's generic `Json` to the shapes the app
 * actually uses. Every consumer keeps working unchanged.
 */

export type { Database, Json } from './database.generated';
import type { Database, Json } from './database.generated';

// ---------------------------------------------------------------------------
// Raw generated rows
// ---------------------------------------------------------------------------
type RawProfile     = Database['public']['Tables']['profiles']['Row'];
type RawDivision    = Database['public']['Tables']['divisions']['Row'];
type RawProduct     = Database['public']['Tables']['products']['Row'];
type RawTemplate    = Database['public']['Tables']['templates']['Row'];
type RawDesign      = Database['public']['Tables']['designs']['Row'];
type RawOrder       = Database['public']['Tables']['orders']['Row'];
type RawOrderItem   = Database['public']['Tables']['order_items']['Row'];
type RawProof       = Database['public']['Tables']['proofs']['Row'];
type RawProofLog    = Database['public']['Tables']['proof_logs']['Row'];
type RawPrintJob    = Database['public']['Tables']['print_jobs']['Row'];
type RawGalleryItem = Database['public']['Tables']['gallery_items']['Row'];

// ---------------------------------------------------------------------------
// Row aliases with typed jsonb overrides
// ---------------------------------------------------------------------------
export type Profile     = RawProfile;
export type Division    = RawDivision;
export type Order       = RawOrder;
export type Proof       = RawProof;
export type ProofLog    = RawProofLog;
export type PrintJob    = RawPrintJob;
export type GalleryItem = RawGalleryItem;

export type Product = Omit<
  RawProduct,
  'allowed_materials' | 'allowed_orientations' | 'volume_discount_tiers' | 'template_fit_rules'
> & {
  allowed_materials: MaterialOption[];
  allowed_orientations: ('landscape' | 'portrait')[];
  volume_discount_tiers: VolumeDiscountTier[];
  template_fit_rules: TemplateFitRules;
};

export type Template = Omit<RawTemplate, 'print_area' | 'placeholder_definitions'> & {
  print_area: PrintArea;
  placeholder_definitions: PlaceholderDefinition[];
};

export type Design = Omit<RawDesign, 'canvas_json' | 'config_snapshot' | 'artwork_source'> & {
  canvas_json: Json;
  config_snapshot: Json;
  artwork_source: 'canvas' | 'upload';
};

export type OrderItem = Omit<RawOrderItem, 'spec_snapshot'> & {
  spec_snapshot: OrderSpecSnapshot;
};

// ---------------------------------------------------------------------------
// Row type aliases (kept for imports that use the *Row suffix)
// ---------------------------------------------------------------------------
export type ProfileRow        = Profile;
export type DivisionRow       = Division;
export type ProductRow        = Product;
export type TemplateRow       = Template;
export type DesignRow         = Design;
export type OrderRow          = Order;
export type OrderItemRow      = OrderItem;
export type ProofRow          = Proof;
export type ProofLogRow       = ProofLog;
export type PrintJobRow       = PrintJob;
export type GalleryItemRow    = GalleryItem;

// ---------------------------------------------------------------------------
// Insert / Update (Json columns stay as `Json` — cast at write sites via asJson)
// ---------------------------------------------------------------------------
export type ProfileInsert     = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate     = Database['public']['Tables']['profiles']['Update'];
export type DivisionInsert    = Database['public']['Tables']['divisions']['Insert'];
export type DivisionUpdate    = Database['public']['Tables']['divisions']['Update'];
export type ProductInsert     = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate     = Database['public']['Tables']['products']['Update'];
export type TemplateInsert    = Database['public']['Tables']['templates']['Insert'];
export type TemplateUpdate    = Database['public']['Tables']['templates']['Update'];
export type DesignInsert      = Database['public']['Tables']['designs']['Insert'];
export type DesignUpdate      = Database['public']['Tables']['designs']['Update'];
export type OrderInsert       = Database['public']['Tables']['orders']['Insert'];
export type OrderUpdate       = Database['public']['Tables']['orders']['Update'];
export type OrderItemInsert   = Database['public']['Tables']['order_items']['Insert'];
export type OrderItemUpdate   = Database['public']['Tables']['order_items']['Update'];
export type ProofInsert       = Database['public']['Tables']['proofs']['Insert'];
export type ProofUpdate       = Database['public']['Tables']['proofs']['Update'];
export type ProofLogInsert    = Database['public']['Tables']['proof_logs']['Insert'];
export type PrintJobInsert    = Database['public']['Tables']['print_jobs']['Insert'];
export type PrintJobUpdate    = Database['public']['Tables']['print_jobs']['Update'];
export type GalleryItemInsert = Database['public']['Tables']['gallery_items']['Insert'];
export type GalleryItemUpdate = Database['public']['Tables']['gallery_items']['Update'];

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type UserRole         = Database['public']['Enums']['user_role'];
export type OrderStatus      = Database['public']['Enums']['order_status'];
export type ProofStatus      = Database['public']['Enums']['proof_status'];
export type ProofAction      = Database['public']['Enums']['proof_action'];
export type PrintJobStatus   = Database['public']['Enums']['print_job_status'];
export type PrintJobFileType = Database['public']['Enums']['print_job_file_type'];

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/**
 * Cast any structured value into the generated `Json` column type.
 * Use when writing typed objects into `jsonb` columns.
 */
export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

// ---------------------------------------------------------------------------
// Hand-authored jsonb shapes
// ---------------------------------------------------------------------------
export interface MaterialOption {
  id: string;
  label: string;
  priceMultiplier: number;
}

export interface VolumeDiscountTier {
  min_qty: number;
  discount_percent: number;
}

export interface TemplateFitRules {
  mode: 'shrink' | 'fit' | 'stretch';
  min_font_size: number;
  max_font_size: number;
  letter_spacing_min: number;
  letter_spacing_max: number;
}

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlaceholderType = 'text' | 'image';

export interface PlaceholderDefinition {
  id: string;
  type: PlaceholderType;
  label: string;
  maxLength: number;
  required: boolean;
  defaultText: string;
  bounds: PrintArea;
  fontSize: number;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
}

export interface ShippingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface OrderSpecSnapshot {
  productSlug: string;
  productName: string;
  divisionSlug: string;
  material: string | null;
  widthMm: number;
  heightMm: number;
  orientation: 'landscape' | 'portrait' | null;
  unitPriceCents: number;
  quantity: number;
  volumeDiscountPercent: number;
  vatPercent: number;
  templateId?: string | null;
}