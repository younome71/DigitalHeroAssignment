import 'server-only';

import Papa from 'papaparse';
import JSZip from 'jszip';
import type { ProductRow, TemplateRow } from '@/types/database';
import { generatePdf } from './pdf-generator';
import type { CanvasElement, CanvasJson } from './canvas-json';

export interface CsvMergeOptions {
  csvText: string;
  canvasJson: CanvasJson;
  product: ProductRow;
  template: TemplateRow;
  widthMm: number;
  heightMm: number;
  orderNumber: string;
  productSlug: string;
  dateStr: string;
}

export interface CsvMergeResult {
  zipBuffer: Buffer;
  fileCount: number;
  skippedRows: number;
  totalRows: number;
  folderName: string;
}

const MAX_ROWS = 500;

export async function csvMergeToZip(
  opts: CsvMergeOptions,
): Promise<CsvMergeResult> {
  const {
    csvText,
    canvasJson,
    product,
    template,
    widthMm,
    heightMm,
    orderNumber,
    productSlug,
    dateStr,
  } = opts;

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data.filter((row) =>
    Object.values(row).some((v) => v != null && String(v).trim() !== ''),
  );

  if (rows.length === 0) {
    throw new Error('CSV contains no data rows');
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(`CSV exceeds ${MAX_ROWS} rows; batch smaller for Vercel.`);
  }

  const folderName = `${orderNumber}_${productSlug}_${dateStr}_Output`;
  const zip = new JSZip();
  const folder = zip.folder(folderName);
  if (!folder) throw new Error('Failed to allocate ZIP folder');

  let skippedRows = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const rowCanvasJson = applyOverrides(canvasJson, row);
      const pdfBytes = await generatePdf({
        canvasJson: rowCanvasJson,
        product,
        template,
        widthMm,
        heightMm,
      });
      const fileName = `${folderName}_row_${i + 1}.pdf`;
      folder.file(fileName, Buffer.from(pdfBytes));
    } catch (err) {
      skippedRows += 1;
      console.error(`[csv-merge] row ${i + 1} failed:`, err);
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    zipBuffer,
    fileCount: rows.length - skippedRows,
    skippedRows,
    totalRows: rows.length,
    folderName,
  };
}

function applyOverrides(
  canvasJson: CanvasJson,
  row: Record<string, string>,
): CanvasJson {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    if (v != null) lookup.set(k.trim().toLowerCase(), String(v));
  }

  const elements: CanvasElement[] = canvasJson.elements.map((el) => {
    if (el.type === 'text' && el.placeholderId) {
      const value = lookup.get(el.placeholderId.toLowerCase());
      if (value !== undefined && value !== '') {
        return { ...el, text: value };
      }
    }
    return el;
  });

  return { ...canvasJson, elements };
}

export function buildDateStr(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}