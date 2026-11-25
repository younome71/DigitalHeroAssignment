'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Stage, Layer, Group, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { PrintArea, PlaceholderDefinition, TemplateFitRules } from '@/types/database';
import {
  useDesignerStore,
  type DesignerElement,
  type DesignerTextElement,
  type DesignerImageElement,
} from '@/hooks/useDesignerStore';
import { browserTextMeasurer, fitText } from '@/lib/print/template-fit';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Public handle
// ---------------------------------------------------------------------------

export interface CanvasHandle {
  exportPng: (pixelRatio?: number) => string | null;
}

// ---------------------------------------------------------------------------
// Local image loader
// ---------------------------------------------------------------------------

function useLoadedImage(src: string | undefined | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let alive = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (alive) setImage(img);
    };
    img.onerror = () => {
      if (alive) setImage(null);
    };
    img.src = src;
    return () => {
      alive = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);
  return image;
}

// ---------------------------------------------------------------------------
// Print-area clamping
// ---------------------------------------------------------------------------

interface ClampResult {
  x: number;
  y: number;
  overflows: boolean;
}

function clampToPrintArea(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotation: number,
  printArea: PrintArea,
): ClampResult {
  const rad = (rotation * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));
  const aabbW = width * absCos + height * absSin;
  const aabbH = width * absSin + height * absCos;
  const halfW = aabbW / 2;
  const halfH = aabbH / 2;

  const minX = printArea.x + halfW;
  const maxX = printArea.x + printArea.width - halfW;
  const minY = printArea.y + halfH;
  const maxY = printArea.y + printArea.height - halfH;

  const overflows = halfW * 2 > printArea.width || halfH * 2 > printArea.height;

  const x = overflows ? printArea.x + printArea.width / 2 : Math.max(minX, Math.min(maxX, cx));
  const y = overflows ? printArea.y + printArea.height / 2 : Math.max(minY, Math.min(maxY, cy));

  return { x, y, overflows };
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export const Canvas = forwardRef<CanvasHandle, { className?: string }>(
  function Canvas({ className }, ref) {
    const stageRef = useRef<Konva.Stage>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [displayScale, setDisplayScale] = useState(0.4);

    const template = useDesignerStore((s) => s.template);
    const product = useDesignerStore((s) => s.product);
    const elements = useDesignerStore((s) => s.elements);
    const selectedId = useDesignerStore((s) => s.selectedId);
    const selectElement = useDesignerStore((s) => s.selectElement);
    const updateElement = useDesignerStore((s) => s.updateElement);

    const bgImage = useLoadedImage(template?.background_url ?? null);

    // Responsive stage sizing
    useEffect(() => {
      if (!template) return;
      const compute = () => {
        const available = containerRef.current?.clientWidth ?? 800;
        const scaleX = (available - 32) / template.canvas_width_px;
        const scaleY = (window.innerHeight - 240) / template.canvas_height_px;
        setDisplayScale(Math.max(0.15, Math.min(scaleX, scaleY, 1)));
      };
      compute();
      window.addEventListener('resize', compute);
      return () => window.removeEventListener('resize', compute);
    }, [template]);

    useImperativeHandle(
      ref,
      () => ({
        exportPng: (pixelRatio = 2) => {
          const stage = stageRef.current;
          if (!stage) return null;
          return stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
        },
      }),
      [],
    );

    if (!template || !product) {
      return (
        <div className={cn('grid aspect-[4/3] place-items-center bg-canvas text-sm text-ink-muted', className)}>
          Loading designer…
        </div>
      );
    }

    const pa = template.print_area;
    const displayW = template.canvas_width_px * displayScale;
    const displayH = template.canvas_height_px * displayScale;

    const placeholders = template.placeholder_definitions as PlaceholderDefinition[];

    return (
      <div ref={containerRef} className={cn('flex justify-center', className)}>
        <div
          style={{ width: displayW, height: displayH }}
          className="relative overflow-hidden rounded-xs border border-line bg-white shadow-panel"
        >
          <Stage
            ref={stageRef}
            width={template.canvas_width_px}
            height={template.canvas_height_px}
            scaleX={displayScale}
            scaleY={displayScale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) selectElement(null);
            }}
            onTouchStart={(e) => {
              if (e.target === e.target.getStage()) selectElement(null);
            }}
          >
            <Layer>
              {bgImage ? (
                <KonvaImage
                  image={bgImage}
                  x={0}
                  y={0}
                  width={template.canvas_width_px}
                  height={template.canvas_height_px}
                  listening={false}
                />
              ) : (
                <Rect
                  x={0}
                  y={0}
                  width={template.canvas_width_px}
                  height={template.canvas_height_px}
                  fill="#FFFFFF"
                  listening={false}
                />
              )}

              <Rect
                x={pa.x}
                y={pa.y}
                width={pa.width}
                height={pa.height}
                stroke="#E85D04"
                strokeWidth={2}
                dash={[8, 6]}
                listening={false}
              />

              {product.safe_margin_mm > 0 ? (
                <Rect
                  x={pa.x + mmToPx(product.safe_margin_mm, template.canvas_width_px, Number(product.max_width_mm))}
                  y={pa.y + mmToPx(product.safe_margin_mm, template.canvas_height_px, Number(product.max_height_mm))}
                  width={
                    pa.width -
                    2 * mmToPx(product.safe_margin_mm, template.canvas_width_px, Number(product.max_width_mm))
                  }
                  height={
                    pa.height -
                    2 * mmToPx(product.safe_margin_mm, template.canvas_height_px, Number(product.max_height_mm))
                  }
                  stroke="#0E7C5A"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              ) : null}

              <Group
                clipX={pa.x}
                clipY={pa.y}
                clipWidth={pa.width}
                clipHeight={pa.height}
              >
                {elements.map((el) =>
                  el.type === 'text' ? (
                    <TextNode
                      key={el.id}
                      element={el}
                      printArea={pa}
                      isSelected={selectedId === el.id}
                      onSelect={() => selectElement(el.id)}
                      onChange={(updates) => updateElement(el.id, updates)}
                      placeholders={placeholders}
                      rules={product.template_fit_rules as TemplateFitRules}
                      displayScale={displayScale}
                    />
                  ) : (
                    <ImageNode
                      key={el.id}
                      element={el}
                      printArea={pa}
                      isSelected={selectedId === el.id}
                      onSelect={() => selectElement(el.id)}
                      onChange={(updates) => updateElement(el.id, updates)}
                      displayScale={displayScale}
                    />
                  ),
                )}
              </Group>

              <Rect
                x={pa.x}
                y={pa.y}
                width={pa.width}
                height={pa.height}
                stroke="#E85D04"
                strokeWidth={1}
                dash={[2, 4]}
                listening={false}
                opacity={0.6}
              />
            </Layer>
          </Stage>
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Text node
// ---------------------------------------------------------------------------

interface TextNodeProps {
  element: DesignerTextElement;
  printArea: PrintArea;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<DesignerTextElement>) => void;
  placeholders: PlaceholderDefinition[];
  rules: TemplateFitRules;
  displayScale: number;
}

