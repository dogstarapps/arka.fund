"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import ClientConnect from "@/components/ClientConnect";
import { UX_REVIEW_PREVIEW } from '@/lib/previewSafety';
import {
  clearStoredOperatorSession,
  clearOperatorSessionCookie,
  deriveOperatorWalletBinding,
  readStoredOperatorSession,
  readStoredWalletPubkey,
  requestOperatorChallenge,
  validateOperatorSession,
  verifyOperatorChallengeSignature,
  writeStoredOperatorSession,
  writeStoredWalletPubkey,
  type OperatorAccessStatus,
} from "@/lib/operatorAccessClient";
import {
  OPERATOR_CONSOLE_NAV,
  PRIMARY_PRODUCT_NAV,
  buildPublicCreateArkaHref,
  isOperatorOnlyProductPath,
  isProductNavActive,
  resolveOperatorConsoleItem,
  type ProductNavItem,
} from "@/lib/workflows/productNavigation";
import { resolveGlobalSearchTarget } from "@/lib/workflows/globalSearch";

type OperatorAccessState = {
  status: OperatorAccessStatus;
  pubkey?: string;
  error?: string;
};

function NavGlyph({ icon }: { icon: ProductNavItem["icon"] }) {
  switch (icon) {
    case "discover":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 7 12l5 8 5-8-5-8Zm0 4.4L14.2 12 12 15.6 9.8 12 12 8.4Z" />
        </svg>
      );
    case "vaults":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16v11H4V7Zm2 2v7h12V9H6Zm3-4h6v2H9V5Z" />
        </svg>
      );
    case "governance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 7v5c0 4.8 2.9 7.8 7 9 4.1-1.2 7-4.2 7-9V7l-7-4Zm0 2.2 5 2.9V12c0 3.3-1.8 5.8-5 7-3.2-1.2-5-3.7-5-7V8.1l5-2.9Zm-1 3.8h2v4h-2V9Zm0 5.5h2v2h-2v-2Z" />
        </svg>
      );
    case "assets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 0 1 5.9 3.2H6.1A7 7 0 0 1 12 5Zm0 14a7 7 0 0 1-6.7-5h13.4A7 7 0 0 1 12 19Zm7-7H5c0-.7.1-1.4.3-2h13.4c.2.6.3 1.3.3 2Z" />
        </svg>
      );
    case "managers":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 10c-4.3 0-8 2.2-8 5v1h16v-1c0-2.8-3.7-5-8-5Zm0 2c3 0 5.4 1.1 5.9 2H6.1c.5-.9 2.9-2 5.9-2Z" />
        </svg>
      );
    case "integrations":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h4v2H9v3H7V4Zm6 0h4v5h-2V6h-2V4ZM7 15h2v3h2v2H7v-5Zm8 0h2v5h-4v-2h2v-3ZM8 10h8v4H8v-4Z" />
        </svg>
      );
    case "migrations":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6h8v2H8.4l7.3 7.3-1.4 1.4L7 9.4V14H5V6Zm14 12h-8v-2h4.6l-7.3-7.3 1.4-1.4L17 14.6V10h2v8Z" />
        </svg>
      );
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h4v7H4v-7Zm6 0h10v7H10v-7Z" />
        </svg>
      );
    case "create":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
        </svg>
      );
    case "coverage":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 7v5c0 4.8 2.9 7.8 7 9 4.1-1.2 7-4.2 7-9V7l-7-4Zm-1 5h2v3h3v2h-3v3h-2v-3H8v-2h3V8Z" />
        </svg>
      );
    case "ops":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.4 13a7.9 7.9 0 0 0 .1-2l2-1.6-2-3.4-2.5 1a8.6 8.6 0 0 0-1.8-1l-.4-2.7H9.2l-.4 2.7c-.6.2-1.2.5-1.8 1l-2.5-1-2 3.4 2 1.6a7.9 7.9 0 0 0 .1 2l-2 1.6 2 3.4 2.5-1c.6.5 1.2.8 1.8 1l.4 2.7h3.6l.4-2.7c.6-.2 1.2-.5 1.8-1l2.5 1 2-3.4-2-1.6ZM11 9h2v6h-2V9Zm0 7h2v2h-2v-2Z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 7 1.2 1.1 1.7-.4.9 1.5 1.8.6v1.8l-1.8.6-.9 1.5-1.7-.4L12 15l-1.2-1.1-1.7.4-.9-1.5-1.8-.6V10l1.8-.6.9-1.5 1.7.4L12 7Zm0 2.3A2.7 2.7 0 1 0 12 14.7 2.7 2.7 0 0 0 12 9.3Z" />
        </svg>
      );
    case "status":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18h14v2H5v-2Zm2-4h2v4H7v-4Zm4-5h2v9h-2V9Zm4-3h2v12h-2V6Z" />
        </svg>
      );
    case "tiers":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4 4 8l8 4 8-4-8-4Zm-6 6.5 6 3 6-3V14l-6 3-6-3v-3.5Zm0 5 6 3 6-3V19l-6 3-6-3v-1.5Z" />
        </svg>
      );
    case "contracts":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10a2 2 0 0 1 2 2v2h-2V6H7v12h10v-2h2v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm5 3 4 3-4 3V7Zm-6 3h4v2H6v-2Z" />
        </svg>
      );
  }
}

