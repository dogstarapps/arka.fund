import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { GraphqlProfile } from "../../src/graphqlProfiles.js";

export interface MockGraphqlServer {
  url: string;
  close(): Promise<void>;
}

export async function startMockGraphqlServer(
  arkas: unknown[],
  options: {
    expectedAuthorization?: string;
    profile?: GraphqlProfile;
  } = {},
): Promise<MockGraphqlServer> {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }

    if (options.expectedAuthorization) {
      const authorization = request.headers.authorization;
      if (authorization !== options.expectedAuthorization) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ errors: [{ message: "unauthorized" }] }));
        return;
      }
    }

    const payload = await readJsonBody(request);
    const variablesContainer = isRecord(payload) ? payload.variables : undefined;
    const variables = isRecord(variablesContainer) ? variablesContainer : {};
    const first = typeof variables.first === "number" ? variables.first : arkas.length;
    const skip =
      typeof variables.skip === "number"
        ? variables.skip
        : typeof variables.offset === "number"
          ? variables.offset
          : 0;
    const page = arkas.slice(skip, skip + first);

    response.writeHead(200, { "content-type": "application/json" });
    if (options.profile === "subquery") {
      response.end(
        JSON.stringify({
          data: {
            arkas: {
              totalCount: arkas.length,
              nodes: page.map((arka) => {
                const record = isRecord(arka) ? arka : {};
                const assets = Array.isArray(record.assets) ? record.assets : [];
                return {
                  ...record,
                  assets: {
                    totalCount: assets.length,
                    nodes: assets,
                  },
                };
              }),
            },
          },
        }),
      );
      return;
    }
    response.end(JSON.stringify({ data: { arkas: page } }));
  });

  const url = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind mock GraphQL server");
      }
      resolve(`http://127.0.0.1:${address.port}`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
