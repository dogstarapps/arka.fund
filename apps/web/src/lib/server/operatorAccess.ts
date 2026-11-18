import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

export type OperatorAccessRole = "operator";

export type OperatorAccessChallenge = {
  challenge: string;
  expiresAt: number;
  role: OperatorAccessRole;
};

export type OperatorAccessSession = {
  token: string;
  pubkey: string;
  role: OperatorAccessRole;
  expiresAt: number;
};

type SignedPayload =
  | {
      kind: "operator-challenge";
      pubkey: string;
      role: OperatorAccessRole;
      nonce: string;
      issuedAt: number;
      expiresAt: number;
    }
  | {
      kind: "operator-session";
      pubkey: string;
      role: OperatorAccessRole;
      nonce: string;
      issuedAt: number;
      expiresAt: number;
    };

const CHALLENGE_PREFIX = "arkafund-operator-access:";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REVOKED_SESSION_TOKENS_KEY = "__arkafund_revoked_operator_sessions__";

export const OPERATOR_SESSION_COOKIE_NAME = "arkafund_operator_session";
export const OPERATOR_SESSION_TTL_SECONDS = SESSION_TTL_MS / 1_000;

const revokedSessionTokens =
  ((globalThis as unknown as Record<string, Map<string, number>>)[
    REVOKED_SESSION_TOKENS_KEY
  ] ??= new Map<string, number>());

function pruneRevokedSessionTokens(now = Date.now()): void {
  for (const [token, expiresAt] of revokedSessionTokens.entries()) {
    if (expiresAt < now) {
      revokedSessionTokens.delete(token);
    }
  }
}

export function revokeOperatorSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): void {
  const normalized = (token ?? "").trim();
  if (!normalized) {
    return;
  }
  pruneRevokedSessionTokens(now);
  revokedSessionTokens.set(normalized, now + SESSION_TTL_MS);
}

function isProductionDeployment(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.ARKAFUND_DEPLOYMENT_ENV === "production"
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function normalizePubkey(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase();
}

function isValidPublicKey(pubkey: string): boolean {
  try {
    Keypair.fromPublicKey(pubkey);
    return true;
  } catch {
    return false;
  }
}

function splitWalletList(input: string | undefined): string[] {
  return (input ?? "")
    .split(/[\s,;]+/)
    .map(normalizePubkey)
    .filter(Boolean);
}

export function resolveOperatorWalletAllowlist(): Set<string> {
  return new Set(
    [
      ...splitWalletList(process.env.OPERATOR_WALLET_ALLOWLIST),
      ...splitWalletList(process.env.NEXT_PUBLIC_OPERATOR_WALLET_ALLOWLIST),
      ...splitWalletList(process.env.GOVERNANCE_OPERATOR_WALLETS),
      ...splitWalletList(process.env.NEXT_PUBLIC_GOVERNANCE_OPERATOR_WALLETS),
      ...splitWalletList(process.env.ARKA_MANAGER),
      ...splitWalletList(process.env.NEXT_PUBLIC_ARKA_MANAGER),
      ...splitWalletList(process.env.SIM_ACCOUNT),
      ...splitWalletList(process.env.NEXT_PUBLIC_SIM_ACCOUNT),
    ].filter(isValidPublicKey),
  );
}

export function resolveOperatorAccessSecret(): string | null {
  const configured =
    process.env.OPERATOR_ACCESS_SECRET ??
    process.env.ARKAFUND_OPERATOR_ACCESS_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    null;

  if (configured?.trim()) {
    return configured.trim();
  }

  if (isProductionDeployment()) {
    return null;
  }

  return "arkafund-local-operator-access-secret";
}

export function resolveOperatorRole(pubkeyInput: string): OperatorAccessRole | null {
  const pubkey = normalizePubkey(pubkeyInput);
  if (!isValidPublicKey(pubkey)) {
    return null;
  }

  return resolveOperatorWalletAllowlist().has(pubkey) ? "operator" : null;
}

function signPayload(payload: SignedPayload, secret: string): string {
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifySignedPayload(token: string, secret: string): SignedPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(fromBase64url(encodedPayload).toString("utf8")) as SignedPayload;
  } catch {
    return null;
  }
}

export function createOperatorChallenge(
  pubkeyInput: string,
  now = Date.now(),
): OperatorAccessChallenge | null {
  const secret = resolveOperatorAccessSecret();
  if (!secret) {
    return null;
  }

  const pubkey = normalizePubkey(pubkeyInput);
  const role = resolveOperatorRole(pubkey);
  if (!role) {
    return null;
  }

  const payload: SignedPayload = {
    kind: "operator-challenge",
    pubkey,
    role,
    nonce: randomUUID(),
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
  };

  return {
    challenge: `${CHALLENGE_PREFIX}${signPayload(payload, secret)}`,
    expiresAt: payload.expiresAt,
    role,
  };
}

