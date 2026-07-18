import { Keypair } from "@stellar/stellar-sdk";
import type {
  ArkaCatalogEntry,
  ArkaIdentityMetadata,
  ArkaQuery,
  IdentityArchive,
  IdentityTrustState,
  IdentityUpdatePayload,
  IdentityUpdateRequest,
  ManagerCatalogEntry,
  ManagerIdentityMetadata,
  ManagerQuery,
  Page,
  RankedArkaCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types.js";

const IDENTITY_SCHEMA_VERSION = 1;
const MAX_DISPLAY_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 220;
const MAX_URL_LENGTH = 220;
const MAX_NONCE_LENGTH = 96;
const SIGNATURE_MAX_AGE_MS = 15 * 60 * 1000;

type IdentityScope = "arka" | "manager";

export class IdentityUpdateError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IdentityUpdateError";
  }
}

export function createEmptyIdentityArchive(): IdentityArchive {
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    updatedAt: new Date(0).toISOString(),
    arkas: {},
    managers: {},
  };
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
  const normalized = {
    displayName: normalizeOptionalText(payload.displayName, MAX_DISPLAY_NAME_LENGTH),
    description: normalizeOptionalText(payload.description, MAX_DESCRIPTION_LENGTH),
    avatarUrl: normalizeOptionalUrl(payload.avatarUrl),
    websiteUrl: normalizeOptionalUrl(payload.websiteUrl),
    socialUrl: normalizeOptionalUrl(payload.socialUrl),
    nonce: normalizeRequiredText(payload.nonce, MAX_NONCE_LENGTH, "nonce"),
    issuedAt: normalizeIssuedAt(payload.issuedAt),
  };
  return normalized;
}

export function applyIdentityToArka(
  entry: ArkaCatalogEntry,
  archive: IdentityArchive,
): ArkaCatalogEntry {
  return {
    ...entry,
    identity: resolveArkaIdentity(entry, archive),
  };
}

export function applyIdentityToArkaPage<T extends RankedArkaCatalogEntry>(
  page: Page<T>,
  archive: IdentityArchive,
): Page<T> {
  return {
    ...page,
    items: page.items.map((entry) => ({
      ...entry,
      identity: resolveArkaIdentity(entry, archive),
    })),
  };
}

export function applyIdentityToManager(
  entry: ManagerCatalogEntry,
  archive: IdentityArchive,
): ManagerCatalogEntry {
  return {
    ...entry,
    identity: resolveManagerIdentity(entry, archive),
  };
}

export function applyIdentityToManagerPage<T extends RankedManagerCatalogEntry>(
  page: Page<T>,
  archive: IdentityArchive,
): Page<T> {
  return {
    ...page,
    items: page.items.map((entry) => ({
      ...entry,
      identity: resolveManagerIdentity(entry, archive),
    })),
  };
}

export function createArkaIdentityMatcher(archive: IdentityArchive) {
  return (entry: ArkaCatalogEntry, search: string): boolean => {
    const identity = resolveArkaIdentity(entry, archive);
    const haystacks = [
      entry.arkaId,
      entry.manager,
      entry.denominationContract ?? "",
      identity?.displayName ?? "",
      identity?.description ?? "",
    ];
    return containsSearch(haystacks, search);
  };
}

export function createManagerIdentityMatcher(archive: IdentityArchive) {
  return (entry: ManagerCatalogEntry, search: string): boolean => {
    const identity = resolveManagerIdentity(entry, archive);
    const haystacks = [
      entry.manager,
      identity?.displayName ?? "",
      identity?.description ?? "",
    ];
    return containsSearch(haystacks, search);
  };
}

export function upsertArkaIdentityInArchive(input: {
  archive: IdentityArchive;
  arkaId: string;
  manager: string;
  curated: boolean;
  pendingIndexation: boolean;
  request: IdentityUpdateRequest;
  now: Date;
}): { archive: IdentityArchive; identity: ArkaIdentityMetadata } {
  validateSignedIdentityRequest({
    scope: "arka",
    target: input.arkaId,
    request: input.request,
    now: input.now,
  });
  if (input.request.signer !== input.manager) {
    throw new IdentityUpdateError(
      403,
      "not_manager",
      "Only the current Arka manager can update this profile.",
    );
  }

  const payload = normalizeIdentityPayload(input.request.payload);
  const previous = input.archive.arkas[input.arkaId];
  const identity: ArkaIdentityMetadata = {
    arkaId: input.arkaId,
    manager: input.manager,
    displayName: payload.displayName ?? null,
    description: payload.description ?? null,
    avatarUrl: payload.avatarUrl ?? null,
    websiteUrl: payload.websiteUrl ?? null,
    socialUrl: payload.socialUrl ?? null,
    trustState: preserveOrDefaultTrustState(previous?.trustState, input.curated),
    updatedAt: input.now.toISOString(),
    updatedBy: input.request.signer,
    pendingIndexation: input.pendingIndexation || undefined,
  };

  return {
    archive: {
      ...input.archive,
      updatedAt: input.now.toISOString(),
      arkas: {
        ...input.archive.arkas,
        [input.arkaId]: identity,
      },
    },
    identity,
  };
}

