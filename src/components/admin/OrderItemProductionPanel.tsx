'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Download,
  FileImage,
  FileText,
  Loader2,
  Lock,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProofEntry {
  id: string;
  version: number;
  status: string;
  created_at: string;
}

interface PrintJobEntry {
  id: string;
  file_type: 'pdf' | 'png' | 'zip';
  file_url: string | null;
  status: string;
  created_at: string;
}

interface Props {
  orderItemId: string;
  proofs: ProofEntry[];
  printJobs: PrintJobEntry[];
  latestProofApproved: boolean;
}

export function OrderItemProductionPanel({
  orderItemId,
  proofs,
  printJobs,
  latestProofApproved,
}: Props) {
  const router = useRouter();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPng, setGeneratingPng] = useState(false);
  const [bulkCsvBusy, setBulkCsvBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadProof() {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('order_item_id', orderItemId);
      if (proofFile) form.append('file', proofFile);

      const res = await fetch('/api/proofs/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Proof upload failed');
      setProofFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proof upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function generatePrint(kind: 'pdf' | 'png') {
    setError(null);
    kind === 'pdf' ? setGeneratingPdf(true) : setGeneratingPng(true);
    try {
      const res = await fetch('/api/print/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_item_id: orderItemId, file_type: kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Print generation failed');
      router.refresh();
      if (typeof data?.signedUrl === 'string') {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print generation failed');
    } finally {
      kind === 'pdf' ? setGeneratingPdf(false) : setGeneratingPng(false);
    }
  }

  async function bulkCsv() {
    setError(null);
    if (!csvFile) {
      setError('Choose a CSV file first');
      return;
    }
    setBulkCsvBusy(true);
    try {
      const form = new FormData();
      form.append('order_item_id', orderItemId);
      form.append('file', csvFile);
      const res = await fetch('/api/print/bulk-csv', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'CSV merge failed');
      setCsvFile(null);
      router.refresh();
      if (typeof data?.signedUrl === 'string') {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV merge failed');
    } finally {
      setBulkCsvBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      {/* Proofs ------------------------------------------------------ */}
      <div>
        <p className="spec-label mb-2">Proofs</p>
        {proofs.length === 0 ? (
          <p className="mb-3 text-xs text-ink-muted">No proofs uploaded yet.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {[...proofs]
              .sort((a, b) => b.version - a.version)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-mono text-ink-muted">v{p.version}</span>
                  <span className="tag capitalize">{p.status}</span>
                  <span className="text-[10px] text-ink-muted">
                    {new Date(p.created_at).toLocaleDateString('en-NZ')}
                  </span>
                </li>
              ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <button
            type="button"
            onClick={uploadProof}
            disabled={uploading}
            className="btn-ghost py-1.5 text-xs disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading
              ? 'Uploading…'
              : proofFile
              ? 'Upload Proof'
              : 'Auto-Generate Proof'}
          </button>
        </div>
      </div>

      {/* Production files -------------------------------------------- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="spec-label">Production files</p>
          {latestProofApproved ? (
            <span className="inline-flex items-center rounded-xs bg-success/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-success">
              Unlocked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-xs bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
              <Lock className="h-2.5 w-2.5" /> Locked
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generatePrint('pdf')}
            disabled={!latestProofApproved || generatingPdf}
            title={
              latestProofApproved
                ? 'Generate print-ready PDF'
                : 'Approve the proof first'
            }
            className={cn(
              'btn-ghost py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {generatingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={() => generatePrint('png')}
            disabled={!latestProofApproved || generatingPng}
            title={
              latestProofApproved
                ? 'Generate print-ready PNG'
                : 'Approve the proof first'
            }
            className="btn-ghost py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generatingPng ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileImage className="h-3.5 w-3.5" />
            )}
            PNG
          </button>
        </div>

        {/* Bulk CSV */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            disabled={!latestProofApproved}
            className="text-xs disabled:opacity-50"
          />
          <button
            type="button"
            onClick={bulkCsv}
            disabled={!latestProofApproved || bulkCsvBusy || !csvFile}
            title={
              latestProofApproved
                ? 'Merge CSV into ZIP'
                : 'Approve the proof first'
            }
            className="btn-ghost py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkCsvBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            Merge CSV
          </button>
        </div>

        {/* Existing print jobs */}
        {printJobs.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {printJobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                  {job.file_type.toUpperCase()} · {job.status}
                </span>
                <a
                  href={`/api/print/download/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}