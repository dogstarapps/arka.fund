const json = (schema: Record<string, unknown>) => ({
  "application/json": { schema },
});

const response = (description: string, schema: Record<string, unknown>) => ({
  description,
  content: json(schema),
});

const requestBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: json(schema),
});

const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorResponses = {
  "404": response("Resource not found.", schemaRef("Error")),
  "503": response("The latest indexed snapshot is unavailable.", schemaRef("Error")),
};

const identityErrorResponses = {
  "400": response("The signed profile payload is invalid or expired.", schemaRef("Error")),
  "403": response("The signer is not authorized to update this profile.", schemaRef("Error")),
  "404": errorResponses["404"],
};

const idParameter = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

const query = (
  name: string,
  description: string,
  schema: Record<string, unknown> = { type: "string" },
) => ({ name, in: "query", required: false, description, schema });

const pagination = [
  query("offset", "Zero-based result offset.", { type: "integer", minimum: 0 }),
  query("limit", "Maximum number of returned items.", {
    type: "integer",
    minimum: 1,
    maximum: 200,
  }),
];

const order = query("order", "Sort direction.", {
  type: "string",
  enum: ["asc", "desc"],
});

const historyParameters = [
  query("from", "Inclusive ISO-8601 start time.", { type: "string", format: "date-time" }),
  query("to", "Inclusive ISO-8601 end time.", { type: "string", format: "date-time" }),
  order,
  query("limit", "Maximum number of history points.", {
    type: "integer",
    minimum: 1,
    maximum: 365,
  }),
];

const arkaFilters = [
  query("sort", "Arka sort field.", {
    type: "string",
    enum: ["nav", "manager", "syncedAt"],
  }),
  order,
  query("curated", "Filter by platform curation state.", { type: "boolean" }),
  query("delisted", "Filter by delisting state.", { type: "boolean" }),
  query("search", "Case-insensitive address or identity search."),
  ...pagination,
];

