import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildGraphqlPageDefinition, type GraphqlProfile } from "./graphqlProfiles.js";
import type { CatalogSnapshot } from "./types.js";

export interface SnapshotGraphqlMirrorServer {
  url: string;
  close(): Promise<void>;
}

export interface SnapshotGraphqlMirrorOptions {
  snapshot:
    | CatalogSnapshot
    | (() => CatalogSnapshot | Promise<CatalogSnapshot>);
  profile?: GraphqlProfile;
  bearerToken?: string;
  host?: string;
  port?: number;
}

export interface SnapshotGraphqlRequest {
  query?: string;
  variables?: {
    first?: number;
    offset?: number;
    skip?: number;
  };
}

export interface SnapshotGraphqlPayload {
  arkas: unknown;
}

export function projectSnapshotGraphqlPayload(
  snapshot: CatalogSnapshot,
  request: SnapshotGraphqlRequest,
  profile: GraphqlProfile = "generic",
): SnapshotGraphqlPayload {
  const first = request.variables?.first ?? snapshot.arkas.length;
  const skip = request.variables?.skip ?? request.variables?.offset ?? 0;
  const page = snapshot.arkas.slice(skip, skip + first);
  if (profile === "subquery") {
    return {
      arkas: {
        totalCount: snapshot.arkas.length,
        nodes: page.map((arka) => ({
          ...arka,
          assets: {
            totalCount: arka.assets.length,
            nodes: arka.assets,
          },
        })),
      },
    };
  }
  return {
    arkas: page,
  };
}

export async function createSnapshotGraphqlMirrorServer(
  options: SnapshotGraphqlMirrorOptions,
): Promise<SnapshotGraphqlMirrorServer> {
  const host = options.host ?? "127.0.0.1";
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST") {
        writeJson(response, 405, { errors: [{ message: "method_not_allowed" }] });
        return;
      }

      if (options.bearerToken) {
        const authorization = request.headers.authorization;
        if (authorization !== `Bearer ${options.bearerToken}`) {
          writeJson(response, 401, { errors: [{ message: "unauthorized" }] });
          return;
        }
      }

      const payload = await readJsonBody(request);
      const requestPayload = parseGraphqlRequest(payload);
      const snapshot =
        typeof options.snapshot === "function" ? await options.snapshot() : options.snapshot;
      const profile = options.profile ?? detectGraphqlProfile(requestPayload);

      writeJson(response, 200, {
        data: projectSnapshotGraphqlPayload(snapshot, requestPayload, profile),
      });
    } catch (error) {
      writeJson(response, 400, {
        errors: [{ message: error instanceof Error ? error.message : String(error) }],
      });
    }
  });

  const url = await new Promise<string>((resolve) => {
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind snapshot GraphQL mirror server");
      }
      resolve(`http://${host}:${address.port}`);
    });
  });

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function parseGraphqlRequest(value: unknown): SnapshotGraphqlRequest {
  if (!isRecord(value)) {
    return {};
  }
  const variables = isRecord(value.variables) ? value.variables : {};
  return {
    query: typeof value.query === "string" ? value.query : undefined,
    variables: {
      first:
        typeof variables.first === "number" && Number.isFinite(variables.first)
          ? variables.first
          : undefined,
      offset:
        typeof variables.offset === "number" && Number.isFinite(variables.offset)
          ? variables.offset
          : undefined,
      skip:
        typeof variables.skip === "number" && Number.isFinite(variables.skip)
          ? variables.skip
          : undefined,
    },
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function detectGraphqlProfile(request: SnapshotGraphqlRequest): GraphqlProfile {
  const genericDefinition = buildGraphqlPageDefinition("generic", { first: 1, skip: 0 });
  if (request.query === genericDefinition.query) {
    return "generic";
  }
  return "subquery";
}
