import WalletPortfolioSurface from '@/components/product/WalletPortfolioSurface';
export default function InvestmentsPage() { return <WalletPortfolioSurface mode="investor" redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />; }
