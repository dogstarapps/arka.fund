import Link from "next/link";
import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import {
  resolveAssetDisplayLabel,
  resolveAssetGlyphHue,
  resolveAssetGlyphText,
} from "@/lib/catalog/assetPresentation";
import {
  IDENTITY_FIELD_LIMITS,
  type EditableIdentityDraft,
} from "@/lib/catalog/identity";

export function SurfaceHero(props: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  aside: ReactNode;
}): ReactNode {
  return (
    <section className="surface-hero">
      <div className="surface-hero-copy">
        <div className="surface-hero-heading">
          <span className="surface-eyebrow">{props.eyebrow}</span>
          <h1 className="surface-title">{props.title}</h1>
          <p className="surface-description">{props.description}</p>
        </div>
        <div className="surface-hero-footer">
          <div className="surface-actions">
            <Link href={props.primaryHref} className="surface-button surface-button-primary">
              {props.primaryLabel}
            </Link>
            <Link href={props.secondaryHref} className="surface-button surface-button-secondary">
              {props.secondaryLabel}
            </Link>
          </div>
          <div className="surface-hero-rule" aria-hidden="true" />
        </div>
      </div>
      <div className="surface-hero-aside">
        <div className="surface-hero-aside-frame">{props.aside}</div>
      </div>
    </section>
  );
}

export function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "positive" | "warning";
  testId?: string;
}): ReactNode {
  const toneClass =
    props.tone === "positive"
      ? "metric-card-positive"
      : props.tone === "warning"
        ? "metric-card-warning"
        : "metric-card-default";

  return (
    <article className={`metric-card ${toneClass}`} data-testid={props.testId}>
      <span className="metric-label">{props.label}</span>
      <strong className="metric-value">{props.value}</strong>
      <span className="metric-detail">{props.detail}</span>
    </article>
  );
}

export function Panel(
  props: PropsWithChildren<{
    title: string;
    subtitle?: string;
    testId?: string;
    actions?: ReactNode;
    id?: string;
    className?: string;
  }>,
): ReactNode {
  const className = ["surface-panel", props.className].filter(Boolean).join(" ");
  return (
    <section id={props.id} className={className} data-testid={props.testId}>
      <div className="surface-panel-header">
        <div>
          <h2 className="surface-panel-title">{props.title}</h2>
          {props.subtitle ? <p className="surface-panel-subtitle">{props.subtitle}</p> : null}
        </div>
        {props.actions ? <div className="surface-panel-actions">{props.actions}</div> : null}
      </div>
      <div className="surface-panel-body">{props.children}</div>
    </section>
  );
}

export function SurfaceTable(
  props: PropsWithChildren<{
    columnsClassName: string;
    headers: ReactNode[];
    testId?: string;
    className?: string;
  }>,
): ReactNode {
  const className = ["surface-table", "surface-table-panel", props.className].filter(Boolean).join(" ");
  return (
    <div className={className} data-testid={props.testId}>
      <div className={`surface-table-header ${props.columnsClassName}`}>
        {props.headers.map((header, index) => (
          <div key={index}>{header}</div>
        ))}
      </div>
      {props.children}
    </div>
  );
}

export function StatusPill(props: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
}): ReactNode {
  const toneClass =
    props.tone === "positive"
      ? "status-pill-positive"
      : props.tone === "warning"
        ? "status-pill-warning"
        : props.tone === "critical"
          ? "status-pill-critical"
          : "status-pill-neutral";
  return <span className={`status-pill ${toneClass}`}>{props.label}</span>;
}

export function ActionField(
  props: PropsWithChildren<{
    label: string;
    htmlFor?: string;
    hint?: string;
    error?: string;
    span?: boolean;
    required?: boolean;
    className?: string;
    testId?: string;
  }>,
): ReactNode {
  const className = [
    "ops-field",
    props.span ? "ops-field-span" : "",
    props.error ? "ops-field-invalid" : "",
    props.className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={className} htmlFor={props.htmlFor} data-testid={props.testId}>
      <span className="ops-field-label-row">
        <span className="ops-field-label">{props.label}</span>
        {props.required ? <span className="ops-field-required">Required</span> : null}
      </span>
      {props.hint ? <span className="ops-field-hint">{props.hint}</span> : null}
      {props.children}
      {props.error ? <span className="ops-field-error">{props.error}</span> : null}
    </label>
  );
}

