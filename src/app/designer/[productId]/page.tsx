
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DesignerWorkspace } from '@/components/designer/DesignerWorkspace';
import type {
  DesignerElement,
  DesignerImageElement,
} from '@/hooks/useDesignerStore';
import { asProduct, asTemplates } from '@/lib/db-cast';

interface Params {
  productId: string;
}

interface SearchParams {
  designId?: string;
  width?: string;
  height?: string;
  material?: string;
  orientation?: string;
  qty?: string;
}

export const dynamic = 'force-dynamic';

export default async function DesignerPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { productId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/designer/${productId}`)}`,
    );
  }

  // ---- Product + division ---------------------------------------------
  const { data: product } = await supabase
    .from('products')
    .select('*, division:divisions(slug, name)')
    .eq('id', productId)
    .eq('active', true)
    .maybeSingle();

  if (!product) notFound();

  const typedProduct = asProduct(product);

  // ---- Templates -------------------------------------------------------
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('product_id', typedProduct.id)
    .eq('active', true)
    .order('name', { ascending: true });

  if (!templates || templates.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="spec-label">Designer</p>

        <h1 className="mt-2 font-display text-display-md">
          No templates yet
        </h1>

        <p className="mt-3 text-sm text-ink-muted">
          This product has no active templates. Ask production to add one,
          or use the direct-upload path from the division page.
        </p>

        <Link
          href={`/divisions/${typedProduct.division?.slug ?? ''}`}
          className="btn-ghost mt-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {typedProduct.division?.name ?? 'division'}
        </Link>
      </div>
    );
  }

  const typedTemplates = asTemplates(templates);

  // ---- Optional existing design ---------------------------------------
  let existingDesign: {
    id: string;
    name: string;
    template_id: string | null;
    canvas_json: unknown;
    config_snapshot: unknown;
    artwork_source: 'canvas' | 'upload';
    uploaded_artwork_url: string | null;
  } | null = null;

  if (sp.designId) {
    const { data } = await supabase
      .from('designs')
      .select(
        'id, name, template_id, canvas_json, config_snapshot, artwork_source, uploaded_artwork_url',
      )
      .eq('id', sp.designId)
      .eq('customer_id', user.id)
      .maybeSingle();

    existingDesign = data
      ? {
          ...data,
          artwork_source: (
            data.artwork_source === 'upload' ? 'upload' : 'canvas'
          ) as 'canvas' | 'upload',
        }
      : null;

    if (!existingDesign) notFound();
  }

  // ---- Resolve template + config --------------------------------------
  const typedTemplate =
    (existingDesign?.template_id
      ? typedTemplates.find(
          (t) => t.id === existingDesign!.template_id,
        )
      : null) ?? typedTemplates[0];

  const existingConfig = (existingDesign?.config_snapshot ?? {}) as {
    widthMm?: number;
    heightMm?: number;
    materialId?: string | null;
    orientation?: 'landscape' | 'portrait';
    quantity?: number;
  };

  const widthMm =
    Number(sp.width) ||
    existingConfig.widthMm ||
    Number(typedProduct.min_width_mm) * 2;

  const heightMm =
    Number(sp.height) ||
    existingConfig.heightMm ||
    Number(typedProduct.min_height_mm) * 2;

  const materialId =
    sp.material ??
    existingConfig.materialId ??
    typedProduct.allowed_materials[0]?.id ??
    null;

  const orientation =
    (sp.orientation as 'landscape' | 'portrait' | undefined) ??
    existingConfig.orientation ??
    typedProduct.allowed_orientations[0] ??
    'landscape';

  const quantity = Number(sp.qty) || existingConfig.quantity || 100;

  // ---- Hydrate saved elements with fresh signed URLs ------------------
  let hydratedElements: DesignerElement[] | undefined;
  let hydratedUploadUrl: string | null = null;
  let hydratedUploadPath: string | null = null;

  const savedElements =
    existingDesign &&
    Array.isArray(
      (existingDesign.canvas_json as { elements?: unknown })?.elements,
    )
      ? (
          existingDesign.canvas_json as {
            elements: DesignerElement[];
          }
        ).elements
      : null;

  if (savedElements) {
    const imagePaths = savedElements
      .filter(
        (e): e is DesignerImageElement =>
          e.type === 'image' && Boolean(e.srcPath),
      )
      .map((e) => e.srcPath);

    const pathToUrl = new Map<string, string>();

    if (imagePaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('customer-artworks')
        .createSignedUrls(imagePaths, 60 * 60 * 4);

      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) {
          pathToUrl.set(item.path, item.signedUrl);
        }
      }
    }

    if (existingDesign?.uploaded_artwork_url) {
      const path = existingDesign.uploaded_artwork_url;
      hydratedUploadPath = path;

      const cached = pathToUrl.get(path);

      if (cached) {
        hydratedUploadUrl = cached;
      } else {
        const { data: signed } = await supabase.storage
          .from('customer-artworks')
          .createSignedUrl(path, 60 * 60 * 4);

        hydratedUploadUrl = signed?.signedUrl ?? null;
      }
    }

    hydratedElements = savedElements.map(
      (el): DesignerElement => {
        if (el.type === 'image') {
          const url = pathToUrl.get(el.srcPath);
          return url ? { ...el, src: url } : el;
        }

        return el;
      },
    );
  }

  // ---- Render workspace -----------------------------------------------
  return (
    <DesignerWorkspace
      userId={user.id}
      designId={existingDesign?.id ?? crypto.randomUUID()}
      existingDesignName={existingDesign?.name}
      product={typedProduct}
      template={typedTemplate}
      availableTemplates={typedTemplates}
      divisionSlug={typedProduct.division?.slug ?? ''}
      initialConfig={{
        widthMm,
        heightMm,
        materialId,
        orientation,
        quantity,
      }}
      initialElements={hydratedElements}
      initialArtworkSource={existingDesign?.artwork_source ?? 'canvas'}
      initialUploadedFilePath={hydratedUploadPath}
      initialUploadedFileUrl={hydratedUploadUrl}
    />
  );
}
