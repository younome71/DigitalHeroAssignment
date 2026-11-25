import type { PrintArea, PlaceholderDefinition } from '@/types/database';

export interface CanvasJson {
  elements: CanvasElement[];
  print_area: PrintArea;
  canvas_width_px: number;
  canvas_height_px: number;
}

export interface CanvasElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  placeholderId?: string;
}

export interface CanvasTextElement extends CanvasElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export interface CanvasImageElement extends CanvasElementBase {
  type: 'image';
  src: string;
  srcPath: string;
}

export type CanvasElement = CanvasTextElement | CanvasImageElement;

export function isCanvasJson(value: unknown): value is CanvasJson {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.elements) &&
    typeof v.print_area === 'object' &&
    typeof v.canvas_width_px === 'number' &&
    typeof v.canvas_height_px === 'number'
  );
}

export function normalizeCanvasJson(
  raw: unknown,
  printArea: PrintArea,
  canvasWidthPx: number,
  canvasHeightPx: number,
): CanvasJson {
  if (isCanvasJson(raw)) return raw;
  return {
    elements: [],
    print_area: printArea,
    canvas_width_px: canvasWidthPx,
    canvas_height_px: canvasHeightPx,
  };
}

export function placeholderValues(
  elements: CanvasElement[],
  placeholders: PlaceholderDefinition[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of elements) {
    if (el.type === 'text' && el.placeholderId) {
      out[el.placeholderId] = el.text;
    }
  }
  for (const ph of placeholders) {
    if (out[ph.id] === undefined && ph.type === 'text') {
      out[ph.id] = ph.defaultText;
    }
  }
  return out;
}