function TextNode({
  element,
  printArea,
  isSelected,
  onSelect,
  onChange,
  placeholders,
  rules,
  displayScale,
}: TextNodeProps) {
  const ref = useRef<Konva.Text>(null);

  const fitted = useMemo(() => {
    if (!element.placeholderId) return null;
    const ph = placeholders.find((p) => p.id === element.placeholderId);
    if (!ph) return null;
    return fitText(
      {
        text: element.text,
        rules,
        boundsWidthPx: element.width,
        boundsHeightPx: element.height,
        preferredFontSize: element.fontSize,
        preferredLetterSpacing: element.letterSpacing,
        fontFamily: element.fontFamily,
      },
      browserTextMeasurer,
    );
  }, [
    element.placeholderId,
    element.text,
    element.width,
    element.height,
    element.fontSize,
    element.letterSpacing,
    element.fontFamily,
    placeholders,
    rules,
  ]);

  const fontSize = fitted?.fontSize ?? element.fontSize;
  const letterSpacing = fitted?.letterSpacing ?? element.letterSpacing;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const clamped = clampToPrintArea(
      node.x(),
      node.y(),
      element.width,
      element.height,
      element.rotation,
      printArea,
    );
    node.position({ x: clamped.x, y: clamped.y });
    onChange({ x: clamped.x, y: clamped.y });
  };

  const handleTransformEnd = () => {
    const node = ref.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const rotation = node.rotation();
    const newWidth = Math.max(40, element.width * scaleX);
    const newHeight = Math.max(20, element.height * scaleY);

    const clamped = clampToPrintArea(
      node.x(),
      node.y(),
      newWidth,
      newHeight,
      rotation,
      printArea,
    );
    node.position({ x: clamped.x, y: clamped.y });

    const fontScale = (scaleX + scaleY) / 2;
    const nextFontSize = Math.max(
      rules.min_font_size,
      Math.min(rules.max_font_size, element.fontSize * fontScale),
    );

    onChange({
      x: clamped.x,
      y: clamped.y,
      width: newWidth,
      height: newHeight,
      rotation,
      fontSize: Math.round(nextFontSize * 100) / 100,
    });
  };

  return (
    <>
      <Text
        ref={ref}
        text={element.text}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        offsetX={element.width / 2}
        offsetY={element.height / 2}
        rotation={element.rotation}
        fontSize={fontSize}
        fontFamily={element.fontFamily}
        fill={element.fill}
        align={element.align}
        verticalAlign="middle"
        letterSpacing={letterSpacing}
        visible={element.visible}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        dragBoundFunc={(pos) => {
          // pos is in scaled screen coords — convert to logical, clamp, back.
          const logicalX = pos.x / displayScale;
          const logicalY = pos.y / displayScale;
          const clamped = clampToPrintArea(
            logicalX,
            logicalY,
            element.width,
            element.height,
            element.rotation,
            printArea,
          );
          return { x: clamped.x * displayScale, y: clamped.y * displayScale };
        }}
      />
      {isSelected ? (
        <Transformer
          rotateEnabled
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 30 || Math.abs(newBox.height) < 16) return oldBox;
            if (Math.abs(newBox.width) > printArea.width) return oldBox;
            if (Math.abs(newBox.height) > printArea.height) return oldBox;
            return newBox;
          }}
          nodes={[ref.current].filter(Boolean) as Konva.Text[]}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Image node