export function upsertManagerIdentityInArchive(input: {
  archive: IdentityArchive;
  manager: string;
  curated: boolean;
  request: IdentityUpdateRequest;
  now: Date;
}): { archive: IdentityArchive; identity: ManagerIdentityMetadata } {
  validateSignedIdentityRequest({
    scope: "manager",
    target: input.manager,
    request: input.request,
    now: input.now,
  });
  if (input.request.signer !== input.manager) {
    throw new IdentityUpdateError(
      403,
      "not_manager",
      "Only this manager wallet can update this profile.",
    );
  }

  const payload = normalizeIdentityPayload(input.request.payload);
  const previous = input.archive.managers[input.manager];
  const identity: ManagerIdentityMetadata = {
    manager: input.manager,
    displayName: payload.displayName ?? null,
    description: payload.description ?? null,
    avatarUrl: payload.avatarUrl ?? null,
    websiteUrl: payload.websiteUrl ?? null,
    socialUrl: payload.socialUrl ?? null,
    trustState: preserveOrDefaultTrustState(previous?.trustState, input.curated),
    updatedAt: input.now.toISOString(),
    updatedBy: input.request.signer,
  };

  return {
    archive: {
      ...input.archive,
      updatedAt: input.now.toISOString(),
      managers: {
        ...input.archive.managers,
        [input.manager]: identity,
      },
    },
    identity,
  };
}

export function validateIdentityArchive(archive: IdentityArchive): IdentityArchive {
  if (archive.schemaVersion !== IDENTITY_SCHEMA_VERSION) {
    throw new Error(`Unsupported identity schema version: ${archive.schemaVersion}`);
  }
  if (!archive.updatedAt || !isRecord(archive.arkas) || !isRecord(archive.managers)) {
    throw new Error("Identity archive is missing required collections");
  }
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    updatedAt: archive.updatedAt,
    arkas: Object.fromEntries(
      Object.entries(archive.arkas).map(([key, identity]) => [
        key,
        validateArkaIdentity(identity),
      ]),
    ),
    managers: Object.fromEntries(
      Object.entries(archive.managers).map(([key, identity]) => [
        key,
        validateManagerIdentity(identity),
      ]),
    ),
  };
}

function validateSignedIdentityRequest(input: {
  scope: IdentityScope;
  target: string;
  request: IdentityUpdateRequest;
  now: Date;
}): void {
  if (!input.request || !input.request.signer || !input.request.message || !input.request.signature) {
    throw new IdentityUpdateError(400, "invalid_request", "Signed identity payload is incomplete.");
  }
  const payload = normalizeIdentityPayload(input.request.payload);
  const expectedMessage = buildIdentityUpdateMessage({
    scope: input.scope,
    target: input.target,
    signer: input.request.signer,
    payload,
  });
  if (input.request.message !== expectedMessage) {
    throw new IdentityUpdateError(400, "message_mismatch", "Signed identity payload does not match the profile update.");
  }
  assertFreshIssuedAt(payload.issuedAt, input.now);
  assertValidSignature(input.request.signer, input.request.message, input.request.signature);
}

function assertValidSignature(signer: string, message: string, signature: string): void {
  let keypair: Keypair;
  try {
    keypair = Keypair.fromPublicKey(signer);
  } catch {
    throw new IdentityUpdateError(400, "invalid_signer", "Signer is not a valid Stellar public key.");
  }
  const messageBytes = Buffer.from(message, "utf8");
  const candidates = decodeSignatureCandidates(signature);
  if (candidates.some((candidate) => keypair.verify(messageBytes, candidate))) {
    return;
  }
  throw new IdentityUpdateError(401, "invalid_signature", "Wallet signature could not be verified.");
}

function decodeSignatureCandidates(signature: string): Buffer[] {
  const trimmed = signature.trim();
  const candidates: Buffer[] = [];
  const push = (buffer: Buffer) => {
    if (buffer.length > 0 && !candidates.some((candidate) => candidate.equals(buffer))) {
      candidates.push(buffer);
    }
  };
  try {
    push(Buffer.from(trimmed, "base64"));
  } catch {}
  try {
    push(Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  } catch {}
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    try {
      push(Buffer.from(trimmed, "hex"));
    } catch {}
  }
  return candidates;
}