export const catalogOpenApiPaths: Record<string, unknown> = {
  "/v1/nav": {
    get: {
      tags: ["NAV"],
      summary: "Read aggregate NAV",
      operationId: "getCatalogNav",
      description:
        "Returns the canonical snapshot-backed NAV aggregate, denomination totals, valuation state and indexer monitoring state. Use the activity endpoints for live contract events.",
      responses: {
        "200": response("Current aggregate NAV response.", schemaRef("NavResponse")),
        "503": errorResponses["503"],
      },
    },
  },
  "/health": {
    get: {
      tags: ["Operations"],
      summary: "Read indexer health",
      operationId: "getHealth",
      description:
        "Returns sync freshness, indexed/failing Arka counts and active monitoring alerts. Critical alerts produce HTTP 503.",
      responses: {
        "200": response("Indexer is available.", schemaRef("Health")),
        "503": response("Indexer has no snapshot or a critical alert is active.", schemaRef("Health")),
      },
    },
  },
  "/v1/metrics": {
    get: {
      tags: ["Catalog"],
      summary: "Read catalog totals",
      operationId: "getMetrics",
      responses: {
        "200": response("Current catalog metrics.", schemaRef("Metrics")),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/arkas": {
    get: {
      tags: ["Arkas"],
      summary: "List indexed Arkas",
      operationId: "listArkas",
      description:
        "Returns paginated Arkas. Use curated=true and delisted=false for the public platform listing.",
      parameters: arkaFilters,
      responses: { "200": response("Paginated Arka list.", schemaRef("ArkaPage")) },
    },
  },
  "/v1/arkas/{id}": {
    get: {
      tags: ["Arkas"],
      summary: "Read an Arka",
      operationId: "getArka",
      parameters: [idParameter("id", "Arka contract ID.")],
      responses: {
        "200": response("Indexed Arka state.", schemaRef("Arka")),
        ...errorResponses,
      },
    },
  },
  "/v1/arkas/{id}/identity": {
    get: {
      tags: ["Arkas"],
      summary: "Read an Arka profile",
      operationId: "getArkaIdentity",
      parameters: [idParameter("id", "Arka contract ID.")],
      responses: {
        "200": response("Public Arka profile metadata.", schemaRef("ArkaIdentity")),
        "404": errorResponses["404"],
      },
    },
    put: {
      tags: ["Arkas"],
      summary: "Update an Arka profile",
      operationId: "updateArkaIdentity",
      description:
        "Saves public Arka profile metadata after verifying a Stellar signature from the current Arka manager.",
      parameters: [idParameter("id", "Arka contract ID.")],
      requestBody: requestBody(schemaRef("IdentityUpdateRequest")),
      responses: {
        "200": response("Updated Arka profile metadata.", schemaRef("ArkaIdentity")),
        ...identityErrorResponses,
      },
    },
  },
  "/v1/arkas/{id}/assets": {
    get: {
      tags: ["Arkas"],
      summary: "List Arka asset exposures",
      operationId: "listArkaAssets",
      parameters: [idParameter("id", "Arka contract ID.")],
      responses: {
        "200": response("Arka asset exposures.", {
          type: "array",
          items: schemaRef("AssetExposure"),
        }),
        ...errorResponses,
      },
    },
  },
  "/v1/arkas/{id}/portfolio": {
    get: {
      tags: ["Arkas"],
      summary: "Read ranked Arka composition",
      operationId: "getArkaPortfolio",
      parameters: [
        idParameter("id", "Arka contract ID."),
        query("limit", "Maximum number of positions.", { type: "integer", minimum: 1 }),
      ],
      responses: {
        "200": response("Ranked portfolio composition.", {
          type: "object",
          additionalProperties: true,
        }),
        ...errorResponses,
      },
    },
  },
  "/v1/arkas/{id}/history": {
    get: {
      tags: ["History"],
      summary: "Read Arka NAV history",
      operationId: "getArkaHistory",
      parameters: [idParameter("id", "Arka contract ID."), ...historyParameters],
      responses: {
        "200": response("Paginated Arka history.", {
          type: "object",
          additionalProperties: true,
        }),
      },
    },
  },
  "/v1/arkas/{id}/activity": {
    get: {
      tags: ["Activity"],
      summary: "Read Arka contract activity",
      operationId: "getArkaActivity",
      parameters: [idParameter("id", "Arka contract ID."), ...activityParameters()],
      responses: { "200": response("Paginated activity.", schemaRef("ActivityPage")) },
    },
  },
  "/v1/assets": {
    get: {
      tags: ["Assets"],
      summary: "List indexed assets",
      operationId: "listAssets",
      parameters: [
        query("sort", "Asset sort field.", {
          type: "string",
          enum: ["netManagedAmount", "arkaCount", "syncedAt"],
        }),
        order,
        query("search", "Case-insensitive contract search."),
        ...pagination,
      ],
      responses: {
        "200": response("Paginated asset list.", schemaRef("AssetPage")),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/prices": {
    get: {
      tags: ["NAV"],
      summary: "List indexed USD prices",
      operationId: "listAssetPrices",
      description:
        "Returns the latest OracleGuard result for each asset observed by the catalog. Unavailable prices include an explicit status and reason and are never replaced by a guessed value.",
      responses: {
        "200": response("Current asset prices and oracle state.", schemaRef("AssetPriceList")),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/prices/{id}": {
    get: {
      tags: ["NAV"],
      summary: "Read an indexed USD price",
      operationId: "getAssetPrice",
      parameters: [idParameter("id", "Stellar asset contract ID.")],
      responses: {
        "200": response("Current asset price and oracle state.", schemaRef("AssetPrice")),
        ...errorResponses,
      },
    },
  },
  "/v1/assets/{id}": {
    get: {
      tags: ["Assets"],
      summary: "Read an asset",
      operationId: "getAsset",
      parameters: [idParameter("id", "Asset contract ID.")],
      responses: {
        "200": response("Indexed asset state.", schemaRef("Asset")),
        ...errorResponses,
      },
    },
  },
  "/v1/assets/{id}/history": {
    get: {
      tags: ["History"],
      summary: "Read asset history",
      operationId: "getAssetHistory",
      parameters: [idParameter("id", "Asset contract ID."), ...historyParameters],
      responses: {
        "200": response("Paginated asset history.", {
          type: "object",
          additionalProperties: true,
        }),
      },
    },
  },
  "/v1/assets/{id}/arkas": {
    get: {
      tags: ["Assets"],
      summary: "List Arkas with an asset exposure",
      operationId: "listAssetArkas",
      parameters: [idParameter("id", "Asset contract ID."), ...arkaFilters],
      responses: {
        "200": response("Paginated Arka list.", schemaRef("ArkaPage")),
        ...errorResponses,
      },
    },
  },
  "/v1/managers": {
    get: {
      tags: ["Managers"],
      summary: "List indexed managers",
      operationId: "listManagers",
      parameters: [
        query("sort", "Manager sort field.", {
          type: "string",
          enum: ["totalNav", "arkaCount", "manager"],
        }),
        order,
        query("search", "Case-insensitive address or identity search."),
        ...pagination,
      ],
      responses: { "200": response("Paginated managers.", schemaRef("ManagerPage")) },
    },
  },
  "/v1/managers/{id}": {
    get: {
      tags: ["Managers"],
      summary: "Read a manager",
      operationId: "getManager",
      parameters: [idParameter("id", "Manager account address.")],
      responses: {
        "200": response("Indexed manager state.", schemaRef("Manager")),
        ...errorResponses,
      },
    },
  },
  "/v1/managers/{id}/identity": {
    get: {
      tags: ["Managers"],
      summary: "Read a manager profile",
      operationId: "getManagerIdentity",
      parameters: [idParameter("id", "Manager account address.")],
      responses: {
        "200": response("Public manager profile metadata.", schemaRef("ManagerIdentity")),
        "404": errorResponses["404"],
      },
    },
    put: {
      tags: ["Managers"],
      summary: "Update a manager profile",
      operationId: "updateManagerIdentity",
      description:
        "Saves public manager profile metadata after verifying a signature from the manager wallet.",
      parameters: [idParameter("id", "Manager account address.")],
      requestBody: requestBody(schemaRef("IdentityUpdateRequest")),
      responses: {
        "200": response("Updated manager profile metadata.", schemaRef("ManagerIdentity")),
        ...identityErrorResponses,
      },
    },
  },
  "/v1/managers/{id}/history": {
    get: {
      tags: ["History"],
      summary: "Read manager history",
      operationId: "getManagerHistory",
      parameters: [idParameter("id", "Manager account address."), ...historyParameters],
      responses: {
        "200": response("Paginated manager history.", {
          type: "object",
          additionalProperties: true,
        }),
      },
    },
  },
  "/v1/managers/{id}/arkas": {
    get: {
      tags: ["Managers"],
      summary: "List a manager's Arkas",
      operationId: "listManagerArkas",
      parameters: [idParameter("id", "Manager account address."), ...arkaFilters],
      responses: {
        "200": response("Paginated Arka list.", schemaRef("ArkaPage")),
        ...errorResponses,
      },
    },
  },
  "/v1/activity": {
    get: {
      tags: ["Activity"],
      summary: "Read indexed contract activity",
      operationId: "listActivity",
      parameters: activityParameters(),
      responses: {
        "200": response("Paginated activity.", schemaRef("ActivityPage")),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/dashboard/overview": {
    get: {
      tags: ["Dashboard"],
      summary: "Read dashboard aggregates",
      operationId: "getDashboardOverview",
      parameters: [
        query("activityLimit", "Number of recent activity records used in aggregates.", {
          type: "integer",
          minimum: 1,
        }),
      ],
      responses: {
        "200": response("Dashboard totals and monitoring summary.", {
          type: "object",
          additionalProperties: true,
        }),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/dashboard/composition": {
    get: {
      tags: ["Dashboard"],
      summary: "Read aggregate portfolio composition",
      operationId: "getDashboardComposition",
      parameters: [query("limit", "Maximum number of assets.", { type: "integer", minimum: 1 })],
      responses: {
        "200": response("Ranked asset composition.", {
          type: "object",
          additionalProperties: true,
        }),
        "503": errorResponses["503"],
      },
    },
  },
  "/v1/monitoring/status": {
    get: {
      tags: ["Operations"],
      summary: "Read monitoring status",
      operationId: "getMonitoringStatus",
      responses: {
        "200": response("Monitoring health, thresholds and active alerts.", schemaRef("MonitoringStatus")),
      },
    },
  },
  "/v1/monitoring/runs": {
    get: {
      tags: ["Operations"],
      summary: "List indexer sync runs",
      operationId: "listMonitoringRuns",
      parameters: [
        query("status", "Filter by run status.", {
          type: "string",
          enum: ["success", "failure"],
        }),
        order,
        query("limit", "Maximum number of runs.", { type: "integer", minimum: 1 }),
      ],
      responses: {
        "200": response("Paginated sync runs.", schemaRef("MonitoringRunPage")),
      },
    },
  },
  "/v1/monitoring/alerts": {
    get: {
      tags: ["Operations"],
      summary: "List monitoring alerts",
      operationId: "listMonitoringAlerts",
      parameters: [query("active", "Filter by active state.", { type: "boolean" })],
      responses: {
        "200": response("Monitoring alert history.", {
          type: "array",
          items: schemaRef("MonitoringAlert"),
        }),
      },
    },
  },
};

function activityParameters(): Record<string, unknown>[] {
  return [
    query("kind", "Activity type.", {
      type: "string",
      enum: ["deposit", "redeem", "profit", "lend", "borrow", "repay", "withdraw"],
    }),
    query("fromLedger", "Minimum ledger sequence.", { type: "integer", minimum: 0 }),
    query("toLedger", "Maximum ledger sequence.", { type: "integer", minimum: 0 }),
    order,
    query("limit", "Maximum number of activity records.", { type: "integer", minimum: 1 }),
  ];
}
