//! Managed withdrawals v1: new, empty, single-denomination, debt-free funds only.
//! Shares stay exposed until settlement; reserved cash is removed from NAV.
//! Settlement and claims never need the manager's signature. Recovery is bounded.
use super::*;

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedPolicy {
    pub epoch_seconds: u64,
    pub manager_window: u64,
    pub min_request_shares: i128,
    pub buffer_bps: u32,
    pub blend_market_id: u128,
    pub blend_adapter: Option<Address>,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedPolicy {
    pub epoch_seconds: u64,
    pub manager_window: u64,
    pub min_request_shares: i128,
    pub buffer_bps: u32,
    pub blend_market_id: u128,
    pub blend_adapter: Option<Address>,
}
}
crate::compact_codec::record!(ManagedPolicy, __wire_spec_ManagedPolicy::ManagedPolicy; (0, blend_adapter, Option<Address>), (1, blend_market_id, u128), (2, buffer_bps, u32), (3, epoch_seconds, u64), (4, manager_window, u64), (5, min_request_shares, i128));

// Additive, immutable opt-in for NEW debt-free portfolios. Denomination is the
// accounting/payout asset, not a restriction to holding that asset alone.
#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedSpotRoute {
    pub asset: Address,
    pub router: Address,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedSpotRoute {
 use super::*;
 // Additive, immutable opt-in for NEW debt-free portfolios. Denomination is the
 // accounting/payout asset, not a restriction to holding that asset alone.
 #[soroban_sdk::contracttype]
 pub struct ManagedSpotRoute {
    pub asset: Address,
    pub router: Address,
}
}
crate::compact_codec::record!(ManagedSpotRoute, __wire_spec_ManagedSpotRoute::ManagedSpotRoute; (0, asset, Address), (1, router, Address));

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedPortfolioPolicy {
    pub routes: Vec<ManagedSpotRoute>,
    pub instant_cash: bool,
    pub auto_payout: bool,
    pub max_slippage_bps: u32,
    pub cancel_lock_seconds: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedPortfolioPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedPortfolioPolicy {
    pub routes: Vec<ManagedSpotRoute>,
    pub instant_cash: bool,
    pub auto_payout: bool,
    pub max_slippage_bps: u32,
    pub cancel_lock_seconds: u64,
}
}
crate::compact_codec::record!(ManagedPortfolioPolicy, __wire_spec_ManagedPortfolioPolicy::ManagedPortfolioPolicy; (0, auto_payout, bool), (1, cancel_lock_seconds, u64), (2, instant_cash, bool), (3, max_slippage_bps, u32), (4, routes, Vec<ManagedSpotRoute>));

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedQueue {
    pub head: u64,
    pub next_id: u64,
    pub pending_shares: i128,
    pub pending_count: u32,
    pub reserved_assets: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedQueue {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedQueue {
    pub head: u64,
    pub next_id: u64,
    pub pending_shares: i128,
    pub pending_count: u32,
    pub reserved_assets: i128,
}
}
crate::compact_codec::record!(ManagedQueue, __wire_spec_ManagedQueue::ManagedQueue; (0, head, u64), (1, next_id, u64), (2, pending_count, u32), (3, pending_shares, i128), (4, reserved_assets, i128));

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedRequest {
    pub id: u64,
    pub owner: Address,
    pub requested_shares: i128,
    pub pending_shares: i128,
    pub settled_shares: i128,
    pub cancelled_shares: i128,
    pub claimable_assets: i128,
    pub claimed_assets: i128,
    pub created_at: u64,
    pub eligible_at: u64,
    pub last_settled_at: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedRequest {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedRequest {
    pub id: u64,
    pub owner: Address,
    pub requested_shares: i128,
    pub pending_shares: i128,
    pub settled_shares: i128,
    pub cancelled_shares: i128,
    pub claimable_assets: i128,
    pub claimed_assets: i128,
    pub created_at: u64,
    pub eligible_at: u64,
    pub last_settled_at: u64,
}
}
crate::compact_codec::record!(ManagedRequest, __wire_spec_ManagedRequest::ManagedRequest; (0, cancelled_shares, i128), (1, claimable_assets, i128), (2, claimed_assets, i128), (3, created_at, u64), (4, eligible_at, u64), (5, id, u64), (6, last_settled_at, u64), (7, owner, Address), (8, pending_shares, i128), (9, requested_shares, i128), (10, settled_shares, i128));

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedSettlement {
    pub head_before: u64,
    pub head_after: u64,
    pub visited: u32,
    pub settled_shares: i128,
    pub reserved_assets: i128,
    pub nav_before: i128,
    pub total_shares_before: i128,
    pub timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedSettlement {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedSettlement {
    pub head_before: u64,
    pub head_after: u64,
    pub visited: u32,
    pub settled_shares: i128,
    pub reserved_assets: i128,
    pub nav_before: i128,
    pub total_shares_before: i128,
    pub timestamp: u64,
}
}
crate::compact_codec::record!(ManagedSettlement, __wire_spec_ManagedSettlement::ManagedSettlement; (0, head_after, u64), (1, head_before, u64), (2, nav_before, i128), (3, reserved_assets, i128), (4, settled_shares, i128), (5, timestamp, u64), (6, total_shares_before, i128), (7, visited, u32));

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedStatus {
    pub queue: ManagedQueue,
    pub nav: i128,
    pub total_shares: i128,
    pub cash: i128,
    pub settle_capacity: i128,
    pub recovery_needed: i128,
    pub recovery_available: i128,
    pub recovery_public_at: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedStatus {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedStatus {
    pub queue: ManagedQueue,
    pub nav: i128,
    pub total_shares: i128,
    pub cash: i128,
    pub settle_capacity: i128,
    pub recovery_needed: i128,
    pub recovery_available: i128,
    pub recovery_public_at: u64,
}
}
crate::compact_codec::record!(ManagedStatus, __wire_spec_ManagedStatus::ManagedStatus; (0, cash, i128), (1, nav, i128), (2, queue, ManagedQueue), (3, recovery_available, i128), (4, recovery_needed, i128), (5, recovery_public_at, u64), (6, settle_capacity, i128), (7, total_shares, i128));

impl ArkaContract {
    pub(super) fn managed_portfolio(env: &Env) -> Option<ManagedPortfolioPolicy> {
        crate::compact_storage::instance(&env)
            .get(&DataKey::ManagedPortfolioPolicy)
    }

    pub(super) fn managed_enable_portfolio(
        env: &Env,
        caller: &Address,
        policy: ManagedPolicy,
        portfolio: ManagedPortfolioPolicy,
    ) {
        Self::require_policy_auth(env, caller);
        Self::managed_assert_legacy_mode(env);
        if portfolio.routes.len() > 16
            || portfolio.max_slippage_bps > 500
            || portfolio.cancel_lock_seconds < policy.manager_window
            || portfolio.cancel_lock_seconds > 604_800
        {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let denom = Self::denomination(env.clone()).contract;
        // Existing valuation ABI uses Stellar's seven-decimal asset units.
        // Reject incompatible tokens rather than silently misprice a portfolio.
        if env.invoke_contract::<u32>(&denom, &symbol_short!("decimals"), Vec::new(env)) != 7 {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        Self::require_valuation_oracle_config(env);
        for (i, route) in portfolio.routes.iter().enumerate() {
            if route.asset == denom
                || env.invoke_contract::<u32>(
                    &route.asset,
                    &symbol_short!("decimals"),
                    Vec::new(env),
                ) != 7
            {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
            Self::assert_asset_allowed(env, &route.asset);
            Self::managed_route_admitted(env, &route);
            for prior in portfolio.routes.iter().take(i) {
                if prior.asset == route.asset {
                    panic_with_error!(env, Error::ManagedInvalidRequest);
                }
            }
            Self::value_asset_amount_in_denom(
                env,
                &route.asset,
                10_000_000,
                &Asset {
                    contract: denom.clone(),
                },
            );
        }
        let allowed: Vec<Asset> = crate::compact_storage::instance(&env)
            .get(&DataKey::Whitelist)
            .unwrap_or(Vec::new(env));
        for asset in allowed.iter() {
            if asset.contract != denom
                && !portfolio.routes.iter().any(|r| r.asset == asset.contract)
            {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        crate::compact_storage::instance(&env)
            .set(&DataKey::ManagedPortfolioPolicy, &portfolio);
        Self::managed_initialize(env, policy);
    }
    pub(super) fn managed_policy(env: &Env) -> Option<ManagedPolicy> {
        crate::compact_storage::instance(&env).get(&DataKey::ManagedPolicy)
    }

    fn managed_required_policy(env: &Env) -> ManagedPolicy {
        Self::managed_policy(env).unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    pub(super) fn managed_assert_legacy_mode(env: &Env) {
        if Self::managed_policy(env).is_some() {
            panic_with_error!(env, Error::ManagedPolicyLocked);
        }
    }

    pub(super) fn managed_queue(env: &Env) -> ManagedQueue {
        Self::dynamic_get(env, &DataKey::ManagedQueue).unwrap_or(ManagedQueue {
            head: 1,
            next_id: 1,
            pending_shares: 0,
            pending_count: 0,
            reserved_assets: 0,
        })
    }

    pub(super) fn managed_assert_no_obligations(env: &Env) {
        let q = Self::managed_queue(env);
        if q.pending_shares != 0 || q.reserved_assets != 0 {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
    }

    fn managed_add(env: &Env, a: i128, b: i128) -> i128 {
        a.checked_add(b)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    #[inline(never)]
    fn managed_mul_div(env: &Env, a: i128, b: i128, d: i128, ceil: bool) -> i128 {
        if a < 0 || b < 0 || d <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let n = a
            .checked_mul(b)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        let floor = cm::div(n,d);
        if ceil && n % d != 0 {
            Self::managed_add(env, floor, 1)
        } else {
            floor
        }
    }

    fn managed_backing(env: &Env, q: &ManagedQueue) {
        let asset = Self::denomination(env.clone()).contract;
        let cash = Self::liquid_balance_internal(env, &asset);
        if cash < 0
            || q.reserved_assets < 0
            || Self::token_balance(env, &asset, &env.current_contract_address())
                < Self::managed_add(env, cash, q.reserved_assets)
        {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
    }

    fn managed_pool(
        env: &Env,
        policy: &ManagedPolicy,
    ) -> Option<(Address, BlendPoolPositions, BlendReserve)> {
        let Some(adapter) = &policy.blend_adapter else {
            return None;
        };
        let pool: Address = crate::compact_storage::instance(&env)
            .get(&DataKey::ManagedPool)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        if Self::read_blend_router(env, adapter) != pool {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let positions =
            Self::read_blend_pool_positions(env, &pool, &env.current_contract_address());
        let reserve_assets: Vec<Address> = env.invoke_contract(
            &pool, &Symbol::new(env, "get_reserve_list"), vec![env]);
        let reserve =
            Self::read_blend_reserve(env, &pool, &Self::denomination(env.clone()).contract);
        if reserve.data.b_rate <= 0 {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        for (_, v) in positions.liabilities.iter() {
            if v != 0 {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        for (_, v) in positions.supply.iter() {
            if v != 0 {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        for (index, v) in positions.collateral.iter() {
            if v < 0 {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
            if v > 0 && index != reserve.config.index {
                if Self::managed_route_bindings(env).is_empty() { panic_with_error!(env, Error::ManagedUnsupported); }
                let portfolio = Self::managed_portfolio(env).unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
                let mut matched = false;
                for route in portfolio.routes.iter() {
                    if !reserve_assets.contains(&route.asset) { continue; }
                    let other = Self::read_blend_reserve(env, &pool, &route.asset);
                    if other.config.index == index {
                        Self::managed_reserve_valid(env, &other, &route.asset);
                        matched = true;
                        break;
                    }
                }
                if !matched { panic_with_error!(env, Error::ManagedUnsupported); }
            }
        }
        Some((pool, positions, reserve))
    }

    fn managed_collateral_asset(env: &Env, asset: &Address) -> bool {
        *asset == Self::denomination(env.clone()).contract ||
            (!Self::managed_route_bindings(env).is_empty() && Self::managed_portfolio(env)
                .map(|p| p.routes.iter().any(|r| r.asset == *asset)).unwrap_or(false))
    }

    fn managed_reserve_valid(env: &Env, reserve: &BlendReserve, asset: &Address) {
        if reserve.asset != *asset || !reserve.config.enabled || reserve.config.decimals != 7 || reserve.data.b_rate <= 0 {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
    }

    pub(super) fn managed_enable(env: &Env, caller: &Address, policy: ManagedPolicy) {
        Self::require_policy_auth(env, caller);
        Self::managed_initialize(env, policy);
    }

    fn managed_initialize(env: &Env, policy: ManagedPolicy) {
        Self::managed_assert_legacy_mode(env);
        Self::require_current_share_accounting(env);
        if policy.epoch_seconds < 60
            || policy.epoch_seconds > 86_400
            || policy.manager_window < policy.epoch_seconds
            || policy.manager_window > 604_800
            || policy.min_request_shares <= 0
            || policy.buffer_bps > 5_000
        {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        if Self::total_shares_internal(env) != 0 || Self::total_nav_internal(env) != 0 {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        if let Some(share) = Self::share_token(env.clone()) {
            let admin: Address =
                env.invoke_contract(&share, &symbol_short!("admin"), Vec::new(env));
            if admin != env.current_contract_address() {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        let fees = Self::fees(env.clone());
        // No new exit toll or stranded last-holder exit-fee dust in v1.
        if fees.redeem_bps != 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let denom = Self::denomination(env.clone()).contract;
        let assets: Vec<Address> =
            Self::dynamic_get(env, &DataKey::TrackedAssets).unwrap_or(Vec::new(env));
        for asset in assets.iter() {
            if asset != denom && Self::managed_portfolio(env).is_none() {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        if let Some(adapter) = &policy.blend_adapter {
            let c = Self::read_credit_market_config_internal(
                env,
                &CreditProtocol::Blend,
                policy.blend_market_id,
            )
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
            if c.adapter != *adapter
                || !c.enabled
                || !c.allow_supply
                || !c.allow_withdraw
                || c.allow_borrow
                || c.allow_repay
            {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
            Self::assert_global_venue_allowed(env, adapter);
            crate::compact_storage::instance(&env).set(
                &DataKey::ManagedPool,
                &Self::read_blend_router(env, adapter),
            );
            let (_, positions, _) = Self::managed_pool(env, &policy).unwrap();
            for (_, v) in positions.collateral.iter() {
                if v != 0 {
                    panic_with_error!(env, Error::ManagedOutstanding);
                }
            }
        }
        crate::compact_storage::instance(&env)
            .set(&DataKey::ManagedPolicy, &policy);
        // Keep the existing read, validation, legacy migration and TTL bump.
        // An absent queue already means head=next_id=1 with zero obligations.
        // Materialize it on the first request, never reset an existing queue.
        let _ = Self::managed_queue(env);
        env.events()
            .publish((Symbol::new(env, "managed_policy"),), policy);
    }

    pub(super) fn managed_check_supply(
        env: &Env,
        adapter: &Address,
        market: u128,
        asset: &Address,
        amount: i128,
    ) {
        let Some(p) = Self::managed_policy(env) else {
            return;
        };
        let q = Self::managed_queue(env);
        if p.blend_adapter != Some(adapter.clone())
            || market != p.blend_market_id
            || !Self::managed_collateral_asset(env, asset)
        {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        if q.pending_shares != 0 {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        Self::managed_backing(env, &q);
        Self::managed_pool(env, &p);
        let floor = Self::managed_mul_div(
            env,
            Self::total_nav_internal(env),
            p.buffer_bps as i128,
            10_000,
            true,
        );
        if amount <= 0 || Self::liquid_balance_internal(env, asset) < amount
            || Self::liquid_balance_internal(env, &Self::denomination(env.clone()).contract)
                - if *asset == Self::denomination(env.clone()).contract { amount } else { 0 } < floor {
            panic_with_error!(env, Error::ManagedNoLiquidity);
        }
    }

    pub(super) fn managed_check_market(
        env: &Env,
        adapter: &Address,
        market: u128,
        asset: &Address,
    ) {
        let Some(p) = Self::managed_policy(env) else {
            return;
        };
        if p.blend_adapter != Some(adapter.clone())
            || market != p.blend_market_id
            || !Self::managed_collateral_asset(env, asset)
        {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        Self::managed_pool(env, &p);
    }

    fn managed_move_shares(env: &Env, from: &Address, to: &Address, amount: i128) {
        if let Some(token) = Self::share_token(env.clone()) {
            // Holder-to-escrow transfer is part of the holder's signed auth tree.
            let args = vec![
                env,
                from.clone().into_val(env),
                to.clone().into_val(env),
                amount.into_val(env),
            ];
            if *from == env.current_contract_address() {
                Self::invoke_with_contract_auth::<()>(env, &token, "transfer", args);
            } else {
                env.invoke_contract::<()>(&token, &symbol_short!("transfer"), args);
            }
        } else {
            let fk = DataKey::Balance(from.clone());
            let tk = DataKey::Balance(to.clone());
            let before: i128 = Self::dynamic_get(env, &fk).unwrap_or(0);
            let received: i128 = Self::dynamic_get(env, &tk).unwrap_or(0);
            if before < amount {
                panic_with_error!(env, Error::InsufficientUserShares);
            }
            Self::dynamic_set(env, &fk, &(cm::sub(before,amount)));
            Self::dynamic_set(env, &tk, &Self::managed_add(env, received, amount));
        }
    }

    pub(super) fn managed_request(env: &Env, owner: &Address, shares: i128) -> ManagedRequest {
        Self::managed_create_request(env, owner, shares, false)
    }

    fn managed_create_request(
        env: &Env,
        owner: &Address,
        shares: i128,
        instant: bool,
    ) -> ManagedRequest {
        let p = Self::managed_required_policy(env);
        owner.require_auth();
        if *owner == env.current_contract_address() {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let balance = Self::shares_of(env.clone(), owner.clone());
        if shares <= 0 || shares > balance || (shares < p.min_request_shares && shares != balance) {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        if Self::dynamic_get::<u64>(env, &DataKey::ManagedOwnerPending(owner.clone())).is_some() {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        let mut q = Self::managed_queue(env);
        Self::managed_backing(env, &q);
        // No pending investor can be skipped. Fixed claims remain in their
        // request records/reserves; a closed prefix must not consume the
        // instant settlement budget, regardless of its length.
        if instant && q.pending_count == 0 {
            q.head = q.next_id;
        }
        let now = env.ledger().timestamp();
        let eligible_at = if instant {
            now
        } else {
            (now / p.epoch_seconds)
                .checked_add(1)
                .and_then(|v| v.checked_mul(p.epoch_seconds))
                .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
        };
        let r = ManagedRequest {
            id: q.next_id,
            owner: owner.clone(),
            requested_shares: shares,
            pending_shares: shares,
            settled_shares: 0,
            cancelled_shares: 0,
            claimable_assets: 0,
            claimed_assets: 0,
            created_at: now,
            eligible_at,
            last_settled_at: 0,
        };
        q.next_id = q
            .next_id
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        q.pending_shares = Self::managed_add(env, q.pending_shares, shares);
        q.pending_count = q
            .pending_count
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        Self::managed_move_shares(env, owner, &env.current_contract_address(), shares);
        Self::dynamic_set(env, &DataKey::ManagedRequest(r.id), &r);
        Self::dynamic_set(env, &DataKey::ManagedOwnerPending(owner.clone()), &r.id);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        env.events()
            .publish((Symbol::new(env, "withdraw_requested"),), r.clone());
        r
    }

    pub(super) fn managed_get_request(env: &Env, id: u64) -> Option<ManagedRequest> {
        Self::dynamic_get(env, &DataKey::ManagedRequest(id))
    }

    pub(super) fn managed_cancel(env: &Env, owner: &Address, id: u64) -> ManagedRequest {
        Self::managed_required_policy(env);
        owner.require_auth();
        let mut r = Self::managed_get_request(env, id)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedInvalidRequest));
        if r.owner != *owner || r.pending_shares <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        if let Some(p) = Self::managed_portfolio(env) {
            let now = env.ledger().timestamp();
            // A disclosed processing window prevents cancellation after an
            // unwind has begun. A finite escape prevents an indefinite lock.
            let unlock = r
                .eligible_at
                .checked_add(p.cancel_lock_seconds)
                .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
            if now >= r.eligible_at && now < unlock {
                panic_with_error!(env, Error::ManagedTooEarly);
            }
        }
        let mut q = Self::managed_queue(env);
        Self::managed_return_pending(env, &mut q, &mut r);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        r
    }

    #[inline(never)]
    fn managed_return_pending(env: &Env, q: &mut ManagedQueue, r: &mut ManagedRequest) {
        let shares = r.pending_shares;
        r.cancelled_shares = Self::managed_add(env, r.cancelled_shares, shares);
        r.pending_shares = 0;
        q.pending_shares -= shares;
        q.pending_count -= 1;
        Self::dynamic_remove(env, &DataKey::ManagedOwnerPending(r.owner.clone()));
        Self::dynamic_set(env, &DataKey::ManagedRequest(r.id), r);
        Self::managed_move_shares(env, &env.current_contract_address(), &r.owner, shares);
        env.events().publish((Symbol::new(env, "withdraw_cancelled"),), r.clone());
    }

    fn managed_capacity(env: &Env, p: &ManagedPolicy, cash: i128, nav: i128) -> i128 {
        let a = Self::managed_mul_div(env, cash, 10_000, 1, false);
        let b = Self::managed_mul_div(env, nav, p.buffer_bps as i128, 1, false);
        if a <= b {
            0
        } else {
            core::cmp::min(cash, cm::div(cm::sub(a,b),cm::sub(10_000,p.buffer_bps as i128)))
        }
    }

    // Bounded maintenance also prevents cancelled entries poisoning the queue.
    fn managed_advance(env: &Env, q: &mut ManagedQueue, max: u32) {
        for _ in 0..max {
            if q.head >= q.next_id {
                break;
            }
            let r = Self::managed_get_request(env, q.head).unwrap();
            if r.pending_shares > 0 {
                break;
            }
            q.head += 1;
        }
    }

    pub(super) fn managed_settle(env: &Env, limit: u32) -> ManagedSettlement {
        let p = Self::managed_required_policy(env);
        if limit == 0 || limit > 16 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let mut q = Self::managed_queue(env);
        Self::managed_backing(env, &q);
        Self::managed_pool(env, &p);
        let fee = Self::settle_fees_internal(env);
        let nav = fee.nav;
        let total = fee.total_shares_after;
        let now = env.ledger().timestamp();
        let asset = Self::denomination(env.clone()).contract;
        let mut out = ManagedSettlement {
            head_before: q.head,
            head_after: q.head,
            visited: 0,
            settled_shares: 0,
            reserved_assets: 0,
            nav_before: nav,
            total_shares_before: total,
            timestamp: now,
        };
        for _ in 0..limit {
            if q.head >= q.next_id {
                break;
            }
            out.visited += 1;
            let mut r = Self::managed_get_request(env, q.head).unwrap();
            if r.pending_shares == 0 {
                q.head += 1;
                continue;
            }
            if now < r.eligible_at || nav <= 0 || total <= 0 {
                break;
            }
            // A whole remaining claim worth less than one payout unit cannot
            // be settled. Return its escrowed shares, preserving ownership and
            // all existing claimable cash, so it cannot block another holder.
            // Never cancel merely because available cash is small or zero.
            if Self::managed_mul_div(env, r.pending_shares, nav, total, false) == 0 {
                Self::managed_return_pending(env, &mut q, &mut r);
                q.head += 1;
                continue;
            }
            let cash = Self::liquid_balance_internal(env, &asset);
            let capacity = Self::managed_capacity(env, &p, cash, cm::sub(nav,out.reserved_assets));
            let shares = core::cmp::min(
                r.pending_shares,
                Self::managed_mul_div(env, capacity, total, nav, false),
            );
            if shares <= 0 {
                break;
            }
            let amount = Self::managed_mul_div(env, shares, nav, total, false);
            if amount <= 0 {
                break;
            }
            r.pending_shares -= shares;
            r.settled_shares = Self::managed_add(env, r.settled_shares, shares);
            r.claimable_assets = Self::managed_add(env, r.claimable_assets, amount);
            r.last_settled_at = now;
            q.pending_shares -= shares;
            q.reserved_assets = Self::managed_add(env, q.reserved_assets, amount);
            Self::add_liquid_balance(env, &asset, -amount);
            Self::burn_shares_from(env, &env.current_contract_address(), shares);
            out.settled_shares = Self::managed_add(env, out.settled_shares, shares);
            out.reserved_assets = Self::managed_add(env, out.reserved_assets, amount);
            if r.pending_shares == 0 {
                q.pending_count -= 1;
                Self::dynamic_remove(env, &DataKey::ManagedOwnerPending(r.owner.clone()));
                q.head += 1;
            }
            Self::dynamic_set(env, &DataKey::ManagedRequest(r.id), &r);
            env.events().publish(
                (Symbol::new(env, "withdraw_settled"),),
                (r.id, shares, amount, nav, total),
            );
            if r.pending_shares > 0 {
                break;
            }
        }
        out.head_after = q.head;
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        crate::compact_storage::instance(&env)
            .set(&DataKey::Aum, &(cm::sub(nav,out.reserved_assets)));
        Self::managed_backing(env, &q);
        out
    }

    pub(super) fn managed_claim(env: &Env, owner: &Address, id: u64) -> i128 {
        Self::managed_required_policy(env);
        owner.require_auth();
        Self::managed_pay_to_owner(env, owner, id)
    }

    fn managed_pay_to_owner(env: &Env, owner: &Address, id: u64) -> i128 {
        let mut r = Self::managed_get_request(env, id)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedInvalidRequest));
        if r.owner != *owner {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let amount = r.claimable_assets;
        if amount <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let mut q = Self::managed_queue(env);
        Self::managed_backing(env, &q);
        r.claimable_assets = 0;
        r.claimed_assets = Self::managed_add(env, r.claimed_assets, amount);
        q.reserved_assets -= amount;
        Self::dynamic_set(env, &DataKey::ManagedRequest(id), &r);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        // No NAV read or protocol unwind in claim: liquidity is already reserved.
        Self::transfer_from_vault(
            env,
            &Self::denomination(env.clone()).contract,
            owner,
            amount,
        );
        Self::managed_backing(env, &q);
        env.events().publish(
            (Symbol::new(env, "withdraw_claimed"),),
            (id, owner.clone(), amount),
        );
        amount
    }

    pub(super) fn managed_pay(env: &Env, id: u64) -> i128 {
        let p = Self::managed_portfolio(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        if !p.auto_payout {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let r = Self::managed_get_request(env, id)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedInvalidRequest));
        // No caller-supplied recipient. No price/pool access. Anyone may pay
        // the already-reserved amount to its recorded owner, and ONLY that owner.
        Self::managed_pay_to_owner(env, &r.owner, id)
    }

    pub(super) fn managed_redeem_liquid(env: &Env, owner: &Address, shares: i128) -> i128 {
        let p = Self::managed_portfolio(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        if !p.instant_cash || Self::managed_queue(env).pending_shares != 0 {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        let r = Self::managed_create_request(env, owner, shares, true);
        // No bypass of a queued investor. No partial instant exit: insufficient
        // cash rolls back escrow, fees and reservation in the SAME transaction.
        Self::managed_settle(env, 16);
        let done = Self::managed_get_request(env, r.id).unwrap();
        if done.pending_shares != 0 {
            panic_with_error!(env, Error::ManagedNoLiquidity);
        }
        Self::managed_pay_to_owner(env, owner, r.id)
    }

    pub(super) fn managed_portfolio_swap(env: &Env, step: &SwapStep, recovery: bool, withdrawal_base: Option<i128>) -> i128 {
        let p = Self::managed_portfolio(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedPolicyLocked));
        let denomination = Self::denomination(env.clone());
        let denom = &denomination.contract;
        let input = &step.asset_in.contract;
        let output = &step.asset_out.contract;
        let binding = Self::managed_binding_for(env, step);
        let paired = if input == denom {
            output
        } else if output == denom {
            input
        } else {
            panic_with_error!(env, Error::ManagedUnsupported);
        };
        if input == output
            || step.amount_in <= 0
            || step.min_out <= 0
            || !p
                .routes
                .iter()
                .any(|r| r.asset == *paired && (r.router == step.router_addr || binding.is_some()))
        {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        Self::assert_asset_allowed(env, input);
        Self::assert_asset_allowed(env, output);
        if let Some(b) = &binding {
            let internal: Address = crate::compact_storage::instance(&env).get(&DataKey::Router).unwrap();
            Self::enforce_swap_risk_policy_for_step(env, step, &internal, false, withdrawal_base);
            Self::managed_validate_binding(env, b, false);
        } else {
            if Self::managed_route_bindings(env).iter().any(|b| b.executor == step.router_addr) { panic_with_error!(env, Error::ManagedUnsupported); }
            Self::assert_global_venue_allowed(env, &step.router_addr);
        }
        let q = Self::managed_queue(env);
        Self::managed_backing(env, &q);
        // While withdrawals wait, swaps may only create payout liquidity.
        if (recovery || q.pending_shares > 0) && output != denom {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        let value = Self::value_asset_amount_in_denom(env, input, step.amount_in, &denomination);
        let floor = Self::value_asset_amount_in_denom(env, output, step.min_out, &denomination);
        if value <= 0
            || floor
                < Self::managed_mul_div(
                    env,
                    value,
                    (10_000 - p.max_slippage_bps) as i128,
                    10_000,
                    true,
                )
        {
            panic_with_error!(env, Error::SwapSlippageExceeded);
        }
        let needed = if recovery { Self::managed_status(env).recovery_needed } else { 0 };
        let budget = if withdrawal_base.is_some() { Self::managed_spot_budget(env, &p, needed) } else { needed };
        if recovery && value > budget {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        if let Some(base) = withdrawal_base {
            let balance = Self::liquid_balance_internal(env, input);
            let risk = Self::read_swap_risk_policy_internal(env);
            let cap = Self::managed_mul_div(env, base, risk.max_trade_size_bps as i128, 10_000, false);
            // When this entire asset is needed, a public executor cannot split
            // off a tiny tail instead of following the balanced payout lots.
            if risk.enabled && cap > 0 && Self::value_asset_amount_in_denom(env, input, balance, &denomination) <= budget
                && step.amount_in != Self::managed_mul_div(env, balance, 1, Self::managed_mul_div(env, balance, 1, cap, true), true) {
                panic_with_error!(env, Error::ManagedUnsupported);
            }
        }
        if Self::liquid_balance_internal(env, input) < step.amount_in {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        Self::settle_fees_internal(env);
        let vault = env.current_contract_address();
        let before_in = Self::token_balance(env, input, &vault);
        let before_out = Self::token_balance(env, output, &vault);
        let expiry = env
            .ledger()
            .sequence()
            .checked_add(100)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        if let Some(b) = &binding {
            Self::managed_execute_bound(env, b, step);
        } else {
        Self::invoke_with_contract_auth::<()>(
            env,
            input,
            "approve",
            vec![
                env,
                vault.clone().into_val(env),
                step.router_addr.clone().into_val(env),
                step.amount_in.into_val(env),
                expiry.into_val(env),
            ],
        );
        let _: Vec<i128> = env.invoke_contract(
            &step.router_addr,
            &Symbol::new(env, "swap_exact_tokens_for_tokens"),
            vec![
                env,
                step.amount_in.into_val(env),
                step.min_out.into_val(env),
                vec![env, input.clone(), output.clone()].into_val(env),
                vault.clone().into_val(env),
                env.ledger()
                    .timestamp()
                    .checked_add(60)
                    .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
                    .into_val(env),
            ],
        );
        Self::invoke_with_contract_auth::<()>(
            env,
            input,
            "approve",
            vec![
                env,
                vault.clone().into_val(env),
                step.router_addr.clone().into_val(env),
                0i128.into_val(env),
                expiry.into_val(env),
            ],
        );
        }
        let spent = before_in
            .checked_sub(Self::token_balance(env, input, &vault))
            .unwrap_or(-1);
        let received = Self::token_balance(env, output, &vault)
            .checked_sub(before_out)
            .unwrap_or(-1);
        if spent != step.amount_in || received < step.min_out {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        if Self::managed_queue(env) != q {
            panic_with_error!(env, Error::ManagedOutstanding);
        }
        Self::add_liquid_balance(env, input, -spent);
        Self::add_liquid_balance(env, output, received);
        // Aum refresh and the following buffer guard use the SAME live NAV.
        // No financial action intervenes; do not repeat all Blend/oracle reads.
        let nav = Self::total_nav_internal(env);
        crate::compact_storage::instance(&env).set(&DataKey::Aum, &nav);
        let policy = Self::managed_required_policy(env);
        let buffer = Self::managed_mul_div(
            env,
            nav,
            policy.buffer_bps as i128,
            10_000,
            true,
        );
        if output != denom && Self::liquid_balance_internal(env, denom) < buffer {
            panic_with_error!(env, Error::ManagedNoLiquidity);
        }
        Self::managed_backing(env, &q);
        env.events().publish(
            (Symbol::new(env, "portfolio_swap"),),
            (input, output, spent, received, recovery),
        );
        received
    }

    pub(super) fn managed_liquidate_spot(env: &Env, caller: &Address, step: &SwapStep) -> i128 {
        caller.require_auth();
        let p = Self::managed_required_policy(env);
        let mut q = Self::managed_queue(env);
        Self::managed_advance(env, &mut q, 16);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        let r = Self::managed_get_request(env, q.head)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedInvalidRequest));
        let now = env.ledger().timestamp();
        let public_at = r
            .eligible_at
            .checked_add(p.manager_window)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        if r.pending_shares <= 0
            || now < r.eligible_at
            || (*caller != Self::manager(env.clone()) && now < public_at)
        {
            panic_with_error!(env, Error::ManagedTooEarly);
        }
        let base = Self::managed_spot_base(env, &step.asset_in.contract, true);
        Self::managed_portfolio_swap(env, step, true, Some(base))
    }

    // Request-scoped reference: normal trading and Blend recovery retain the
    // current-balance cap. Failed calls roll back this write as well.
    #[inline(never)]
    fn managed_spot_base(env: &Env, asset: &Address, save: bool) -> i128 {
        let mut queue = Self::managed_queue(env);
        Self::managed_advance(env, &mut queue, 16);
        let key: Val = (symbol_short!("exitbase"), queue.head, asset.clone()).into_val(env);
        // Dedicated scalar namespace, outside the closed DataKey record codec.
        let initial = env.storage().persistent().get::<Val, i128>(&key)
            .unwrap_or_else(|| Self::liquid_balance_internal(env, asset));
        if save { env.storage().persistent().set(&key, &initial); Self::bump_dynamic_val(env, &key); }
        initial
    }

    #[inline(never)]
    fn managed_spot_budget(env: &Env, p: &ManagedPortfolioPolicy, needed: i128) -> i128 {
        if Self::read_swap_risk_policy_internal(env).enabled {
            Self::managed_mul_div(env, needed, 10_000, (10_000 - p.max_slippage_bps) as i128, true)
        } else { needed }
    }

    pub(super) fn managed_spot_steps(env: &Env, max_value: i128) -> Vec<SwapStep> {
        let mut out = Vec::new(env);
        let Some(p) = Self::managed_portfolio(env) else {
            return out;
        };
        if max_value <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        // Only the disclosed slippage allowance above the payout shortfall.
        let budget = Self::managed_spot_budget(env, &p, Self::managed_status(env).recovery_needed);
        let need = core::cmp::min(budget, max_value);
        if need <= 0 {
            return out;
        }
        let denom = Self::denomination(env.clone());
        let oracle = Self::require_valuation_oracle_config(env);
        let price = Self::read_oracle_last_price(env, &oracle.oracle, &denom.contract);
        Self::assert_valuation_price_usable(env, &price, oracle.max_price_age);
        for route in p.routes.iter() {
            let asset_price = Self::read_oracle_last_price(env, &oracle.oracle, &route.asset);
            Self::assert_valuation_price_usable(env, &asset_price, oracle.max_price_age);
            let balance = Self::liquid_balance_internal(env, &route.asset);
            let risk = Self::read_swap_risk_policy_internal(env);
            let cap = if risk.enabled { Self::managed_mul_div(env, Self::managed_spot_base(env, &route.asset, false), risk.max_trade_size_bps as i128, 10_000, false) } else { balance };
            if balance <= 0 || cap <= 0 { continue; }
            // Balance the lots to avoid a final integer tail: 603 at cap 150
            // becomes 121/121/121/120/120, never four lots plus a tail of 3.
            let lots = Self::managed_mul_div(env, balance, 1, cap, true);
            let lot = Self::managed_mul_div(env, balance, 1, lots, true);
            let amount = core::cmp::min(
                lot,
                Self::managed_mul_div(env, need, price.price, asset_price.price, false),
            );
            // Prices are already validated above; no action intervened.
            if risk.enabled && Self::checked_value_in_denom_units(env, balance, asset_price.price, price.price) <= budget && amount < lot { continue; }
            let value = Self::checked_value_in_denom_units(env, amount, asset_price.price, price.price);
            let minimum = Self::managed_mul_div(
                env,
                value,
                (10_000 - p.max_slippage_bps) as i128,
                10_000,
                true,
            );
            if amount > 0 && minimum > 0 {
                out.push_back(Self::managed_bound_step(env, SwapStep {
                    adapter: route.router.clone(),
                    pool_id: 0,
                    asset_in: Asset {
                        contract: route.asset,
                    },
                    amount_in: amount,
                    min_out: minimum,
                    asset_out: denom.clone(),
                    router_addr: route.router,
                }));
                // Each confirmed leg changes cash/NAV; replan before the next.
                break;
            }
        }
        out
    }

    pub(super) fn managed_trade_quote(
        env: &Env,
        asset: &Address,
        amount: i128,
        sell: bool,
    ) -> SwapStep {
        let p = Self::managed_portfolio(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        let route = p
            .routes
            .iter()
            .find(|r| r.asset == *asset)
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        if amount <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let denom = Self::denomination(env.clone());
        let cfg = Self::require_valuation_oracle_config(env);
        let a = Self::read_oracle_last_price(env, &cfg.oracle, asset);
        let d = Self::read_oracle_last_price(env, &cfg.oracle, &denom.contract);
        Self::assert_valuation_price_usable(env, &a, cfg.max_price_age);
        Self::assert_valuation_price_usable(env, &d, cfg.max_price_age);
        let value = Self::managed_mul_div(
            env,
            amount,
            if sell { a.price } else { d.price },
            d.price,
            false,
        );
        let min_value = Self::managed_mul_div(
            env,
            value,
            (10_000 - p.max_slippage_bps) as i128,
            10_000,
            true,
        );
        let minimum = Self::managed_mul_div(
            env,
            min_value,
            d.price,
            if sell { d.price } else { a.price },
            true,
        );
        if minimum <= 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        Self::managed_bound_step(env, SwapStep {
            adapter: route.router.clone(),
            pool_id: 0,
            asset_in: if sell {
                Asset {
                    contract: asset.clone(),
                }
            } else {
                denom.clone()
            },
            amount_in: amount,
            min_out: minimum,
            asset_out: if sell {
                denom
            } else {
                Asset {
                    contract: asset.clone(),
                }
            },
            router_addr: route.router,
        })
    }

    pub(super) fn managed_status(env: &Env) -> ManagedStatus {
        let p = Self::managed_required_policy(env);
        let mut q = Self::managed_queue(env);
        Self::managed_backing(env, &q);
        Self::managed_advance(env, &mut q, 16);
        let fee = Self::preview_fee_settlement_internal(env);
        let nav = fee.nav;
        let total = fee.total_shares_after;
        let asset = Self::denomination(env.clone()).contract;
        let cash = Self::liquid_balance_internal(env, &asset);
        let mut needed = 0;
        let mut public_at = 0;
        if q.head < q.next_id && total > 0 && nav > 0 {
            let r = Self::managed_get_request(env, q.head).unwrap();
            if r.pending_shares == 0 {
                return ManagedStatus {
                    queue: q,
                    nav,
                    total_shares: total,
                    cash,
                    settle_capacity: Self::managed_capacity(env, &p, cash, nav),
                    recovery_needed: 0,
                    recovery_available: 0,
                    recovery_public_at: 0,
                };
            }
            let payout = core::cmp::min(
                nav,
                Self::managed_mul_div(env, r.pending_shares, nav, total, true),
            );
            let floor =
                Self::managed_mul_div(env, cm::sub(nav,payout), p.buffer_bps as i128, 10_000, true);
            needed = core::cmp::max(0, cm::sub(Self::managed_add(env,payout,floor),cash));
            public_at = r
                .eligible_at
                .checked_add(p.manager_window)
                .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        }
        let mut available = 0;
        if let Some((pool, positions, reserve)) = Self::managed_pool(env, &p) {
            let collateral = Self::managed_mul_div(
                env,
                positions.collateral.get(reserve.config.index).unwrap_or(0),
                reserve.data.b_rate,
                BLEND_RATE_SCALE,
                false,
            );
            available = core::cmp::min(
                needed,
                core::cmp::min(collateral, Self::token_balance(env, &asset, &pool)),
            );
            // Availability is a conservative estimate, NEVER a reservation.
            // NAV itself continues using canonical pool-oracle valuation.
            if !Self::managed_route_bindings(env).is_empty() {
                if let Some(portfolio) = Self::managed_portfolio(env) {
                    let reserve_assets: Vec<Address> = env.invoke_contract(
                        &pool, &Symbol::new(env, "get_reserve_list"), vec![env]);
                    for route in portfolio.routes.iter() {
                        if !reserve_assets.contains(&route.asset) { continue; }
                        let reserve = Self::read_blend_reserve(env, &pool, &route.asset);
                        Self::managed_reserve_valid(env, &reserve, &route.asset);
                        let amount = core::cmp::min(Self::managed_mul_div(env, positions.collateral.get(reserve.config.index).unwrap_or(0), reserve.data.b_rate, BLEND_RATE_SCALE, false), Self::token_balance(env, &route.asset, &pool));
                        if amount > 0 {
                            let value = Self::value_asset_amount_in_denom(env, &route.asset, amount, &Self::denomination(env.clone()));
                            let floor = Self::managed_mul_div(env, value, (10_000 - portfolio.max_slippage_bps) as i128, 10_000, false);
                            available = core::cmp::min(needed, Self::managed_add(env, available, floor));
                        }
                    }
                }
            }
        }
        ManagedStatus {
            queue: q,
            nav,
            total_shares: total,
            cash,
            settle_capacity: Self::managed_capacity(env, &p, cash, nav),
            recovery_needed: needed,
            recovery_available: available,
            recovery_public_at: public_at,
        }
    }

    pub(super) fn managed_prepare(env: &Env, caller: &Address, amount: i128) -> i128 {
        let p = Self::managed_required_policy(env);
        caller.require_auth();
        let mut q = Self::managed_queue(env);
        Self::managed_advance(env, &mut q, 16);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        if q.head >= q.next_id {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        let r = Self::managed_get_request(env, q.head).unwrap();
        if r.pending_shares == 0 {
            panic_with_error!(env, Error::ManagedInvalidRequest);
        }
        if env.ledger().timestamp() < r.eligible_at {
            panic_with_error!(env, Error::ManagedTooEarly);
        }
        let s = Self::managed_status(env);
        if *caller != Self::manager(env.clone()) && env.ledger().timestamp() < s.recovery_public_at
        {
            panic_with_error!(env, Error::ManagedTooEarly);
        }
        if amount <= 0 || amount > s.recovery_available {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let adapter = p
            .blend_adapter
            .clone()
            .unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        Self::assert_global_venue_allowed(env, &adapter);
        // Settle accrued ownership before changing the strategy's cash allocation.
        Self::settle_fees_internal(env);
        let asset = Self::denomination(env.clone()).contract;
        let (pool, before, reserve) = Self::managed_pool(env, &p).unwrap();
        let max_burn =
            Self::managed_mul_div(env, amount, BLEND_RATE_SCALE, reserve.data.b_rate, true);
        let actual = Self::invoke_blend_adapter(
            env,
            &adapter,
            &asset,
            BlendAction::Withdraw,
            p.blend_market_id,
            amount,
        );
        let (_, after, _) = Self::managed_pool(env, &p).unwrap();
        let burned = before.collateral.get(reserve.config.index).unwrap_or(0)
            - after.collateral.get(reserve.config.index).unwrap_or(0);
        if actual < cm::sub(amount,1) || actual > amount || burned < 0 || burned > max_burn {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let position =
            Self::reconcile_blend_position_from_pool(env, &adapter, p.blend_market_id, &asset);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, p.blend_market_id).is_empty() {
            Self::clear_blend_adapter(env, p.blend_market_id);
        }
        Self::add_liquid_balance(env, &asset, actual);
        Self::refresh_aum(env);
        Self::managed_backing(env, &Self::managed_queue(env));
        env.events().publish(
            (Symbol::new(env, "withdraw_liquidity"),),
            (caller.clone(), pool, actual),
        );
        actual
    }

    // Withdraw the actual collateral and convert its measured receipt in one
    // atomic invocation. The original request remains pending until settlement.
    pub(super) fn managed_prepare_asset(env: &Env, caller: &Address, withdraw_amount: i128, step: &SwapStep) -> i128 {
        caller.require_auth();
        let p = Self::managed_required_policy(env);
        if Self::managed_binding_for(env, step).is_none() || step.asset_out.contract != Self::denomination(env.clone()).contract
            || step.asset_in.contract == step.asset_out.contract || step.amount_in <= 0 || withdraw_amount <= 0 || !Self::managed_collateral_asset(env, &step.asset_in.contract) {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let mut q = Self::managed_queue(env);
        Self::managed_advance(env, &mut q, 16);
        Self::dynamic_set(env, &DataKey::ManagedQueue, &q);
        let request = Self::managed_get_request(env, q.head).unwrap_or_else(|| panic_with_error!(env, Error::ManagedInvalidRequest));
        let status = Self::managed_status(env);
        if request.pending_shares <= 0 || env.ledger().timestamp() < request.eligible_at
            || (*caller != Self::manager(env.clone()) && env.ledger().timestamp() < status.recovery_public_at) {
            panic_with_error!(env, Error::ManagedTooEarly);
        }
        let value = Self::value_asset_amount_in_denom(env, &step.asset_in.contract, step.amount_in, &Self::denomination(env.clone()));
        if value <= 0 || value > status.recovery_needed { panic_with_error!(env, Error::ManagedUnsupported); }
        let withdrawn_value = Self::value_asset_amount_in_denom(env, &step.asset_in.contract, withdraw_amount, &Self::denomination(env.clone()));
        if withdrawn_value <= 0 || withdrawn_value > status.recovery_needed { panic_with_error!(env, Error::ManagedUnsupported); }
        let adapter = p.blend_adapter.clone().unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
        Self::assert_global_venue_allowed(env, &adapter);
        let config = Self::require_credit_market_config(env, &CreditProtocol::Blend, p.blend_market_id);
        Self::assert_credit_action_allowed(env, &config, &CreditAction::Withdraw);
        if config.adapter != adapter { panic_with_error!(env, Error::ManagedUnsupported); }
        Self::settle_fees_internal(env);
        let (pool, before, _) = Self::managed_pool(env, &p).unwrap();
        let reserve = Self::read_blend_reserve(env, &pool, &step.asset_in.contract);
        Self::managed_reserve_valid(env, &reserve, &step.asset_in.contract);
        let shares = before.collateral.get(reserve.config.index).unwrap_or(0);
        let underlying = Self::managed_mul_div(env, shares, reserve.data.b_rate, BLEND_RATE_SCALE, false);
        if withdraw_amount > underlying || withdraw_amount > Self::token_balance(env, &step.asset_in.contract, &pool) { panic_with_error!(env, Error::ManagedNoLiquidity); }
        let actual = Self::invoke_blend_adapter(env, &adapter, &step.asset_in.contract, BlendAction::Withdraw, p.blend_market_id, withdraw_amount);
        let (_, after, _) = Self::managed_pool(env, &p).unwrap();
        let burned = cm::sub(shares,after.collateral.get(reserve.config.index).unwrap_or(0));
        let maximum = Self::managed_mul_div(env, withdraw_amount, BLEND_RATE_SCALE, reserve.data.b_rate, true);
        let minimum = Self::managed_mul_div(env, actual, BLEND_RATE_SCALE, reserve.data.b_rate, false);
        if actual < cm::sub(withdraw_amount,1) || actual > withdraw_amount || burned <= 0 || burned < minimum || burned > maximum {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        for (index, prior) in before.collateral.iter() {
            if index != reserve.config.index && after.collateral.get(index).unwrap_or(0) != prior { panic_with_error!(env, Error::ManagedUnsupported); }
        }
        for (index, next) in after.collateral.iter() {
            if index != reserve.config.index && before.collateral.get(index).unwrap_or(0) != next { panic_with_error!(env, Error::ManagedUnsupported); }
        }
        // The post-submit positions above are already fresh and fully checked.
        // Reuse that observation instead of fetching the same positions twice
        // again for collateral and debt. Rates are re-read AFTER submit.
        let after_reserve = Self::read_blend_reserve(env, &pool, &step.asset_in.contract);
        let mut position = Self::read_blend_position_internal(env, p.blend_market_id, &step.asset_in.contract)
            .unwrap_or(BlendPosition { market_id:p.blend_market_id, asset:step.asset_in.contract.clone(), collateral_amount:0, debt_amount:0 });
        if position.asset != step.asset_in.contract { panic_with_error!(env, Error::InvalidBlendPosition); }
        position.collateral_amount = Self::convert_position_shares_to_amount(after.collateral.get(after_reserve.config.index).unwrap_or(0), after_reserve.data.b_rate);
        position.debt_amount = Self::convert_debt_shares_to_amount(after.liabilities.get(after_reserve.config.index).unwrap_or(0), after_reserve.data.d_rate);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, p.blend_market_id).is_empty() { Self::clear_blend_adapter(env, p.blend_market_id); }
        Self::add_liquid_balance(env, &step.asset_in.contract, actual);
        Self::refresh_aum(env);
        let received = Self::managed_portfolio_swap(env, step, true, None);
        if Self::managed_queue(env) != q { panic_with_error!(env, Error::ManagedOutstanding); }
        Self::managed_backing(env, &q);
        env.events().publish((Symbol::new(env, "withdraw_cross_asset"),), (caller.clone(), step.asset_in.contract.clone(), actual, received));
        received
    }
}
