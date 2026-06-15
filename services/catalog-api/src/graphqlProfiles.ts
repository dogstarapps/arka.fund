export type GraphqlProfile = "generic" | "subquery";

export interface GraphqlPageRequest {
  first: number;
  skip: number;
}

export interface GraphqlPageDefinition {
  query: string;
  variables: Record<string, unknown>;
}

type GraphqlEnvelope = Record<string, unknown>;

const GENERIC_ARKAS_QUERY = `
query CatalogArkas($first: Int!, $skip: Int!) {
  arkas(first: $first, skip: $skip, orderBy: ID_ASC) {
    id
    arkaId
    manager
    curated
    delisted
    nav
    denominationContract
    whitelistContracts
    shareToken
    syncedAt
    fees {
      mgmtBps
      perfBps
      depositBps
      redeemBps
    }
    assets {
      assetContract
      isDenomination
      liquidBalance
      collateralAmount
      debtAmount
      netManagedAmount
      netPositionValue
      marketIds
      syncedAt
    }
  }
}
`;

const SUBQUERY_ARKAS_QUERY = `
query CatalogArkas($first: Int!, $offset: Int!) {
  arkas(first: $first, offset: $offset, orderBy: ID_ASC) {
    totalCount
    nodes {
      id
      arkaId
      manager
      curated
      delisted
      nav
      denominationContract
      whitelistContracts
      shareToken
      syncedAt
      fees {
        mgmtBps
        perfBps
        depositBps
        redeemBps
      }
      assets {
        totalCount
        nodes {
          assetContract
          isDenomination
          liquidBalance
          collateralAmount
          debtAmount
          netManagedAmount
          netPositionValue
          marketIds
          syncedAt
        }
      }
    }
  }
}
`;

export function buildGraphqlPageDefinition(
  profile: GraphqlProfile,
  request: GraphqlPageRequest,
): GraphqlPageDefinition {
  if (profile === "subquery") {
    return {
      query: SUBQUERY_ARKAS_QUERY,
      variables: {
        first: request.first,
        offset: request.skip,
      },
    };
  }

  return {
    query: GENERIC_ARKAS_QUERY,
    variables: {
      first: request.first,
      skip: request.skip,
    },
  };
}

export function extractGraphqlArkaNodes(
  profile: GraphqlProfile,
  data: unknown,
): unknown[] {
  if (!isRecord(data)) {
    return [];
  }

  if (profile === "subquery") {
    const root = resolveSubqueryRoot(data);
    const arkas = root.arkas;
    if (!isRecord(arkas)) {
      return [];
    }
    const nodes = arkas.nodes;
    return Array.isArray(nodes) ? nodes : [];
  }

  return Array.isArray(data.arkas) ? data.arkas : [];
}

export function extractGraphqlConnectionNodes(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return [];
  }
  return Array.isArray(value.nodes) ? value.nodes : [];
}

function resolveSubqueryRoot(data: GraphqlEnvelope): GraphqlEnvelope {
  if (isRecord(data.query)) {
    return data.query;
  }
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
