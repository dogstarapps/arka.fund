import { notFound } from 'next/navigation';
import ManagedWithdrawalsClient from './ManagedWithdrawalsClient';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.ARKA_MANAGED_PREVIEW !== '1' || process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW !== '1') notFound();
  return <ManagedWithdrawalsClient />;
}
