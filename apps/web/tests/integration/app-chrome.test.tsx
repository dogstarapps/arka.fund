import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/integrations/operator",
  searchParams: new URLSearchParams("q=blend"),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ push: navigationState.push }),
  useSearchParams: () => navigationState.searchParams,
}));

vi.mock("@/components/ClientConnect", () => ({
  default: ({ variant = "chrome" }: { variant?: string }) => (
    <div data-testid={`client-connect-${variant}`}>wallet</div>
  ),
}));

const walletMocks = vi.hoisted(() => ({
  connectWallet: vi.fn(async () => "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV"),
  connectFreighterDirect: vi.fn(async () => "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV"),
  getWalletsKit: vi.fn(() => ({ id: "kit" })),
  isWalletSelectionClosedError: vi.fn(
    (event: unknown) => event instanceof Error && event.message === "Wallet selection was closed",
  ),
  signMessageWithWallet: vi.fn(async () => "signed-message"),
}));

vi.mock("@/lib/walletKit", () => walletMocks);

import AppChrome from "@/components/product/AppChrome";
import { OPERATOR_CONSOLE_NAV } from "@/lib/workflows/productNavigation";

function readLocalHref(element: HTMLElement): URL {
  const href = element.getAttribute("href");
  expect(href).toBeTruthy();
  return new URL(href ?? "", "https://arka.fund");
}

