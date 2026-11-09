import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  jsonNoStore,
  readJsonObjectBody,
} from "@/lib/server/apiHardening";
import {
  createOperatorChallenge,
  createOperatorSession,
  OPERATOR_SESSION_COOKIE_NAME,
  resolveOperatorAccessSecret,
  resolveOperatorRole,
  resolveOperatorSessionTokenFromRequest,
  OPERATOR_SESSION_TTL_SECONDS,
  revokeOperatorSessionToken,
  verifyOperatorChallenge,
  verifyOperatorMessageSignature,
  verifyOperatorSession,
} from "@/lib/server/operatorAccess";

type OperatorAccessRequest =
  | {
      action?: "challenge";
      pubkey?: string;
    }
  | {
      action?: "verify";
      pubkey?: string;
      challenge?: string;
      signature?: string;
    };

function unavailableResponse(): NextResponse {
  return jsonNoStore(
    {
      authorized: false,
      error: "operator_access_secret_missing",
      message: "Operator access is fail-closed until OPERATOR_ACCESS_SECRET is configured.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!resolveOperatorAccessSecret()) {
    return unavailableResponse();
  }

  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    resolveOperatorSessionTokenFromRequest(request);
  const session = token ? verifyOperatorSession(token) : null;
  if (!session) {
    return jsonNoStore({ authorized: false }, { status: 200 });
  }

  return jsonNoStore({
    authorized: true,
    pubkey: session.pubkey,
    role: session.role,
    expiresAt: session.expiresAt,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!resolveOperatorAccessSecret()) {
    return unavailableResponse();
  }

  let body: OperatorAccessRequest;
  try {
    body = await readJsonObjectBody<OperatorAccessRequest & Record<string, unknown>>(request);
  } catch {
    return apiErrorResponse(
      "api_operator_access",
      "invalid_json",
      "Request body must be a JSON object.",
      { status: 400 },
    );
  }

  if (body.action === "challenge") {
    const pubkey = body.pubkey ?? "";
    const role = resolveOperatorRole(pubkey);
    if (!role) {
      return jsonNoStore(
        { authorized: false, error: "wallet_not_authorized" },
        { status: 403 },
      );
    }

    const challenge = createOperatorChallenge(pubkey);
    if (!challenge) {
      return jsonNoStore(
        { authorized: false, error: "challenge_unavailable" },
        { status: 503 },
      );
    }

    return jsonNoStore({
      authorized: false,
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt,
      role: challenge.role,
    });
  }

  if (body.action === "verify") {
    const pubkey = body.pubkey ?? "";
    const challenge = body.challenge ?? "";
    const signature = body.signature ?? "";
    const role = verifyOperatorChallenge(pubkey, challenge);
    const signatureValid = role
      ? verifyOperatorMessageSignature(pubkey, challenge, signature)
      : false;

    if (!role || !signatureValid) {
      return jsonNoStore(
        { authorized: false, error: "operator_signature_invalid" },
        { status: 403 },
      );
    }

    const session = createOperatorSession(pubkey, role);
    if (!session) {
      return jsonNoStore(
        { authorized: false, error: "session_unavailable" },
        { status: 503 },
      );
    }

    const response = jsonNoStore({
      authorized: true,
      pubkey: session.pubkey,
      role: session.role,
      token: session.token,
      expiresAt: session.expiresAt,
    });
    response.cookies.set(OPERATOR_SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: OPERATOR_SESSION_TTL_SECONDS,
      expires: new Date(session.expiresAt),
    });
    return response;
  }

  return apiErrorResponse(
    "api_operator_access",
    "unknown_action",
    "Operator access action must be challenge or verify.",
    { status: 400 },
  );
}

export async function DELETE(request: Request): Promise<NextResponse> {
  revokeOperatorSessionToken(resolveOperatorSessionTokenFromRequest(request));
  const response = jsonNoStore(
    { authorized: false, cleared: true },
    { status: 200 },
  );
  response.cookies.set(OPERATOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
