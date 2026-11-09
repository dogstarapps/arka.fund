import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const policy = vi.hoisted(() => ({ preview: false }));
vi.mock('@/lib/previewSafety', () => ({ get UX_REVIEW_PREVIEW() { return policy.preview; } }));
import FundSwapReview from '@/components/product/FundSwapReview';

const base = {
  snapshotKey: 'quote-1', fundName: 'Noah’s Ark', pays: '1 XLM', receives: '0.18 USDC', minimum: '0.175 USDC', route: 'Aquarius', canReview: true, canSign: true,
};
describe('compact fund swap review', () => {
  beforeEach(() => { policy.preview = false; });
  afterEach(cleanup);
  it('shows a review without building, signing or submitting anything', async () => {
    const confirm = vi.fn();
    render(<FundSwapReview {...base} onConfirm={confirm}><label>Amount <input defaultValue="1" /></label></FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    expect(screen.getByRole('region', { name: 'Review fund change' })).toHaveTextContent('Noah’s Ark');
    expect(screen.getByTestId('fund-swap-review')).toHaveTextContent('0.175 USDC');
    expect(screen.getByTestId('fund-swap-review')).toHaveTextContent('Calculated during the next simulation');
    expect(screen.getByRole('heading', { name: 'Review fund change' })).toHaveFocus();
    expect(confirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to amount' }));
    expect(screen.getByRole('button', { name: 'Review change' })).toBeVisible();
    expect(screen.getByLabelText('Amount')).toHaveValue('1');
  });
  it('requires a separate confirmation and prevents duplicate pending submissions', async () => {
    let finish!: () => void;
    const confirm = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<FundSwapReview {...base} onConfirm={confirm}>Amount</FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    await userEvent.dblClick(screen.getByTestId('rebalance-confirm-button'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Back to amount' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByTestId('fund-swap-review')).not.toBeInTheDocument());
  });
  it('allows public review but never grants manager authority', async () => {
    const confirm = vi.fn();
    render(<FundSwapReview {...base} canSign={false} onConfirm={confirm}>Amount</FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    expect(screen.getByTestId('rebalance-confirm-button')).toBeDisabled();
    expect(screen.getByText(/connect the fund manager wallet/i)).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('blocks signing in a review preview even for a manager', async () => {
    policy.preview = true;
    const confirm = vi.fn();
    render(<FundSwapReview {...base} onConfirm={confirm}>Amount</FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    await userEvent.click(screen.getByTestId('rebalance-confirm-button'));
    expect(screen.getByTestId('rebalance-confirm-button')).toBeDisabled();
    expect(screen.getByText(/no wallet will open/i)).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('invalidates a review when the quote or inputs change', async () => {
    const confirm = vi.fn();
    const view = render(<FundSwapReview {...base} onConfirm={confirm}>Amount</FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    view.rerender(<FundSwapReview {...base} snapshotKey="quote-2" minimum="0.17 USDC" onConfirm={confirm}>Amount</FundSwapReview>);
    expect(screen.queryByTestId('rebalance-confirm-button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Review the updated amounts');
    expect(confirm).not.toHaveBeenCalled();
  });
  it('does not offer review when the quote or risk checks are not ready', () => {
    render(<FundSwapReview {...base} canReview={false} onConfirm={vi.fn()}>Amount</FundSwapReview>);
    expect(screen.getByRole('button', { name: 'Review change' })).toBeDisabled();
  });
  it('handles preparation failures without leaving a locked pending action', async () => {
    render(<FundSwapReview {...base} onConfirm={vi.fn().mockRejectedValue(new Error('RPC offline'))}>Amount</FundSwapReview>);
    await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
    await userEvent.click(screen.getByTestId('rebalance-confirm-button'));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be prepared');
    expect(screen.getByRole('button', { name: 'Review change' })).toBeEnabled();
  });
});
