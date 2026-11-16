import IntegrationsSurface from "../IntegrationsClient";

export default function IntegrationsOperatorPage() {
  return <IntegrationsSurface mode="operator" redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />;
}
