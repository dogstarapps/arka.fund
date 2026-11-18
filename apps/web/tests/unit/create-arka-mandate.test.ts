import { describe, expect, it } from "vitest";
import { buildCreateArkaMandateChips } from "@/lib/workflows/createArkaMandate";

describe("createArkaMandate", () => {
  it("keeps denomination visible and excludes it from optional allowed chips", () => {
    const result = buildCreateArkaMandateChips(
      {
        denominationContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        whitelistContracts: [
          "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
          "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
          "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
        ],
        options: [
          {
            contract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
            label: "BLND",
          },
          {
            contract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
            label: "XTAR",
          },
        ],
      },
      (contract) => contract.slice(0, 8),
    );

    expect(result.denomination).toEqual({
      contract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      label: "BLND",
      locked: true,
    });
    expect(result.allowed).toEqual([
      {
        contract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
        label: "XTAR",
        locked: false,
      },
    ]);
  });
});
