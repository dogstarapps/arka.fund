import Link from "next/link";
import { buildPublicCreateArkaHref } from "@/lib/workflows/productNavigation";

export default function PortfolioHeading({ mode }: { mode: "investor" | "manager" }) {
  const manager = mode === "manager";
  return (
    <header className="arka-redesign-page-heading arka-redesign-portfolio-heading">
      <div>
        <h1>{manager ? "Manage Arkas" : "My investments"}</h1>
        <p>{manager ? "Review the Arkas you manage and their pending withdrawals." : "Track your positions and withdrawal requests."}</p>
      </div>
      {manager ? <Link href={buildPublicCreateArkaHref("/manage") + "&step=start"} className="arka-redesign-button">Create Arka</Link> : null}
    </header>
  );
}
