import type { CatalogIdentityUpdatePayload } from "./types.js";

export type CatalogIdentityScope = "arka" | "manager";

export function buildCatalogIdentityUpdateMessage(input: {
  scope: CatalogIdentityScope;
  target: string;
  signer: string;
  payload: CatalogIdentityUpdatePayload;
}): string {
  return JSON.stringify({
    version: 1,
    app: "arka.fund",
    action: "identity.update",
    scope: input.scope,
    target: input.target,
    signer: input.signer,
    payload: normalizeCatalogIdentityPayload(input.payload),
  });
}

export function normalizeCatalogIdentityPayload(
  payload: CatalogIdentityUpdatePayload,
): CatalogIdentityUpdatePayload {
  return {
    displayName: normalizeText(payload.displayName, 64),
    description: normalizeText(payload.description, 220),
    avatarUrl: normalizeUrl(payload.avatarUrl),
    websiteUrl: normalizeUrl(payload.websiteUrl),
    socialUrl: normalizeUrl(payload.socialUrl),
    nonce: requiredText(payload.nonce, 96, "nonce"),
    issuedAt: normalizeDate(payload.issuedAt),
  };
}

function normalizeText(value: string | null | undefined, maxLength: number): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`profile value must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function normalizeUrl(value: string | null | undefined): string | null {
  const normalized = normalizeText(value, 220);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.protocol !== "https:") {
    throw new Error("profile URLs must use https");
  }
  return url.toString();
}

function requiredText(value: string, maxLength: number, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maxLength) {
    throw new Error(`${field} must not exceed ${maxLength} characters`);
  }
  return normalized;
}

function normalizeDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("issuedAt must be an ISO-8601 date");
  return new Date(timestamp).toISOString();
}
