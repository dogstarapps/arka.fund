import { apiErrorResponse } from "./apiHardening";
import { resolveOperatorSessionFromRequest } from "./operatorAccess";

export function requireOperatorApiSession(request: Request): Response | null {
  const session = resolveOperatorSessionFromRequest(request);
  if (session) {
    return null;
  }

  return apiErrorResponse(
    "api_operator_guard",
    "operator_access_required",
    "This endpoint belongs to the advanced operator surface. Verify an authorized operator wallet before requesting it.",
    {
      status: 401,
      headers: {
        "www-authenticate": 'OperatorSession realm="arkafund"',
      },
    },
  );
}
