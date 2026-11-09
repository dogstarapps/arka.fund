// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_KEYPAIR,
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
} from "../helpers/operator-auth";
import { OPERATOR_SESSION_COOKIE_NAME } from "@/lib/server/operatorAccess";

describe("operator access API route", () => {
  const operator = OPERATOR_TEST_KEYPAIR;

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("sets, validates and clears the httpOnly operator session cookie", async () => {
    configureOperatorAccess();
    const { DELETE, GET, POST } = await import("@/app/api/operator/access/route");

    const challengeResponse = await POST(
      new Request("http://localhost/api/operator/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "challenge",
          pubkey: OPERATOR_TEST_PUBLIC_KEY,
        }),
      }),
    );
    const challengePayload = await challengeResponse.json();
    expect(challengeResponse.status).toBe(200);
    expect(challengeResponse.headers.get("cache-control")).toBe("no-store");
    expect(challengePayload.challenge).toMatch(/^arkafund-operator-access:/);

    const signature = operator.sign(
      Buffer.from(challengePayload.challenge, "utf8"),
    ).toString("base64");
    const verifyResponse = await POST(
      new Request("http://localhost/api/operator/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          pubkey: OPERATOR_TEST_PUBLIC_KEY,
          challenge: challengePayload.challenge,
          signature,
        }),
      }),
    );
    const verifyPayload = await verifyResponse.json();
    const setCookie = verifyResponse.headers.get("set-cookie") ?? "";

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get("cache-control")).toBe("no-store");
    expect(verifyPayload.authorized).toBe(true);
    expect(setCookie).toContain(OPERATOR_SESSION_COOKIE_NAME);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const sessionCookie = setCookie.split(";")[0];
    const sessionResponse = await GET(
      new Request("http://localhost/api/operator/access", {
        headers: { cookie: sessionCookie },
      }),
    );
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.headers.get("cache-control")).toBe("no-store");
    expect(sessionPayload.authorized).toBe(true);
    expect(sessionPayload.pubkey).toBe(OPERATOR_TEST_PUBLIC_KEY);

    const clearResponse = await DELETE(
      new Request("http://localhost/api/operator/access", {
        method: "DELETE",
        headers: { cookie: sessionCookie },
      }),
    );
    const clearCookie = clearResponse.headers.get("set-cookie") ?? "";
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.headers.get("cache-control")).toBe("no-store");
    expect(clearCookie).toContain(OPERATOR_SESSION_COOKIE_NAME);
    expect(clearCookie).toMatch(/Max-Age=0/i);
  });

  it("does not issue a challenge for wallets outside the operator allowlist", async () => {
    configureOperatorAccess();
    const outsider = "GDEADBEFGDEADBEFGDEADBEFGDEADBEFGDEADBEFGDEADBEFGDEADBEFA";
    const { POST } = await import("@/app/api/operator/access/route");

    const response = await POST(
      new Request("http://localhost/api/operator/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "challenge", pubkey: outsider }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.error).toBe("wallet_not_authorized");
  });
});
