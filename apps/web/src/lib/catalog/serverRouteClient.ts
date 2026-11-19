import { NextRequest } from "next/server";
import { proxyCatalogRequest } from "./proxy";

type QueryValue = string | undefined;

export async function readCatalogJsonForRoute<T>(
  request: NextRequest,
  path: string,
  query: Record<string, QueryValue> = {},
): Promise<T> {
  const catalogUrl = new URL(`/api/catalog${path}`, request.url);
  for (const [key, value] of Object.entries(query)) {
    if (!value || value.trim().length === 0) continue;
    catalogUrl.searchParams.set(key, value);
  }

  const catalogRequest = new NextRequest(catalogUrl, {
    method: "GET",
    headers: request.headers,
  });
  const pathSegments = catalogUrl.pathname
    .replace(/^\/api\/catalog\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  const response = await proxyCatalogRequest(catalogRequest, pathSegments);
  const body = await parseCatalogBody(response);
  if (!response.ok) {
    throw new Error(extractCatalogError(body, response.status));
  }
  return body as T;
}

async function parseCatalogBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

function extractCatalogError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const message = Reflect.get(body, "message");
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    const error = Reflect.get(body, "error");
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }
  if (typeof body === "string" && body.trim().length > 0) {
    return body;
  }
  return `Catalog request failed with status ${status}.`;
}
