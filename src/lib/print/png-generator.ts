import 'server-only';

import sharp from 'sharp';
import type { ProductRow, TemplateRow } from '@/types/database';
import { fitText } from './template-fit';
import {
  createServerMeasurer,
  loadFonts,
  sanitizeForWinAnsi,
} from './fonts';
import type {
  CanvasElement,
  CanvasJson,
  CanvasTextElement,
} from './canvas-json';
import { readFile } from 'fs/promises';
import path from 'path';  

const MAX_PIXELS = 32_000_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export interface GeneratePngOptions {
  canvasJson: CanvasJson;
  product: ProductRow;
  template: TemplateRow;
  widthMm: number;
  heightMm: number;
}

export async function generatePng(
  opts: GeneratePngOptions,
): Promise<{ buffer: Buffer; widthPx: number; heightPx: number; effectiveDpi: number }> {
  const { canvasJson, product, template, widthMm, heightMm } = opts;
  const bleed = Number(product.bleed_mm);
  const targetDpi = product.target_dpi;

  const pageWmm = widthMm + 2 * bleed;
  const pageHmm = heightMm + 2 * bleed;

  let dpi = targetDpi;
  let widthPx = Math.round((pageWmm / 25.4) * dpi);
  let heightPx = Math.round((pageHmm / 25.4) * dpi);

  if (widthPx * heightPx > MAX_PIXELS) {
    const ratio = Math.sqrt(MAX_PIXELS / (widthPx * heightPx));
    dpi = Math.round(dpi * ratio);
    widthPx = Math.round((pageWmm / 25.4) * dpi);
    heightPx = Math.round((pageHmm / 25.4) * dpi);
    console.warn(`[png] DPI reduced to ${dpi} to fit ${MAX_PIXELS}px budget`);
  }

  const fonts = await loadFonts();
  const measurer = createServerMeasurer(fonts);

  // Pre-fetch all images that need embedding.
  const urlSet = new Set<string>();
  if (template.background_url) urlSet.add(template.background_url);
  for (const el of canvasJson.elements) {
    if (el.type === 'image' && el.src) urlSet.add(el.src);
  }

  const imageCache = new Map<string, string>();
  await Promise.all(
    Array.from(urlSet).map(async (url) => {
      try {
        const dataUri = await fetchAsDataUri(url);
        imageCache.set(url, dataUri);
      } catch (err) {
        console.warn('[png] image fetch failed:', url, err);
      }
    }),
  );

  const svg = buildSvg({
    canvasJson,
    template,
    product,
    pageWpx: widthPx,
    pageHpx: heightPx,
    imageCache,
    measurer,
  });

  const buffer = await sharp(Buffer.from(svg), { density: 300 })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { buffer, widthPx, heightPx, effectiveDpi: dpi };
}

async function fetchAsDataUri(url: string): Promise<string> {
  if (url.startsWith('/')) {
    const filePath = path.join(process.cwd(), 'public', url);
    const buf = await readFile(filePath);
    const ext = url.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds 25MB limit');
  }
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

interface SvgBuildOptions {
  canvasJson: CanvasJson;
  template: TemplateRow;
  product: ProductRow;
  pageWpx: number;
  pageHpx: number;
  imageCache: Map<string, string>;
  measurer: ReturnType<typeof createServerMeasurer>;
}

function buildSvg(opts: SvgBuildOptions): string {
  const { canvasJson, template, product, pageWpx, pageHpx, imageCache, measurer } = opts;
  const W = canvasJson.canvas_width_px;
  const H = canvasJson.canvas_height_px;
  const pa = canvasJson.print_area;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${pageWpx}" height="${pageHpx}">`,
  );

  const bg = template.background_url ? imageCache.get(template.background_url) : undefined;
  if (bg) {
    parts.push(
      `<image href="${escapeXml(bg)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`,
    );
  } else {
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
  }

  parts.push(
    `<defs><clipPath id="pa"><rect x="${pa.x}" y="${pa.y}" width="${pa.width}" height="${pa.height}"/></clipPath></defs>`,
  );
  parts.push(`<g clip-path="url(#pa)">`);

  for (const el of canvasJson.elements) {
    if (!el.visible) continue;
    if (el.type === 'text') {
      parts.push(renderTextElement(el, product, measurer));
    } else if (el.type === 'image') {
      const data = imageCache.get(el.src);
      if (data) parts.push(renderImageElement(el, data));
    }
  }

  parts.push(`</g>`);
  parts.push(`</svg>`);
  return parts.join('');
}

function renderTextElement(
  el: CanvasTextElement,
  product: ProductRow,
  measurer: ReturnType<typeof createServerMeasurer>,
): string {
  const fitted = fitText(
    {
      text: el.text,
      rules: product.template_fit_rules,
      boundsWidthPx: el.width,
      boundsHeightPx: el.height,
      preferredFontSize: el.fontSize,
      preferredLetterSpacing: el.letterSpacing,
      fontFamily: el.fontFamily,
    },
    measurer,
  );

  const fontSize = fitted.fontSize;
  const letterSpacing = fitted.letterSpacing;
  const sanitized = sanitizeForWinAnsi(el.text);
  const lines = sanitized.split('\n');
  const lineHeight = fontSize * 1.15;

  const anchor =
    el.align === 'left' ? 'start' : el.align === 'right' ? 'end' : 'middle';

  const xPos =
    el.align === 'left'
      ? el.x - el.width / 2
      : el.align === 'right'
      ? el.x + el.width / 2
      : el.x;

  const rot = el.rotation !== 0 ? ` rotate(${el.rotation} ${el.x} ${el.y})` : '';

  const tspans = lines.map((line, i) => {
    const localY = el.y - ((lines.length - 1) * lineHeight) / 2 + i * lineHeight;
    return `<tspan x="${xPos}" y="${localY}">${escapeXml(line)}</tspan>`;
  });

  return `<g transform="${rot.trim() || 'translate(0,0)'}"><text text-anchor="${anchor}" dominant-baseline="central" font-family="${escapeXml(el.fontFamily)}" font-size="${fontSize}" letter-spacing="${letterSpacing}" fill="${escapeXml(el.fill)}">${tspans.join('')}</text></g>`;
}

function renderImageElement(
  el: Extract<CanvasElement, { type: 'image' }>,
  dataUri: string,
): string {
  const rot = el.rotation !== 0 ? ` rotate(${el.rotation} ${el.x} ${el.y})` : '';
  return `<g transform="${rot.trim() || 'translate(0,0)'}"><image href="${escapeXml(dataUri)}" x="${el.x - el.width / 2}" y="${el.y - el.height / 2}" width="${el.width}" height="${el.height}" preserveAspectRatio="none"/></g>`;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}