import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogApiError,
  fetchCatalog,
  isCatalogConfigurationError,
} from "@/lib/catalog/api";

describe("catalog API error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies every supported catalog configuration error variant", () => {
    expect(
      isCatalogConfigurationError(
        "Catalog API is not configured for this environment.",
      ),
    ).toBe(true);
    expect(
      isCatalogConfigurationError("Catalog API base URL is not configured."),
    ).toBe(true);
    expect(
      isCatalogConfigurationError(
        "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
      ),
    ).toBe(true);
    expect(isCatalogConfigurationError("catalog upstream gateway timeout")).toBe(
      false,
    );
  });

  it("sanitizes raw environment variable hints before surfacing catalog errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "catalog_not_configured",
          message: "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(fetchCatalog("/v1/arkas")).rejects.toMatchObject({
      name: "CatalogApiError",
      status: 503,
      message: "Catalog API is not configured for this environment.",
    } satisfies Partial<CatalogApiError>);
  });

  it("preserves non-configuration upstream errors for retry diagnostics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "catalog upstream failed with retryable gateway error",
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(fetchCatalog("/v1/arkas")).rejects.toMatchObject({
      name: "CatalogApiError",
      status: 502,
      message: "catalog upstream failed with retryable gateway error",
    } satisfies Partial<CatalogApiError>);
  });
});