// ---------------------------------------------------------------------------

interface ImageNodeProps {
  element: DesignerImageElement;
  printArea: PrintArea;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<DesignerImageElement>) => void;
  displayScale: number;
}

function ImageNode({
  element,
  printArea,
  isSelected,
  onSelect,
  onChange,
  displayScale,
}: ImageNodeProps) {
  const ref = useRef<Konva.Image>(null);
  const image = useLoadedImage(element.src);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const clamped = clampToPrintArea(
      node.x(),
      node.y(),
      element.width,
      element.height,
      element.rotation,
      printArea,
    );
    node.position({ x: clamped.x, y: clamped.y });
    onChange({ x: clamped.x, y: clamped.y });
  };

  const handleTransformEnd = () => {
    const node = ref.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const rotation = node.rotation();
    const newWidth = Math.max(30, element.width * scaleX);
    const newHeight = Math.max(30, element.height * scaleY);
    const clamped = clampToPrintArea(
      node.x(),
      node.y(),
      newWidth,
      newHeight,
      rotation,
      printArea,
    );
    node.position({ x: clamped.x, y: clamped.y });
    onChange({
      x: clamped.x,
      y: clamped.y,
      width: newWidth,
      height: newHeight,
      rotation,
    });
  };

  if (!image) {
    return (
      <Rect
        x={element.x - element.width / 2}
        y={element.y - element.height / 2}
        width={element.width}
        height={element.height}
        fill="#EEE"
        stroke="#CCC"
        dash={[4, 4]}
        listening={false}
      />
    );
  }

  return (
    <>
      <KonvaImage
        ref={ref}
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        offsetX={element.width / 2}
        offsetY={element.height / 2}
        rotation={element.rotation}
        visible={element.visible}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        dragBoundFunc={(pos) => {
          const logicalX = pos.x / displayScale;
          const logicalY = pos.y / displayScale;
          const clamped = clampToPrintArea(
            logicalX,
            logicalY,
            element.width,
            element.height,
            element.rotation,
            printArea,
          );
          return { x: clamped.x * displayScale, y: clamped.y * displayScale };
        }}
      />
      {isSelected ? (
        <Transformer
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
            if (Math.abs(newBox.width) > printArea.width) return oldBox;
            if (Math.abs(newBox.height) > printArea.height) return oldBox;
            return newBox;
          }}
          nodes={[ref.current].filter(Boolean) as Konva.Image[]}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function mmToPx(mm: number, canvasPx: number, dimensionMm: number): number {
  if (!dimensionMm) return 0;
  return (mm / dimensionMm) * canvasPx;
}