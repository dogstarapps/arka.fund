#!/usr/bin/env bash
set -euo pipefail
NETWORK=testnet
ROUTER=CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD
A=CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG
B=CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7
HOLDER=arka-admin

function get_idx() {
  local t1=""; local t2=""
  echo "Query get_pools tokens=[, ]"
  stellar contract invoke --id "" --network "" --source-account "" -- get_pools --tokens "[\"\",\"\"]" | cat
}

echo "Aquarius pool discovery"
echo "Network= Router="
echo "Pair A= B="

get_idx "" ""
get_idx "" ""

# Also get_info for visibility
for order in AB BA; do
  if [[ "" == AB ]]; then t1=""; t2=""; else t1=""; t2=""; fi
  echo "Query get_info tokens=[, ]"
  stellar contract invoke --id "" --network "" --source-account "" -- get_info --tokens "[\"\",\"\"]" --pool_index 9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e | cat || true
  echo "---"
done
