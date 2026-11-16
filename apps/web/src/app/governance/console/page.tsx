import GovernanceSurface from "../GovernanceClient";

export default function GovernanceConsolePage() {
  return <GovernanceSurface operatorConsole redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />;
}