describe("AppChrome", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/operator/access?token=")) {
        return new Response(JSON.stringify({ authorized: false }), { status: 200 });
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      if (body.action === "challenge") {
        return new Response(
          JSON.stringify({
            challenge: "arkafund-operator-access:challenge",
            expiresAt: Date.now() + 60_000,
            role: "operator",
          }),
          { status: 200 },
        );
      }
      if (body.action === "verify") {
        return new Response(
          JSON.stringify({
            authorized: true,
            pubkey: "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
            role: "operator",
            token: "operator-session",
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ authorized: false }), { status: 400 });
    }) as typeof fetch;
    navigationState.pathname = "/integrations/operator";
    navigationState.searchParams = new URLSearchParams("q=blend");
    window.history.replaceState(null, "", "/integrations/operator?q=blend");
    navigationState.push.mockReset();
    walletMocks.connectWallet.mockClear();
    walletMocks.getWalletsKit.mockClear();
    walletMocks.signMessageWithWallet.mockClear();
  });

  it("gates utility routes until an operator wallet signs the access challenge", async () => {
    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    expect(screen.getByTestId("product-rail")).toBeInTheDocument();
    expect(document.querySelector(".chrome-shell-visual-cutover")).toBeInTheDocument();
    expect(document.querySelector(".chrome-grid-visual-cutover")).toBeInTheDocument();
    expect(screen.getByTestId("product-rail").className).toContain(
      "chrome-rail-screen-cutover",
    );
    expect(screen.queryByTestId("chrome-wallet-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("chrome-nav-integrations")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("operator-route-gate")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-guard")).toBeInTheDocument();
    expect(screen.queryByTestId("chrome-utility-integration-ops")).not.toBeInTheDocument();
    expect(screen.getByTestId("client-connect-chrome")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Arka.fund dashboard")[0]).toHaveTextContent("arka.fund");
    expect(screen.getAllByTestId("client-connect-chrome")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Create Arka" })).toHaveLength(1);
    expect(screen.queryByTestId("chrome-command-create")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing asset A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("operator-route-enable"));
    expect(await screen.findByText("surface")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-status")).toHaveTextContent(
      "Operator wallet verified",
    );
    expect(screen.getByTestId("chrome-utility-integration-ops").className).toContain(
      "chrome-utility-link-active",
    );
    expect(walletMocks.signMessageWithWallet).toHaveBeenCalledWith(
      { id: "kit" },
      "arkafund-operator-access:challenge",
      "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    );
  });

  it("keeps operator surfaces out of public routes", () => {
    navigationState.pathname = "/";
    window.history.replaceState(null, "", "/?q=blend");
    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    expect(screen.getByTestId("product-rail").className).toContain(
      "chrome-rail-public-dashboard",
    );
    expect(screen.getByTestId("product-rail").className).toContain(
      "chrome-rail-screen-cutover",
    );
    expect(screen.getByTestId("chrome-nav-dashboard").className).toContain("chrome-rail-link-active");
    expect(screen.getByTestId("chrome-nav-explore-funds").className).not.toContain("chrome-rail-link-active");
    expect(screen.queryByTestId("chrome-wallet-card")).not.toBeInTheDocument();
    const dashboardCreateUrl = readLocalHref(screen.getByTestId("chrome-create-primary"));
    expect(screen.getByTestId("chrome-create-primary")).toHaveTextContent(/^Create Arka$/);
    expect(dashboardCreateUrl.pathname).toBe("/factory/create");
    expect(dashboardCreateUrl.searchParams.get("from")).toBe("/dashboard");
    expect(dashboardCreateUrl.searchParams.has("returnQuery")).toBe(false);
    expect(dashboardCreateUrl.searchParams.has("q")).toBe(false);
    expect(screen.getAllByRole("link", { name: "Create Arka" })).toHaveLength(1);
    expect(
      document.querySelector(".chrome-command-bar .chrome-command-group"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chrome-command-create")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing asset A")).not.toBeInTheDocument();
    expect(screen.queryByTestId("advanced-console")).not.toBeInTheDocument();
    expect(screen.queryByTestId("advanced-console-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chrome-utility-contracts")).not.toBeInTheDocument();
  });

  it("treats the Arka leaderboard as a shared public product shell without command clutter", () => {
    navigationState.pathname = "/vaults";
    navigationState.searchParams = new URLSearchParams("q=gamma&sort=profit");
    window.history.replaceState(null, "", "/vaults?q=gamma&sort=profit");
    render(
      <AppChrome>
        <div data-testid="vaults-stage">vaults surface</div>
      </AppChrome>,
    );

    expect(screen.getByTestId("product-rail").className).toContain(
      "chrome-rail-public-dashboard",
    );
    expect(screen.getByTestId("chrome-nav-arkas").className).toContain(
      "chrome-rail-link-active",
    );
    const vaultsCreateUrl = readLocalHref(screen.getByTestId("chrome-create-primary"));
    expect(vaultsCreateUrl.pathname).toBe("/factory/create");
    expect(vaultsCreateUrl.searchParams.get("from")).toBe("/vaults");
    expect(vaultsCreateUrl.searchParams.has("returnQuery")).toBe(false);
    expect(vaultsCreateUrl.searchParams.has("q")).toBe(false);
    expect(screen.getAllByRole("link", { name: "Create Arka" })).toHaveLength(1);
    expect(
      document.querySelector(".chrome-command-bar .chrome-command-group"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("chrome-command-create")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing asset A")).not.toBeInTheDocument();
    expect(screen.getByTestId("vaults-stage")).toBeInTheDocument();
  });

  it("renders Create Arka as a public focus flow without the product rail", async () => {
    navigationState.pathname = "/factory/create";
    navigationState.searchParams = new URLSearchParams("");
    window.history.replaceState(null, "", "/factory/create");

    render(
      <AppChrome>
        <div>create wizard</div>
      </AppChrome>,
    );

    expect(screen.getByTestId("product-canvas").className).toContain(
      "chrome-canvas-focus",
    );
    expect(screen.getByTestId("product-rail").className).toContain(
      "chrome-rail-focus",
    );
    expect(screen.getByTestId("chrome-search-input")).toHaveAttribute(
      "placeholder",
      "Search Arkas",
    );
    expect(screen.getByTestId("chrome-search-input").closest(".chrome-topbar")).toBeInTheDocument();
    expect(document.querySelector(".chrome-command-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chrome-create-primary")).not.toBeInTheDocument();
    expect(screen.getByText("create wizard")).toBeInTheDocument();
    expect(screen.queryByTestId("operator-route-gate")).not.toBeInTheDocument();
  });

  it("rejects a persisted operator session when the wallet mirror is missing", async () => {
    navigationState.pathname = "/contracts";
    window.localStorage.setItem(
      "arkafund.operatorSession",
      JSON.stringify({
        authorized: true,
        pubkey: "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
        role: "operator",
        token: "operator-session",
        expiresAt: Date.now() + 60_000,
      }),
    );
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/operator/access?token=")) {
        return new Response(
          JSON.stringify({
            authorized: true,
            pubkey: "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
            role: "operator",
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ authorized: false }), { status: 400 });
    }) as typeof fetch;

    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    expect(screen.getByTestId("operator-route-gate")).toBeInTheDocument();
    expect(screen.queryByText("surface")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("operator-route-gate")).toHaveTextContent(
        "Reconnect the authorized operator wallet",
      ),
    );
    expect(window.localStorage.getItem("arkafund.operatorSession")).toBeNull();
  });

  it("accepts a persisted operator session only when the connected wallet matches", async () => {
    navigationState.pathname = "/contracts";
    const pubkey = "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV";
    window.localStorage.setItem("wallet:pubkey", pubkey);
    window.localStorage.setItem(
      "arkafund.operatorSession",
      JSON.stringify({
        authorized: true,
        pubkey,
        role: "operator",
        token: "operator-session",
        expiresAt: Date.now() + 60_000,
      }),
    );
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/operator/access?token=")) {
        return new Response(
          JSON.stringify({
            authorized: true,
            pubkey,
            role: "operator",
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ authorized: false }), { status: 400 });
    }) as typeof fetch;

    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    expect(await screen.findByText("surface")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-status")).toHaveTextContent(
      "Operator wallet verified",
    );
    expect(screen.getByTestId("chrome-utility-contracts")).toBeInTheDocument();
  });

  it("locks an operator route on live wallet disconnect and recovers after operator reconnect", async () => {
    navigationState.pathname = "/contracts";
    const pubkey = "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV";
    window.localStorage.setItem("wallet:pubkey", pubkey);
    window.localStorage.setItem(
      "arkafund.operatorSession",
      JSON.stringify({
        authorized: true,
        pubkey,
        role: "operator",
        token: "operator-session",
        expiresAt: Date.now() + 60_000,
      }),
    );
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/operator/access?token=")) {
        return new Response(
          JSON.stringify({
            authorized: true,
            pubkey,
            role: "operator",
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200 },
        );
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        action?: string;
        pubkey?: string;
      };
      if (body.action === "challenge") {
        return new Response(
          JSON.stringify({
            challenge: "arkafund-operator-access:challenge",
            expiresAt: Date.now() + 60_000,
            role: "operator",
          }),
          { status: 200 },
        );
      }
      if (body.action === "verify") {
        return new Response(
          JSON.stringify({
            authorized: true,
            pubkey: body.pubkey,
            role: "operator",
            token: "operator-session-reconnected",
            expiresAt: Date.now() + 60_000,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ authorized: false }), { status: 400 });
    }) as typeof fetch;

    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    expect(await screen.findByText("surface")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-status")).toHaveTextContent(
      "Operator wallet verified",
    );

    window.localStorage.removeItem("wallet:pubkey");
    window.dispatchEvent(new CustomEvent("wallet:pubkey-changed", { detail: "" }));

    await waitFor(() =>
      expect(screen.getByTestId("operator-route-gate")).toHaveTextContent(
        "Reconnect the authorized operator wallet",
      ),
    );
    expect(screen.queryByText("surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chrome-utility-contracts")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("arkafund.operatorSession")).toBeNull();

    window.localStorage.setItem("wallet:pubkey", pubkey);
    window.dispatchEvent(new CustomEvent("wallet:pubkey-changed", { detail: pubkey }));
    fireEvent.click(screen.getByTestId("operator-route-enable"));

    expect(await screen.findByText("surface")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-console-status")).toHaveTextContent(
      "Operator wallet verified",
    );
    expect(screen.getByTestId("chrome-utility-contracts")).toBeInTheDocument();
    expect(walletMocks.signMessageWithWallet).toHaveBeenCalledWith(
      { id: "kit" },
      "arkafund-operator-access:challenge",
      pubkey,
    );
  });

  it("keeps operator utility routes behind the same operator gate until explicitly enabled", async () => {
    for (const route of OPERATOR_CONSOLE_NAV) {
      cleanup();
      window.localStorage.clear();
      navigationState.pathname = route.href;
      navigationState.searchParams = new URLSearchParams();

      render(
        <AppChrome>
          <div>surface</div>
        </AppChrome>,
      );

      expect(screen.getByTestId("operator-route-gate")).toBeInTheDocument();
      expect(screen.getByTestId("operator-route-gate")).toHaveTextContent(route.label);
      expect(screen.getByTestId("advanced-console-guard")).toBeInTheDocument();
      expect(screen.queryByText("surface")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("operator-route-enable"));

      expect(await screen.findByText("surface")).toBeInTheDocument();
      expect(screen.getByTestId("advanced-console-status")).toBeInTheDocument();
      expect(
        screen.getByTestId(`chrome-utility-${route.label.toLowerCase().replace(/\s+/g, "-")}`).className,
      ).toContain("chrome-utility-link-active");
      await waitFor(() => expect(walletMocks.signMessageWithWallet).toHaveBeenCalled());
    }
  });

  it("pushes discover search queries through the global search box", () => {
    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    const input = screen.getAllByTestId("chrome-search-input")[0];
    fireEvent.change(input, { target: { value: "phoenix" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(navigationState.push).toHaveBeenCalledWith("/discover?q=phoenix");
  });

  it("pushes intentional global searches to real product and detail routes", () => {
    render(
      <AppChrome>
        <div>surface</div>
      </AppChrome>,
    );

    const input = screen.getAllByTestId("chrome-search-input")[0];
    const form = input.closest("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "assets" } });
    fireEvent.submit(form);
    expect(navigationState.push).toHaveBeenLastCalledWith("/assets");

    fireEvent.change(input, { target: { value: "BLND" } });
    fireEvent.submit(form);
    expect(navigationState.push).toHaveBeenLastCalledWith(
      "/assets/CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    );

    fireEvent.change(input, {
      target: {
        value: "ops:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      },
    });
    fireEvent.submit(form);
    expect(navigationState.push).toHaveBeenLastCalledWith(
      "/arkas/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    );
  });
});
