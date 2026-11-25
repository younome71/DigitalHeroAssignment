'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProofAction =
  | 'uploaded'
  | 'approved'
  | 'rejected'
  | 'change_requested';

export type ProofStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface ProofLogEntry {
  id: string;
  action: ProofAction;
  notes: string | null;
  createdAt: string;
  userName: string | null;
  userRole: 'customer' | 'admin' | null;
}

export interface ProofApprovalProps {
  proofId: string;
  version: number;
  status: ProofStatus;
  signedUrl: string | null;
  createdAt: string;
  logs: ProofLogEntry[];
  isLatestPending: boolean;
  orderId: string;
  orderNumber: string;
  productName: string;
}

const ACTION_META: Record<
  ProofAction,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  uploaded: {
    label: 'Proof uploaded',
    icon: <Clock className="h-3.5 w-3.5" />,
    tone: 'text-ink-muted',
  },
  approved: {
    label: 'Approved',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    tone: 'text-success',
  },
  rejected: {
    label: 'Rejected',
    icon: <XCircle className="h-3.5 w-3.5" />,
    tone: 'text-danger',
  },
  change_requested: {
    label: 'Changes requested',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    tone: 'text-accent',
  },
};

export function ProofApproval({
  proofId,
  version,
  status,
  signedUrl,
  createdAt,
  logs,
  isLatestPending,
  orderId,
  orderNumber,
  productName,
}: ProofApprovalProps) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: 'approved' | 'rejected', withNotes: boolean) {
    setError(null);
    setBusy(decision === 'approved' ? 'approve' : 'reject');
    try {
      const res = await fetch(`/api/proofs/${proofId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes: withNotes && notes.trim() ? notes.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to submit decision');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const createdDate = new Date(createdAt).toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header ---------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="spec-label">Order {orderNumber}</p>
          <h1 className="mt-2 font-display text-display-md">
            Proof approval · {productName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="tag">v{version}</span>
            <StatusPill status={status} />
            <span className="text-[11px] text-ink-muted">
              Uploaded {createdDate}
            </span>
          </div>
        </div>
        <a href={`/dashboard`} className="text-xs text-ink-muted hover:text-ink">
          ← Back to dashboard
        </a>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Preview ----------------------------------------------- */}
        <div className="rounded-sm border border-line bg-surface p-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <p className="spec-label">Proof preview</p>
            <a
              href={signedUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent hover:underline disabled:text-ink-muted"
              aria-disabled={!signedUrl}
            >
              Open full PDF
            </a>
          </div>
          <div className="mt-3 aspect-[3/4] overflow-hidden rounded-xs border border-line bg-canvas">
            {signedUrl ? (
              <iframe
                src={`${signedUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={`Proof v${version}`}
                className="h-full w-full"
              />
            ) : (
              <p className="grid h-full w-full place-items-center text-xs text-ink-muted">
                Preview unavailable
              </p>
            )}
          </div>
        </div>

        {/* Timeline + actions ------------------------------------- */}
        <div className="space-y-6">
          <section className="rounded-sm border border-line bg-surface p-4">
            <p className="spec-label mb-3">Approval history</p>
            {logs.length === 0 ? (
              <p className="text-xs text-ink-muted">
                No activity yet on this proof.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-4">
                {logs.map((log) => {
                  const meta = ACTION_META[log.action];
                  return (
                    <li key={log.id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[22px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-surface',
                          meta.tone,
                        )}
                      >
                        {meta.icon}
                      </span>
                      <p className="text-xs font-medium text-ink">
                        {meta.label}
                        {log.userName ? (
                          <span className="text-ink-muted"> · {log.userName}</span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-ink-muted">
                        {new Date(log.createdAt).toLocaleString('en-NZ', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      {log.notes ? (
                        <p className="mt-1 rounded-sm bg-canvas px-2 py-1 text-[11px] text-ink-soft">
                          {log.notes}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-sm border border-line bg-surface p-4">
            <p className="spec-label mb-3">Your decision</p>

            {!isLatestPending ? (
              <p className="text-xs text-ink-muted">
                {status === 'approved'
                  ? 'This proof was approved. Production can proceed.'
                  : status === 'rejected'
                  ? 'This proof was rejected. Production is on hold.'
                  : status === 'superseded'
                  ? 'A newer version has been uploaded. Review the latest proof instead.'
                  : 'This proof can no longer be actioned.'}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => submit('approved', false)}
                  disabled={busy !== null}
                  className="btn-accent w-full"
                >
                  {busy === 'approve' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {busy === 'approve' ? 'Approving…' : 'Approve proof'}
                </button>

                <div className="mt-3">
                  {!showChangeForm ? (
                    <button
                      type="button"
                      onClick={() => setShowChangeForm(true)}
                      disabled={busy !== null}
                      className="w-full rounded-sm border border-line bg-surface px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
                    >
                      <MessageSquare className="mr-1.5 inline h-3.5 w-3.5" />
                      Request changes
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <label className="spec-label block" htmlFor="notes">
                        Describe the changes
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        maxLength={2_000}
                        className="input-base text-xs"
                        placeholder="e.g. Change the race number to 4123 and move the logo up by 5mm."
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submit('rejected', true)}
                          disabled={busy !== null || notes.trim().length === 0}
                          className="btn-primary flex-1 py-2 text-xs"
                        >
                          {busy === 'reject' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                          {busy === 'reject'
                            ? 'Sending…'
                            : 'Submit change request'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowChangeForm(false);
                            setNotes('');
                          }}
                          disabled={busy !== null}
                          className="rounded-sm border border-line bg-surface px-3 py-2 text-xs text-ink-soft hover:border-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {error ? (
              <p className="mt-3 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                {error}
              </p>
            ) : null}
          </section>

          <p className="text-center text-[11px] text-ink-muted">
            Order ref{' '}
            <a
              href={`/orders/${orderId}`}
              className="font-mono hover:text-ink"
            >
              {orderNumber}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ProofStatus }) {
  const map: Record<ProofStatus, { label: string; className: string }> = {
    pending: { label: 'Pending review', className: 'bg-accent text-white' },
    approved: { label: 'Approved', className: 'bg-success text-white' },
    rejected: { label: 'Rejected', className: 'bg-danger text-white' },
    superseded: { label: 'Superseded', className: 'bg-ink-soft text-white' },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs px-2 py-1 font-mono text-[10px] uppercase tracking-widest',
        className,
      )}
    >
      {label}
    </span>
  );
}