export function AssetGlyph(props: {
  contract?: string | null;
  label?: string | null;
  size?: "sm" | "md";
}): ReactNode {
  const glyphText = props.label
    ? resolveAssetGlyphText(props.label)
    : resolveAssetGlyphText(props.contract);
  const accessibleLabel = props.label ?? resolveAssetDisplayLabel(props.contract);
  const hue = resolveAssetGlyphHue(props.contract ?? props.label);

  return (
    <span
      className={`asset-glyph asset-glyph-${props.size ?? "sm"}`}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      style={{ "--asset-glyph-hue": String(hue) } as CSSProperties}
    >
      {glyphText}
    </span>
  );
}

export function AssetMark(props: {
  contract?: string | null;
  label?: string | null;
  size?: "sm" | "md";
  iconUrl?: string | null;
  fallbackIconUrl?: string | null;
}): ReactNode {
  const accessibleLabel = props.label ?? resolveAssetDisplayLabel(props.contract);
  const iconUrl = props.iconUrl ?? props.fallbackIconUrl ?? null;

  if (!iconUrl) {
    return <AssetGlyph contract={props.contract} label={props.label} size={props.size} />;
  }

  return (
    <span
      className={`asset-mark asset-mark-${props.size ?? "sm"}`}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={(event) => {
          const target = event.currentTarget;
          const fallback = props.fallbackIconUrl;
          if (fallback && target.src !== new URL(fallback, window.location.origin).href) {
            target.src = fallback;
            return;
          }
          target.style.display = "none";
        }}
      />
    </span>
  );
}

