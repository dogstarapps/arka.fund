import { Keypair } from "@stellar/stellar-sdk";
import {
  createOperatorSession,
  OPERATOR_SESSION_COOKIE_NAME,
} from "@/lib/server/operatorAccess";

export const OPERATOR_TEST_KEYPAIR = Keypair.random();
export const OUTSIDER_TEST_KEYPAIR = Keypair.random();
export const OPERATOR_TEST_PUBLIC_KEY = OPERATOR_TEST_KEYPAIR.publicKey();
export const OPERATOR_TEST_SECRET = "unit-test-operator-secret";

export function operatorAuthHeaders(): HeadersInit {
  const session = createOperatorSession(
    OPERATOR_TEST_PUBLIC_KEY,
    "operator",
  );
  if (!session) {
    throw new Error("Unable to create operator test session.");
  }

  return {
    cookie: `${OPERATOR_SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`,
  };
}

export function operatorRequest(
  url: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(operatorAuthHeaders())) {
    headers.set(key, String(value));
  }
  return new Request(url, {
    ...init,
    headers,
  });
}
