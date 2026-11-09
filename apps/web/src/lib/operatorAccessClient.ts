export const OPERATOR_SESSION_STORAGE_KEY = "arkafund.operatorSession";
export const LEGACY_OPERATOR_MODE_STORAGE_KEY = "arkafund.operatorMode";

export type OperatorAccessStatus = "checking" | "locked" | "verified" | "error";

export type OperatorSessionSnapshot = {
  authorized: boolean;
  pubkey?: string;
  role?: "operator";
  token?: string;
  expiresAt?: number;
  error?: string;
  message?: string;
};

export type OperatorWalletBinding =
  | {
      valid: true;
      pubkey: string;
    }
  | {
      valid: false;
      error: string;
    };

type ChallengeResponse = {
  challenge?: string;
  expiresAt?: number;
  role?: "operator";
  error?: string;
  message?: string;
};

type VerifyResponse = OperatorSessionSnapshot;

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeOperatorPubkey(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function deriveOperatorWalletBinding(params: {
  sessionPubkey?: string | null;
  walletPubkey?: string | null;
}): OperatorWalletBinding {
  const sessionPubkey = normalizeOperatorPubkey(params.sessionPubkey);
  const walletPubkey = normalizeOperatorPubkey(params.walletPubkey);

  if (!sessionPubkey) {
    return {
      valid: false,
      error: "Operator session is missing its wallet identity.",
    };
  }

  if (!walletPubkey) {
    return {
      valid: false,
      error: "Reconnect the authorized operator wallet to unlock advanced routes.",
    };
  }

  if (sessionPubkey !== walletPubkey) {
    return {
      valid: false,
      error: "Connected wallet does not match the stored operator session.",
    };
  }

  return {
    valid: true,
    pubkey: sessionPubkey,
  };
}

export function readStoredOperatorSession(): OperatorSessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseJson<OperatorSessionSnapshot>(
      window.localStorage.getItem(OPERATOR_SESSION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function writeStoredOperatorSession(session: OperatorSessionSnapshot): void {
  if (typeof window === "undefined" || !session.token) {
    return;
  }

  try {
    window.localStorage.setItem(OPERATOR_SESSION_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.removeItem(LEGACY_OPERATOR_MODE_STORAGE_KEY);
  } catch {
    // Session persistence is a convenience; server verification remains authoritative.
  }
}

export function clearStoredOperatorSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(OPERATOR_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_OPERATOR_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export async function clearOperatorSessionCookie(): Promise<void> {
  try {
    await fetch("/api/operator/access", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    // Local lock still removes browser-visible state; the next server validation remains fail-closed.
  }
}

export function readStoredWalletPubkey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem("wallet:pubkey") ?? "";
  } catch {
    return "";
  }
}

export function writeStoredWalletPubkey(pubkey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem("wallet:pubkey", pubkey);
    window.dispatchEvent(new CustomEvent("wallet:pubkey-changed", { detail: pubkey }));
  } catch {
    // Wallet state is mirrored by the wallet component; do not fail access verification.
  }
}

export async function validateOperatorSession(
  token: string,
): Promise<OperatorSessionSnapshot> {
  const res = await fetch(`/api/operator/access?token=${encodeURIComponent(token)}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as OperatorSessionSnapshot;
  if (!res.ok) {
    return { authorized: false, error: json.error ?? "session_validation_failed", message: json.message };
  }
  return json;
}

export async function requestOperatorChallenge(pubkey: string): Promise<ChallengeResponse> {
  const res = await fetch("/api/operator/access", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", pubkey }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as ChallengeResponse;
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? "operator_challenge_failed");
  }
  if (!json.challenge) {
    throw new Error("operator_challenge_missing");
  }
  return json;
}

export async function verifyOperatorChallengeSignature(params: {
  pubkey: string;
  challenge: string;
  signature: string;
}): Promise<VerifyResponse> {
  const res = await fetch("/api/operator/access", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "verify",
      pubkey: params.pubkey,
      challenge: params.challenge,
      signature: params.signature,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as VerifyResponse;
  if (!res.ok || !json.authorized || !json.token) {
    throw new Error(json.message ?? json.error ?? "operator_verification_failed");
  }
  return json;
}
