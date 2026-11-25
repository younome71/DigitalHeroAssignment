import 'server-only';
import Papa from 'papaparse';
import type { OrderItemRow, OrderRow, ProductRow, ProfileRow } from '@/types/database';

export interface XeroCsvRow {
  ContactName: string;
  EmailAddress: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
  TaxType: string;
}

export interface XeroExportInput {
  order: Pick<OrderRow, 'id' | 'order_number' | 'paid_at' | 'created_at'>;
  customer: Pick<ProfileRow, 'full_name' | 'company_name' | 'email'>;
  items: Array<
    Pick<OrderItemRow, 'quantity' | 'unit_price_cents' | 'width_mm' | 'height_mm' | 'material'> & {
      product: Pick<ProductRow, 'name' | 'xero_account_code'>;
    }
  >;
  vatPercent: number;
}

function ymd(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Xero sales invoice import — one row per line item, all sharing the
 * same InvoiceNumber. `UnitAmount` in dollars (Xero requirement), no VAT
 * included (Xero adds tax via `TaxType`).
 */
export function buildXeroRows(input: XeroExportInput): XeroCsvRow[] {
  const invoiceDate = ymd(input.order.paid_at ?? input.order.created_at);
  const dueDate = invoiceDate; // paid immediately
  const contactName =
    (input.customer.company_name?.trim() || input.customer.full_name?.trim() || input.customer.email);
  const taxType = input.vatPercent > 0 ? 'OUTPUT2' : 'NONE';

  return input.items.map((item) => {
    const sizeDesc = `${Math.round(Number(item.width_mm))}×${Math.round(Number(item.height_mm))}mm`;
    const material = item.material ? ` · ${item.material}` : '';
    return {
      ContactName: contactName,
      EmailAddress: input.customer.email,
      InvoiceNumber: input.order.order_number,
      InvoiceDate: invoiceDate,
      DueDate: dueDate,
      Description: `${item.product.name} (${sizeDesc}${material})`,
      Quantity: item.quantity,
      UnitAmount: Number((item.unit_price_cents / 100).toFixed(2)),
      AccountCode: item.product.xero_account_code,
      TaxType: taxType,
    };
  });
}

export function buildXeroCsv(rows: XeroCsvRow[]): string {
  return Papa.unparse(rows, {
    columns: [
      'ContactName',
      'EmailAddress',
      'InvoiceNumber',
      'InvoiceDate',
      'DueDate',
      'Description',
      'Quantity',
      'UnitAmount',
      'AccountCode',
      'TaxType',
    ],
  });
}