export function verifyOperatorChallenge(
  pubkeyInput: string,
  challenge: string,
  now = Date.now(),
): OperatorAccessRole | null {
  const secret = resolveOperatorAccessSecret();
  if (!secret || !challenge.startsWith(CHALLENGE_PREFIX)) {
    return null;
  }

  const payload = verifySignedPayload(challenge.slice(CHALLENGE_PREFIX.length), secret);
  const pubkey = normalizePubkey(pubkeyInput);
  if (
    !payload ||
    payload.kind !== "operator-challenge" ||
    payload.pubkey !== pubkey ||
    payload.expiresAt < now
  ) {
    return null;
  }

  const role = resolveOperatorRole(pubkey);
  return role === payload.role ? role : null;
}

export function createOperatorSession(
  pubkeyInput: string,
  role: OperatorAccessRole,
  now = Date.now(),
): OperatorAccessSession | null {
  const secret = resolveOperatorAccessSecret();
  if (!secret) {
    return null;
  }

  const pubkey = normalizePubkey(pubkeyInput);
  if (resolveOperatorRole(pubkey) !== role) {
    return null;
  }

  const payload: SignedPayload = {
    kind: "operator-session",
    pubkey,
    role,
    nonce: randomUUID(),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  return {
    token: signPayload(payload, secret),
    pubkey,
    role,
    expiresAt: payload.expiresAt,
  };
}

export function verifyOperatorSession(
  token: string,
  now = Date.now(),
): OperatorAccessSession | null {
  const secret = resolveOperatorAccessSecret();
  if (!secret) {
    return null;
  }

  pruneRevokedSessionTokens(now);
  if (revokedSessionTokens.has(token)) {
    return null;
  }

  const payload = verifySignedPayload(token, secret);
  if (!payload || payload.kind !== "operator-session" || payload.expiresAt < now) {
    return null;
  }

  if (resolveOperatorRole(payload.pubkey) !== payload.role) {
    return null;
  }

  return {
    token,
    pubkey: payload.pubkey,
    role: payload.role,
    expiresAt: payload.expiresAt,
  };
}

function readCookieToken(cookieHeader: string | null): string {
  if (!cookieHeader) {
    return "";
  }

  for (const rawPart of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = rawPart.trim().split("=");
    if (rawName !== OPERATOR_SESSION_COOKIE_NAME) {
      continue;
    }
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return rawValue.join("=");
    }
  }

  return "";
}

export function resolveOperatorSessionTokenFromRequest(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]?.trim()) {
    return bearerMatch[1].trim();
  }

  const explicitHeader = request.headers.get("x-operator-session")?.trim();
  if (explicitHeader) {
    return explicitHeader;
  }

  return readCookieToken(request.headers.get("cookie"));
}

export function resolveOperatorSessionFromRequest(
  request: Request,
  now = Date.now(),
): OperatorAccessSession | null {
  const token = resolveOperatorSessionTokenFromRequest(request);
  return token ? verifyOperatorSession(token, now) : null;
}

function decodeSignatureCandidates(signature: string): Buffer[] {
  const candidates: Buffer[] = [];
  const trimmed = signature.trim();

  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
    candidates.push(Buffer.from(trimmed, "base64"));
    candidates.push(Buffer.from(trimmed, "base64url"));
  }

  if (/^[a-fA-F0-9]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    candidates.push(Buffer.from(trimmed, "hex"));
  }

  candidates.push(Buffer.from(trimmed, "utf8"));

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (candidate.length !== 64) {
      return false;
    }
    const fingerprint = candidate.toString("hex");
    if (seen.has(fingerprint)) {
      return false;
    }
    seen.add(fingerprint);
    return true;
  });
}

export function verifyOperatorMessageSignature(
  pubkeyInput: string,
  message: string,
  signature: string,
): boolean {
  const pubkey = normalizePubkey(pubkeyInput);
  if (!isValidPublicKey(pubkey)) {
    return false;
  }

  const keypair = Keypair.fromPublicKey(pubkey);
  const messageBuffer = Buffer.from(message, "utf8");
  // SEP-53: wallets sign SHA-256(prefix || UTF-8 message), not the raw
  // challenge. Retain raw signatures for already-supported legacy wallets.
  // Challenge HMAC, authorized pubkey, nonce and expiry are checked separately.
  const sep53Hash = createHash("sha256")
    .update(Buffer.from("Stellar Signed Message:\n", "utf8"))
    .update(messageBuffer)
    .digest();
  return decodeSignatureCandidates(signature).some((candidate) =>
    keypair.verify(sep53Hash, candidate) || keypair.verify(messageBuffer, candidate),
  );
}
