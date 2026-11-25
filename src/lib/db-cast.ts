/**
 * Supabase returns raw generator shapes with `Json` for every `jsonb` column.
 * The app expects typed shapes (MaterialOption[], PrintArea, etc.).
 * These helpers are the boundary where we assert the DB has valid shapes —
 * validated at write time via Zod + DB CHECK constraints.
 */
import type {
  Product,
  Template,
  Design,
  OrderItem,
  Database,
} from '@/types/database';

type RawProduct = Database['public']['Tables']['products']['Row'];
type RawTemplate = Database['public']['Tables']['templates']['Row'];
type RawDesign = Database['public']['Tables']['designs']['Row'];
type RawOrderItem = Database['public']['Tables']['order_items']['Row'];

export const asProduct = <T extends RawProduct>(r: T): Omit<T, keyof RawProduct> & Product =>
  r as unknown as Omit<T, keyof RawProduct> & Product;
export const asProducts = <T extends RawProduct>(rs: T[]): Array<Omit<T, keyof RawProduct> & Product> =>
  rs as unknown as Array<Omit<T, keyof RawProduct> & Product>;

export const asTemplate = <T extends RawTemplate>(r: T): Omit<T, keyof RawTemplate> & Template =>
  r as unknown as Omit<T, keyof RawTemplate> & Template;
export const asTemplates = <T extends RawTemplate>(rs: T[]): Array<Omit<T, keyof RawTemplate> & Template> =>
  rs as unknown as Array<Omit<T, keyof RawTemplate> & Template>;

export const asDesign = <T extends RawDesign>(r: T): Omit<T, keyof RawDesign> & Design =>
  r as unknown as Omit<T, keyof RawDesign> & Design;

export const asOrderItem = <T extends RawOrderItem>(r: T): Omit<T, keyof RawOrderItem> & OrderItem =>
  r as unknown as Omit<T, keyof RawOrderItem> & OrderItem;