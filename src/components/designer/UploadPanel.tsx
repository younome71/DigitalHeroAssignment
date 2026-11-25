'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDesignerStore } from '@/hooks/useDesignerStore';

const ACCEPTED_EXTENSIONS = ['.pdf', '.svg', '.ai', '.png'];
const ACCEPTED_MIME = [
  'application/pdf',
  'image/svg+xml',
  'image/png',
  'application/postscript',
  'application/illustrator',
];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface Props {
  userId: string;
  designId: string;
}

function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const ext = ACCEPTED_EXTENSIONS.find((e) => lower.endsWith(e));
  if (!ext) {
    return `Unsupported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_SIZE) {
    return 'File exceeds the 20MB limit';
  }
  // MIME is advisory — some browsers misreport .ai.
  if (file.type && !ACCEPTED_MIME.includes(file.type)) {
    // Still allow if extension matches and MIME is empty/unknown.
    if (file.type !== '' && file.type !== 'application/octet-stream') {
      // Just warn silently — do not block on MIME alone.
    }
  }
  return null;
}

export function UploadPanel({ userId, designId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadedFilePath = useDesignerStore((s) => s.uploadedFilePath);
  const uploadedFileUrl = useDesignerStore((s) => s.uploadedFileUrl);
  const setUploadedFile = useDesignerStore((s) => s.setUploadedFile);
  const clearUploadedFile = useDesignerStore((s) => s.clearUploadedFile);
  const setArtworkSource = useDesignerStore((s) => s.setArtworkSource);
  const addImageElement = useDesignerStore((s) => s.addImageElement);

  async function handleFile(file: File) {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${designId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-artworks')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: signed, error: signError } = await supabase.storage
        .from('customer-artworks')
        .createSignedUrl(path, 60 * 60 * 4);

      if (signError || !signed?.signedUrl) {
        throw new Error('Failed to generate preview URL');
      }

      setUploadedFile(path, signed.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Logos must be PNG, JPG, or SVG images.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Logo exceeds the 20MB limit');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${designId}/logo-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('customer-artworks')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { data: signed } = await supabase.storage
        .from('customer-artworks')
        .createSignedUrl(path, 60 * 60 * 4);

      if (!signed?.signedUrl) throw new Error('Failed to sign logo URL');

      // Load natural size for placement.
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = signed.signedUrl!;
      });

      addImageElement(signed.signedUrl, path, dims.w, dims.h);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-6 p-4">
      {/* Canvas logo ------------------------------------------------ */}
      <section>
        <p className="spec-label mb-2">Add logo to canvas</p>
        <label className="flex cursor-pointer items-center justify-between rounded-sm border border-line bg-surface px-3 py-2.5 text-xs transition-colors hover:border-ink">
          <span className="text-ink">PNG, JPG, SVG</span>
          <Upload className="h-3.5 w-3.5 text-ink-muted" />
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLogoUpload(file);
              e.currentTarget.value = '';
            }}
            className="sr-only"
            disabled={busy}
          />
        </label>
      </section>

      <div className="spec-divider" />

      {/* Full artwork ------------------------------------------------ */}
      <section>
        <p className="spec-label mb-2">Upload full artwork</p>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-muted">
          Bypass the canvas and send us a production-ready file. Allowed: PDF, SVG, AI, PNG. Max 20MB.
        </p>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-sm border-2 border-dashed border-line bg-canvas px-4 py-8 text-center transition-colors hover:border-ink"
        >
          <Upload className="mx-auto h-6 w-6 text-ink-muted" />
          <p className="mt-3 text-xs text-ink-soft">
            Drop file or{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-ink underline-offset-4 hover:underline"
              disabled={busy}
            >
              browse
            </button>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.currentTarget.value = '';
            }}
            className="sr-only"
            disabled={busy}
          />
        </div>

        {busy ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
          </div>
        ) : null}

        {uploadedFilePath && !busy ? (
          <div className="mt-3 flex items-start gap-2 rounded-sm border border-success/30 bg-success/5 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-success">Artwork uploaded</p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-ink-muted">
                {uploadedFilePath.split('/').pop()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearUploadedFile();
                setArtworkSource('canvas');
              }}
              className="grid h-6 w-6 place-items-center rounded-xs text-ink-muted hover:bg-surface"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {uploadedFilePath && uploadedFileUrl ? (
          <button
            type="button"
            onClick={() => setArtworkSource('upload')}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Use uploaded file instead of canvas
          </button>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}