import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const walletMocks = vi.hoisted(() => {
  const walletAddress =
    "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV";
  const kit = { id: "selected-wallet-kit" };

  return {
    walletAddress,
    kit,
    getWalletsKit: vi.fn(() => kit),
    connectWallet: vi.fn(async () => walletAddress),
    clearStoredWalletConnection: vi.fn(() => {
      window.localStorage.removeItem("wallet:pubkey");
      window.localStorage.removeItem("wallet:module");
      window.dispatchEvent(new CustomEvent("wallet:pubkey-changed", { detail: "" }));
    }),
  };
});

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: walletMocks.getWalletsKit,
  connectWallet: walletMocks.connectWallet,
  clearStoredWalletConnection: walletMocks.clearStoredWalletConnection,
}));

import ClientConnect from "@/components/ClientConnect";

describe("ClientConnect", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("shows a visible disconnect action for a restored wallet session", async () => {
    window.localStorage.setItem("wallet:pubkey", walletMocks.walletAddress);
    window.localStorage.setItem("wallet:module", "XBULL");
    const user = userEvent.setup();

    render(<ClientConnect />);

    await waitFor(() =>
      expect(screen.getByTestId("wallet-badge-chrome")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("disconnect-wallet-chrome"));

    expect(walletMocks.clearStoredWalletConnection).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("connect-wallet-chrome")).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem("wallet:pubkey")).toBeNull();
    expect(window.localStorage.getItem("wallet:module")).toBeNull();
  });

  it("connects through the selected wallet kit and stores the public key", async () => {
    const user = userEvent.setup();

    render(<ClientConnect />);

    await waitFor(() =>
      expect(screen.getByTestId("connect-wallet-chrome")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("connect-wallet-chrome"));

    expect(walletMocks.connectWallet).toHaveBeenCalledWith(walletMocks.kit);
    await waitFor(() =>
      expect(screen.getByTestId("wallet-badge-chrome")).toBeInTheDocument(),
    );
    expect(window.localStorage.getItem("wallet:pubkey")).toBe(
      walletMocks.walletAddress,
    );
  });
});