function assertFreshIssuedAt(issuedAt: string, now: Date): void {
  const issuedAtMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    throw new IdentityUpdateError(400, "invalid_issued_at", "Identity signature timestamp is invalid.");
  }
  const delta = Math.abs(now.getTime() - issuedAtMs);
  if (delta > SIGNATURE_MAX_AGE_MS) {
    throw new IdentityUpdateError(401, "stale_signature", "Identity signature has expired.");
  }
}

function resolveArkaIdentity(
  entry: Pick<ArkaCatalogEntry, "arkaId" | "manager" | "curated">,
  archive: IdentityArchive,
): ArkaIdentityMetadata | null {
  const identity = archive.arkas[entry.arkaId];
  if (!identity || identity.manager !== entry.manager) {
    return null;
  }
  return {
    ...identity,
    pendingIndexation: undefined,
    trustState: preserveOrDefaultTrustState(identity.trustState, entry.curated),
  };
}

function resolveManagerIdentity(
  entry: Pick<ManagerCatalogEntry, "manager" | "curatedArkaCount">,
  archive: IdentityArchive,
): ManagerIdentityMetadata | null {
  const identity = archive.managers[entry.manager];
  if (!identity) {
    return null;
  }
  return {
    ...identity,
    trustState: preserveOrDefaultTrustState(identity.trustState, entry.curatedArkaCount > 0),
  };
}

function preserveOrDefaultTrustState(
  trustState: IdentityTrustState | undefined,
  curated: boolean,
): IdentityTrustState {
  if (trustState === "verified" || trustState === "official") {
    return trustState;
  }
  return curated ? "curated" : "unverified";
}

function validateArkaIdentity(identity: ArkaIdentityMetadata): ArkaIdentityMetadata {
  return {
    arkaId: normalizeRequiredText(identity.arkaId, 128, "arkaId"),
    manager: normalizeRequiredText(identity.manager, 128, "manager"),
    displayName: normalizeOptionalText(identity.displayName, MAX_DISPLAY_NAME_LENGTH),
    description: normalizeOptionalText(identity.description, MAX_DESCRIPTION_LENGTH),
    avatarUrl: normalizeOptionalUrl(identity.avatarUrl),
    websiteUrl: normalizeOptionalUrl(identity.websiteUrl),
    socialUrl: normalizeOptionalUrl(identity.socialUrl),
    trustState: normalizeTrustState(identity.trustState),
    updatedAt: normalizeIssuedAt(identity.updatedAt),
    updatedBy: normalizeRequiredText(identity.updatedBy, 128, "updatedBy"),
    pendingIndexation: identity.pendingIndexation || undefined,
  };
}

function validateManagerIdentity(identity: ManagerIdentityMetadata): ManagerIdentityMetadata {
  return {
    manager: normalizeRequiredText(identity.manager, 128, "manager"),
    displayName: normalizeOptionalText(identity.displayName, MAX_DISPLAY_NAME_LENGTH),
    description: normalizeOptionalText(identity.description, MAX_DESCRIPTION_LENGTH),
    avatarUrl: normalizeOptionalUrl(identity.avatarUrl),
    websiteUrl: normalizeOptionalUrl(identity.websiteUrl),
    socialUrl: normalizeOptionalUrl(identity.socialUrl),
    trustState: normalizeTrustState(identity.trustState),
    updatedAt: normalizeIssuedAt(identity.updatedAt),
    updatedBy: normalizeRequiredText(identity.updatedBy, 128, "updatedBy"),
    pendingIndexation: identity.pendingIndexation || undefined,
  };
}

function normalizeTrustState(value: IdentityTrustState | undefined): IdentityTrustState {
  if (value === "curated" || value === "verified" || value === "official") {
    return value;
  }
  return "unverified";
}

function normalizeRequiredText(value: unknown, maxLength: number, label: string): string {
  if (typeof value !== "string") {
    throw new IdentityUpdateError(400, "invalid_text", `${label} is required.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new IdentityUpdateError(400, "invalid_text", `${label} is required.`);
  }
  return normalized.slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new IdentityUpdateError(400, "invalid_text", "Profile text must be a string.");
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeOptionalUrl(value: unknown): string | null {
  const text = normalizeOptionalText(value, MAX_URL_LENGTH);
  if (!text) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new IdentityUpdateError(400, "invalid_url", "Profile links must be valid URLs.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new IdentityUpdateError(400, "invalid_url", "Profile links must use http or https.");
  }
  return parsed.toString().slice(0, MAX_URL_LENGTH);
}

function normalizeIssuedAt(value: unknown): string {
  if (typeof value !== "string") {
    throw new IdentityUpdateError(400, "invalid_issued_at", "Identity timestamp is required.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new IdentityUpdateError(400, "invalid_issued_at", "Identity timestamp is invalid.");
  }
  return date.toISOString();
}

function containsSearch(values: string[], search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  return values.some((value) => value.toLowerCase().includes(normalizedSearch));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