function Wordmark({ compact = false, link = true }: { compact?: boolean; link?: boolean }) {
  const content = (
    <>
      <Image
        src="/figma/logo-arkafund.png"
        alt=""
        width={compact ? 124 : 168}
        height={compact ? 24 : 32}
        className={`chrome-brand-image ${compact ? "chrome-brand-image-compact" : ""}`}
        priority
        unoptimized
      />
      <span className="chrome-brand-a11y">arka.fund vault intelligence</span>
    </>
  );

  if (!link) {
    return <div className={`chrome-brand ${compact ? "chrome-brand-compact" : ""}`}>{content}</div>;
  }

  return (
    <Link
      href="/dashboard"
      className={`chrome-brand ${compact ? "chrome-brand-compact" : ""}`}
      aria-label="Arka.fund dashboard"
    >
      {content}
    </Link>
  );
}

function OperatorRouteGate(props: {
  routeLabel: string;
  accessStatus: OperatorAccessStatus;
  busy: boolean;
  error?: string;
  onVerify: () => void;
}) {
  const checking = props.accessStatus === "checking";
  return (
    <section className="chrome-operator-gate" data-testid="operator-route-gate">
      <span className="surface-eyebrow">Verified operator wallet</span>
      <h1 className="chrome-operator-gate-title">{props.routeLabel} stays behind governed access</h1>
      <p className="chrome-operator-gate-copy">
        This route belongs to the advanced governance and operations surface. Connect an authorized operator wallet and sign the access challenge to open it from this shell.
      </p>
      <p className="chrome-operator-gate-copy chrome-operator-gate-copy-muted">
        Contract-level authorization, transaction signatures and timelock execution still apply independently when a write action is attempted.
      </p>
      {props.error ? (
        <p className="chrome-operator-gate-copy chrome-operator-gate-copy-error" role="alert">
          {props.error}
        </p>
      ) : null}
      <div className="chrome-operator-gate-actions">
        <button
          type="button"
          className="surface-button surface-button-primary"
          onClick={props.onVerify}
          disabled={props.busy || checking}
          data-testid="operator-route-enable"
        >
          {checking ? "Checking access" : props.busy ? "Verifying wallet" : "Verify operator wallet"}
        </button>
        <Link href="/dashboard" className="surface-button surface-button-secondary">
          Return to dashboard
        </Link>
      </div>
    </section>
  );
}

