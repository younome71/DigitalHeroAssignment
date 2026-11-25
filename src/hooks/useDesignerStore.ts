'use client';

import { create } from 'zustand';
import type { ProductRow, TemplateRow, PlaceholderDefinition } from '@/types/database';

// ---------------------------------------------------------------------------
// Element model
// ---------------------------------------------------------------------------

export interface DesignerElementBase {
  id: string;
  /** Center X in print-area-local coordinates. */
  x: number;
  /** Center Y in print-area-local coordinates. */
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  /** When set, this element is bound to a template placeholder. */
  placeholderId?: string;
}

export interface DesignerTextElement extends DesignerElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export interface DesignerImageElement extends DesignerElementBase {
  type: 'image';
  /** Ephemeral signed URL used for rendering. */
  src: string;
  /** Persistent storage path — what we save to the DB. */
  srcPath: string;
}

export type DesignerElement = DesignerTextElement | DesignerImageElement;

export interface DesignerConfig {
  widthMm: number;
  heightMm: number;
  materialId: string | null;
  orientation: 'landscape' | 'portrait';
  quantity: number;
}

export type ArtworkSource = 'canvas' | 'upload';

// ---------------------------------------------------------------------------
// History snapshot
// ---------------------------------------------------------------------------

interface Snapshot {
  elements: DesignerElement[];
  selectedId: string | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DesignerState {
  // Identity
  designId: string;
  userId: string;
  designName: string;

  // Catalogue context
  product: ProductRow | null;
  template: TemplateRow | null;
  availableTemplates: TemplateRow[];

  // Sale configuration
  config: DesignerConfig | null;

  // Content
  elements: DesignerElement[];
  selectedId: string | null;
  artworkSource: ArtworkSource;
  uploadedFilePath: string | null;
  uploadedFileUrl: string | null;

  // History
  past: Snapshot[];
  future: Snapshot[];

  // Modal
  proofPreviewOpen: boolean;

  // Actions — initialization
  initialize: (payload: {
    designId: string;
    userId: string;
    designName?: string;
    product: ProductRow;
    template: TemplateRow;
    availableTemplates: TemplateRow[];
    config: DesignerConfig;
    elements?: DesignerElement[];
    artworkSource?: ArtworkSource;
    uploadedFilePath?: string | null;
    uploadedFileUrl?: string | null;
  }) => void;

  setDesignName: (name: string) => void;

  // Templates & config
  switchTemplate: (template: TemplateRow) => void;
  setConfig: (partial: Partial<DesignerConfig>) => void;

  // Elements
  addTextElement: () => void;
  addImageElement: (src: string, srcPath: string, naturalWidth: number, naturalHeight: number) => void;
  updateElement: (id: string, updates: Partial<DesignerElement>) => void;
  removeElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Artwork source
  setArtworkSource: (source: ArtworkSource) => void;
  setUploadedFile: (path: string, url: string) => void;
  clearUploadedFile: () => void;

  // History
  undo: () => void;
  redo: () => void;

  // Modal
  setProofPreviewOpen: (open: boolean) => void;

  // Reset
  reset: () => void;
}

const FONT_STACKS = {
  display: "'Space Grotesk', sans-serif",
  body: "Inter, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `el_${Math.random().toString(36).slice(2, 10)}`;
}

function buildElementsFromTemplate(
  template: TemplateRow,
  rules: ProductRow['template_fit_rules'],
): DesignerElement[] {
  const elements: DesignerElement[] = [];
  for (const ph of template.placeholder_definitions as PlaceholderDefinition[]) {
    if (ph.type === 'text') {
      const fontSize = Math.max(
        rules.min_font_size,
        Math.min(rules.max_font_size, ph.fontSize),
      );
      elements.push({
        id: makeId(),
        type: 'text',
        text: ph.defaultText,
        x: ph.bounds.x + ph.bounds.width / 2,
        y: ph.bounds.y + ph.bounds.height / 2,
        width: ph.bounds.width,
        height: ph.bounds.height,
        rotation: 0,
        visible: true,
        fontSize,
        fontFamily: FONT_STACKS.body,
        fill: '#141413',
        align: ph.align,
        letterSpacing: 0,
        placeholderId: ph.id,
      });
    } else {
      // Image placeholder — created only when the user uploads a file.
    }
  }
  return elements;
}

export const useDesignerStore = create<DesignerState>((set, get) => {
  const commit = (next: Partial<DesignerState>) => {
    const state = get();
    set({
      past: [
        ...state.past.slice(-29),
        { elements: state.elements, selectedId: state.selectedId },
      ],
      future: [],
      ...next,
    });
  };

  return {
    designId: '',
    userId: '',
    designName: 'Untitled design',
    product: null,
    template: null,
    availableTemplates: [],
    config: null,
    elements: [],
    selectedId: null,
    artworkSource: 'canvas',
    uploadedFilePath: null,
    uploadedFileUrl: null,
    past: [],
    future: [],
    proofPreviewOpen: false,

    initialize: (payload) => {
      const elements =
        payload.elements ??
        buildElementsFromTemplate(payload.template, payload.product.template_fit_rules);

      set({
        designId: payload.designId,
        userId: payload.userId,
        designName: payload.designName ?? 'Untitled design',
        product: payload.product,
        template: payload.template,
        availableTemplates: payload.availableTemplates,
        config: payload.config,
        elements,
        selectedId: null,
        artworkSource: payload.artworkSource ?? 'canvas',
        uploadedFilePath: payload.uploadedFilePath ?? null,
        uploadedFileUrl: payload.uploadedFileUrl ?? null,
        past: [],
        future: [],
        proofPreviewOpen: false,
      });
    },

    setDesignName: (name) => set({ designName: name.slice(0, 100) }),

    switchTemplate: (template) => {
      const state = get();
      if (!state.product) return;
      const newElements = buildElementsFromTemplate(
        template,
        state.product.template_fit_rules,
      );
      commit({
        template,
        elements: newElements,
        selectedId: null,
      });
    },

    setConfig: (partial) =>
      set((s) =>
        s.config ? { config: { ...s.config, ...partial } } : {},
      ),

    addTextElement: () => {
      const state = get();
      if (!state.template || !state.product) return;
      const pa = state.template.print_area;
      const rules = state.product.template_fit_rules;
      const fontSize = Math.max(
        rules.min_font_size,
        Math.min(rules.max_font_size, 32),
      );
      const el: DesignerTextElement = {
        id: makeId(),
        type: 'text',
        text: 'New text',
        x: pa.x + pa.width / 2,
        y: pa.y + pa.height / 2,
        width: Math.min(pa.width * 0.6, 400),
        height: Math.min(pa.height * 0.15, 120),
        rotation: 0,
        visible: true,
        fontSize,
        fontFamily: FONT_STACKS.body,
        fill: '#141413',
        align: 'center',
        letterSpacing: 0,
      };
      commit({
        elements: [...state.elements, el],
        selectedId: el.id,
      });
    },

    addImageElement: (src, srcPath, naturalWidth, naturalHeight) => {
      const state = get();
      if (!state.template) return;
      const pa = state.template.print_area;
      const maxW = pa.width * 0.5;
      const maxH = pa.height * 0.5;
      const ratio = Math.min(maxW / naturalWidth, maxH / naturalHeight, 1);
      const width = Math.round(naturalWidth * ratio);
      const height = Math.round(naturalHeight * ratio);
      const el: DesignerImageElement = {
        id: makeId(),
        type: 'image',
        src,
        srcPath,
        x: pa.x + pa.width / 2,
        y: pa.y + pa.height / 2,
        width,
        height,
        rotation: 0,
        visible: true,
      };
      commit({
        elements: [...state.elements, el],
        selectedId: el.id,
      });
    },

    updateElement: (id, updates) => {
      const state = get();
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx < 0) return;
      const nextElements = [...state.elements];
      nextElements[idx] = { ...nextElements[idx], ...updates } as DesignerElement;

      // Debounce-free commit: pushing history on every keystroke would be
      // unusable, so we only push when the caller explicitly signals
      // structure changes via the dedicated methods (add/remove/reorder/
      // drag-end/transform-end). Position/drag ops go through updateElement
      // without committing to history; the Canvas calls updateElement only
      // at drag-end / transform-end, so history granularity is correct.
      set({ elements: nextElements });
    },

    removeElement: (id) => {
      const state = get();
      commit({
        elements: state.elements.filter((e) => e.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      });
    },

    selectElement: (id) => set({ selectedId: id }),

    bringForward: (id) => {
      const state = get();
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx < 0 || idx === state.elements.length - 1) return;
      const next = [...state.elements];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      commit({ elements: next });
    },

    sendBackward: (id) => {
      const state = get();
      const idx = state.elements.findIndex((e) => e.id === id);
      if (idx <= 0) return;
      const next = [...state.elements];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      commit({ elements: next });
    },

    setArtworkSource: (source) => set({ artworkSource: source }),

    setUploadedFile: (path, url) =>
      set({ uploadedFilePath: path, uploadedFileUrl: url, artworkSource: 'upload' }),

    clearUploadedFile: () =>
      set({ uploadedFilePath: null, uploadedFileUrl: null }),

    undo: () => {
      const state = get();
      if (state.past.length === 0) return;
      const previous = state.past[state.past.length - 1];
      set({
        past: state.past.slice(0, -1),
        future: [
          { elements: state.elements, selectedId: state.selectedId },
          ...state.future.slice(0, 29),
        ],
        elements: previous.elements,
        selectedId: previous.selectedId,
      });
    },

    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      const next = state.future[0];
      set({
        past: [
          ...state.past.slice(-29),
          { elements: state.elements, selectedId: state.selectedId },
        ],
        future: state.future.slice(1),
        elements: next.elements,
        selectedId: next.selectedId,
      });
    },

    setProofPreviewOpen: (open) => set({ proofPreviewOpen: open }),

    reset: () =>
      set({
        designId: '',
        userId: '',
        designName: 'Untitled design',
        product: null,
        template: null,
        availableTemplates: [],
        config: null,
        elements: [],
        selectedId: null,
        artworkSource: 'canvas',
        uploadedFilePath: null,
        uploadedFileUrl: null,
        past: [],
        future: [],
        proofPreviewOpen: false,
      }),
  };
});