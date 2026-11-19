import IntegrationsClient from "./IntegrationsClient";

export default function IntegrationsPage() {
  return <IntegrationsClient mode="public" redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />;
}
