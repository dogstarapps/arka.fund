#!/usr/bin/env bash
set -euo pipefail

SDK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSUMER_DIR="$(mktemp -d)"
PACKAGE_FILE=""

cleanup() {
  rm -rf "$CONSUMER_DIR"
  if [[ -n "$PACKAGE_FILE" && -f "$PACKAGE_FILE" ]]; then
    rm -f "$PACKAGE_FILE"
  fi
}
trap cleanup EXIT

cd "$SDK_DIR"
npm run build >/dev/null
PACKAGE_FILE="$SDK_DIR/$(npm pack --silent)"

PACKAGE_CONTENTS="$(tar -xOf "$PACKAGE_FILE" package/README.md; tar -xOf "$PACKAGE_FILE" package/package.json; tar -xOf "$PACKAGE_FILE" package/dist/src/sdk.js)"
LOCAL_USERS_MARKER="/""Users/"
LOCAL_HOME_MARKER="/""home/"
if grep -Eqi "${LOCAL_USERS_MARKER}|${LOCAL_HOME_MARKER}|marcosoliva|manna-digital|ARKA_MAINNET_ADMIN_SK|HETZNER_PASS|OPENAI_API_KEY|GITHUB_TOKEN_DOGSTAR|ARKA_PAGERDUTY_ROUTING_KEY" <<<"$PACKAGE_CONTENTS"; then
  echo "SDK tarball contains a local path or sensitive identifier" >&2
  exit 1
fi

if tar -tzf "$PACKAGE_FILE" | grep -Eq '(^|/)(\.env|\.npmrc|id_[^/]+|.*\.pem)$'; then
  echo "SDK tarball contains a forbidden credential file" >&2
  exit 1
fi

cd "$CONSUMER_DIR"
npm init -y >/dev/null
npm install --silent "$PACKAGE_FILE"
node --input-type=module <<'NODE'
import {
  ARKAFUND_MAINNET_CONTRACTS,
  ArkafundSdk,
  CatalogClient,
  createMainnetConfig,
  formatAssetAmount,
} from "@arkafund/sdk";

const sdk = new ArkafundSdk(createMainnetConfig());
if (!sdk.registry(ARKAFUND_MAINNET_CONTRACTS.arkaRegistry)) {
  throw new Error("Registry module was not created");
}
if (!(new CatalogClient({ baseUrl: "https://catalog.arka.fund" }))) {
  throw new Error("Catalog client was not created");
}
if (formatAssetAmount("10000000", 7) !== "1") {
  throw new Error("Amount formatter produced an unexpected value");
}
console.log("clean consumer import: ok");
NODE