function OperatorSessionStrip(props: {
  routeLabel: string;
  pubkey?: string;
  onLock: () => void;
}) {
  return (
    <div className="chrome-operator-session-strip" data-testid="operator-session-strip">
      <div>
        <span className="surface-eyebrow">Operator shell</span>
        <p className="chrome-operator-session-copy">
          {props.routeLabel} is open for a verified operator wallet.
          {props.pubkey ? ` ${props.pubkey.slice(0, 6)}…${props.pubkey.slice(-4)}` : ""}
        </p>
      </div>
      <button
        type="button"
        className="chrome-advanced-inline-action"
        onClick={props.onLock}
        data-testid="advanced-console-disable-focus"
      >
        Lock console
      </button>
    </div>
  );
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const localManagedPreview = process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL === '1';
  const localManagedRoute = pathname === '/investments' || pathname === '/manage' || pathname?.startsWith('/arkas/') || pathname?.startsWith('/factory/create');
  const [publicMenuExpanded, setPublicMenuExpanded] = useState(false);
  useEffect(() => {
    if (!localManagedPreview) return;
    if (typeof window.matchMedia !== 'function') { setPublicMenuExpanded(true); return; }
    const desktop = window.matchMedia('(min-width: 701px)');
    const sync = () => setPublicMenuExpanded(desktop.matches);
    sync();
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, [localManagedPreview]);
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [operatorAccess, setOperatorAccess] = useState<OperatorAccessState>({ status: "checking" });
  const [operatorBusy, setOperatorBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(() => isOperatorOnlyProductPath(pathname));
  const operatorRouteItem = resolveOperatorConsoleItem(pathname);
  const operatorConsoleRoute = operatorRouteItem !== null;
  const operatorVerified = operatorAccess.status === "verified";
  const blockedUtilityRoute = operatorConsoleRoute && !operatorVerified;
  const showAdvancedConsole =
    advancedOpen || blockedUtilityRoute || (operatorVerified && operatorConsoleRoute);
  const renderAdvancedConsole = operatorConsoleRoute || operatorVerified;
  const createWizardRoute = !localManagedPreview && Boolean(pathname) && pathname.startsWith("/factory/create");
  const publicDashboardFrame = Boolean(pathname) &&
    !createWizardRoute &&
    !operatorConsoleRoute &&
    (pathname === "/" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/discover") ||
      pathname.startsWith("/vaults") ||
      pathname.startsWith("/arkas") ||
      pathname.startsWith("/governance") ||
      pathname.startsWith("/assets") ||
      pathname.startsWith("/managers") ||
      pathname.startsWith("/integrations"));
  const primaryNavPathname = pathname;
  const publicCreateHref = useMemo(
    () => buildPublicCreateArkaHref(pathname ?? "/dashboard"),
    [pathname],
  );
  const focusCanvas = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith("/factory/create")) return !localManagedPreview;
    return (
      operatorVerified &&
      (pathname.startsWith("/contracts") ||
        pathname.startsWith("/ops") ||
        pathname.startsWith("/tiers"))
    );
  }, [operatorVerified, pathname, localManagedPreview]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const browserSearch = window.location.search.replace(/^\?/, "");
    const currentSearch = new URLSearchParams(browserSearch).get("q") ?? "";
    setSearchValue(currentSearch);
  }, [pathname]);

  useEffect(() => {
    if (operatorConsoleRoute) {
      setAdvancedOpen(true);
    }
  }, [operatorConsoleRoute]);

  useEffect(() => {
    let cancelled = false;

    async function refreshOperatorAccess() {
      const stored = readStoredOperatorSession();
      if (!stored?.token) {
        clearStoredOperatorSession();
        if (!cancelled) setOperatorAccess({ status: "locked" });
        return;
      }

      const session = await validateOperatorSession(stored.token);
      if (cancelled) {
        return;
      }

      if (session.authorized) {
        const walletBinding = deriveOperatorWalletBinding({
          sessionPubkey: session.pubkey,
          walletPubkey: readStoredWalletPubkey(),
        });
        if (!walletBinding.valid) {
          clearStoredOperatorSession();
          setOperatorAccess({
            status: "locked",
            error: walletBinding.error,
          });
          return;
        }

        const verifiedSession = { ...session, token: stored.token };
        writeStoredOperatorSession(verifiedSession);
        setOperatorAccess({
          status: "verified",
          pubkey: verifiedSession.pubkey,
        });
        return;
      }

      clearStoredOperatorSession();
      setOperatorAccess({
        status: session.error ? "error" : "locked",
        error: session.message ?? session.error,
      });
    }

    void refreshOperatorAccess();

    const onWalletChanged = () => {
      const stored = readStoredOperatorSession();
      if (!stored?.pubkey) {
        return;
      }

      const walletBinding = deriveOperatorWalletBinding({
        sessionPubkey: stored.pubkey,
        walletPubkey: readStoredWalletPubkey(),
      });

      if (!walletBinding.valid) {
        clearStoredOperatorSession();
        setOperatorAccess({
          status: "locked",
          error: walletBinding.error,
        });
      }
    };

    window.addEventListener("wallet:pubkey-changed", onWalletChanged as EventListener);
    window.addEventListener("storage", onWalletChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("wallet:pubkey-changed", onWalletChanged as EventListener);
      window.removeEventListener("storage", onWalletChanged);
    };
  }, []);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Read the submitted control so a quick Enter always searches the text the
    // visitor sees, even before React has committed the latest input state.
    const submittedValue = new FormData(event.currentTarget).get("search");
    const query = typeof submittedValue === "string" ? submittedValue : searchValue;
    router.push(resolveGlobalSearchTarget(query).href);
  };

  const verifyOperatorAccess = async () => {
    setOperatorBusy(true);
    setOperatorAccess((current) => ({ ...current, error: undefined }));
    try {
      const wallet = await import("@/lib/walletKit");
      const kit = wallet.getWalletsKit();
      let pubkey = readStoredWalletPubkey().trim();
      if (!pubkey) {
        pubkey = await wallet.connectWallet(kit);
        writeStoredWalletPubkey(pubkey);
      }

      const challenge = await requestOperatorChallenge(pubkey);
      const challengeMessage = challenge.challenge;
      if (!challengeMessage) {
        throw new Error("Operator challenge missing");
      }
      const signature = await wallet.signMessageWithWallet(kit, challengeMessage, pubkey);
      const session = await verifyOperatorChallengeSignature({
        pubkey,
        challenge: challengeMessage,
        signature,
      });

      writeStoredOperatorSession(session);
      setOperatorAccess({ status: "verified", pubkey: session.pubkey });
      setAdvancedOpen(true);
    } catch (error) {
      clearStoredOperatorSession();
      setOperatorAccess({
        status: "error",
        error: error instanceof Error ? error.message : "Operator verification failed",
      });
    } finally {
      setOperatorBusy(false);
    }
  };

  const disableOperatorAccess = async () => {
    clearStoredOperatorSession();
    await clearOperatorSessionCookie();
    setOperatorAccess({ status: "locked" });
    setAdvancedOpen(true);
  };

  return (
    <div
      className={`chrome-shell chrome-shell-visual-cutover ${focusCanvas ? "chrome-shell-focus" : ""} ${
        createWizardRoute ? "chrome-shell-create" : ""
      } ${
        publicDashboardFrame ? "chrome-shell-public-dashboard" : ""
      } ${
        publicDashboardFrame && pathname === "/discover" ? "chrome-shell-route-discover" : ""
      } ${
        publicDashboardFrame && (pathname === "/" || pathname === "/dashboard")
          ? "chrome-shell-route-dashboard"
          : ""
      }`}
    >
      <div className={`chrome-topbar ${createWizardRoute ? "chrome-topbar-create" : ""}`}>
        <Wordmark />
        <form className="chrome-search-form chrome-topbar-search" onSubmit={onSearchSubmit}>
          <input
            name="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="chrome-search-input"
            aria-label="Search Arkas"
            placeholder={createWizardRoute ? "Search Arkas" : "Search vaults, managers or assets"}
            data-testid="chrome-search-input"
          />
          <button type="submit" className="chrome-search-submit" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4a6 6 0 1 0 3.9 10.5l4 4 1.4-1.4-4-4A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
            </svg>
          </button>
        </form>
        <div className="chrome-topbar-actions">
          {!createWizardRoute ? (
            <Link
              href={publicCreateHref}
              className="chrome-topbar-create-link"
              aria-label="Create Arka"
              data-public-create-entry="topbar"
              data-testid="chrome-create-primary"
            >
              Create Arka
            </Link>
          ) : null}
          <ClientConnect variant="chrome" />
          <Link href="/settings" className="chrome-gear-link" aria-label="Open settings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.6 3h2.8l.4 2a7 7 0 0 1 1.6.7l1.8-1 2 2-1 1.8c.3.5.5 1 .7 1.6l2 .4v2.8l-2 .4a7 7 0 0 1-.7 1.6l1 1.8-2 2-1.8-1a7 7 0 0 1-1.6.7l-.4 2h-2.8l-.4-2a7 7 0 0 1-1.6-.7l-1.8 1-2-2 1-1.8a7 7 0 0 1-.7-1.6l-2-.4v-2.8l2-.4c.2-.6.4-1.1.7-1.6l-1-1.8 2-2 1.8 1c.5-.3 1-.5 1.6-.7l.4-2Zm1.4 6.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
            </svg>
          </Link>
        </div>
      </div>

      {UX_REVIEW_PREVIEW ? <div className="ux-preview-banner" role="status" data-testid="ux-preview-banner">{process.env.NEXT_PUBLIC_MAINNET_GENERAL_READONLY === '1' ? 'Mainnet read-only · Signing and sending disabled' : process.env.NEXT_PUBLIC_MANAGED_SNAPSHOT_REPLAY === '1' ? 'Snapshot preview · Signing disabled' : localManagedPreview ? localManagedRoute ? 'Local sandbox · Fictitious assets · Standalone only · Live funds disabled' : 'Public data preview · Read-only browsing · Live funds disabled' : pathname === '/managed-withdrawals' ? 'Managed withdrawals preview · Synthetic balances · No blockchain transactions · Production is unchanged' : 'UX review preview · Live public data · Signing and sending are disabled · Production is unchanged'}</div> : null}

      <div
        className={`chrome-grid chrome-grid-visual-cutover ${focusCanvas ? "chrome-grid-focus" : ""} ${
          publicDashboardFrame ? "chrome-grid-public-dashboard" : ""
        }`}
      >
        <section className="chrome-main chrome-main-visual-cutover">
          <div
            className={`chrome-canvas ${focusCanvas ? "chrome-canvas-focus" : ""} ${
              createWizardRoute ? "chrome-canvas-create" : ""
            } ${
              publicDashboardFrame ? "chrome-canvas-public-dashboard" : ""
            }`}
            data-testid="product-canvas"
          >
            {blockedUtilityRoute && operatorRouteItem ? (
              <OperatorRouteGate
                routeLabel={operatorRouteItem.label}
                accessStatus={operatorAccess.status}
                busy={operatorBusy}
                error={operatorAccess.error}
                onVerify={verifyOperatorAccess}
              />
            ) : (
              <>
                {operatorVerified && operatorRouteItem ? (
                  <OperatorSessionStrip
                    routeLabel={operatorRouteItem.label}
                    pubkey={operatorAccess.pubkey}
                    onLock={() => {
                      void disableOperatorAccess();
                    }}
                  />
                ) : null}
                {children}
              </>
            )}
          </div>
        </section>

        <aside
          className={`chrome-rail chrome-rail-screen-cutover ${focusCanvas ? "chrome-rail-focus" : ""} ${
            publicDashboardFrame ? "chrome-rail-public-dashboard" : ""
          }`}
          data-testid="product-rail"
        >
          <nav className="chrome-rail-nav chrome-rail-nav-cutover" aria-label="Primary navigation">
            {PRIMARY_PRODUCT_NAV.slice(0, 3).map((item) => {
              const active = isProductNavActive(primaryNavPathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`chrome-rail-link ${active ? "chrome-rail-link-active" : ""}`}
                  data-testid={`chrome-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="chrome-rail-icon">
                    <NavGlyph icon={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <details className={`ux-platform-navigation ${localManagedPreview ? 'managed-platform-navigation' : ''}`} open={publicMenuExpanded || PRIMARY_PRODUCT_NAV.slice(3).some(item => isProductNavActive(primaryNavPathname,item.href))}>
              <summary>{localManagedPreview ? 'More from Arka' : 'Platform & research'}</summary>
              <div className={localManagedPreview ? 'managed-platform-links' : undefined}>
              {PRIMARY_PRODUCT_NAV.slice(3).map(item => <Link key={item.href} href={item.href} className={`chrome-rail-link ${isProductNavActive(primaryNavPathname,item.href) ? 'chrome-rail-link-active' : ''}`} data-testid={`chrome-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}><span className="chrome-rail-icon"><NavGlyph icon={item.icon} /></span><span>{item.label}</span></Link>)}
              </div>
            </details>
          </nav>

          {renderAdvancedConsole ? (
            <section
              className={`chrome-advanced-console ${
                showAdvancedConsole ? "chrome-advanced-console-open" : ""
              } chrome-advanced-console-cutover`}
              data-testid="advanced-console"
            >
              <button
                type="button"
                className="chrome-advanced-toggle"
                aria-expanded={showAdvancedConsole}
                aria-controls="advanced-console-links"
                onClick={() => setAdvancedOpen((value) => !value)}
                data-testid="advanced-console-toggle"
              >
                <span>Operator access</span>
                <span className="chrome-advanced-toggle-icon" aria-hidden="true">
                  {showAdvancedConsole ? "-" : "+"}
                </span>
              </button>
              {showAdvancedConsole ? (
                operatorVerified ? (
                  <div className="chrome-advanced-body" data-testid="advanced-console-operator">
                    <div className="chrome-advanced-status" data-testid="advanced-console-status">
                      <span className="chrome-advanced-status-pill chrome-advanced-status-pill-active">
                        Operator wallet verified
                      </span>
                      {operatorAccess.pubkey ? (
                        <span className="chrome-advanced-status-wallet">
                          {operatorAccess.pubkey.slice(0, 6)}…{operatorAccess.pubkey.slice(-4)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="chrome-advanced-inline-action"
                        onClick={() => {
                          void disableOperatorAccess();
                        }}
                        data-testid="advanced-console-disable"
                      >
                        Lock console
                      </button>
                    </div>
                    <div id="advanced-console-links" className="chrome-utility-grid">
                      {OPERATOR_CONSOLE_NAV.map((item) => {
                        const active = isProductNavActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`chrome-utility-link ${active ? "chrome-utility-link-active" : ""}`}
                            data-testid={`chrome-utility-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <span className="chrome-utility-icon">
                              <NavGlyph icon={item.icon} />
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="chrome-advanced-guard" id="advanced-console-links" data-testid="advanced-console-guard">
                    <span className="chrome-advanced-status-pill">Operator wallet required</span>
                    <p className="chrome-advanced-guard-copy">
                      Connect an authorized wallet and sign an access challenge to reveal governance, contracts, settings, ops and other advanced routes.
                    </p>
                    {operatorRouteItem ? (
                      <p className="chrome-advanced-guard-copy chrome-advanced-guard-copy-muted">
                        Current route: {operatorRouteItem.label}
                      </p>
                    ) : null}
                    {operatorAccess.error ? (
                      <p className="chrome-advanced-guard-copy chrome-operator-gate-copy-error" role="alert">
                        {operatorAccess.error}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="chrome-advanced-inline-action chrome-advanced-inline-action-primary"
                      onClick={verifyOperatorAccess}
                      disabled={operatorBusy || operatorAccess.status === "checking"}
                      data-testid="advanced-console-enable"
                    >
                      {operatorAccess.status === "checking"
                        ? "Checking access"
                        : operatorBusy
                          ? "Verifying wallet"
                          : "Verify operator wallet"}
                    </button>
                  </div>
                )
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