export function TransactionFeedbackRail(props: {
  loading?: boolean;
  loadingLabel?: string;
  status?: string;
  error?: string;
  loadingTestId?: string;
  statusTestId?: string;
  errorTestId?: string;
}): ReactNode {
  if (!props.loading && !props.status && !props.error) {
    return null;
  }

  return (
    <div className="transaction-rail transaction-surface-rail">
      {props.loading ? (
        <div className="transaction-rail-card transaction-rail-card-loading" data-testid={props.loadingTestId}>
          <span className="transaction-rail-spinner" aria-hidden="true" />
          <div className="transaction-rail-copy">
            <span className="transaction-rail-label">Waiting for network confirmation</span>
            <strong className="transaction-rail-value">{props.loadingLabel ?? "Preparing signed action..."}</strong>
          </div>
        </div>
      ) : null}
      {props.status ? (
        <div
          className="transaction-rail-card transaction-rail-card-success"
          data-testid={props.statusTestId}
        >
          <div className="transaction-rail-copy">
            <span className="transaction-rail-label">Transaction update</span>
            <strong className="transaction-rail-value">{props.status}</strong>
          </div>
        </div>
      ) : null}
      {props.error ? (
        <div
          className="transaction-rail-card transaction-rail-card-error"
          data-testid={props.errorTestId}
        >
          <div className="transaction-rail-copy">
            <span className="transaction-rail-label">Action could not be completed</span>
            <strong className="transaction-rail-value">{props.error}</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TransactionReviewCard(props: {
  title: string;
  body: string;
  tone?: "neutral" | "positive" | "warning";
  bullets?: string[];
  testId?: string;
}): ReactNode {
  const toneClass =
    props.tone === "positive"
      ? "transaction-review-positive"
      : props.tone === "warning"
        ? "transaction-review-warning"
        : "transaction-review-neutral";

  return (
    <article
      className={`transaction-review-card transaction-surface-review-card ${toneClass}`}
      data-testid={props.testId}
    >
      <div className="transaction-review-head">
        <div>
          <span className="transaction-review-kicker">Review</span>
          <div className="transaction-review-title">{props.title}</div>
        </div>
        <StatusPill
          label={
            props.tone === "positive"
              ? "Ready"
              : props.tone === "warning"
                ? "Review carefully"
                : "Inspect"
          }
          tone={props.tone === "positive" ? "positive" : props.tone === "warning" ? "warning" : "neutral"}
        />
      </div>
      <p className="transaction-review-body">{props.body}</p>
      {props.bullets && props.bullets.length > 0 ? (
        <div className="transaction-review-list">
          {props.bullets.map((bullet) => (
            <div key={bullet} className="transaction-review-item">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function TransactionConfirmDialog(props: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  detail?: string;
  bullets?: string[];
  tone?: "warning" | "critical" | "positive";
  busy?: boolean;
  confirmTestId?: string;
  cancelTestId?: string;
}): ReactNode {
  if (!props.open) {
    return null;
  }

  const toneClass =
    props.tone === "critical"
      ? "transaction-dialog-critical"
      : props.tone === "positive"
        ? "transaction-dialog-positive"
        : "transaction-dialog-warning";

  return (
    <div
      className="transaction-dialog-backdrop transaction-surface-dialog-backdrop"
      role="presentation"
      onClick={props.onCancel}
    >
      <div
        className={`transaction-dialog transaction-surface-confirm-dialog ${toneClass}`}
        data-testid="transaction-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="transaction-dialog-frame" aria-hidden="true" />
        <div className="transaction-dialog-content">
          <span className="transaction-dialog-kicker">Confirm transaction</span>
          <h2 id="transaction-dialog-title" className="transaction-dialog-title">
            {props.title}
          </h2>
          <p className="transaction-dialog-body">{props.body}</p>
          {props.detail ? <div className="transaction-dialog-detail">{props.detail}</div> : null}
          {props.bullets && props.bullets.length > 0 ? (
            <div className="transaction-dialog-list">
              {props.bullets.map((bullet) => (
                <div key={bullet} className="transaction-dialog-item">
                  {bullet}
                </div>
              ))}
            </div>
          ) : null}
          <div className="transaction-dialog-actions">
            <button
              type="button"
              className="surface-button surface-button-secondary"
              onClick={props.onCancel}
              data-testid={props.cancelTestId}
            >
              Cancel
            </button>
            <button
              type="button"
              className="surface-button surface-button-primary"
              onClick={props.onConfirm}
              disabled={props.busy}
              data-testid={props.confirmTestId}
            >
              {props.busy ? "Submitting..." : props.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransactionSuccessDialog(props: {
  open: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onClose: () => void;
  detailRows?: Array<{ label: string; value: string }>;
  primaryTestId?: string;
  secondaryTestId?: string;
}): ReactNode {
  if (!props.open) {
    return null;
  }

  return (
    <div
      className="transaction-dialog-backdrop transaction-surface-dialog-backdrop"
      role="presentation"
      onClick={props.onClose}
    >
      <div
        className="transaction-dialog transaction-surface-confirm-dialog transaction-dialog-positive transaction-success-dialog"
        data-testid="transaction-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-success-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="transaction-dialog-frame" aria-hidden="true" />
        <div className="transaction-dialog-content">
          <span className="transaction-dialog-kicker">Arka created</span>
          <h2 id="transaction-success-dialog-title" className="transaction-dialog-title">
            {props.title}
          </h2>
          <p className="transaction-dialog-body">{props.body}</p>
          {props.detailRows && props.detailRows.length > 0 ? (
            <div className="identity-detail-grid" data-testid="transaction-success-details">
              {props.detailRows.map((row) => (
                <div key={row.label} className="identity-detail-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <div className="transaction-dialog-actions">
            <button
              type="button"
              className="surface-button surface-button-secondary"
              onClick={props.onSecondary}
              data-testid={props.secondaryTestId}
            >
              {props.secondaryLabel}
            </button>
            <button
              type="button"
              className="surface-button surface-button-primary"
              onClick={props.onPrimary}
              data-testid={props.primaryTestId}
            >
              {props.primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IdentityEditDialog(props: {
  open: boolean;
  title: string;
  body: string;
  draft: EditableIdentityDraft;
  busy?: boolean;
  error?: string;
  onDraftChange: (draft: EditableIdentityDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  testId?: string;
}): ReactNode {
  if (!props.open) {
    return null;
  }

  const updateDraft = (patch: Partial<EditableIdentityDraft>) => {
    props.onDraftChange({ ...props.draft, ...patch });
  };

  return (
    <div
      className="transaction-dialog-backdrop transaction-surface-dialog-backdrop"
      role="presentation"
      onClick={props.onCancel}
    >
      <div
        className="transaction-dialog transaction-surface-confirm-dialog identity-edit-dialog"
        data-testid={props.testId ?? "identity-edit-dialog"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-edit-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="transaction-dialog-frame" aria-hidden="true" />
        <div className="transaction-dialog-content">
          <span className="transaction-dialog-kicker">Profile identity</span>
          <h2 id="identity-edit-dialog-title" className="transaction-dialog-title">
            {props.title}
          </h2>
          <p className="transaction-dialog-body">{props.body}</p>
          <div className="identity-edit-form">
            <label className="ops-field">
              <span className="ops-field-label">Display name</span>
              <input
                className="ops-input"
                value={props.draft.displayName}
                maxLength={IDENTITY_FIELD_LIMITS.displayName}
                onChange={(event) => updateDraft({ displayName: event.target.value })}
                placeholder="Commercial name"
                data-testid="identity-display-name-input"
              />
              <span className="surface-table-subtle identity-character-counter">
                {props.draft.displayName.length}/{IDENTITY_FIELD_LIMITS.displayName}
              </span>
            </label>
            <label className="ops-field">
              <span className="ops-field-label">Short summary</span>
              <textarea
                className="ops-textarea"
                value={props.draft.description}
                maxLength={IDENTITY_FIELD_LIMITS.description}
                rows={2}
                onChange={(event) => updateDraft({ description: event.target.value })}
                placeholder="A concise introduction shown in listings and profile headers."
                data-testid="identity-description-input"
              />
              <span className="surface-table-subtle identity-character-counter">
                {props.draft.description.length}/{IDENTITY_FIELD_LIMITS.description}
              </span>
            </label>
            <label className="ops-field">
              <span className="ops-field-label">Strategy</span>
              <textarea
                className="ops-textarea"
                value={props.draft.strategy}
                maxLength={IDENTITY_FIELD_LIMITS.strategy}
                rows={6}
                onChange={(event) => updateDraft({ strategy: event.target.value })}
                placeholder="Describe how the portfolio is managed and where it may allocate capital."
                data-testid="identity-strategy-input"
              />
              <span className="surface-table-subtle identity-character-counter">
                {props.draft.strategy.length}/{IDENTITY_FIELD_LIMITS.strategy}
              </span>
            </label>
            <label className="ops-field">
              <span className="ops-field-label">Risk disclosure</span>
              <textarea
                className="ops-textarea"
                value={props.draft.riskDisclosure}
                maxLength={IDENTITY_FIELD_LIMITS.riskDisclosure}
                rows={4}
                onChange={(event) => updateDraft({ riskDisclosure: event.target.value })}
                placeholder="Explain the main risks investors should consider."
                data-testid="identity-risk-input"
              />
              <span className="surface-table-subtle identity-character-counter">
                {props.draft.riskDisclosure.length}/{IDENTITY_FIELD_LIMITS.riskDisclosure}
              </span>
            </label>
            <label className="ops-field">
              <span className="ops-field-label">Target return</span>
              <textarea
                className="ops-textarea"
                value={props.draft.targetReturn}
                maxLength={IDENTITY_FIELD_LIMITS.targetReturn}
                rows={2}
                onChange={(event) => updateDraft({ targetReturn: event.target.value })}
                placeholder="Optional target and the conditions that may affect it."
                data-testid="identity-target-return-input"
              />
              <span className="surface-table-subtle identity-character-counter">
                {props.draft.targetReturn.length}/{IDENTITY_FIELD_LIMITS.targetReturn}
              </span>
            </label>
            <div className="identity-edit-link-grid">
              <label className="ops-field">
                <span className="ops-field-label">Website</span>
                <input
                  className="ops-input"
                  value={props.draft.websiteUrl ?? ""}
                  onChange={(event) => updateDraft({ websiteUrl: event.target.value })}
                  placeholder="https://"
                  data-testid="identity-website-input"
                />
              </label>
              <label className="ops-field">
                <span className="ops-field-label">Social</span>
                <input
                  className="ops-input"
                  value={props.draft.socialUrl ?? ""}
                  onChange={(event) => updateDraft({ socialUrl: event.target.value })}
                  placeholder="https://"
                  data-testid="identity-social-input"
                />
              </label>
            </div>
          </div>
          {props.error ? (
            <p className="ops-field-error" role="alert" data-testid="identity-edit-error">
              {props.error}
            </p>
          ) : null}
          <div className="transaction-dialog-actions">
            <button
              type="button"
              className="surface-button surface-button-secondary"
              onClick={props.onCancel}
              disabled={props.busy}
              data-testid="identity-edit-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="surface-button surface-button-primary"
              onClick={props.onSave}
              disabled={props.busy}
              data-testid="identity-edit-save"
            >
              {props.busy ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingState(props: { title: string; body: string; testId?: string }): ReactNode {
  return (
    <div
      className="surface-empty-state surface-empty-state-loading"
      data-testid={props.testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="surface-empty-spinner" aria-hidden="true" />
      <div className="surface-empty-copy">
        <h2 className="surface-empty-title">{props.title}</h2>
        <p className="surface-empty-body">{props.body}</p>
      </div>
    </div>
  );
}

export function SurfaceLoadStatus(props: {
  title: string;
  body: string;
  testId?: string;
  tone?: "refresh" | "warning";
}): ReactNode {
  return (
    <div
      className={`surface-load-status surface-load-status-${props.tone ?? "refresh"}`}
      data-testid={props.testId}
      role="status"
      aria-live="polite"
      aria-busy={props.tone === "warning" ? undefined : "true"}
    >
      <span className="surface-load-spinner" aria-hidden="true" />
      <div className="surface-load-copy">
        <span className="surface-load-label">{props.title}</span>
        <p className="surface-load-body">{props.body}</p>
      </div>
    </div>
  );
}

export function ErrorState(props: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  testId?: string;
}): ReactNode {
  return (
    <div className="surface-empty-state surface-empty-state-action" data-testid={props.testId}>
      <div className="surface-empty-copy">
        <h2 className="surface-empty-title">{props.title}</h2>
        <p className="surface-empty-body">{props.body}</p>
      </div>
      <button
        type="button"
        className="surface-button surface-button-primary surface-empty-action"
        onClick={props.onAction}
      >
        {props.actionLabel}
      </button>
    </div>
  );
}

export function CatalogOfflineState(props: {
  title?: string;
  body?: string;
  onRetry: () => void;
  testId?: string;
}): ReactNode {
  return (
    <div
      className="surface-empty-state surface-empty-state-action catalog-offline-state"
      data-testid={props.testId}
    >
      <div className="surface-empty-copy">
        <span className="surface-eyebrow">Data unavailable</span>
        <h2 className="surface-empty-title">
          {props.title ?? "Product data is not available"}
        </h2>
        <p className="surface-empty-body">
          {props.body ??
            "This view could not load current product data. Retry, or check status if the problem continues."}
        </p>
        <div className="surface-chip-wrap catalog-offline-actions">
          <button
            type="button"
            className="surface-button surface-button-primary"
            onClick={props.onRetry}
          >
            Retry
          </button>
          <Link href="/status" className="surface-button surface-button-secondary">
            Open status
          </Link>
          <Link href="/settings" className="surface-button surface-button-secondary">
            Inspect config
          </Link>
        </div>
      </div>
    </div>
  );
}

export function EmptyState(props: { title: string; body: string; testId?: string }): ReactNode {
  return (
    <div className="surface-empty-state" data-testid={props.testId}>
      <div className="surface-empty-copy">
        <h2 className="surface-empty-title">{props.title}</h2>
        <p className="surface-empty-body">{props.body}</p>
      </div>
    </div>
  );
}

export function BarList(props: {
  items: Array<{
    id: string;
    label: string;
    value: string;
    meta: string;
    widthPct: number;
    accent?: string;
    href?: string;
    ariaLabel?: string;
    testId?: string;
  }>;
  testId?: string;
}): ReactNode {
  return (
    <div className="bar-list" data-testid={props.testId}>
      {props.items.map((item) => {
        const content = (
          <>
            <div className="bar-list-heading">
              <div>
                <div className="bar-list-label">{item.label}</div>
                <div className="bar-list-meta">{item.meta}</div>
              </div>
              <strong className="bar-list-value">{item.value}</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(8, Math.min(100, item.widthPct))}%`,
                  background: item.accent ?? "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
                }}
              />
            </div>
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className="bar-list-row bar-list-row-link"
              aria-label={item.ariaLabel ?? item.label}
              data-testid={item.testId}
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={item.id} className="bar-list-row" data-testid={item.testId}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function HistoryBars(props: {
  items: Array<{
    id: string;
    label: string;
    value: string;
    widthPct: number;
  }>;
  testId?: string;
}): ReactNode {
  return (
    <div className="history-bars" data-testid={props.testId}>
      {props.items.map((item) => (
        <div key={item.id} className="history-bars-row">
          <span className="history-bars-label">{item.label}</span>
          <div className="history-bars-track">
            <div className="history-bars-fill" style={{ width: `${Math.max(8, Math.min(100, item.widthPct))}%` }} />
          </div>
          <strong className="history-bars-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
