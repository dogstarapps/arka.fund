"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UX_REVIEW_PREVIEW } from '@/lib/previewSafety';

interface Props {
  children: ReactNode;
  snapshotKey: string;
  fundName: string;
  pays: string;
  receives: string;
  minimum: string;
  route: string;
  canReview: boolean;
  canSign: boolean;
  onConfirm: () => Promise<void>;
}

export default function FundSwapReview(props: Props) {
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reviewing = busy || (reviewedKey === props.snapshotKey && props.canReview);
  useEffect(() => { if (reviewing) headingRef.current?.focus(); }, [reviewing]);

  async function confirm() {
    if (busyRef.current || UX_REVIEW_PREVIEW || !props.canSign || !props.canReview || reviewedKey !== props.snapshotKey) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try { await props.onConfirm(); }
    catch { setError('The change could not be prepared. Review the current quote and try again.'); }
    finally { busyRef.current = false; setBusy(false); setReviewedKey(null); }
  }

  return <>
    {error ? <p role="alert" className="ops-alert ops-alert-warning">{error}</p> : null}
    <div hidden={reviewing} data-testid="rebalance-edit-form">
      {reviewedKey !== null && !reviewing ? <p role="status" className="surface-note">The quote or inputs changed. Review the updated amounts before continuing.</p> : null}
      {props.children}
      <button type="button" data-testid="rebalance-run-button" className="surface-button surface-button-primary ux-swap-review-cta" disabled={!props.canReview} onClick={() => setReviewedKey(props.snapshotKey)}>Review change</button>
    </div>
    {reviewing ? <section className="ux-swap-review" aria-label="Review fund change" data-testid="fund-swap-review">
      <h3 ref={headingRef} tabIndex={-1}>Review fund change</h3>
      <p className="surface-note">Both assets belong to {props.fundName}. This is not a personal wallet swap.</p>
      <dl>
        <div><dt>Fund affected</dt><dd>{props.fundName}</dd></div>
        <div><dt>The fund pays</dt><dd>{props.pays}</dd></div>
        <div><dt>Estimated to the fund</dt><dd>{props.receives}</dd></div>
        <div><dt>Minimum to the fund</dt><dd>{props.minimum}</dd></div>
        <div><dt>Quoted route</dt><dd>{props.route}</dd></div>
        <div><dt>Network cost</dt><dd>Calculated during the next simulation</dd></div>
      </dl>
      <p className="surface-note">A fresh quote, risk checks and simulation run before your wallet opens. If the new quote falls below this minimum, you must review it again.</p>
      {UX_REVIEW_PREVIEW ? <p className="ops-alert ops-alert-warning">Read-only preview. You can review this change, but no wallet will open and no transaction can be signed or sent.</p> : !props.canSign ? <p className="ops-alert ops-alert-warning">Connect the fund manager wallet to approve this change.</p> : null}
      <div className="ops-action-row">
        <button type="button" className="surface-button surface-button-secondary" disabled={busy} onClick={() => setReviewedKey(null)}>Back to amount</button>
        <button type="button" data-testid="rebalance-confirm-button" className="surface-button surface-button-primary" disabled={UX_REVIEW_PREVIEW || !props.canSign || !props.canReview || busy} onClick={() => { void confirm(); }}>{busy ? 'Checking and preparing…' : 'Confirm and open wallet'}</button>
      </div>
    </section> : null}
  </>;
}
