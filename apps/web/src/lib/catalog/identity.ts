import { formatContractLabel } from "./format";
import type {
  ArkaIdentityMetadata,
  IdentityTrustState,
  IdentityUpdatePayload,
  RankedArkaCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types";

export const IDENTITY_FIELD_LIMITS = {
  displayName: 64,
  description: 280,
  strategy: 2_000,
  riskDisclosure: 1_200,
  targetReturn: 280,
  url: 220,
} as const;
const MAX_NONCE_LENGTH = 96;

type IdentityScope = "arka" | "manager";

export interface EditableIdentityDraft {
  displayName: string;
  description: string;
  strategy: string;
  riskDisclosure: string;
  targetReturn: string;
  avatarUrl?: string;
  websiteUrl?: string;
  socialUrl?: string;
}

export function resolveArkaDisplayName(
  entry: Pick<RankedArkaCatalogEntry, "arkaId" | "rank" | "identity">,
): string {
  const displayName = entry.identity?.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  return "Unnamed Arka";
}

export function resolveArkaSubtitle(
  entry: Pick<RankedArkaCatalogEntry, "arkaId" | "identity">,
): string {
  return entry.identity?.description?.trim() || formatContractLabel(entry.arkaId, 10, 6);
}

export function resolveManagerDisplayName(
  entry: Pick<RankedManagerCatalogEntry, "manager" | "identity"> | string,
): string {
  if (typeof entry === "string") {
    return formatContractLabel(entry, 10, 6);
  }
  const displayName = entry.identity?.displayName?.trim();
  return displayName || "Unnamed manager";
}

export function resolveManagerSubtitle(
  entry: Pick<RankedManagerCatalogEntry, "manager" | "identity"> | string,
): string {
  if (typeof entry === "string") {
    return formatContractLabel(entry, 10, 6);
  }
  return entry.identity?.description?.trim() || formatContractLabel(entry.manager, 10, 6);
}

export function formatIdentityTrustLabel(state?: IdentityTrustState | null): string {
  if (state === "official") return "Official";
  if (state === "verified") return "Verified";
  if (state === "curated") return "Curated";
  return "Unverified";
}

export function identityTrustTone(
  state?: IdentityTrustState | null,
): "positive" | "neutral" | "warning" {
  if (state === "official" || state === "verified" || state === "curated") {
    return "positive";
  }
  return "neutral";
}

export function buildIdentityPayload(
  draft: EditableIdentityDraft,
  issuedAt = new Date(),
): IdentityUpdatePayload {
  return normalizeIdentityPayload({
    displayName: draft.displayName,
    description: draft.description,
    strategy: draft.strategy,
    riskDisclosure: draft.riskDisclosure,
    targetReturn: draft.targetReturn,
    avatarUrl: draft.avatarUrl,
    websiteUrl: draft.websiteUrl,
    socialUrl: draft.socialUrl,
    nonce: createIdentityNonce(),
    issuedAt: issuedAt.toISOString(),
  });
}

export function buildIdentityUpdateMessage(input: {
  scope: IdentityScope;
  target: string;
  signer: string;
  payload: IdentityUpdatePayload;
}): string {
  const payload = normalizeIdentityPayload(input.payload);
  return JSON.stringify({
    version: 1,
    app: "arka.fund",
    action: "identity.update",
    scope: input.scope,
    target: input.target,
    signer: input.signer,
    payload,
  });
}

export function normalizeIdentityPayload(
  payload: IdentityUpdatePayload,
): IdentityUpdatePayload {
  return {
    displayName: normalizeOptionalSingleLineText(
      payload.displayName,
      IDENTITY_FIELD_LIMITS.displayName,
    ),
    description: normalizeOptionalSingleLineText(
      payload.description,
      IDENTITY_FIELD_LIMITS.description,
    ),
    strategy: normalizeOptionalMultilineText(
      payload.strategy,
      IDENTITY_FIELD_LIMITS.strategy,
    ),
    riskDisclosure: normalizeOptionalMultilineText(
      payload.riskDisclosure,
      IDENTITY_FIELD_LIMITS.riskDisclosure,
    ),
    targetReturn: normalizeOptionalMultilineText(
      payload.targetReturn,
      IDENTITY_FIELD_LIMITS.targetReturn,
    ),
    avatarUrl: normalizeOptionalUrl(payload.avatarUrl),
    websiteUrl: normalizeOptionalUrl(payload.websiteUrl),
    socialUrl: normalizeOptionalUrl(payload.socialUrl),
    nonce: normalizeRequiredText(payload.nonce, MAX_NONCE_LENGTH),
    issuedAt: normalizeIssuedAt(payload.issuedAt),
  };
}

export function buildArkaIdentityDraft(
  arkaId: string,
  rank: number,
  identity?: ArkaIdentityMetadata | null,
): EditableIdentityDraft {
  return {
    displayName: identity?.displayName ?? "",
    description: identity?.description ?? "",
    strategy: identity?.strategy ?? "",
    riskDisclosure: identity?.riskDisclosure ?? "",
    targetReturn: identity?.targetReturn ?? "",
    avatarUrl: identity?.avatarUrl ?? "",
    websiteUrl: identity?.websiteUrl ?? "",
    socialUrl: identity?.socialUrl ?? "",
  };
}

function createIdentityNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeRequiredText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeOptionalSingleLineText(value: unknown, maxLength: number): string | null {
  const text = normalizeOptionalText(value, maxLength);
  return text?.replace(/\s+/g, " ") ?? null;
}

function normalizeOptionalMultilineText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeOptionalUrl(value: unknown): string | null {
  const text = normalizeOptionalText(value, IDENTITY_FIELD_LIMITS.url);
  if (!text) {
    return null;
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString().slice(0, IDENTITY_FIELD_LIMITS.url);
  } catch {
    return null;
  }
}

function normalizeIssuedAt(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
