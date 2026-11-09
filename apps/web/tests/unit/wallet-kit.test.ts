import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const walletKitMocks = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
  setWalletSpy: vi.fn(),
  freighterModuleSpy: vi.fn(function () { return { productId: "freighter" }; }),
  albedoModuleSpy: vi.fn(function () { return { productId: "albedo" }; }),
  xbullModuleSpy: vi.fn(function () { return { productId: "xbull" }; }),
}));

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  WalletNetwork: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
    FUTURENET: "Test SDF Future Network ; October 2022",
    SANDBOX: "Local Sandbox Stellar Network ; September 2022",
    STANDALONE: "Standalone Network ; February 2017",
  },
  FreighterModule: walletKitMocks.freighterModuleSpy,
  AlbedoModule: walletKitMocks.albedoModuleSpy,
  xBullModule: walletKitMocks.xbullModuleSpy,
  StellarWalletsKit: class {
    constructor(params: unknown) {
      walletKitMocks.constructorSpy(params);
    }
    setWallet(id: string) {
      walletKitMocks.setWalletSpy(id);
    }
  },
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => false),
  getAddress: vi.fn(),
  signMessage: vi.fn(),
}));

describe("wallet kit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    walletKitMocks.constructorSpy.mockClear();
    walletKitMocks.setWalletSpy.mockClear();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.body.innerHTML = "";
    window.localStorage.clear();
  });

  it("uses the public Stellar network for mainnet deployments", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_STELLAR_NETWORK",
      "Public Global Stellar Network ; September 2015",
    );

    const { getWalletsKit } = await import("@/lib/walletKit");
    getWalletsKit();

    expect(walletKitMocks.constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "Public Global Stellar Network ; September 2015",
      }),
    );
  });

  it("stores the selected wallet module when connecting", async () => {
    const { connectWallet } = await import("@/lib/walletKit");
    const kit = {
      setWallet: vi.fn(),
      getAddress: vi.fn(async () => ({
        address: "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
      })),
      openModal: vi.fn(({ onWalletSelected }) => {
        onWalletSelected?.({ id: "XBULL" });
      }),
    };

    await expect(connectWallet(kit as never)).resolves.toBe(
      "GDEMOUSER7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    );

    expect(kit.setWallet).toHaveBeenCalledWith("XBULL");
    expect(window.localStorage.getItem("wallet:module")).toBe("XBULL");
  });

  it("rehydrates the stored wallet module when creating a new kit", async () => {
    window.localStorage.setItem("wallet:module", "XBULL");
    const { getWalletsKit } = await import("@/lib/walletKit");

    getWalletsKit();

    expect(walletKitMocks.setWalletSpy).toHaveBeenCalledWith("XBULL");
  });

  it("rejects when the wallet modal closes without firing onClosed", async () => {
    const { connectWallet, isWalletSelectionClosedError } = await import(
      "@/lib/walletKit"
    );
    const kit = {
      openModal: vi.fn(() => {
        const modal = document.createElement("stellar-wallets-modal");
        modal.setAttribute("showmodal", "");
        const shadow = modal.attachShadow({ mode: "open" });
        shadow.innerHTML = "<dialog open></dialog>";
        document.body.appendChild(modal);
        setTimeout(() => {
          modal.removeAttribute("showmodal");
          shadow.innerHTML = "<dialog></dialog>";
        }, 20);
      }),
    };

    let caught: unknown;
    try {
      await connectWallet(kit as never);
    } catch (event) {
      caught = event;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Wallet selection was closed");
    expect(isWalletSelectionClosedError(caught)).toBe(true);
  });
});
