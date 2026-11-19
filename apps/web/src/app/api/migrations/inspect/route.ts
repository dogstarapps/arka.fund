import { NextRequest } from "next/server";
import { Address, xdr } from "@stellar/stellar-sdk";
import { ARKA_FACTORY, ARKA_REGISTRY } from "@/lib/config";
import { scValToNative, simulateContractReadonly } from "@/lib/soroban";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";

export const dynamic = "force-dynamic";

function toAddressArg(value: string): xdr.ScVal {
  return xdr.ScVal.scvAddress(Address.fromString(value).toScAddress());
}

type OptionalFactoryReadResult = {
  supported: boolean;
  value: string | null;
};

async function readFactoryAddressMethod(
  method: string,
  address: string,
): Promise<string | null> {
  const result = await simulateContractReadonly(ARKA_FACTORY, method, [
    toAddressArg(address),
  ]);
  const plain = scValToNative(result);
  return typeof plain === "string" && plain.trim() ? plain : null;
}

async function readOptionalFactoryMethod(
  method: string,
): Promise<OptionalFactoryReadResult> {
  try {
    const result = await simulateContractReadonly(ARKA_FACTORY, method);
    const plain = scValToNative(result);
    return {
      supported: true,
      value: typeof plain === "string" && plain.trim() ? plain : null,
    };
  } catch {
    return {
      supported: false,
      value: null,
    };
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const sourceArka = request.nextUrl.searchParams.get("sourceArka")?.trim() ?? "";
  const targetArka = request.nextUrl.searchParams.get("targetArka")?.trim() ?? "";

  try {
    if (sourceArka) Address.fromString(sourceArka);
    if (targetArka) Address.fromString(targetArka);
  } catch {
    return jsonNoStore(
      {
        ok: false,
        error: "Invalid source or target Arka address.",
      },
      { status: 400 },
    );
  }

  try {
    const [
      implementationResult,
      registryResult,
      shareTokenImplementationResult,
      migratedTo,
      migratedFrom,
      sourceShareToken,
      targetShareToken,
    ] = await Promise.all([
      readOptionalFactoryMethod("get_implementation"),
      readOptionalFactoryMethod("get_registry"),
      simulateContractReadonly(ARKA_FACTORY, "get_share_token_implementation"),
      sourceArka
        ? readFactoryAddressMethod("migrated_to", sourceArka)
        : Promise.resolve(null),
      targetArka
        ? readFactoryAddressMethod("migrated_from", targetArka)
        : Promise.resolve(null),
      sourceArka
        ? readFactoryAddressMethod("share_token_of", sourceArka)
        : Promise.resolve(null),
      targetArka
        ? readFactoryAddressMethod("share_token_of", targetArka)
        : Promise.resolve(null),
    ]);

    const currentShareTokenImplementation = scValToNative(
      shareTokenImplementationResult,
    );

    return jsonNoStore(
      {
        ok: true,
        source: "api_migrations_inspect",
        generatedAt: new Date().toISOString(),
        snapshot: {
          factoryId: ARKA_FACTORY,
          registryId: ARKA_REGISTRY,
          sourceArka,
          targetArka,
          implementationGetterSupported: implementationResult.supported,
          currentImplementation: implementationResult.value,
          registryGetterSupported: registryResult.supported,
          currentRegistry: registryResult.value,
          currentShareTokenImplementation:
            typeof currentShareTokenImplementation === "string"
              ? currentShareTokenImplementation
              : "",
          migratedTo,
          migratedFrom,
          sourceShareToken,
          targetShareToken,
        },
      },
    );
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        error: redactApiText(error, "Failed to inspect migration state."),
      },
      { status: 500 },
    );
  }
}
