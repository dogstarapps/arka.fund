import { expect, type APIResponse, type Page } from "@playwright/test";

type OperatorSessionPayload = {
  authorized: true;
  pubkey: string;
  role: string;
  token: string;
  expiresAt: number;
};

const OPERATOR_ACCESS_RETRY_DELAYS_MS = [0, 250, 750, 1_500] as const;
const OPERATOR_SESSION_COOKIE_NAME = "arkafund_operator_session";
const PLAYWRIGHT_APP_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3005";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeRetryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function requestWithTransientRetry(
  label: string,
  request: () => Promise<APIResponse>,
): Promise<APIResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt < OPERATOR_ACCESS_RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = OPERATOR_ACCESS_RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      const response = await request();
      if (response.ok() || response.status() < 500) {
        return response;
      }
      lastError = new Error(`${label} returned HTTP ${response.status()}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${label} failed after ${OPERATOR_ACCESS_RETRY_DELAYS_MS.length} attempts: ${describeRetryError(
      lastError,
    )}`,
  );
}

export async function createOperatorSessionPayload(page: Page): Promise<OperatorSessionPayload> {
  const walletResponse = await requestWithTransientRetry("operator wallet lookup", () =>
    page.request.get("/api/e2e-wallet?profile=manager"),
  );
  expect(walletResponse.ok()).toBeTruthy();
  const wallet = (await walletResponse.json()) as { address?: string };
  expect(wallet.address).toBeTruthy();

  const challengeResponse = await requestWithTransientRetry("operator challenge", () =>
    page.request.post("/api/operator/access", {
      data: { action: "challenge", pubkey: wallet.address },
    }),
  );
  expect(challengeResponse.ok()).toBeTruthy();
  const challenge = (await challengeResponse.json()) as { challenge?: string };
  expect(challenge.challenge).toBeTruthy();

  const signatureResponse = await requestWithTransientRetry("operator challenge signature", () =>
    page.request.post("/api/e2e-wallet?profile=manager", {
      data: { message: challenge.challenge },
    }),
  );
  expect(signatureResponse.ok()).toBeTruthy();
  const signature = (await signatureResponse.json()) as { signedMessage?: string };
  expect(signature.signedMessage).toBeTruthy();

  const sessionResponse = await requestWithTransientRetry("operator session verify", () =>
    page.request.post("/api/operator/access", {
      data: {
        action: "verify",
        pubkey: wallet.address,
        challenge: challenge.challenge,
        signature: signature.signedMessage,
      },
    }),
  );
  expect(sessionResponse.ok()).toBeTruthy();
  const session = (await sessionResponse.json()) as {
    token?: string;
    pubkey?: string;
    role?: string;
    expiresAt?: number;
  };
  expect(session.token).toBeTruthy();

  const operatorSession: OperatorSessionPayload = {
    authorized: true,
    pubkey: session.pubkey ?? wallet.address ?? "",
    token: session.token ?? "",
    role: session.role ?? "operator",
    expiresAt: session.expiresAt ?? Date.now() + 60 * 60 * 1000,
  };
  expect(operatorSession.pubkey).toBeTruthy();
  expect(operatorSession.token).toBeTruthy();

  return operatorSession;
}

export async function enableOperatorMode(page: Page): Promise<void> {
  const operatorSession = await createOperatorSessionPayload(page);

  await page.context().addCookies([
    {
      name: OPERATOR_SESSION_COOKIE_NAME,
      value: operatorSession.token,
      url: PLAYWRIGHT_APP_URL,
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
      expires: Math.floor(operatorSession.expiresAt / 1_000),
    },
  ]);

  await page.addInitScript(
    ({ pubkey, token, role, expiresAt }) => {
      window.localStorage.setItem("e2e-wallet-profile", "manager");
      window.localStorage.setItem("wallet:pubkey", pubkey);
      window.localStorage.setItem(
        "arkafund.operatorSession",
        JSON.stringify({
          authorized: true,
          pubkey,
          role,
          token,
          expiresAt,
        }),
      );
      window.localStorage.removeItem("arkafund.operatorMode");
    },
    operatorSession,
  );
}
