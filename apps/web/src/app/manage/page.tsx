import WalletPortfolioSurface from '@/components/product/WalletPortfolioSurface';
export default function ManagePage() { return <WalletPortfolioSurface mode="manager" redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />; }
