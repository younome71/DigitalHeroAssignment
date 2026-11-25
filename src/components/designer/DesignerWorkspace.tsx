'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  ShoppingBag,
} from 'lucide-react';
import type { ProductRow, TemplateRow } from '@/types/database';
import {
  useDesignerStore,
  type DesignerConfig,
  type DesignerElement,
  type ArtworkSource,
} from '@/hooks/useDesignerStore';
import { Toolbar } from './Toolbar';
import { LayerList } from './LayerList';
import { PropertiesPanel } from './PropertiesPanel';
import { UploadPanel } from './UploadPanel';
import { ProofPreview } from './ProofPreview';
import type { CanvasHandle } from './Canvas';

const Canvas = dynamic(() => import('./Canvas').then((m) => m.Canvas), {
  ssr: false,
  loading: () => (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-sm border border-line bg-surface">
      <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
    </div>
  ),
});

type Tab = 'properties' | 'layers' | 'upload';

interface Props {
  userId: string;
  designId: string;
  existingDesignName?: string;
  product: ProductRow;
  template: TemplateRow;
  availableTemplates: TemplateRow[];
  divisionSlug: string;
  initialConfig: DesignerConfig;
  initialElements?: DesignerElement[];
  initialArtworkSource: ArtworkSource;
  initialUploadedFilePath: string | null;
  initialUploadedFileUrl: string | null;
}

export function DesignerWorkspace({
  userId,
  designId,
  existingDesignName,
  product,
  template,
  availableTemplates,
  divisionSlug,
  initialConfig,
  initialElements,
  initialArtworkSource,
  initialUploadedFilePath,
  initialUploadedFileUrl,
}: Props) {
  const router = useRouter();
  const store = useDesignerStore();
  const canvasRef = useRef<CanvasHandle>(null);
  const [tab, setTab] = useState<Tab>('properties');
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate store on mount.
  useEffect(() => {
    useDesignerStore.getState().initialize({
      designId,
      userId,
      designName: existingDesignName ?? 'Untitled design',
      product,
      template,
      availableTemplates,
      config: initialConfig,
      elements: initialElements,
      artworkSource: initialArtworkSource,
      uploadedFilePath: initialUploadedFilePath,
      uploadedFileUrl: initialUploadedFileUrl,
    });
  }, [
    designId,
    userId,
    existingDesignName,
    product,
    template,
    availableTemplates,
    initialConfig,
    initialElements,
    initialArtworkSource,
    initialUploadedFilePath,
    initialUploadedFileUrl,
  ]);

  async function persistDesign(): Promise<{ id: string } | null> {
    const state = useDesignerStore.getState();
    if (!state.template || !state.config) return null;

    const thumbnail = canvasRef.current?.exportPng(2) ?? null;

    const res = await fetch('/api/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: state.designId,
        product_id: product.id,
        template_id: state.template.id,
        name: state.designName.trim() || 'Untitled design',
        canvas_json: {
          elements: state.elements,
          print_area: state.template.print_area,
          canvas_width_px: state.template.canvas_width_px,
          canvas_height_px: state.template.canvas_height_px,
        },
        config_snapshot: state.config,
        thumbnail_data_url: thumbnail,
        artwork_source: state.artworkSource,
        uploaded_artwork_url: state.uploadedFilePath,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? 'Failed to save design');
    }
    return res.json() as Promise<{ id: string }>;
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const result = await persistDesign();
      if (result) {
        router.push(`/designs/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout() {
    setError(null);
    setCheckingOut(true);
    try {
      const saved = await persistDesign();
      if (!saved) throw new Error('Unable to save design before checkout');

      const cfg = useDesignerStore.getState().config!;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: [
            {
              productId: product.id,
              designId: saved.id,
              quantity: cfg.quantity,
              widthMm: cfg.widthMm,
              heightMm: cfg.heightMm,
              materialId: cfg.materialId,
              orientation: cfg.orientation,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || typeof data?.url !== 'string') {
        throw new Error(data?.error ?? 'Checkout failed');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setCheckingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Toolbar
        onSave={handleSave}
        onCheckout={handleCheckout}
        saving={saving}
        checkingOut={checkingOut}
        divisionSlug={divisionSlug}
        productName={product.name}
      />

      {error ? (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
            {error}
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Canvas ---------------------------------------------------- */}
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-sm border border-line bg-surface shadow-panel">
              <div className="border-b border-line bg-canvas px-4 py-2">
                <div className="flex items-center justify-between">
                  <p className="spec-label">
                    Canvas · {template.name}
                  </p>
                  <p className="font-mono text-[10px] text-ink-muted tabular">
                    {template.canvas_width_px} × {template.canvas_height_px}px
                  </p>
                </div>
              </div>
              <div className="p-4">
                <Canvas ref={canvasRef} />
              </div>
            </div>
          </div>

          {/* Sidebar --------------------------------------------------- */}
          <div className="order-1 lg:order-2">
            <div className="rounded-sm border border-line bg-surface shadow-panel">
              <div className="grid grid-cols-3 border-b border-line">
                <TabButton active={tab === 'properties'} onClick={() => setTab('properties')}>
                  Properties
                </TabButton>
                <TabButton active={tab === 'layers'} onClick={() => setTab('layers')}>
                  Layers
                </TabButton>
                <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>
                  Upload
                </TabButton>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                {tab === 'properties' ? <PropertiesPanel /> : null}
                {tab === 'layers' ? <LayerList /> : null}
                {tab === 'upload' ? (
                  <UploadPanel
                    userId={userId}
                    designId={useDesignerStore.getState().designId || designId}
                  />
                ) : null}
              </div>
            </div>

            <Link
              href={`/divisions/${divisionSlug}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3 w-3" /> Back to {product.name}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile action bar -------------------------------------------- */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || checkingOut}
            className="btn-ghost flex-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={saving || checkingOut}
            className="btn-accent flex-1"
          >
            {checkingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
            {checkingOut ? 'Opening…' : 'Checkout'}
          </button>
        </div>
      </div>

      <ProofPreview />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'border-b-2 px-3 py-3 text-xs font-medium transition-colors ' +
        (active
          ? 'border-accent text-ink'
          : 'border-transparent text-ink-muted hover:text-ink')
      }
    >
      {children}
    </button>
  );
}