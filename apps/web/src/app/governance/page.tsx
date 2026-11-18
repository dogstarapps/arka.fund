import GovernanceClient from "./GovernanceClient";

export default function GovernancePage() {
  return <GovernanceClient redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />;
}
