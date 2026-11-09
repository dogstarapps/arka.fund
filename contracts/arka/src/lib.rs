#![no_std]
mod compact_codec;
mod compact_math;
use compact_math as cm;
#[path = "compact_storage_asset.rs"]
mod compact_storage;
mod managed_withdrawals;
mod managed_routes;
pub use managed_routes::{ManagedRouteFamily, ManagedRouteBinding};
pub use managed_withdrawals::{ManagedPolicy, ManagedPortfolioPolicy, ManagedSpotRoute, ManagedQueue, ManagedRequest, ManagedSettlement, ManagedStatus};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Map, Symbol, TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct FeeStructure {
    pub mgmt_bps: i32,
    pub perf_bps: i32,
    pub deposit_bps: i32,
    pub redeem_bps: i32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_FeeStructure {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct FeeStructure {
    pub mgmt_bps: i32,
    pub perf_bps: i32,
    pub deposit_bps: i32,
    pub redeem_bps: i32,
}
}
crate::compact_codec::record!(FeeStructure, __wire_spec_FeeStructure::FeeStructure; (0, deposit_bps, i32), (1, mgmt_bps, i32), (2, perf_bps, i32), (3, redeem_bps, i32));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ProtocolFeePolicy {
    pub mgmt_protocol_bps: i32,
    pub perf_protocol_bps: i32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ProtocolFeePolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ProtocolFeePolicy {
    pub mgmt_protocol_bps: i32,
    pub perf_protocol_bps: i32,
}
}
crate::compact_codec::record!(ProtocolFeePolicy, __wire_spec_ProtocolFeePolicy::ProtocolFeePolicy; (0, mgmt_protocol_bps, i32), (1, perf_protocol_bps, i32));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct FeeState {
    pub last_settlement_ts: u64,
    pub high_water_mark: i128,
    pub cumulative_management_shares: i128,
    pub cumulative_performance_shares: i128,
    pub cumulative_manager_shares: i128,
    pub cumulative_protocol_shares: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_FeeState {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct FeeState {
    pub last_settlement_ts: u64,
    pub high_water_mark: i128,
    pub cumulative_management_shares: i128,
    pub cumulative_performance_shares: i128,
    pub cumulative_manager_shares: i128,
    pub cumulative_protocol_shares: i128,
}
}
crate::compact_codec::record!(FeeState, __wire_spec_FeeState::FeeState; (0, cumulative_management_shares, i128), (1, cumulative_manager_shares, i128), (2, cumulative_performance_shares, i128), (3, cumulative_protocol_shares, i128), (4, high_water_mark, i128), (5, last_settlement_ts, u64));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct FeeSettlement {
    pub timestamp: u64,
    pub nav: i128,
    pub total_shares_before: i128,
    pub share_price_before: i128,
    pub management_fee_value: i128,
    pub management_fee_shares: i128,
    pub performance_fee_value: i128,
    pub performance_fee_shares: i128,
    pub manager_fee_shares: i128,
    pub protocol_fee_shares: i128,
    pub total_shares_after: i128,
    pub share_price_after: i128,
    pub high_water_mark_before: i128,
    pub high_water_mark_after: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_FeeSettlement {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct FeeSettlement {
    pub timestamp: u64,
    pub nav: i128,
    pub total_shares_before: i128,
    pub share_price_before: i128,
    pub management_fee_value: i128,
    pub management_fee_shares: i128,
    pub performance_fee_value: i128,
    pub performance_fee_shares: i128,
    pub manager_fee_shares: i128,
    pub protocol_fee_shares: i128,
    pub total_shares_after: i128,
    pub share_price_after: i128,
    pub high_water_mark_before: i128,
    pub high_water_mark_after: i128,
}
}
crate::compact_codec::record!(FeeSettlement, __wire_spec_FeeSettlement::FeeSettlement; (0, high_water_mark_after, i128), (1, high_water_mark_before, i128), (2, management_fee_shares, i128), (3, management_fee_value, i128), (4, manager_fee_shares, i128), (5, nav, i128), (6, performance_fee_shares, i128), (7, performance_fee_value, i128), (8, protocol_fee_shares, i128), (9, share_price_after, i128), (10, share_price_before, i128), (11, timestamp, u64), (12, total_shares_after, i128), (13, total_shares_before, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct Asset {
    pub contract: Address,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_Asset {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct Asset {
    pub contract: Address,
}
}
crate::compact_codec::record!(Asset, __wire_spec_Asset::Asset; (0, contract, Address));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct SwapStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub asset_in: Asset,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
    pub router_addr: Address,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_SwapStep {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct SwapStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub asset_in: Asset,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
    pub router_addr: Address,
}
}
crate::compact_codec::record!(SwapStep, __wire_spec_SwapStep::SwapStep; (0, adapter, Address), (1, amount_in, i128), (2, asset_in, Asset), (3, asset_out, Asset), (4, min_out, i128), (5, pool_id, u128), (6, router_addr, Address));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct RouterStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_RouterStep {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct RouterStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
}
}
crate::compact_codec::record!(RouterStep, __wire_spec_RouterStep::RouterStep; (0, adapter, Address), (1, amount_in, i128), (2, asset_out, Asset), (3, min_out, i128), (4, pool_id, u128));

#[derive(Clone)]
#[contracttype]
pub enum BlendAction {
    Lend,
    Borrow,
    Repay,
    Withdraw,
}

#[derive(Clone, Eq, PartialEq)]
#[contracttype]
pub enum CreditProtocol {
    Blend,
}

#[derive(Clone, Eq, PartialEq)]
#[contracttype]
pub enum CreditAction {
    Supply,
    Borrow,
    Repay,
    Withdraw,
}

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditMarketConfig {
    pub protocol: CreditProtocol,
    pub market_id: u128,
    pub adapter: Address,
    pub allow_supply: bool,
    pub allow_borrow: bool,
    pub allow_repay: bool,
    pub allow_withdraw: bool,
    pub enabled: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditMarketConfig {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditMarketConfig {
    pub protocol: CreditProtocol,
    pub market_id: u128,
    pub adapter: Address,
    pub allow_supply: bool,
    pub allow_borrow: bool,
    pub allow_repay: bool,
    pub allow_withdraw: bool,
    pub enabled: bool,
}
}
crate::compact_codec::record!(CreditMarketConfig, __wire_spec_CreditMarketConfig::CreditMarketConfig; (0, adapter, Address), (1, allow_borrow, bool), (2, allow_repay, bool), (3, allow_supply, bool), (4, allow_withdraw, bool), (5, enabled, bool), (6, market_id, u128), (7, protocol, CreditProtocol));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditBorrowPolicy {
    pub protocol: CreditProtocol,
    pub market_id: u128,
    pub asset: Address,
    pub max_borrow_per_action: i128,
    pub max_debt_for_asset: i128,
    pub enabled: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditBorrowPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditBorrowPolicy {
    pub protocol: CreditProtocol,
    pub market_id: u128,
    pub asset: Address,
    pub max_borrow_per_action: i128,
    pub max_debt_for_asset: i128,
    pub enabled: bool,
}
}
crate::compact_codec::record!(CreditBorrowPolicy, __wire_spec_CreditBorrowPolicy::CreditBorrowPolicy; (0, asset, Address), (1, enabled, bool), (2, market_id, u128), (3, max_borrow_per_action, i128), (4, max_debt_for_asset, i128), (5, protocol, CreditProtocol));

// The factory that attests a Blend V2 pool was deployed by the canonical
// Blend pool factory. A borrow requires this source as well as the ordinary
// market policy: an adapter address alone is not enough evidence that the
// router implements the risk-read ABI Arka relies on.
#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendV2RiskSource {
    pub market_id: u128,
    pub pool_factory: Address,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendV2RiskSource {
 use super::*;
 // The factory that attests a Blend V2 pool was deployed by the canonical
 // Blend pool factory. A borrow requires this source as well as the ordinary
 // market policy: an adapter address alone is not enough evidence that the
 // router implements the risk-read ABI Arka relies on.
 #[soroban_sdk::contracttype]
 pub struct BlendV2RiskSource {
    pub market_id: u128,
    pub pool_factory: Address,
}
}
crate::compact_codec::record!(BlendV2RiskSource, __wire_spec_BlendV2RiskSource::BlendV2RiskSource; (0, market_id, u128), (1, pool_factory, Address));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendPosition {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}
}
crate::compact_codec::record!(BlendPosition, __wire_spec_BlendPosition::BlendPosition; (0, asset, Address), (1, collateral_amount, i128), (2, debt_amount, i128), (3, market_id, u128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditPosition {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}
}
crate::compact_codec::record!(CreditPosition, __wire_spec_CreditPosition::CreditPosition; (0, asset, Address), (1, collateral_amount, i128), (2, debt_amount, i128), (3, market_id, u128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendPositionValue {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}
}
crate::compact_codec::record!(BlendPositionValue, __wire_spec_BlendPositionValue::BlendPositionValue; (0, asset, Address), (1, c_factor, u32), (2, collateral_amount, i128), (3, collateral_shares, i128), (4, collateral_value, i128), (5, debt_amount, i128), (6, debt_shares, i128), (7, debt_value, i128), (8, health_factor, i128), (9, market_id, u128), (10, net_value, i128), (11, oracle_timestamp, u64), (12, price, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditPositionValue {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}
}
crate::compact_codec::record!(CreditPositionValue, __wire_spec_CreditPositionValue::CreditPositionValue; (0, asset, Address), (1, c_factor, u32), (2, collateral_amount, i128), (3, collateral_shares, i128), (4, collateral_value, i128), (5, debt_amount, i128), (6, debt_shares, i128), (7, debt_value, i128), (8, health_factor, i128), (9, market_id, u128), (10, net_value, i128), (11, oracle_timestamp, u64), (12, price, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendMarketValue {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}
}
crate::compact_codec::record!(BlendMarketValue, __wire_spec_BlendMarketValue::BlendMarketValue; (0, collateral_value, i128), (1, debt_value, i128), (2, health_factor, i128), (3, market_id, u128), (4, net_value, i128), (5, oracle_timestamp, u64));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditMarketValue {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}
}
crate::compact_codec::record!(CreditMarketValue, __wire_spec_CreditMarketValue::CreditMarketValue; (0, collateral_value, i128), (1, debt_value, i128), (2, health_factor, i128), (3, market_id, u128), (4, net_value, i128), (5, oracle_timestamp, u64));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendRiskPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}
}
crate::compact_codec::record!(BlendRiskPolicy, __wire_spec_BlendRiskPolicy::BlendRiskPolicy; (0, fail_close_actions, bool), (1, fail_close_nav, bool), (2, market_id, u128), (3, max_oracle_age, u64), (4, min_health_factor, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditRiskPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}
}
crate::compact_codec::record!(CreditRiskPolicy, __wire_spec_CreditRiskPolicy::CreditRiskPolicy; (0, fail_close_actions, bool), (1, fail_close_nav, bool), (2, market_id, u128), (3, max_oracle_age, u64), (4, min_health_factor, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct SwapRiskPolicy {
    pub enabled: bool,
    pub oracle_checks_enabled: bool,
    pub max_price_impact_bps: i32,
    pub max_slippage_bps: i32,
    pub max_twap_deviation_bps: i32,
    pub max_oracle_age_seconds: u64,
    pub max_trade_size_bps: i32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_SwapRiskPolicy {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct SwapRiskPolicy {
    pub enabled: bool,
    pub oracle_checks_enabled: bool,
    pub max_price_impact_bps: i32,
    pub max_slippage_bps: i32,
    pub max_twap_deviation_bps: i32,
    pub max_oracle_age_seconds: u64,
    pub max_trade_size_bps: i32,
}
}
crate::compact_codec::record!(SwapRiskPolicy, __wire_spec_SwapRiskPolicy::SwapRiskPolicy; (0, enabled, bool), (1, max_oracle_age_seconds, u64), (2, max_price_impact_bps, i32), (3, max_slippage_bps, i32), (4, max_trade_size_bps, i32), (5, max_twap_deviation_bps, i32), (6, oracle_checks_enabled, bool));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ValuationOracleConfig {
    pub oracle: Address,
    pub max_price_age: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ValuationOracleConfig {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ValuationOracleConfig {
    pub oracle: Address,
    pub max_price_age: u64,
}
}
crate::compact_codec::record!(ValuationOracleConfig, __wire_spec_ValuationOracleConfig::ValuationOracleConfig; (0, max_price_age, u64), (1, oracle, Address));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ShareBalanceTarget {
    pub holder: Address,
    pub balance: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ShareBalanceTarget {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ShareBalanceTarget {
    pub holder: Address,
    pub balance: i128,
}
}
crate::compact_codec::record!(ShareBalanceTarget, __wire_spec_ShareBalanceTarget::ShareBalanceTarget; (0, balance, i128), (1, holder, Address));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendMarketStatus {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}
}
crate::compact_codec::record!(BlendMarketStatus, __wire_spec_BlendMarketStatus::BlendMarketStatus; (0, debt_value, i128), (1, has_disabled_reserve, bool), (2, has_future_oracle_timestamp, bool), (3, has_invalid_oracle_data, bool), (4, has_live_pricing, bool), (5, has_stale_oracle, bool), (6, health_factor, i128), (7, market_id, u128), (8, max_oracle_age, u64), (9, min_health_factor, i128), (10, nav_blocked, bool), (11, oracle_age, u64), (12, pool_status, u32), (13, risky_actions_blocked, bool));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct CreditMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_CreditMarketStatus {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct CreditMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}
}
crate::compact_codec::record!(CreditMarketStatus, __wire_spec_CreditMarketStatus::CreditMarketStatus; (0, debt_value, i128), (1, has_disabled_reserve, bool), (2, has_future_oracle_timestamp, bool), (3, has_invalid_oracle_data, bool), (4, has_live_pricing, bool), (5, has_stale_oracle, bool), (6, health_factor, i128), (7, market_id, u128), (8, max_oracle_age, u64), (9, min_health_factor, i128), (10, nav_blocked, bool), (11, oracle_age, u64), (12, pool_status, u32), (13, risky_actions_blocked, bool));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendRequest {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendRequest {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendRequest {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}
}
crate::compact_codec::record!(BlendRequest, __wire_spec_BlendRequest::BlendRequest; (0, address, Address), (1, amount, i128), (2, request_type, u32));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub enum DataKey {
    Denomination,
    TotalShares,
    ShareToken,
    Aum,
    Fees,
    ProtocolTreasury,
    ProtocolFeePolicy,
    FeeState,
    Whitelist,
    Manager,
    Governor,
    Router,
    Balance(Address),
    TrackedAssets,
    LiquidBalance(Address),
    BlendMarkets,
    BlendMarketAssets(u128),
    BlendPosition(u128, Address),
    BlendAdapter(u128),
    BlendRiskPolicy(u128),
    BlendExternalDiagnostics(u128),
    BlendV2RiskSource(u128),
    CreditProtocols,
    CreditMarkets(CreditProtocol),
    CreditMarketConfig(CreditProtocol, u128),
    CreditBorrowPolicy(CreditProtocol, u128, Address),
    SwapRiskPolicy,
    SwapOracle,
    ValuationOracleConfig,
    ShareAccountingVersion,
    AllowedRouters,
    AllowedAdapters,
    VenueRegistry,
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    LastWasmHash,
    ManagedPolicy,
    ManagedPortfolioPolicy,
    ManagedQueue,
    ManagedRequest(u64),
    ManagedOwnerPending(Address),
    ManagedPool,
    ManagedRouteBindings,
}
#[allow(non_snake_case)]
#[cfg(target_family = "wasm")]
mod __wire_spec_DataKey {use super::*; #[soroban_sdk::contracttype] pub enum DataKey {
    Denomination,
    TotalShares,
    ShareToken,
    Aum,
    Fees,
    ProtocolTreasury,
    ProtocolFeePolicy,
    FeeState,
    Whitelist,
    Manager,
    Governor,
    Router,
    Balance(Address),
    TrackedAssets,
    LiquidBalance(Address),
    BlendMarkets,
    BlendMarketAssets(u128),
    BlendPosition(u128, Address),
    BlendAdapter(u128),
    BlendRiskPolicy(u128),
    BlendExternalDiagnostics(u128),
    BlendV2RiskSource(u128),
    CreditProtocols,
    CreditMarkets(CreditProtocol),
    CreditMarketConfig(CreditProtocol, u128),
    CreditBorrowPolicy(CreditProtocol, u128, Address),
    SwapRiskPolicy,
    SwapOracle,
    ValuationOracleConfig,
    ShareAccountingVersion,
    AllowedRouters,
    AllowedAdapters,
    VenueRegistry,
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    LastWasmHash,
    ManagedPolicy,
    ManagedPortfolioPolicy,
    ManagedQueue,
    ManagedRequest(u64),
    ManagedOwnerPending(Address),
    ManagedPool,
    ManagedRouteBindings,
}}
impl DataKey {pub(crate) const KEY_NAMES:&'static[&'static str]=&["Denomination","TotalShares","ShareToken","Aum","Fees","ProtocolTreasury","ProtocolFeePolicy","FeeState","Whitelist","Manager","Governor","Router","Balance","TrackedAssets","LiquidBalance","BlendMarkets","BlendMarketAssets","BlendPosition","BlendAdapter","BlendRiskPolicy","BlendExternalDiagnostics","BlendV2RiskSource","CreditProtocols","CreditMarkets","CreditMarketConfig","CreditBorrowPolicy","SwapRiskPolicy","SwapOracle","ValuationOracleConfig","ShareAccountingVersion","AllowedRouters","AllowedAdapters","VenueRegistry","BootstrapAdmin","BootstrapAdminExpiresAt","LastWasmHash","ManagedPolicy","ManagedPortfolioPolicy","ManagedQueue","ManagedRequest","ManagedOwnerPending","ManagedPool","ManagedRouteBindings"];}
#[cfg(target_family = "wasm")]
impl DataKey {pub const fn spec_xdr()->[u8;__wire_spec_DataKey::DataKey::spec_xdr().len()]{__wire_spec_DataKey::DataKey::spec_xdr()}}
#[cfg(target_family = "wasm")]
impl TryFromVal<Env,Val> for DataKey {type Error=soroban_sdk::ConversionError;fn try_from_val(env:&Env,val:&Val)->Result<Self,Self::Error>{let v=__wire_spec_DataKey::DataKey::try_from_val(env,val)?;Ok(match v{__wire_spec_DataKey::DataKey::Denomination=>DataKey::Denomination,__wire_spec_DataKey::DataKey::TotalShares=>DataKey::TotalShares,__wire_spec_DataKey::DataKey::ShareToken=>DataKey::ShareToken,__wire_spec_DataKey::DataKey::Aum=>DataKey::Aum,__wire_spec_DataKey::DataKey::Fees=>DataKey::Fees,__wire_spec_DataKey::DataKey::ProtocolTreasury=>DataKey::ProtocolTreasury,__wire_spec_DataKey::DataKey::ProtocolFeePolicy=>DataKey::ProtocolFeePolicy,__wire_spec_DataKey::DataKey::FeeState=>DataKey::FeeState,__wire_spec_DataKey::DataKey::Whitelist=>DataKey::Whitelist,__wire_spec_DataKey::DataKey::Manager=>DataKey::Manager,__wire_spec_DataKey::DataKey::Governor=>DataKey::Governor,__wire_spec_DataKey::DataKey::Router=>DataKey::Router,__wire_spec_DataKey::DataKey::Balance(a0)=>DataKey::Balance(a0),__wire_spec_DataKey::DataKey::TrackedAssets=>DataKey::TrackedAssets,__wire_spec_DataKey::DataKey::LiquidBalance(a0)=>DataKey::LiquidBalance(a0),__wire_spec_DataKey::DataKey::BlendMarkets=>DataKey::BlendMarkets,__wire_spec_DataKey::DataKey::BlendMarketAssets(a0)=>DataKey::BlendMarketAssets(a0),__wire_spec_DataKey::DataKey::BlendPosition(a0,a1)=>DataKey::BlendPosition(a0,a1),__wire_spec_DataKey::DataKey::BlendAdapter(a0)=>DataKey::BlendAdapter(a0),__wire_spec_DataKey::DataKey::BlendRiskPolicy(a0)=>DataKey::BlendRiskPolicy(a0),__wire_spec_DataKey::DataKey::BlendExternalDiagnostics(a0)=>DataKey::BlendExternalDiagnostics(a0),__wire_spec_DataKey::DataKey::BlendV2RiskSource(a0)=>DataKey::BlendV2RiskSource(a0),__wire_spec_DataKey::DataKey::CreditProtocols=>DataKey::CreditProtocols,__wire_spec_DataKey::DataKey::CreditMarkets(a0)=>DataKey::CreditMarkets(a0),__wire_spec_DataKey::DataKey::CreditMarketConfig(a0,a1)=>DataKey::CreditMarketConfig(a0,a1),__wire_spec_DataKey::DataKey::CreditBorrowPolicy(a0,a1,a2)=>DataKey::CreditBorrowPolicy(a0,a1,a2),__wire_spec_DataKey::DataKey::SwapRiskPolicy=>DataKey::SwapRiskPolicy,__wire_spec_DataKey::DataKey::SwapOracle=>DataKey::SwapOracle,__wire_spec_DataKey::DataKey::ValuationOracleConfig=>DataKey::ValuationOracleConfig,__wire_spec_DataKey::DataKey::ShareAccountingVersion=>DataKey::ShareAccountingVersion,__wire_spec_DataKey::DataKey::AllowedRouters=>DataKey::AllowedRouters,__wire_spec_DataKey::DataKey::AllowedAdapters=>DataKey::AllowedAdapters,__wire_spec_DataKey::DataKey::VenueRegistry=>DataKey::VenueRegistry,__wire_spec_DataKey::DataKey::BootstrapAdmin=>DataKey::BootstrapAdmin,__wire_spec_DataKey::DataKey::BootstrapAdminExpiresAt=>DataKey::BootstrapAdminExpiresAt,__wire_spec_DataKey::DataKey::LastWasmHash=>DataKey::LastWasmHash,__wire_spec_DataKey::DataKey::ManagedPolicy=>DataKey::ManagedPolicy,__wire_spec_DataKey::DataKey::ManagedPortfolioPolicy=>DataKey::ManagedPortfolioPolicy,__wire_spec_DataKey::DataKey::ManagedQueue=>DataKey::ManagedQueue,__wire_spec_DataKey::DataKey::ManagedRequest(a0)=>DataKey::ManagedRequest(a0),__wire_spec_DataKey::DataKey::ManagedOwnerPending(a0)=>DataKey::ManagedOwnerPending(a0),__wire_spec_DataKey::DataKey::ManagedPool=>DataKey::ManagedPool,__wire_spec_DataKey::DataKey::ManagedRouteBindings=>DataKey::ManagedRouteBindings})}}
#[cfg(target_family = "wasm")]
impl TryFromVal<Env,DataKey> for Val {type Error=soroban_sdk::ConversionError;#[inline(never)] fn try_from_val(env:&Env,val:&DataKey)->Result<Self,Self::Error>{use soroban_sdk::TryIntoVal;let index=match val{DataKey::Denomination=>0,DataKey::TotalShares=>1,DataKey::ShareToken=>2,DataKey::Aum=>3,DataKey::Fees=>4,DataKey::ProtocolTreasury=>5,DataKey::ProtocolFeePolicy=>6,DataKey::FeeState=>7,DataKey::Whitelist=>8,DataKey::Manager=>9,DataKey::Governor=>10,DataKey::Router=>11,DataKey::Balance(..)=>12,DataKey::TrackedAssets=>13,DataKey::LiquidBalance(..)=>14,DataKey::BlendMarkets=>15,DataKey::BlendMarketAssets(..)=>16,DataKey::BlendPosition(..)=>17,DataKey::BlendAdapter(..)=>18,DataKey::BlendRiskPolicy(..)=>19,DataKey::BlendExternalDiagnostics(..)=>20,DataKey::BlendV2RiskSource(..)=>21,DataKey::CreditProtocols=>22,DataKey::CreditMarkets(..)=>23,DataKey::CreditMarketConfig(..)=>24,DataKey::CreditBorrowPolicy(..)=>25,DataKey::SwapRiskPolicy=>26,DataKey::SwapOracle=>27,DataKey::ValuationOracleConfig=>28,DataKey::ShareAccountingVersion=>29,DataKey::AllowedRouters=>30,DataKey::AllowedAdapters=>31,DataKey::VenueRegistry=>32,DataKey::BootstrapAdmin=>33,DataKey::BootstrapAdminExpiresAt=>34,DataKey::LastWasmHash=>35,DataKey::ManagedPolicy=>36,DataKey::ManagedPortfolioPolicy=>37,DataKey::ManagedQueue=>38,DataKey::ManagedRequest(..)=>39,DataKey::ManagedOwnerPending(..)=>40,DataKey::ManagedPool=>41,DataKey::ManagedRouteBindings=>42};let name=DataKey::KEY_NAMES[index];let mut values=Vec::<Val>::new(env);values.push_back(Symbol::new(env,name).into_val(env));match val{DataKey::Balance(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::LiquidBalance(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendMarketAssets(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendPosition(a0,a1)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);values.push_back(a1.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendAdapter(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendRiskPolicy(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendExternalDiagnostics(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::BlendV2RiskSource(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::CreditMarkets(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::CreditMarketConfig(a0,a1)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);values.push_back(a1.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::CreditBorrowPolicy(a0,a1,a2)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);values.push_back(a1.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);values.push_back(a2.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::ManagedRequest(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},DataKey::ManagedOwnerPending(a0)=>{values.push_back(a0.try_into_val(env).map_err(|_|soroban_sdk::ConversionError)?);},_=>{}} Ok(values.into_val(env))}}
#[cfg(target_family = "wasm")]
impl TryFromVal<Env,&DataKey> for Val {type Error=soroban_sdk::ConversionError;#[inline(always)] fn try_from_val(env:&Env,val:&&DataKey)->Result<Self,Self::Error>{<Self as TryFromVal<Env,DataKey>>::try_from_val(env,*val)}}

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendPoolConfig {
    pub bstop_rate: u32,
    pub max_positions: u32,
    pub min_collateral: i128,
    pub oracle: Address,
    pub status: u32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendPoolConfig {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendPoolConfig {
    pub bstop_rate: u32,
    pub max_positions: u32,
    pub min_collateral: i128,
    pub oracle: Address,
    pub status: u32,
}
}
crate::compact_codec::record!(BlendPoolConfig, __wire_spec_BlendPoolConfig::BlendPoolConfig; (0, bstop_rate, u32), (1, max_positions, u32), (2, min_collateral, i128), (3, oracle, Address), (4, status, u32));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendReserveConfig {
    pub c_factor: u32,
    pub decimals: u32,
    pub enabled: bool,
    pub index: u32,
    pub l_factor: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_three: u32,
    pub r_two: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub util: u32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendReserveConfig {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendReserveConfig {
    pub c_factor: u32,
    pub decimals: u32,
    pub enabled: bool,
    pub index: u32,
    pub l_factor: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_three: u32,
    pub r_two: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub util: u32,
}
}
crate::compact_codec::record!(BlendReserveConfig, __wire_spec_BlendReserveConfig::BlendReserveConfig; (0, c_factor, u32), (1, decimals, u32), (2, enabled, bool), (3, index, u32), (4, l_factor, u32), (5, max_util, u32), (6, r_base, u32), (7, r_one, u32), (8, r_three, u32), (9, r_two, u32), (10, reactivity, u32), (11, supply_cap, i128), (12, util, u32));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendReserveData {
    pub b_rate: i128,
    pub b_supply: i128,
    pub backstop_credit: i128,
    pub d_rate: i128,
    pub d_supply: i128,
    pub ir_mod: i128,
    pub last_time: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendReserveData {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendReserveData {
    pub b_rate: i128,
    pub b_supply: i128,
    pub backstop_credit: i128,
    pub d_rate: i128,
    pub d_supply: i128,
    pub ir_mod: i128,
    pub last_time: u64,
}
}
crate::compact_codec::record!(BlendReserveData, __wire_spec_BlendReserveData::BlendReserveData; (0, b_rate, i128), (1, b_supply, i128), (2, backstop_credit, i128), (3, d_rate, i128), (4, d_supply, i128), (5, ir_mod, i128), (6, last_time, u64));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendReserve {
    pub asset: Address,
    pub config: BlendReserveConfig,
    pub data: BlendReserveData,
    pub scalar: i128,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendReserve {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendReserve {
    pub asset: Address,
    pub config: BlendReserveConfig,
    pub data: BlendReserveData,
    pub scalar: i128,
}
}
crate::compact_codec::record!(BlendReserve, __wire_spec_BlendReserve::BlendReserve; (0, asset, Address), (1, config, BlendReserveConfig), (2, data, BlendReserveData), (3, scalar, i128));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct BlendPoolPositions {
    pub collateral: Map<u32, i128>,
    pub liabilities: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_BlendPoolPositions {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct BlendPoolPositions {
    pub collateral: Map<u32, i128>,
    pub liabilities: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}
}
crate::compact_codec::record!(BlendPoolPositions, __wire_spec_BlendPoolPositions::BlendPoolPositions; (0, collateral, Map<u32, i128>), (1, liabilities, Map<u32, i128>), (2, supply, Map<u32, i128>));

#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_OraclePriceData {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}
}
crate::compact_codec::record!(OraclePriceData, __wire_spec_OraclePriceData::OraclePriceData; (0, price, i128), (1, timestamp, u64));

#[derive(Clone)]
struct BlendPositionDiagnostics {
    value: BlendPositionValue,
    pool_status: u32,
    reserve_enabled: bool,
    has_invalid_oracle_data: bool,
    has_future_oracle_timestamp: bool,
}

#[derive(Clone)]
struct BlendDiagnosticsContext {
    router: Address,
    pool_config: BlendPoolConfig,
    positions: BlendPoolPositions,
    denomination: Asset,
    denomination_price: OraclePriceData,
    ledger_timestamp: u64,
}

#[derive(Clone)]
struct BlendMarketAssessment {
    value: BlendMarketValue,
    has_invalid_oracle_data: bool,
    has_future_oracle_timestamp: bool,
    has_disabled_reserve: bool,
    pool_status: u32,
}

impl From<BlendPosition> for CreditPosition {
    fn from(value: BlendPosition) -> Self {
        Self {
            market_id: value.market_id,
            asset: value.asset,
            collateral_amount: value.collateral_amount,
            debt_amount: value.debt_amount,
        }
    }
}

impl From<BlendPositionValue> for CreditPositionValue {
    fn from(value: BlendPositionValue) -> Self {
        Self {
            market_id: value.market_id,
            asset: value.asset,
            collateral_shares: value.collateral_shares,
            collateral_amount: value.collateral_amount,
            collateral_value: value.collateral_value,
            debt_shares: value.debt_shares,
            debt_amount: value.debt_amount,
            debt_value: value.debt_value,
            net_value: value.net_value,
            price: value.price,
            health_factor: value.health_factor,
            c_factor: value.c_factor,
            oracle_timestamp: value.oracle_timestamp,
        }
    }
}

impl From<BlendMarketValue> for CreditMarketValue {
    fn from(value: BlendMarketValue) -> Self {
        Self {
            market_id: value.market_id,
            collateral_value: value.collateral_value,
            debt_value: value.debt_value,
            net_value: value.net_value,
            health_factor: value.health_factor,
            oracle_timestamp: value.oracle_timestamp,
        }
    }
}

impl From<BlendRiskPolicy> for CreditRiskPolicy {
    fn from(value: BlendRiskPolicy) -> Self {
        Self {
            market_id: value.market_id,
            max_oracle_age: value.max_oracle_age,
            min_health_factor: value.min_health_factor,
            fail_close_nav: value.fail_close_nav,
            fail_close_actions: value.fail_close_actions,
        }
    }
}

impl From<BlendMarketStatus> for CreditMarketStatus {
    fn from(value: BlendMarketStatus) -> Self {
        Self {
            market_id: value.market_id,
            has_live_pricing: value.has_live_pricing,
            has_stale_oracle: value.has_stale_oracle,
            has_invalid_oracle_data: value.has_invalid_oracle_data,
            has_future_oracle_timestamp: value.has_future_oracle_timestamp,
            has_disabled_reserve: value.has_disabled_reserve,
            oracle_age: value.oracle_age,
            max_oracle_age: value.max_oracle_age,
            min_health_factor: value.min_health_factor,
            health_factor: value.health_factor,
            debt_value: value.debt_value,
            pool_status: value.pool_status,
            risky_actions_blocked: value.risky_actions_blocked,
            nav_blocked: value.nav_blocked,
        }
    }
}

#[derive(Clone)]
#[contracttype]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
const EVENT_REDEEM: Symbol = symbol_short!("redeem");
const EVENT_PROFIT: Symbol = symbol_short!("profit");
const EVENT_FEE: Symbol = symbol_short!("fee");
const EVENT_BLEND: Symbol = symbol_short!("blend");
const EVENT_INIT: Symbol = symbol_short!("initcfg");
const EVENT_GOVERNOR_SET: Symbol = symbol_short!("govset");
const EVENT_FEES_CFG: Symbol = symbol_short!("feecfg");
const EVENT_PROTOCOL_FEE_CFG: Symbol = symbol_short!("protfee");
const EVENT_WHITELIST_CFG: Symbol = symbol_short!("whlist");
const EVENT_MANAGER_SET: Symbol = symbol_short!("mngrset");
const EVENT_ROUTER_SET: Symbol = symbol_short!("router");
const EVENT_SHARE_TOKEN_SET: Symbol = symbol_short!("sharetk");
const EVENT_BLEND_POLICY_CFG: Symbol = symbol_short!("blendcfg");
const EVENT_BLEND_DIAGNOSTICS_CFG: Symbol = symbol_short!("bdiagcfg");
const EVENT_BLEND_V2_SOURCE_CFG: Symbol = symbol_short!("blv2src");
const EVENT_CREDIT_MARKET_CFG: Symbol = symbol_short!("creditcf");
const EVENT_CREDIT_BORROW_CFG: Symbol = symbol_short!("crdborcf");
const EVENT_SWAP_POLICY_CFG: Symbol = symbol_short!("swppol");
const EVENT_SWAP_ORACLE_SET: Symbol = symbol_short!("swporcl");
const EVENT_VALUATION_ORACLE_SET: Symbol = symbol_short!("valoracl");
const EVENT_SHARE_ACCOUNTING_MIGRATED: Symbol = symbol_short!("sharemig");
const EVENT_SWAP_VENUES_CFG: Symbol = symbol_short!("swpven");
const EVENT_VENUE_REGISTRY_SET: Symbol = symbol_short!("venreg");
const BLEND_RATE_SCALE: i128 = 1_000_000_000_000;
const DEFAULT_BLEND_MAX_ORACLE_AGE: u64 = 60 * 60;
const DEFAULT_BLEND_MIN_HEALTH_FACTOR: i128 = 12_500_000;
const DEFAULT_SWAP_MAX_PRICE_IMPACT_BPS: i32 = 300;
const DEFAULT_SWAP_MAX_SLIPPAGE_BPS: i32 = 300;
const DEFAULT_SWAP_MAX_TWAP_DEVIATION_BPS: i32 = 350;
const DEFAULT_SWAP_MAX_ORACLE_AGE_SECONDS: u64 = 60;
const DEFAULT_SWAP_MAX_TRADE_SIZE_BPS_OF_LIQUIDITY: i32 = 2_500;
const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;
const SHARE_PRICE_SCALE: i128 = 1_000_000_000;
const YEAR_SECONDS: i128 = 31_536_000;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    OnlyManager = 3,
    AmountZero = 4,
    AssetNotWhitelisted = 5,
    SharesZero = 6,
    InsufficientUserShares = 7,
    InsufficientShares = 8,
    RouterNotSet = 9,
    InvalidFeeBps = 10,
    UnauthorizedPolicy = 11,
    InsufficientLiquidity = 12,
    InvalidBlendPosition = 13,
    BlendAssetMismatch = 14,
    InvalidBlendRiskPolicy = 15,
    BlendOracleStale = 16,
    BlendHealthFactorTooLow = 17,
    BlendNavUnavailable = 18,
    BlendOracleInvalid = 19,
    CreditMarketNotConfigured = 20,
    CreditActionNotAllowed = 21,
    InvalidProtocolFeeBps = 22,
    InvalidSwapRiskPolicy = 23,
    SwapVenueNotAllowed = 24,
    SwapTradeSizeExceeded = 25,
    SwapOracleNotConfigured = 26,
    SwapOracleStale = 27,
    SwapOracleInvalid = 28,
    SwapPriceImpactExceeded = 29,
    SwapSlippageExceeded = 30,
    SwapTwapDeviationExceeded = 31,
    InvalidBootstrapAdmin = 32,
    CreditBorrowPolicyNotConfigured = 33,
    CreditBorrowLimitExceeded = 34,
    InvalidCreditBorrowPolicy = 35,
    BlendV2RiskSourceNotConfigured = 36,
    BlendV2PoolNotVerified = 37,
    ValuationOracleNotConfigured = 38,
    ValuationOracleStale = 39,
    ValuationOracleInvalid = 40,
    ArithmeticOverflow = 41,
    ShareAccountingMigrationRequired = 42,
    ShareAccountingAlreadyMigrated = 43,
    InvalidShareMigration = 44,
    ManagedPolicyLocked = 45,
    ManagedInvalidRequest = 46,
    ManagedOutstanding = 47,
    ManagedUnsupported = 48,
    ManagedTooEarly = 49,
    ManagedNoLiquidity = 50,
}

// The original error enum already fills Soroban's 50-case spec bound. Preserve
// its codes/ABI and keep additive deposit errors in a separate bounded enum.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum DepositError {
    MinimumRequired = 51,
    MinimumNotMet = 52,
}

#[contract]
pub struct ArkaContract;

#[contractimpl]
impl ArkaContract {
    fn apply_fee_bps(amount: i128, fee_bps: i32) -> i128 {
        let bps = cm::sub(10_000i128, fee_bps as i128);
        cm::div(cm::mul(amount,bps),10_000i128)
    }

    fn assert_fee_bps(env: &Env, bps: i32) {
        if !(0..=10_000).contains(&bps) {
            panic_with_error!(env, Error::InvalidFeeBps);
        }
    }

    fn assert_protocol_fee_bps(env: &Env, bps: i32) {
        if !(0..=10_000).contains(&bps) {
            panic_with_error!(env, Error::InvalidProtocolFeeBps);
        }
    }

    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = crate::compact_storage::instance(&env);
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller != governor {
                panic_with_error!(env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
            return;
        }
        let manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != manager {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        }
        caller.require_auth();
    }

    fn bootstrap_admin_active_internal(env: &Env) -> bool {
        let Some(expires_at) = crate::compact_storage::instance(&env)
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_governor_caller_auth(env: &Env, caller: &Address) {
        let Some(governor) = crate::compact_storage::instance(&env)
            .get::<DataKey, Address>(&DataKey::Governor)
        else {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        };
        if *caller != governor {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        }
        caller.require_auth();
    }

    fn require_bootstrap_or_governor_auth(env: &Env, caller: &Address) {
        let store = crate::compact_storage::instance(&env);
        if Self::bootstrap_admin_active_internal(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::BootstrapAdmin) {
                if *caller == admin {
                    caller.require_auth();
                    return;
                }
            }
        }
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::UnauthorizedPolicy);
    }

    fn require_manager(env: &Env, manager: &Address) {
        let store = crate::compact_storage::instance(&env);
        let stored_manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *manager != stored_manager {
            panic_with_error!(env, Error::OnlyManager);
        }
        manager.require_auth();
    }

    fn authorize_current_contract_call(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: &Vec<Val>,
        sub_invocations: Vec<InvokerContractAuthEntry>,
    ) {
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: contract.clone(),
                fn_name: Symbol::new(env, fn_name),
                args: args.clone(),
            },
            sub_invocations,
        });
        env.authorize_as_current_contract(vec![env, auth]);
    }

    fn invoke_with_contract_auth<T>(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: Vec<Val>,
    ) -> T
    where
        T: TryFromVal<Env, Val>,
    {
        Self::authorize_current_contract_call(env, contract, fn_name, &args, vec![env]);
        env.invoke_contract::<T>(contract, &Symbol::new(env, fn_name), args)
    }

    fn maybe_mint_share_token(env: &Env, to: &Address, amount: i128) {
        let store = crate::compact_storage::instance(&env);
        if let Some(share_token) = store.get::<DataKey, Address>(&DataKey::ShareToken) {
            let args = vec![env, to.clone().into_val(env), amount.into_val(env)];
            Self::invoke_with_contract_auth::<()>(env, &share_token, "mint", args);
        }
    }

    fn maybe_burn_share_token(env: &Env, from: &Address, amount: i128) {
        let store = crate::compact_storage::instance(&env);
        if let Some(share_token) = store.get::<DataKey, Address>(&DataKey::ShareToken) {
            let args = vec![env, from.clone().into_val(env), amount.into_val(env)];
            Self::invoke_with_contract_auth::<()>(env, &share_token, "burn", args);
        }
    }

    fn maybe_share_token_balance(env: &Env, user: &Address) -> Option<i128> {
        let store = crate::compact_storage::instance(&env);
        let share_token: Option<Address> = store.get(&DataKey::ShareToken);
        share_token.map(|token| {
            let args = vec![env, user.clone().into_val(env)];
            env.invoke_contract::<i128>(&token, &soroban_sdk::symbol_short!("balance"), args)
        })
    }

    fn token_balance(env: &Env, token: &Address, owner: &Address) -> i128 {
        let args = vec![env, owner.clone().into_val(env)];
        env.invoke_contract::<i128>(token, &soroban_sdk::symbol_short!("balance"), args)
    }

    fn total_shares_internal(env: &Env) -> i128 {
        crate::compact_storage::instance(&env)
            .get(&DataKey::TotalShares)
            .unwrap_or(0)
    }

    fn share_accounting_version_internal(env: &Env) -> u32 {
        crate::compact_storage::instance(&env)
            .get(&DataKey::ShareAccountingVersion)
            .unwrap_or(1)
    }

    fn require_current_share_accounting(env: &Env) {
        if Self::share_accounting_version_internal(env) < 2 {
            panic_with_error!(env, Error::ShareAccountingMigrationRequired);
        }
    }

    fn bump_dynamic_key(env: &Env, key: &DataKey) {
        Self::bump_dynamic_val(env,&key.into_val(env));
    }
    #[inline(never)]
    fn bump_dynamic_val(env: &Env, key: &Val) {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        let store = crate::compact_storage::persistent(&env);
        if store.has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            store.extend_ttl(key, threshold, max_ttl);
        }
    }

    fn dynamic_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let key:Val=key.into_val(env);
        let (raw,legacy)=Self::dynamic_read_val(env,&key);
        raw.map(|raw|{
            let value=T::try_from_val(env,&raw).unwrap_or_else(|_|panic!("compact_value_type"));
            if legacy {Self::dynamic_write_val(env,&key,&value.into_val(env));}
            else {Self::bump_dynamic_val(env,&key);}
            value
        })
    }

    #[inline(never)]
    fn dynamic_read_val(env:&Env,key:&Val)->(Option<Val>,bool){
        if let Some(raw)=crate::compact_storage::persistent(env).get(key){return (Some(raw),false);}
        (crate::compact_storage::instance(env).get(key),true)
    }

    #[inline(never)]
    fn dynamic_write_val(env:&Env,key:&Val,value:&Val){
        crate::compact_storage::persistent(env).set(key,value);
        crate::compact_storage::instance(env).remove(key);
        Self::bump_dynamic_val(env,key);
    }

    fn dynamic_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        Self::dynamic_write_val(env,&key.into_val(env),&value.into_val(env));
    }

    fn dynamic_remove(env: &Env, key: &DataKey) {
        crate::compact_storage::persistent(&env).remove(key);
        crate::compact_storage::instance(&env).remove(key);
    }

    fn fee_state_internal(env: &Env) -> FeeState {
        crate::compact_storage::instance(&env)
            .get(&DataKey::FeeState)
            .unwrap_or(FeeState {
                last_settlement_ts: env.ledger().timestamp(),
                high_water_mark: SHARE_PRICE_SCALE,
                cumulative_management_shares: 0,
                cumulative_performance_shares: 0,
                cumulative_manager_shares: 0,
                cumulative_protocol_shares: 0,
            })
    }

    fn protocol_fee_policy_internal(env: &Env) -> ProtocolFeePolicy {
        crate::compact_storage::instance(&env)
            .get(&DataKey::ProtocolFeePolicy)
            .unwrap_or(ProtocolFeePolicy {
                mgmt_protocol_bps: 0,
                perf_protocol_bps: 0,
            })
    }

    fn protocol_treasury_internal(env: &Env) -> Option<Address> {
        crate::compact_storage::instance(&env).get(&DataKey::ProtocolTreasury)
    }

    fn share_price_scaled(nav: i128, total_shares: i128) -> i128 {
        if nav <= 0 || total_shares <= 0 {
            SHARE_PRICE_SCALE
        } else {
            cm::div(cm::mul(nav,SHARE_PRICE_SCALE),total_shares)
        }
    }

    fn fee_value_to_shares(nav: i128, total_shares: i128, fee_value: i128) -> i128 {
        if nav <= 0 || total_shares <= 0 || fee_value <= 0 || fee_value >= nav {
            return 0;
        }
        cm::div(cm::mul(total_shares,fee_value),cm::sub(nav,fee_value))
    }

    fn mint_shares_to(env: &Env, to: &Address, amount: i128) {
        if amount <= 0 {
            return;
        }
        let store = crate::compact_storage::instance(&env);
        let total = Self::total_shares_internal(env);
        store.set(&DataKey::TotalShares, &(cm::add(total,amount)));
        if store.has(&DataKey::ShareToken) {
            Self::maybe_mint_share_token(env, to, amount);
        } else {
            let key = DataKey::Balance(to.clone());
            let balance: i128 = Self::dynamic_get(env, &key).unwrap_or(0);
            Self::dynamic_set(env, &key, &(cm::add(balance,amount)));
        }
    }

    fn burn_shares_from(env: &Env, from: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::SharesZero);
        }
        let store = crate::compact_storage::instance(&env);
        let total = Self::total_shares_internal(env);
        if amount > total {
            panic_with_error!(env, Error::InsufficientShares);
        }
        let key = DataKey::Balance(from.clone());
        let external_balance = Self::maybe_share_token_balance(env, from);
        let balance: i128 =
            external_balance.unwrap_or_else(|| Self::dynamic_get(env, &key).unwrap_or(0));
        if amount > balance {
            panic_with_error!(env, Error::InsufficientUserShares);
        }
        store.set(&DataKey::TotalShares, &(cm::sub(total,amount)));
        if external_balance.is_some() {
            Self::maybe_burn_share_token(env, from, amount);
        } else {
            let next_balance = cm::sub(balance,amount);
            if next_balance == 0 {
                Self::dynamic_remove(env, &key);
            } else {
                Self::dynamic_set(env, &key, &next_balance);
            }
        }
    }

    fn preview_fee_settlement_internal(env: &Env) -> FeeSettlement {
        let now = env.ledger().timestamp();
        let nav = Self::total_nav_internal(env);
        let total_shares_before = Self::total_shares_internal(env);
        let state = Self::fee_state_internal(env);
        let share_price_before = Self::share_price_scaled(nav, total_shares_before);
        let high_water_mark_before = if state.high_water_mark > 0 {
            state.high_water_mark
        } else {
            SHARE_PRICE_SCALE
        };

        if total_shares_before <= 0 || nav <= 0 {
            return FeeSettlement {
                timestamp: now,
                nav,
                total_shares_before,
                share_price_before,
                management_fee_value: 0,
                management_fee_shares: 0,
                performance_fee_value: 0,
                performance_fee_shares: 0,
                manager_fee_shares: 0,
                protocol_fee_shares: 0,
                total_shares_after: total_shares_before,
                share_price_after: share_price_before,
                high_water_mark_before,
                high_water_mark_after: SHARE_PRICE_SCALE,
            };
        }

        let fees = Self::fees(env.clone());
        let delta_seconds = now.saturating_sub(state.last_settlement_ts) as i128;
        let mut management_fee_value = 0i128;
        if delta_seconds > 0 && fees.mgmt_bps > 0 {
            management_fee_value =
                cm::div(cm::mul(cm::mul(nav,fees.mgmt_bps as i128),delta_seconds),(YEAR_SECONDS * 10_000i128));
            if management_fee_value >= nav {
                management_fee_value = cm::sub(nav,1);
            }
        }

        let management_fee_shares =
            Self::fee_value_to_shares(nav, total_shares_before, management_fee_value);
        let total_after_mgmt = cm::add(total_shares_before,management_fee_shares);
        let share_price_after_mgmt = Self::share_price_scaled(nav, total_after_mgmt);

        let profit_above_hwm = if share_price_after_mgmt > high_water_mark_before {
            let hwm_nav = cm::div(cm::mul(high_water_mark_before,total_after_mgmt),SHARE_PRICE_SCALE);
            if nav > hwm_nav {
                cm::sub(nav,hwm_nav)
            } else {
                0
            }
        } else {
            0
        };

        let mut performance_fee_value = 0i128;
        if fees.perf_bps > 0 && profit_above_hwm > 0 {
            performance_fee_value = cm::div(cm::mul(profit_above_hwm,fees.perf_bps as i128),10_000i128);
            if performance_fee_value >= nav {
                performance_fee_value = cm::sub(nav,1);
            }
        }

        let performance_fee_shares =
            Self::fee_value_to_shares(nav, total_after_mgmt, performance_fee_value);
        let total_shares_after = cm::add(total_after_mgmt,performance_fee_shares);

        let treasury_configured = Self::protocol_treasury_internal(env).is_some();
        let protocol_policy = Self::protocol_fee_policy_internal(env);
        let protocol_mgmt_shares = if treasury_configured {
            cm::div(cm::mul(management_fee_shares,protocol_policy.mgmt_protocol_bps as i128),10_000i128)
        } else {
            0
        };
        let protocol_perf_shares = if treasury_configured {
            cm::div(cm::mul(performance_fee_shares,protocol_policy.perf_protocol_bps as i128),10_000i128)
        } else {
            0
        };
        let protocol_fee_shares = cm::add(protocol_mgmt_shares,protocol_perf_shares);
        let manager_fee_shares =
            cm::sub(cm::add(management_fee_shares,performance_fee_shares),protocol_fee_shares);

        let share_price_after = Self::share_price_scaled(nav, total_shares_after);
        let high_water_mark_after = if share_price_after > high_water_mark_before {
            share_price_after
        } else {
            high_water_mark_before
        };

        FeeSettlement {
            timestamp: now,
            nav,
            total_shares_before,
            share_price_before,
            management_fee_value,
            management_fee_shares,
            performance_fee_value,
            performance_fee_shares,
            manager_fee_shares,
            protocol_fee_shares,
            total_shares_after,
            share_price_after,
            high_water_mark_before,
            high_water_mark_after,
        }
    }

    fn settle_fees_internal(env: &Env) -> FeeSettlement {
        let preview = Self::preview_fee_settlement_internal(env);
        let store = crate::compact_storage::instance(&env);
        let mut state = Self::fee_state_internal(env);

        if preview.manager_fee_shares > 0 {
            let manager: Address = store
                .get(&DataKey::Manager)
                .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
            Self::mint_shares_to(env, &manager, preview.manager_fee_shares);
            state.cumulative_manager_shares += preview.manager_fee_shares;
        }

        if preview.protocol_fee_shares > 0 {
            if let Some(treasury) = Self::protocol_treasury_internal(env) {
                Self::mint_shares_to(env, &treasury, preview.protocol_fee_shares);
                state.cumulative_protocol_shares += preview.protocol_fee_shares;
            }
        }

        state.last_settlement_ts = preview.timestamp;
        state.high_water_mark = preview.high_water_mark_after;
        state.cumulative_management_shares += preview.management_fee_shares;
        state.cumulative_performance_shares += preview.performance_fee_shares;
        store.set(&DataKey::FeeState, &state);
        // Fee settlement changes ownership, not the assets held by the Arka.
        // Reuse the NAV already calculated by the preview instead of executing
        // a second full Blend and oracle valuation pass.
        store.set(&DataKey::Aum, &preview.nav);

        if preview.management_fee_shares > 0 || preview.performance_fee_shares > 0 {
            env.events().publish(
                (EVENT_FEE,),
                (
                    preview.management_fee_shares,
                    preview.performance_fee_shares,
                    preview.manager_fee_shares,
                    preview.protocol_fee_shares,
                    preview.share_price_after,
                ),
            );
        }

        preview
    }

    fn settle_fees_if_accrual_enabled(env: &Env) {
        let fees = Self::fees(env.clone());
        // A fee-free Arka has no shares to accrue. Avoid redundant NAV
        // valuations before a capital or credit action.
        if fees.mgmt_bps == 0 && fees.perf_bps == 0 {
            return;
        }
        Self::settle_fees_internal(env);
    }

    fn settle_fees_for_credit_action(env: &Env) {
        Self::settle_fees_if_accrual_enabled(env);
    }

    fn track_asset(env: &Env, asset: &Address) {
        let tracked_key = DataKey::TrackedAssets;
        let mut tracked: Vec<Address> =
            Self::dynamic_get(env, &tracked_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in tracked.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            tracked.push_back(asset.clone());
            Self::dynamic_set(env, &tracked_key, &tracked);
        }
    }

    fn credit_protocol_event_code(protocol: &CreditProtocol) -> u32 {
        match protocol {
            CreditProtocol::Blend => 0,
        }
    }

    fn liquid_balance_internal(env: &Env, asset: &Address) -> i128 {
        let key = DataKey::LiquidBalance(asset.clone());
        Self::dynamic_get(env, &key).unwrap_or(0)
    }

    fn set_liquid_balance(env: &Env, asset: &Address, amount: i128) {
        Self::track_asset(env, asset);
        let key = DataKey::LiquidBalance(asset.clone());
        if amount == 0 {
            Self::dynamic_remove(env, &key);
            return;
        }
        Self::dynamic_set(env, &key, &amount);
    }

    fn add_liquid_balance(env: &Env, asset: &Address, delta: i128) {
        let next = cm::add(Self::liquid_balance_internal(env,asset),delta);
        if next < 0 {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        Self::set_liquid_balance(env, asset, next);
    }

    fn add_blend_market(env: &Env, market_id: u128) {
        let markets_key = DataKey::BlendMarkets;
        let mut markets: Vec<u128> = Self::dynamic_get(env, &markets_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in markets.iter() {
            if existing == market_id {
                found = true;
                break;
            }
        }
        if !found {
            markets.push_back(market_id);
            Self::dynamic_set(env, &markets_key, &markets);
        }
    }

    fn remove_blend_market(env: &Env, market_id: u128) {
        let markets_key = DataKey::BlendMarkets;
        let markets: Vec<u128> = Self::dynamic_get(env, &markets_key).unwrap_or(Vec::new(env));
        let mut next: Vec<u128> = Vec::new(env);
        for existing in markets.iter() {
            if existing != market_id {
                next.push_back(existing);
            }
        }
        if next.is_empty() {
            Self::dynamic_remove(env, &markets_key);
        } else {
            Self::dynamic_set(env, &markets_key, &next);
        }
    }

    fn add_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let assets_key = DataKey::BlendMarketAssets(market_id);
        let mut assets: Vec<Address> = Self::dynamic_get(env, &assets_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in assets.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            assets.push_back(asset.clone());
            Self::dynamic_set(env, &assets_key, &assets);
        }
        Self::add_blend_market(env, market_id);
    }

    fn remove_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let assets_key = DataKey::BlendMarketAssets(market_id);
        let assets: Vec<Address> = Self::dynamic_get(env, &assets_key).unwrap_or(Vec::new(env));
        let mut next: Vec<Address> = Vec::new(env);
        for existing in assets.iter() {
            if existing != *asset {
                next.push_back(existing);
            }
        }
        if next.is_empty() {
            Self::dynamic_remove(env, &assets_key);
            Self::remove_blend_market(env, market_id);
        } else {
            Self::dynamic_set(env, &assets_key, &next);
        }
    }

    fn read_blend_market_assets_internal(env: &Env, market_id: u128) -> Vec<Address> {
        let key = DataKey::BlendMarketAssets(market_id);
        Self::dynamic_get(env, &key).unwrap_or(Vec::new(env))
    }

    fn read_blend_position_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPosition> {
        let key = DataKey::BlendPosition(market_id, asset.clone());
        Self::dynamic_get(env, &key)
    }

    fn write_blend_position(env: &Env, position: &BlendPosition) {
        let key = DataKey::BlendPosition(position.market_id, position.asset.clone());
        if position.collateral_amount == 0 && position.debt_amount == 0 {
            Self::dynamic_remove(env, &key);
            Self::remove_blend_market_asset(env, position.market_id, &position.asset);
            return;
        }
        Self::add_blend_market_asset(env, position.market_id, &position.asset);
        Self::dynamic_set(env, &key, position);
    }

    fn read_blend_adapter_internal(env: &Env, market_id: u128) -> Option<Address> {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_get(env, &key)
    }

    fn write_blend_adapter(env: &Env, market_id: u128, adapter: &Address) {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_set(env, &key, adapter);
    }

    fn clear_blend_adapter(env: &Env, market_id: u128) {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_remove(env, &key);
    }

    fn add_credit_protocol(env: &Env, protocol: &CreditProtocol) {
        let protocols_key = DataKey::CreditProtocols;
        let mut protocols: Vec<CreditProtocol> =
            Self::dynamic_get(env, &protocols_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in protocols.iter() {
            if existing == *protocol {
                found = true;
                break;
            }
        }
        if !found {
            protocols.push_back(protocol.clone());
            Self::dynamic_set(env, &protocols_key, &protocols);
        }
    }

    fn read_credit_markets_internal(env: &Env, protocol: &CreditProtocol) -> Vec<u128> {
        let key = DataKey::CreditMarkets(protocol.clone());
        Self::dynamic_get(env, &key).unwrap_or(Vec::new(env))
    }

    fn add_credit_market(env: &Env, protocol: &CreditProtocol, market_id: u128) {
        let mut markets = Self::read_credit_markets_internal(env, protocol);
        let mut found = false;
        for existing in markets.iter() {
            if existing == market_id {
                found = true;
                break;
            }
        }
        if !found {
            markets.push_back(market_id);
            let key = DataKey::CreditMarkets(protocol.clone());
            Self::dynamic_set(env, &key, &markets);
        }
        Self::add_credit_protocol(env, protocol);
    }

    fn write_credit_market_config(env: &Env, config: &CreditMarketConfig) {
        Self::add_credit_market(env, &config.protocol, config.market_id);
        let key = DataKey::CreditMarketConfig(config.protocol.clone(), config.market_id);
        Self::dynamic_set(env, &key, config);
    }

    fn read_credit_market_config_internal(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketConfig> {
        let key = DataKey::CreditMarketConfig(protocol.clone(), market_id);
        Self::dynamic_get(env, &key)
    }

    fn read_credit_borrow_policy_internal(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
        asset: &Address,
    ) -> Option<CreditBorrowPolicy> {
        let key = DataKey::CreditBorrowPolicy(protocol.clone(), market_id, asset.clone());
        Self::dynamic_get(env, &key)
    }

    fn assert_credit_borrow_policy(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
        asset: &Address,
        current_debt: i128,
        amount: i128,
    ) {
        let policy = match Self::read_credit_borrow_policy_internal(env, protocol, market_id, asset)
        {
            Some(policy) if policy.enabled => policy,
            _ => panic_with_error!(env, Error::CreditBorrowPolicyNotConfigured),
        };
        if amount > policy.max_borrow_per_action || amount > policy.max_debt_for_asset {
            panic_with_error!(env, Error::CreditBorrowLimitExceeded);
        }
        if current_debt < 0 || current_debt > cm::sub(policy.max_debt_for_asset,amount) {
            panic_with_error!(env, Error::CreditBorrowLimitExceeded);
        }
    }

    fn read_credit_market_configs_internal(
        env: &Env,
        protocol: &CreditProtocol,
    ) -> Vec<CreditMarketConfig> {
        let mut configs = Vec::new(env);
        for market_id in Self::read_credit_markets_internal(env, protocol).iter() {
            if let Some(config) = Self::read_credit_market_config_internal(env, protocol, market_id)
            {
                configs.push_back(config);
            }
        }
        configs
    }

    fn require_credit_market_config(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
    ) -> CreditMarketConfig {
        match Self::read_credit_market_config_internal(env, protocol, market_id) {
            Some(config) if config.enabled => config,
            _ => panic_with_error!(env, Error::CreditMarketNotConfigured),
        }
    }

    fn assert_credit_action_allowed(env: &Env, config: &CreditMarketConfig, action: &CreditAction) {
        let allowed = match action {
            CreditAction::Supply => config.allow_supply,
            CreditAction::Borrow => config.allow_borrow,
            CreditAction::Repay => config.allow_repay,
            CreditAction::Withdraw => config.allow_withdraw,
        };
        if !allowed {
            panic_with_error!(env, Error::CreditActionNotAllowed);
        }
    }

    fn require_legacy_blend_market_action(
        env: &Env,
        adapter: &Address,
        market_id: u128,
        action: &CreditAction,
    ) -> CreditMarketConfig {
        let config = Self::require_credit_market_config(env, &CreditProtocol::Blend, market_id);
        if config.adapter != *adapter {
            panic_with_error!(env, Error::SwapVenueNotAllowed);
        }
        Self::assert_credit_action_allowed(env, &config, action);
        config
    }

    fn default_blend_risk_policy(market_id: u128) -> BlendRiskPolicy {
        BlendRiskPolicy {
            market_id,
            max_oracle_age: DEFAULT_BLEND_MAX_ORACLE_AGE,
            min_health_factor: DEFAULT_BLEND_MIN_HEALTH_FACTOR,
            fail_close_nav: true,
            fail_close_actions: true,
        }
    }

    fn read_blend_risk_policy_internal(env: &Env, market_id: u128) -> BlendRiskPolicy {
        let key = DataKey::BlendRiskPolicy(market_id);
        Self::dynamic_get(env, &key).unwrap_or(Self::default_blend_risk_policy(market_id))
    }

    fn read_blend_external_diagnostics_internal(env: &Env, market_id: u128) -> bool {
        let key = DataKey::BlendExternalDiagnostics(market_id);
        Self::dynamic_get(env, &key).unwrap_or(true)
    }

    fn read_blend_v2_risk_source_internal(env: &Env, market_id: u128) -> Option<BlendV2RiskSource> {
        let key = DataKey::BlendV2RiskSource(market_id);
        Self::dynamic_get(env, &key)
    }

    fn assert_blend_v2_risk_source(env: &Env, market_id: u128, adapter: &Address) -> Address {
        if !Self::read_blend_external_diagnostics_internal(env, market_id) {
            panic_with_error!(env, Error::BlendV2RiskSourceNotConfigured);
        }
        let source = match Self::read_blend_v2_risk_source_internal(env, market_id) {
            Some(source) => source,
            None => panic_with_error!(env, Error::BlendV2RiskSourceNotConfigured),
        };
        let router = Self::read_blend_router(env, adapter);
        let args = vec![env, router.clone().into_val(env)];
        let verified: bool =
            env.invoke_contract(&source.pool_factory, &soroban_sdk::symbol_short!("is_pool"), args);
        if !verified {
            panic_with_error!(env, Error::BlendV2PoolNotVerified);
        }
        router
    }

    fn blend_pool_blocks_risky_actions(env: &Env, market_id: u128, pool_status: u32) -> bool {
        // Preserve the conservative legacy action policy. A verified V2
        // source admits both Active states (0 admin, 1 permissionless).
        if Self::read_blend_v2_risk_source_internal(env, market_id).is_some() {
            pool_status > 1
        } else {
            pool_status != 0
        }
    }

    fn blend_pool_blocks_nav(pool_status: u32) -> bool {
        // Active (0/1) and On-Ice (2/3) positions can still be valued. On-Ice
        // restricts new borrowing; it does not invalidate fresh reserve and
        // oracle data. Keep NAV fail-closed for Frozen (4/5), Setup (6), and
        // unknown statuses until a separate valuation policy is approved.
        pool_status > 3
    }

    fn assert_blend_risk_policy(env: &Env, max_oracle_age: u64, min_health_factor: i128) {
        if max_oracle_age == 0 || min_health_factor < 0 {
            panic_with_error!(env, Error::InvalidBlendRiskPolicy);
        }
    }

    fn default_swap_risk_policy() -> SwapRiskPolicy {
        SwapRiskPolicy {
            enabled: false,
            oracle_checks_enabled: false,
            max_price_impact_bps: DEFAULT_SWAP_MAX_PRICE_IMPACT_BPS,
            max_slippage_bps: DEFAULT_SWAP_MAX_SLIPPAGE_BPS,
            max_twap_deviation_bps: DEFAULT_SWAP_MAX_TWAP_DEVIATION_BPS,
            max_oracle_age_seconds: DEFAULT_SWAP_MAX_ORACLE_AGE_SECONDS,
            max_trade_size_bps: DEFAULT_SWAP_MAX_TRADE_SIZE_BPS_OF_LIQUIDITY,
        }
    }

    fn read_swap_risk_policy_internal(env: &Env) -> SwapRiskPolicy {
        crate::compact_storage::instance(&env)
            .get(&DataKey::SwapRiskPolicy)
            .unwrap_or(Self::default_swap_risk_policy())
    }

    fn read_swap_oracle_internal(env: &Env) -> Option<Address> {
        crate::compact_storage::instance(&env).get(&DataKey::SwapOracle)
    }

    fn read_valuation_oracle_config_internal(env: &Env) -> Option<ValuationOracleConfig> {
        crate::compact_storage::instance(&env)
            .get(&DataKey::ValuationOracleConfig)
    }

    fn require_valuation_oracle_config(env: &Env) -> ValuationOracleConfig {
        Self::read_valuation_oracle_config_internal(env)
            .unwrap_or_else(|| panic_with_error!(env, Error::ValuationOracleNotConfigured))
    }

    fn read_allowed_routers_internal(env: &Env) -> Vec<Address> {
        crate::compact_storage::instance(&env)
            .get(&DataKey::AllowedRouters)
            .unwrap_or(Vec::new(env))
    }

    fn read_allowed_adapters_internal(env: &Env) -> Vec<Address> {
        crate::compact_storage::instance(&env)
            .get(&DataKey::AllowedAdapters)
            .unwrap_or(Vec::new(env))
    }

    fn read_venue_registry_internal(env: &Env) -> Option<Address> {
        crate::compact_storage::instance(&env).get(&DataKey::VenueRegistry)
    }

    fn assert_global_venue_allowed(env: &Env, venue: &Address) {
        if let Some(registry) = Self::read_venue_registry_internal(env) {
            let args = vec![env, venue.clone().into_val(env)];
            let allowed: bool =
                env.invoke_contract(&registry, &Symbol::new(env, "is_allowed"), args);
            if !allowed {
                panic_with_error!(env, Error::SwapVenueNotAllowed);
            }
        }
    }

    fn assert_global_venue_auto_allowed(env: &Env, venue: &Address) {
        if let Some(registry) = Self::read_venue_registry_internal(env) {
            let args = vec![env, venue.clone().into_val(env)];
            let allowed: bool =
                env.invoke_contract(&registry, &Symbol::new(env, "is_auto_allowed"), args);
            if !allowed {
                panic_with_error!(env, Error::SwapVenueNotAllowed);
            }
        }
    }

    fn assert_global_venue_exit_allowed(env: &Env, venue: &Address) {
        if let Some(registry) = Self::read_venue_registry_internal(env) {
            let allowed: bool = env.invoke_contract(&registry, &Symbol::new(env, "is_exit_allowed"), vec![env, venue.clone().into_val(env)]);
            if !allowed { panic_with_error!(env, Error::SwapVenueNotAllowed); }
        }
    }

    fn assert_swap_risk_policy(env: &Env, policy: &SwapRiskPolicy) {
        if !(0..=10_000).contains(&policy.max_price_impact_bps)
            || !(0..=10_000).contains(&policy.max_slippage_bps)
            || !(0..=10_000).contains(&policy.max_twap_deviation_bps)
            || !(1..=10_000).contains(&policy.max_trade_size_bps)
            || policy.max_oracle_age_seconds == 0
        {
            panic_with_error!(env, Error::InvalidSwapRiskPolicy);
        }
    }

    fn assert_address_allowed_or_fail(env: &Env, allowed: Vec<Address>, candidate: &Address) {
        if allowed.is_empty() {
            return;
        }
        for value in allowed.iter() {
            if value == *candidate {
                return;
            }
        }
        panic_with_error!(env, Error::SwapVenueNotAllowed);
    }

    fn positive_bps_loss(value_in: i128, value_out: i128) -> i32 {
        if value_in <= 0 || value_out >= value_in {
            return 0;
        }
        let loss = cm::sub(value_in,value_out);
        (cm::div(cm::mul(loss,10_000i128),value_in)) as i32
    }

    fn value_with_oracle_price(env: &Env, amount: i128, price: i128) -> i128 {
        if amount <= 0 || price <= 0 {
            panic_with_error!(env, Error::SwapOracleInvalid);
        }
        match amount.checked_mul(price) {
            Some(value) => value,
            None => panic_with_error!(env, Error::SwapOracleInvalid),
        }
    }

    fn assert_valuation_price_usable(env: &Env, price: &OraclePriceData, max_price_age: u64) {
        let now = env.ledger().timestamp();
        if price.price <= 0 || price.timestamp == 0 || price.timestamp > now {
            panic_with_error!(env, Error::ValuationOracleInvalid);
        }
        if now - price.timestamp > max_price_age {
            panic_with_error!(env, Error::ValuationOracleStale);
        }
    }

    fn checked_value_in_denom_units(
        env: &Env,
        amount: i128,
        asset_price: i128,
        denomination_price: i128,
    ) -> i128 {
        if amount < 0 || asset_price <= 0 || denomination_price <= 0 {
            panic_with_error!(env, Error::ValuationOracleInvalid);
        }
        let numerator = amount
            .checked_mul(asset_price)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow));
        cm::div(numerator,denomination_price)
    }

    fn value_asset_amount_in_denom(
        env: &Env,
        asset: &Address,
        amount: i128,
        denomination: &Asset,
    ) -> i128 {
        if amount < 0 {
            panic_with_error!(env, Error::ValuationOracleInvalid);
        }
        if amount == 0 || *asset == denomination.contract {
            return amount;
        }

        let config = Self::require_valuation_oracle_config(env);
        if config.max_price_age == 0 {
            panic_with_error!(env, Error::ValuationOracleInvalid);
        }
        let denomination_price =
            Self::read_oracle_last_price(env, &config.oracle, &denomination.contract);
        let asset_price = Self::read_oracle_last_price(env, &config.oracle, asset);
        Self::assert_valuation_price_usable(env, &denomination_price, config.max_price_age);
        Self::assert_valuation_price_usable(env, &asset_price, config.max_price_age);
        Self::checked_value_in_denom_units(env, amount, asset_price.price, denomination_price.price)
    }

    fn enforce_swap_risk_policy_for_step(
        env: &Env,
        s: &SwapStep,
        internal_router: &Address,
        auto_execution: bool,
        withdrawal_base: Option<i128>,
    ) {
        Self::assert_asset_allowed(env, &s.asset_in.contract);
        Self::assert_asset_allowed(env, &s.asset_out.contract);

        let venue = if s.router_addr == *internal_router {
            s.adapter.clone()
        } else {
            s.router_addr.clone()
        };
        if auto_execution {
            Self::assert_global_venue_auto_allowed(env, &venue);
        } else {
            Self::assert_global_venue_allowed(env, &venue);
        }

        let policy = Self::read_swap_risk_policy_internal(env);
        if !policy.enabled {
            return;
        }

        if s.router_addr == *internal_router {
            Self::assert_address_allowed_or_fail(
                env,
                Self::read_allowed_adapters_internal(env),
                &s.adapter,
            );
        } else {
            Self::assert_address_allowed_or_fail(
                env,
                Self::read_allowed_routers_internal(env),
                &s.router_addr,
            );
        }

        let liquid = withdrawal_base.unwrap_or_else(|| Self::liquid_balance_internal(env, &s.asset_in.contract));
        let max_allowed = cm::div(cm::mul(liquid,policy.max_trade_size_bps as i128),10_000i128);
        if s.amount_in > max_allowed {
            panic_with_error!(env, Error::SwapTradeSizeExceeded);
        }

        if !policy.oracle_checks_enabled {
            return;
        }

        let oracle = match Self::read_swap_oracle_internal(env) {
            Some(value) => value,
            None => panic_with_error!(env, Error::SwapOracleNotConfigured),
        };
        let price_in = Self::read_oracle_last_price(env, &oracle, &s.asset_in.contract);
        let price_out = Self::read_oracle_last_price(env, &oracle, &s.asset_out.contract);
        let ledger_ts = env.ledger().timestamp();
        if price_in.price <= 0
            || price_out.price <= 0
            || price_in.timestamp > ledger_ts
            || price_out.timestamp > ledger_ts
        {
            panic_with_error!(env, Error::SwapOracleInvalid);
        }
        if (ledger_ts - price_in.timestamp) > policy.max_oracle_age_seconds
            || (ledger_ts - price_out.timestamp) > policy.max_oracle_age_seconds
        {
            panic_with_error!(env, Error::SwapOracleStale);
        }

        let value_in = Self::value_with_oracle_price(env, s.amount_in, price_in.price);
        let value_out_floor = Self::value_with_oracle_price(env, s.min_out, price_out.price);
        let loss_bps = Self::positive_bps_loss(value_in, value_out_floor);

        if loss_bps > policy.max_slippage_bps {
            panic_with_error!(env, Error::SwapSlippageExceeded);
        }
        if loss_bps > policy.max_price_impact_bps {
            panic_with_error!(env, Error::SwapPriceImpactExceeded);
        }
        if loss_bps > policy.max_twap_deviation_bps {
            panic_with_error!(env, Error::SwapTwapDeviationExceeded);
        }
    }

    fn read_blend_pool_config(env: &Env, router: &Address) -> BlendPoolConfig {
        env.invoke_contract::<BlendPoolConfig>(router, &Symbol::new(env, "get_config"), vec![env])
    }

    fn read_blend_pool_positions(
        env: &Env,
        router: &Address,
        owner: &Address,
    ) -> BlendPoolPositions {
        let args = vec![env, owner.clone().into_val(env)];
        env.invoke_contract::<BlendPoolPositions>(router, &Symbol::new(env, "get_positions"), args)
    }

    fn read_blend_reserve(env: &Env, router: &Address, asset: &Address) -> BlendReserve {
        let args = vec![env, asset.clone().into_val(env)];
        env.invoke_contract::<BlendReserve>(router, &Symbol::new(env, "get_reserve"), args)
    }

    fn read_blend_collateral_amount(env: &Env, adapter: &Address, asset: &Address) -> i128 {
        let router = Self::read_blend_router(env, adapter);
        let positions =
            Self::read_blend_pool_positions(env, &router, &env.current_contract_address());
        let reserve = Self::read_blend_reserve(env, &router, asset);
        let shares = positions.collateral.get(reserve.config.index).unwrap_or(0);
        Self::convert_position_shares_to_amount(shares, reserve.data.b_rate)
    }

    fn read_blend_debt_amount(env: &Env, adapter: &Address, asset: &Address) -> i128 {
        let router = Self::read_blend_router(env, adapter);
        let positions =
            Self::read_blend_pool_positions(env, &router, &env.current_contract_address());
        let reserve = Self::read_blend_reserve(env, &router, asset);
        let shares = positions.liabilities.get(reserve.config.index).unwrap_or(0);
        Self::convert_debt_shares_to_amount(shares, reserve.data.d_rate)
    }

    // Blend accounts in shares, so a historical local position can be absent
    // even though the pool still has a non-zero accrued position. Rebuild the
    // local accounting from the canonical pool state before recovery actions.
    fn reconcile_blend_position_from_pool(
        env: &Env,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
    ) -> BlendPosition {
        let mut position =
            Self::read_blend_position_internal(env, market_id, asset).unwrap_or(BlendPosition {
                market_id,
                asset: asset.clone(),
                collateral_amount: 0,
                debt_amount: 0,
            });
        if position.asset != *asset {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        position.collateral_amount = Self::read_blend_collateral_amount(env, adapter, asset);
        position.debt_amount = Self::read_blend_debt_amount(env, adapter, asset);
        position
    }

    fn read_oracle_last_price(env: &Env, oracle: &Address, asset: &Address) -> OraclePriceData {
        let args = vec![env, OracleAsset::Stellar(asset.clone()).into_val(env)];
        env.invoke_contract::<OraclePriceData>(oracle, &soroban_sdk::symbol_short!("lastprice"), args)
    }

    fn convert_position_shares_to_amount(shares: i128, rate: i128) -> i128 {
        cm::div(cm::mul(shares,rate),BLEND_RATE_SCALE)
    }

    fn convert_debt_shares_to_amount(shares: i128, rate: i128) -> i128 {
        let amount = cm::mul(shares,rate);
        if amount == 0 {
            0
        } else {
            cm::add(cm::div(cm::sub(amount,1),BLEND_RATE_SCALE),1)
        }
    }

    fn value_in_denom_units(amount: i128, asset_price: i128, denom_price: i128) -> i128 {
        if denom_price <= 0 {
            return amount;
        }
        cm::div(cm::mul(amount,asset_price),denom_price)
    }

    fn blend_position_value_from_internal(
        env: &Env,
        position: BlendPosition,
    ) -> BlendPositionValue {
        let denomination = Self::denomination(env.clone());
        let collateral_value = Self::value_asset_amount_in_denom(
            env,
            &position.asset,
            position.collateral_amount,
            &denomination,
        );
        let debt_value = Self::value_asset_amount_in_denom(
            env,
            &position.asset,
            position.debt_amount,
            &denomination,
        );
        BlendPositionValue {
            market_id: position.market_id,
            asset: position.asset,
            collateral_shares: position.collateral_amount,
            collateral_amount: position.collateral_amount,
            collateral_value,
            debt_shares: position.debt_amount,
            debt_amount: position.debt_amount,
            debt_value,
            net_value: cm::sub(collateral_value,debt_value),
            price: 0,
            health_factor: 0,
            c_factor: 0,
            oracle_timestamp: 0,
        }
    }

    fn blend_diagnostics_context_internal(
        env: &Env,
        market_id: u128,
    ) -> Option<BlendDiagnosticsContext> {
        if !Self::read_blend_external_diagnostics_internal(env, market_id) {
            return None;
        }
        let adapter = Self::read_blend_adapter_internal(env, market_id)?;
        let router = Self::read_blend_router(env, &adapter);
        let pool_config = Self::read_blend_pool_config(env, &router);
        let positions =
            Self::read_blend_pool_positions(env, &router, &env.current_contract_address());
        let denomination = Self::denomination(env.clone());
        let denomination_price =
            Self::read_oracle_last_price(env, &pool_config.oracle, &denomination.contract);
        Some(BlendDiagnosticsContext {
            router,
            pool_config,
            positions,
            denomination,
            denomination_price,
            ledger_timestamp: env.ledger().timestamp(),
        })
    }

    fn blend_position_diagnostics_from_context(
        env: &Env,
        market_id: u128,
        position: &BlendPosition,
        context: &BlendDiagnosticsContext,
    ) -> BlendPositionDiagnostics {
        let reserve = Self::read_blend_reserve(env, &context.router, &position.asset);
        let reserve_index = reserve.config.index;
        let collateral_shares = context.positions.collateral.get(reserve_index).unwrap_or(0);
        let debt_shares = context
            .positions
            .liabilities
            .get(reserve_index)
            .unwrap_or(0);
        let collateral_amount =
            Self::convert_position_shares_to_amount(collateral_shares, reserve.data.b_rate);
        let debt_amount = Self::convert_debt_shares_to_amount(debt_shares, reserve.data.d_rate);
        let asset_price = if context.denomination.contract == position.asset {
            context.denomination_price.clone()
        } else {
            Self::read_oracle_last_price(env, &context.pool_config.oracle, &position.asset)
        };
        let denom_price_data = context.denomination_price.clone();
        let has_invalid_oracle_data = asset_price.price <= 0 || denom_price_data.price <= 0;
        let has_future_oracle_timestamp = asset_price.timestamp > context.ledger_timestamp
            || denom_price_data.timestamp > context.ledger_timestamp;
        let prices_are_usable = !has_invalid_oracle_data && !has_future_oracle_timestamp;
        let collateral_value = if prices_are_usable {
            Self::value_in_denom_units(collateral_amount, asset_price.price, denom_price_data.price)
        } else {
            0
        };
        let debt_value = if prices_are_usable {
            Self::value_in_denom_units(debt_amount, asset_price.price, denom_price_data.price)
        } else {
            0
        };
        let health_factor = if debt_value == 0 {
            0
        } else {
            cm::div(cm::mul(collateral_value,reserve.config.c_factor as i128),debt_value)
        };

        BlendPositionDiagnostics {
            value: BlendPositionValue {
                market_id,
                asset: position.asset.clone(),
                collateral_shares,
                collateral_amount,
                collateral_value,
                debt_shares,
                debt_amount,
                debt_value,
                net_value: cm::sub(collateral_value,debt_value),
                price: if prices_are_usable {
                    asset_price.price
                } else {
                    0
                },
                health_factor,
                c_factor: reserve.config.c_factor,
                // Every price used in a valuation must be fresh. Reporting
                // the newer timestamp would hide an expired/missing feed.
                oracle_timestamp: asset_price.timestamp.min(denom_price_data.timestamp),
            },
            pool_status: context.pool_config.status,
            reserve_enabled: reserve.config.enabled,
            has_invalid_oracle_data,
            has_future_oracle_timestamp,
        }
    }

    fn blend_position_diagnostics_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPositionDiagnostics> {
        let position = Self::read_blend_position_internal(env, market_id, asset)?;
        let context = Self::blend_diagnostics_context_internal(env, market_id)?;
        Some(Self::blend_position_diagnostics_from_context(
            env, market_id, &position, &context,
        ))
    }

    fn blend_position_value_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPositionValue> {
        if let Some(diagnostics) = Self::blend_position_diagnostics_internal(env, market_id, asset)
        {
            return Some(diagnostics.value);
        }
        Self::read_blend_position_internal(env, market_id, asset)
            .map(|position| Self::blend_position_value_from_internal(env, position))
    }

    // Keep the market value and the associated safety signals in one pass. A status
    // check is invoked on the transaction path, so re-reading each pool reserve and
    // oracle price only to collect the flags would needlessly consume Soroban budget.
    fn blend_market_assessment_internal(
        env: &Env,
        market_id: u128,
    ) -> Option<BlendMarketAssessment> {
        let assets = Self::read_blend_market_assets_internal(env, market_id);
        if assets.is_empty() {
            return None;
        }

        let mut collateral_value = 0i128;
        let mut debt_value = 0i128;
        let mut collateral_buffer = 0i128;
        let mut oldest_oracle_timestamp: Option<u64> = None;
        let mut has_invalid_oracle_data = false;
        let mut has_future_oracle_timestamp = false;
        let mut has_disabled_reserve = false;
        let mut pool_status = 0u32;
        let external_diagnostics_enabled =
            Self::read_blend_external_diagnostics_internal(env, market_id);
        let mut diagnostics_context: Option<BlendDiagnosticsContext> = None;
        let mut diagnostics_context_initialized = false;

        for asset in assets.iter() {
            let Some(position) = Self::read_blend_position_internal(env, market_id, &asset) else {
                continue;
            };

            if external_diagnostics_enabled {
                if !diagnostics_context_initialized {
                    diagnostics_context = Self::blend_diagnostics_context_internal(env, market_id);
                    diagnostics_context_initialized = true;
                }
            }

            if let Some(context) = diagnostics_context.as_ref() {
                let diagnostics = Self::blend_position_diagnostics_from_context(
                    env, market_id, &position, context,
                );
                let position_value = diagnostics.value;
                collateral_value += position_value.collateral_value;
                debt_value += position_value.debt_value;
                collateral_buffer += cm::div(cm::mul(position_value.collateral_value,position_value.c_factor as i128),10_000_000i128);
                oldest_oracle_timestamp = Some(
                    oldest_oracle_timestamp.map_or(position_value.oracle_timestamp, |previous| {
                        previous.min(position_value.oracle_timestamp)
                    }),
                );
                if diagnostics.has_invalid_oracle_data {
                    has_invalid_oracle_data = true;
                }
                if diagnostics.has_future_oracle_timestamp {
                    has_future_oracle_timestamp = true;
                }
                if !diagnostics.reserve_enabled {
                    has_disabled_reserve = true;
                }
                if diagnostics.pool_status > pool_status {
                    pool_status = diagnostics.pool_status;
                }
            } else {
                let position_value = Self::blend_position_value_from_internal(env, position);
                collateral_value += position_value.collateral_value;
                debt_value += position_value.debt_value;
            }
        }

        let health_factor = if debt_value == 0 {
            0
        } else {
            cm::div(cm::mul(collateral_buffer,10_000_000i128),debt_value)
        };

        Some(BlendMarketAssessment {
            value: BlendMarketValue {
                market_id,
                collateral_value,
                debt_value,
                net_value: cm::sub(collateral_value,debt_value),
                health_factor,
                oracle_timestamp: oldest_oracle_timestamp.unwrap_or(0),
            },
            has_invalid_oracle_data,
            has_future_oracle_timestamp,
            has_disabled_reserve,
            pool_status,
        })
    }

    fn blend_market_value_internal(env: &Env, market_id: u128) -> Option<BlendMarketValue> {
        Self::blend_market_assessment_internal(env, market_id).map(|assessment| assessment.value)
    }

    fn blend_market_status_from_assessment(
        env: &Env,
        market_id: u128,
        assessment: &BlendMarketAssessment,
    ) -> BlendMarketStatus {
        let policy = Self::read_blend_risk_policy_internal(env, market_id);
        let external_diagnostics_enabled =
            Self::read_blend_external_diagnostics_internal(env, market_id);
        let market_value = assessment.value.clone();
        let ledger_timestamp = env.ledger().timestamp();
        let oracle_timestamp = market_value.oracle_timestamp;
        let has_live_pricing = oracle_timestamp > 0;
        let oracle_age = if has_live_pricing && ledger_timestamp >= oracle_timestamp {
            ledger_timestamp - oracle_timestamp
        } else {
            0
        };
        let health_factor = market_value.health_factor;
        let debt_value = market_value.debt_value;
        let has_stale_oracle = if external_diagnostics_enabled || debt_value > 0 {
            !has_live_pricing || oracle_age > policy.max_oracle_age
        } else {
            false
        };
        let below_min_health_factor = debt_value > 0 && health_factor < policy.min_health_factor;
        let has_invalid_oracle_data = assessment.has_invalid_oracle_data;
        let has_future_oracle_timestamp = assessment.has_future_oracle_timestamp;
        let has_disabled_reserve = assessment.has_disabled_reserve;
        let pool_status = assessment.pool_status;
        let has_integrity_failure =
            has_invalid_oracle_data || has_future_oracle_timestamp || has_disabled_reserve;
        let actions_blocked_by_pool =
            Self::blend_pool_blocks_risky_actions(env, market_id, pool_status);
        let nav_blocked_by_pool = Self::blend_pool_blocks_nav(pool_status);

        BlendMarketStatus {
            market_id,
            has_live_pricing,
            has_stale_oracle,
            has_invalid_oracle_data,
            has_future_oracle_timestamp,
            has_disabled_reserve,
            oracle_age,
            max_oracle_age: policy.max_oracle_age,
            min_health_factor: policy.min_health_factor,
            health_factor,
            debt_value,
            pool_status,
            risky_actions_blocked: (policy.fail_close_actions
                && (has_stale_oracle || has_integrity_failure || actions_blocked_by_pool))
                || below_min_health_factor,
            nav_blocked: policy.fail_close_nav
                && (has_stale_oracle || has_integrity_failure || nav_blocked_by_pool),
        }
    }

    fn blend_market_status_internal(env: &Env, market_id: u128) -> Option<BlendMarketStatus> {
        let assessment = Self::blend_market_assessment_internal(env, market_id)?;
        Some(Self::blend_market_status_from_assessment(
            env,
            market_id,
            &assessment,
        ))
    }

    fn assert_blend_risky_actions_allowed(env: &Env, market_id: u128) {
        if let Some(status) = Self::blend_market_status_internal(env, market_id) {
            if status.has_stale_oracle {
                panic_with_error!(env, Error::BlendOracleStale);
            }
            if status.has_invalid_oracle_data
                || status.has_future_oracle_timestamp
                || status.has_disabled_reserve
                || Self::blend_pool_blocks_risky_actions(env, market_id, status.pool_status)
            {
                panic_with_error!(env, Error::BlendOracleInvalid);
            }
            if status.debt_value > 0 && status.health_factor < status.min_health_factor {
                panic_with_error!(env, Error::BlendHealthFactorTooLow);
            }
            if status.risky_actions_blocked {
                panic_with_error!(env, Error::BlendOracleInvalid);
            }
        }
    }

    fn checked_add_nav(env: &Env, current: i128, value: i128) -> i128 {
        current
            .checked_add(value)
            .unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow))
    }

    fn liquid_nav_internal(env: &Env) -> i128 {
        let denomination = Self::denomination(env.clone());
        let tracked: Vec<Address> =
            Self::dynamic_get(env, &DataKey::TrackedAssets).unwrap_or(Vec::new(env));
        let mut nav = 0i128;
        for asset in tracked.iter() {
            let amount = Self::liquid_balance_internal(env, &asset);
            if amount == 0 {
                continue;
            }
            let value = Self::value_asset_amount_in_denom(env, &asset, amount, &denomination);
            nav = Self::checked_add_nav(env, nav, value);
        }
        nav
    }

    fn total_nav_internal(env: &Env) -> i128 {
        let mut nav = Self::liquid_nav_internal(env);
        let markets: Vec<u128> =
            Self::dynamic_get(env, &DataKey::BlendMarkets).unwrap_or(Vec::new(env));
        for market_id in markets.iter() {
            if let Some(assessment) = Self::blend_market_assessment_internal(env, market_id) {
                let status = Self::blend_market_status_from_assessment(env, market_id, &assessment);
                if status.nav_blocked {
                    panic_with_error!(env, Error::BlendNavUnavailable);
                }
                nav = Self::checked_add_nav(env, nav, assessment.value.net_value);
            }
        }
        nav
    }

    fn refresh_aum(env: &Env) {
        let nav = Self::total_nav_internal(env);
        crate::compact_storage::instance(&env).set(&DataKey::Aum, &nav);
    }

    fn assert_asset_allowed(env: &Env, asset: &Address) {
        let store = crate::compact_storage::instance(&env);
        let wl: Vec<Asset> = store.get(&DataKey::Whitelist).unwrap_or(Vec::new(env));
        for entry in wl.iter() {
            if entry.contract == *asset {
                return;
            }
        }
        panic_with_error!(env, Error::AssetNotWhitelisted);
    }

    fn transfer_from_user_to_vault(env: &Env, token: &Address, user: &Address, amount: i128) {
        let self_addr = env.current_contract_address();
        let args = vec![
            env,
            self_addr.clone().into_val(env),
            user.clone().into_val(env),
            self_addr.clone().into_val(env),
            amount.into_val(env),
        ];
        Self::invoke_with_contract_auth::<()>(env, token, "transfer_from", args);
    }

    fn transfer_from_vault(env: &Env, token: &Address, to: &Address, amount: i128) {
        let self_addr = env.current_contract_address();
        let args = vec![
            env,
            self_addr.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        Self::invoke_with_contract_auth::<()>(env, token, "transfer", args);
    }

    fn read_blend_router(env: &Env, adapter: &Address) -> Address {
        env.invoke_contract::<Address>(adapter, &soroban_sdk::symbol_short!("router"), vec![env])
    }

    fn invoke_blend_adapter(
        env: &Env,
        adapter: &Address,
        asset: &Address,
        action: BlendAction,
        _market_id: u128,
        amount: i128,
    ) -> i128 {
        let self_addr = env.current_contract_address();
        let router = Self::read_blend_router(env, adapter);
        let request_type = match action {
            BlendAction::Lend => 2,
            BlendAction::Withdraw => 3,
            BlendAction::Borrow => 4,
            BlendAction::Repay => 5,
        };
        let requests = vec![
            env,
            BlendRequest {
                address: asset.clone(),
                amount,
                request_type,
            },
        ];
        let router_args = vec![
            env,
            self_addr.clone().into_val(env),
            self_addr.clone().into_val(env),
            self_addr.clone().into_val(env),
            requests.into_val(env),
        ];
        let mut auths = vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: router.clone(),
                    fn_name: soroban_sdk::symbol_short!("submit"),
                    args: router_args.clone(),
                },
                sub_invocations: vec![env],
            }),
        ];
        if matches!(action, BlendAction::Lend | BlendAction::Repay) {
            auths.push_back(InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: asset.clone(),
                    fn_name: symbol_short!("transfer"),
                    args: vec![
                        env,
                        self_addr.clone().into_val(env),
                        router.clone().into_val(env),
                        amount.into_val(env),
                    ],
                },
                sub_invocations: vec![env],
            }));
        }
        let balance_before = if matches!(action, BlendAction::Withdraw | BlendAction::Borrow) {
            Some(Self::token_balance(env, asset, &self_addr))
        } else {
            None
        };
        env.authorize_as_current_contract(auths);
        let _: Val = env.invoke_contract(&router, &soroban_sdk::symbol_short!("submit"), router_args);
        if let Some(before) = balance_before {
            let after = Self::token_balance(env, asset, &self_addr);
            if after <= before {
                panic_with_error!(env, Error::InsufficientLiquidity);
            }
            return cm::sub(after,before);
        }
        amount
    }

    pub fn init(
        env: Env,
        denomination_contract: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
        whitelist_contracts: Vec<Address>,
        manager: Address,
    ) {
        Self::assert_fee_bps(&env, mgmt_bps);
        Self::assert_fee_bps(&env, perf_bps);
        Self::assert_fee_bps(&env, deposit_bps);
        Self::assert_fee_bps(&env, redeem_bps);

        let store = crate::compact_storage::instance(&env);
        if store.has(&DataKey::Denomination) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        if store.get::<DataKey, Address>(&DataKey::Manager) != Some(manager.clone()) {
            panic_with_error!(&env, Error::UnauthorizedPolicy);
        }
        manager.require_auth();
        let denomination = Asset {
            contract: denomination_contract.clone(),
        };
        let fees = FeeStructure {
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
        };
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset {
                contract: addr.clone(),
            });
            Self::track_asset(&env, &addr);
        }
        Self::track_asset(&env, &denomination_contract);
        store.set(&DataKey::Denomination, &denomination);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::Whitelist, &wl_assets);
        store.set(&DataKey::Manager, &manager);
        // A newly initialized Arka has no shares; the existing reader defaults
        // to zero. Persist the first actual supply change, not this empty slot.
        store.set(&DataKey::ShareAccountingVersion, &2u32);
        // Aum is a derived cache, written by NAV/fee/capital operations. There
        // is no read of this cache in the contract; do not rent a zero cache.
        store.set(
            &DataKey::FeeState,
            &FeeState {
                last_settlement_ts: env.ledger().timestamp(),
                high_water_mark: SHARE_PRICE_SCALE,
                cumulative_management_shares: 0,
                cumulative_performance_shares: 0,
                cumulative_manager_shares: 0,
                cumulative_protocol_shares: 0,
            },
        );
        store.set(
            &DataKey::ProtocolFeePolicy,
            &ProtocolFeePolicy {
                mgmt_protocol_bps: 0,
                perf_protocol_bps: 0,
            },
        );
        store.set(&DataKey::SwapRiskPolicy, &Self::default_swap_risk_policy());
        store.set(&DataKey::AllowedRouters, &Vec::<Address>::new(&env));
        store.set(&DataKey::AllowedAdapters, &Vec::<Address>::new(&env));
        env.events().publish(
            (EVENT_INIT,),
            (
                manager,
                denomination_contract,
                whitelist_contracts,
                mgmt_bps,
                perf_bps,
                deposit_bps,
                redeem_bps,
            ),
        );
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        let store = crate::compact_storage::instance(&env);
        if let Some(current_governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if caller != current_governor {
                panic_with_error!(&env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
        } else {
            let manager: Address = match store.get(&DataKey::Manager) {
                Some(m) => m,
                None => panic_with_error!(&env, Error::NotInitialized),
            };
            if caller != manager {
                panic_with_error!(&env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
        }
        store.set(&DataKey::Governor, &governor);
        env.events()
            .publish((EVENT_GOVERNOR_SET,), (caller, governor));
    }

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        let can_bootstrap_update = Self::bootstrap_admin_active_internal(&env)
            && crate::compact_storage::instance(&env)
                .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
                .is_some();
        if can_bootstrap_update {
            Self::require_bootstrap_or_governor_auth(&env, &caller);
        } else {
            Self::require_policy_auth(&env, &caller);
        }
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = crate::compact_storage::instance(&env);
        if let Some(current_expires_at) =
            store.get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        if let Some(current_expires_at) = crate::compact_storage::instance(&env)
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        crate::compact_storage::instance(&env)
            .set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin(env: Env, caller: Address) {
        Self::require_governor_caller_auth(&env, &caller);
        let store = crate::compact_storage::instance(&env);
        store.remove(&DataKey::BootstrapAdmin);
        store.remove(&DataKey::BootstrapAdminExpiresAt);
    }

    pub fn bootstrap_admin(env: Env) -> Option<Address> {
        crate::compact_storage::instance(&env)
            .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        crate::compact_storage::instance(&env)
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::managed_assert_no_obligations(&env);
        crate::compact_storage::instance(&env)
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        crate::compact_storage::instance(&env)
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn set_fees(
        env: Env,
        caller: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        Self::settle_fees_internal(&env);
        Self::assert_fee_bps(&env, mgmt_bps);
        Self::assert_fee_bps(&env, perf_bps);
        Self::assert_fee_bps(&env, deposit_bps);
        Self::assert_fee_bps(&env, redeem_bps);
        let fees = FeeStructure {
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
        };
        crate::compact_storage::instance(&env).set(&DataKey::Fees, &fees);
        env.events().publish(
            (EVENT_FEES_CFG,),
            (caller, mgmt_bps, perf_bps, deposit_bps, redeem_bps),
        );
    }

    pub fn set_protocol_fee_policy(
        env: Env,
        caller: Address,
        treasury: Address,
        mgmt_protocol_bps: i32,
        perf_protocol_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::settle_fees_internal(&env);
        Self::assert_protocol_fee_bps(&env, mgmt_protocol_bps);
        Self::assert_protocol_fee_bps(&env, perf_protocol_bps);
        crate::compact_storage::instance(&env)
            .set(&DataKey::ProtocolTreasury, &treasury);
        crate::compact_storage::instance(&env).set(
            &DataKey::ProtocolFeePolicy,
            &ProtocolFeePolicy {
                mgmt_protocol_bps,
                perf_protocol_bps,
            },
        );
        env.events().publish(
            (EVENT_PROTOCOL_FEE_CFG,),
            (caller, treasury, mgmt_protocol_bps, perf_protocol_bps),
        );
    }

    pub fn set_whitelist(env: Env, caller: Address, whitelist_contracts: Vec<Address>) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset {
                contract: addr.clone(),
            });
            Self::track_asset(&env, &addr);
        }
        crate::compact_storage::instance(&env)
            .set(&DataKey::Whitelist, &wl_assets);
        env.events()
            .publish((EVENT_WHITELIST_CFG,), (caller, whitelist_contracts));
    }

    pub fn set_swap_risk_policy(
        env: Env,
        caller: Address,
        enabled: bool,
        oracle_checks_enabled: bool,
        max_price_impact_bps: i32,
        max_slippage_bps: i32,
        max_twap_deviation_bps: i32,
        max_oracle_age_seconds: u64,
        max_trade_size_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        let policy = SwapRiskPolicy {
            enabled,
            oracle_checks_enabled,
            max_price_impact_bps,
            max_slippage_bps,
            max_twap_deviation_bps,
            max_oracle_age_seconds,
            max_trade_size_bps,
        };
        Self::assert_swap_risk_policy(&env, &policy);
        crate::compact_storage::instance(&env)
            .set(&DataKey::SwapRiskPolicy, &policy);
        env.events()
            .publish((EVENT_SWAP_POLICY_CFG,), (caller, policy));
    }

    pub fn set_swap_oracle(env: Env, caller: Address, oracle: Address) {
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env).set(&DataKey::SwapOracle, &oracle);
        env.events()
            .publish((EVENT_SWAP_ORACLE_SET,), (caller, oracle));
    }

    pub fn set_valuation_oracle(env: Env, caller: Address, oracle: Address, max_price_age: u64) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        if max_price_age == 0 {
            panic_with_error!(&env, Error::ValuationOracleInvalid);
        }
        let config = ValuationOracleConfig {
            oracle: oracle.clone(),
            max_price_age,
        };
        crate::compact_storage::instance(&env)
            .set(&DataKey::ValuationOracleConfig, &config);
        env.events().publish(
            (EVENT_VALUATION_ORACLE_SET,),
            (caller, oracle, max_price_age),
        );
    }

    pub fn share_accounting_version(env: Env) -> u32 {
        Self::share_accounting_version_internal(&env)
    }

    // Enables denomination-valued multi-asset accounting for a legacy Arka
    // without redistributing ownership. The complete holder set and each
    // holder's exact live balance must be supplied; any mismatch fails the
    // transaction atomically.
    pub fn migrate_share_accounting(env: Env, caller: Address, targets: Vec<ShareBalanceTarget>) {
        Self::managed_assert_legacy_mode(&env);
        Self::migrate_share_accounting_internal(env, caller, targets, 0);
    }

    // Reconciles legacy internal shares that were never backed by live share
    // tokens. The governed caller must declare the exact unbacked amount;
    // live holder balances are still verified one by one.
    pub fn reconcile_legacy_shares(
        env: Env,
        caller: Address,
        targets: Vec<ShareBalanceTarget>,
        expected_unbacked_shares: i128,
    ) {
        if expected_unbacked_shares <= 0 {
            panic_with_error!(&env, Error::InvalidShareMigration);
        }
        Self::migrate_share_accounting_internal(env, caller, targets, expected_unbacked_shares);
    }

    fn migrate_share_accounting_internal(
        env: Env,
        caller: Address,
        targets: Vec<ShareBalanceTarget>,
        expected_unbacked_shares: i128,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        if Self::share_accounting_version_internal(&env) >= 2 {
            panic_with_error!(&env, Error::ShareAccountingAlreadyMigrated);
        }

        let total_before = Self::total_shares_internal(&env);
        let mut current_sum = 0i128;
        let mut target_sum = 0i128;
        let mut seen_holders = Vec::<Address>::new(&env);
        for target in targets.iter() {
            if target.balance < 0 {
                panic_with_error!(&env, Error::InvalidShareMigration);
            }
            for previous_holder in seen_holders.iter() {
                if previous_holder == target.holder {
                    panic_with_error!(&env, Error::InvalidShareMigration);
                }
            }
            seen_holders.push_back(target.holder.clone());
            let current =
                Self::maybe_share_token_balance(&env, &target.holder).unwrap_or_else(|| {
                    Self::dynamic_get(&env, &DataKey::Balance(target.holder.clone())).unwrap_or(0)
                });
            if (total_before > 0 && current <= 0) || target.balance != current {
                panic_with_error!(&env, Error::InvalidShareMigration);
            }
            current_sum = current_sum
                .checked_add(current)
                .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
            target_sum = target_sum
                .checked_add(target.balance)
                .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
        }
        let reconciled_total = target_sum
            .checked_add(expected_unbacked_shares)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
        if current_sum != target_sum
            || reconciled_total != total_before
            || (total_before > 0 && target_sum <= 0)
            || (total_before == 0
                && (!targets.is_empty() || target_sum != 0 || expected_unbacked_shares != 0))
        {
            panic_with_error!(&env, Error::InvalidShareMigration);
        }

        let nav = Self::total_nav_internal(&env);
        let mut fee_state = Self::fee_state_internal(&env);
        fee_state.last_settlement_ts = env.ledger().timestamp();
        fee_state.high_water_mark = Self::share_price_scaled(nav, target_sum);
        let store = crate::compact_storage::instance(&env);
        store.set(&DataKey::TotalShares, &target_sum);
        store.set(&DataKey::FeeState, &fee_state);
        store.set(&DataKey::Aum, &nav);
        store.set(&DataKey::ShareAccountingVersion, &2u32);
        env.events().publish(
            (EVENT_SHARE_ACCOUNTING_MIGRATED,),
            (caller, total_before, target_sum, nav),
        );
    }

    pub fn set_allowed_venues(
        env: Env,
        caller: Address,
        allowed_routers: Vec<Address>,
        allowed_adapters: Vec<Address>,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env)
            .set(&DataKey::AllowedRouters, &allowed_routers);
        crate::compact_storage::instance(&env)
            .set(&DataKey::AllowedAdapters, &allowed_adapters);
        env.events().publish(
            (EVENT_SWAP_VENUES_CFG,),
            (caller, allowed_routers, allowed_adapters),
        );
    }

    pub fn set_venue_registry(env: Env, caller: Address, registry: Address) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env)
            .set(&DataKey::VenueRegistry, &registry);
        env.events()
            .publish((EVENT_VENUE_REGISTRY_SET,), (caller, registry));
    }

    pub fn clear_venue_registry(env: Env, caller: Address) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env).remove(&DataKey::VenueRegistry);
        env.events().publish(
            (EVENT_VENUE_REGISTRY_SET,),
            (caller, Option::<Address>::None),
        );
    }

    pub fn set_manager(env: Env, caller: Address, manager: Address) {
        // Creation-only reservation, invoked atomically by the factory before
        // publication. A reserved initializer cannot be replaced. Initialized
        // funds continue through the existing governed authorization below.
        let store = crate::compact_storage::instance(&env);
        if !store.has(&DataKey::Denomination) {
            if store.has(&DataKey::Manager) || caller != manager {
                panic_with_error!(&env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
        } else {
            Self::require_policy_auth(&env, &caller);
            Self::settle_fees_internal(&env);
        }
        store.set(&DataKey::Manager, &manager);
        env.events()
            .publish((EVENT_MANAGER_SET,), (caller, manager));
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env).set(&DataKey::Router, &router);
        env.events().publish((EVENT_ROUTER_SET,), (caller, router));
    }

    pub fn set_share_token(env: Env, caller: Address, share_token: Address) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        crate::compact_storage::instance(&env)
            .set(&DataKey::ShareToken, &share_token);
        env.events()
            .publish((EVENT_SHARE_TOKEN_SET,), (caller, share_token));
    }

    pub fn set_blend_risk_policy(
        env: Env,
        caller: Address,
        market_id: u128,
        max_oracle_age: u64,
        min_health_factor: i128,
        fail_close_nav: bool,
        fail_close_actions: bool,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        Self::assert_blend_risk_policy(&env, max_oracle_age, min_health_factor);
        let key = DataKey::BlendRiskPolicy(market_id);
        Self::dynamic_set(
            &env,
            &key,
            &BlendRiskPolicy {
                market_id,
                max_oracle_age,
                min_health_factor,
                fail_close_nav,
                fail_close_actions,
            },
        );
        env.events().publish(
            (EVENT_BLEND_POLICY_CFG,),
            (
                caller,
                market_id,
                max_oracle_age,
                min_health_factor,
                fail_close_nav,
                fail_close_actions,
            ),
        );
    }

    pub fn set_blend_external_diagnostics(
        env: Env,
        caller: Address,
        market_id: u128,
        enabled: bool,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        let key = DataKey::BlendExternalDiagnostics(market_id);
        Self::dynamic_set(&env, &key, &enabled);
        env.events()
            .publish((EVENT_BLEND_DIAGNOSTICS_CFG,), (caller, market_id, enabled));
    }

    // Sets the canonical Blend V2 pool factory used to attest a market's
    // router before a new debt position can be opened. This does not enable
    // borrowing by itself: capability, borrow policy and live risk checks
    // remain mandatory.
    pub fn set_blend_v2_risk_source(
        env: Env,
        caller: Address,
        market_id: u128,
        pool_factory: Address,
    ) {
        Self::require_policy_auth(&env, &caller);
        let config = Self::require_credit_market_config(&env, &CreditProtocol::Blend, market_id);
        let router = Self::read_blend_router(&env, &config.adapter);
        let args = vec![&env, router.clone().into_val(&env)];
        let verified: bool =
            env.invoke_contract(&pool_factory, &soroban_sdk::symbol_short!("is_pool"), args);
        if !verified {
            panic_with_error!(&env, Error::BlendV2PoolNotVerified);
        }
        let key = DataKey::BlendV2RiskSource(market_id);
        Self::dynamic_set(
            &env,
            &key,
            &BlendV2RiskSource {
                market_id,
                pool_factory: pool_factory.clone(),
            },
        );
        env.events().publish(
            (EVENT_BLEND_V2_SOURCE_CFG,),
            (caller, market_id, pool_factory, router),
        );
    }

    pub fn configure_credit_market(
        env: Env,
        caller: Address,
        protocol: CreditProtocol,
        market_id: u128,
        adapter: Address,
        allow_supply: bool,
        allow_borrow: bool,
        allow_repay: bool,
        allow_withdraw: bool,
        enabled: bool,
    ) {
        Self::managed_assert_legacy_mode(&env);
        Self::require_policy_auth(&env, &caller);
        let protocol_event = protocol.clone();
        let adapter_event = adapter.clone();
        Self::write_credit_market_config(
            &env,
            &CreditMarketConfig {
                protocol,
                market_id,
                adapter,
                allow_supply,
                allow_borrow,
                allow_repay,
                allow_withdraw,
                enabled,
            },
        );
        env.events().publish(
            (EVENT_CREDIT_MARKET_CFG,),
            (
                caller,
                Self::credit_protocol_event_code(&protocol_event),
                market_id,
                adapter_event,
                allow_supply,
                allow_borrow,
                allow_repay,
                allow_withdraw,
                enabled,
            ),
        );
    }

    pub fn set_credit_borrow_policy(
        env: Env,
        caller: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        max_borrow_per_action: i128,
        max_debt_for_asset: i128,
        enabled: bool,
    ) {
        Self::require_policy_auth(&env, &caller);
        if max_borrow_per_action < 0
            || max_debt_for_asset < 0
            || (enabled
                && (max_borrow_per_action == 0
                    || max_debt_for_asset == 0
                    || max_borrow_per_action > max_debt_for_asset))
        {
            panic_with_error!(&env, Error::InvalidCreditBorrowPolicy);
        }
        let key = DataKey::CreditBorrowPolicy(protocol.clone(), market_id, asset.clone());
        Self::dynamic_set(
            &env,
            &key,
            &CreditBorrowPolicy {
                protocol: protocol.clone(),
                market_id,
                asset: asset.clone(),
                max_borrow_per_action,
                max_debt_for_asset,
                enabled,
            },
        );
        env.events().publish(
            (EVENT_CREDIT_BORROW_CFG,),
            (
                caller,
                Self::credit_protocol_event_code(&protocol),
                market_id,
                asset,
                max_borrow_per_action,
                max_debt_for_asset,
                enabled,
            ),
        );
    }

    pub fn deposit(env: Env, user: Address, asset: Asset, amount: i128) -> i128 {
        // Keep the legacy ABI for legacy funds, never silently bypass a V3
        // investor's reviewed minimum through the older entrypoint.
        if Self::managed_portfolio(&env).is_some() {
            panic_with_error!(&env, DepositError::MinimumRequired);
        }
        Self::deposit_internal(env, user, asset, amount, None)
    }

    pub fn deposit_protection_version(env: Env) -> u32 {
        if Self::managed_portfolio(&env).is_some() { 1 } else { 0 }
    }

    // Same valuation, fee dilution and rounding as execution; never a promise
    // of future returns. No transfers, allowance consumption or fee minting.
    pub fn quote_deposit(env: Env, asset: Asset, amount: i128) -> i128 {
        Self::require_current_share_accounting(&env);
        if Self::managed_portfolio(&env).is_none() {
            panic_with_error!(&env, Error::ManagedUnsupported);
        }
        if amount <= 0 { panic_with_error!(&env, Error::AmountZero); }
        Self::assert_asset_allowed(&env, &asset.contract);
        let preview = Self::preview_fee_settlement_internal(&env);
        Self::deposit_shares_internal(&env, &asset, amount, preview.nav, preview.total_shares_after).0
    }

    pub fn deposit_protected(env: Env, user: Address, asset: Asset, amount: i128, min_shares_out: i128) -> i128 {
        if Self::managed_portfolio(&env).is_none() {
            panic_with_error!(&env, Error::ManagedUnsupported);
        }
        if min_shares_out <= 0 {
            panic_with_error!(&env, DepositError::MinimumRequired);
        }
        Self::deposit_internal(env, user, asset, amount, Some(min_shares_out))
    }

    fn deposit_shares_internal(env: &Env, asset: &Asset, amount: i128, nav_before: i128, total: i128) -> (i128, i128) {
        let denomination = Self::denomination(env.clone());
        if Self::managed_policy(env).is_some()
            && ((asset.contract != denomination.contract && Self::managed_portfolio(env).is_none())
                || (nav_before == 0 && total > 0))
        {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        let value = Self::value_asset_amount_in_denom(env, &asset.contract, amount, &denomination);
        let net = Self::apply_fee_bps(value, Self::fees(env.clone()).deposit_bps);
        let shares = if total == 0 || nav_before == 0 { net } else {
            net.checked_mul(total).unwrap_or_else(|| panic_with_error!(env, Error::ArithmeticOverflow)) / nav_before
        };
        if shares <= 0 { panic_with_error!(env, Error::SharesZero); }
        (shares, value)
    }

    fn deposit_internal(env: Env, user: Address, asset: Asset, amount: i128, minimum: Option<i128>) -> i128 {
        Self::require_current_share_accounting(&env);
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset.contract);
        let fees = Self::fees(env.clone());
        let nav_before = if fees.mgmt_bps == 0 && fees.perf_bps == 0 {
            Self::total_nav_internal(&env)
        } else {
            Self::settle_fees_internal(&env).nav
        };
        let total = Self::total_shares_internal(&env);
        let (shares_minted, deposit_value) = Self::deposit_shares_internal(&env, &asset, amount, nav_before, total);
        if minimum.is_some_and(|min| shares_minted < min) {
            // Before any token transfer. Soroban also rolls back fee settlement
            // and every subcall if any subsequent part of the transaction fails.
            panic_with_error!(&env, DepositError::MinimumNotMet);
        }
        Self::transfer_from_user_to_vault(&env, &asset.contract, &user, amount);
        Self::add_liquid_balance(&env, &asset.contract, amount);

        Self::mint_shares_to(&env, &user, shares_minted);
        let nav_after = Self::checked_add_nav(&env, nav_before, deposit_value);
        crate::compact_storage::instance(&env).set(&DataKey::Aum, &nav_after);
        env.events().publish(
            (EVENT_DEPOSIT,),
            (user.clone(), asset.contract, amount, shares_minted),
        );
        shares_minted
    }

    pub fn redeem(env: Env, user: Address, shares: i128) -> i128 {
        Self::managed_assert_legacy_mode(&env);
        Self::require_current_share_accounting(&env);
        user.require_auth();
        if shares <= 0 {
            panic_with_error!(&env, Error::SharesZero);
        }
        let store = crate::compact_storage::instance(&env);
        let fees = Self::fees(env.clone());
        let nav = if fees.mgmt_bps == 0 && fees.perf_bps == 0 {
            Self::total_nav_internal(&env)
        } else {
            Self::settle_fees_internal(&env).nav
        };
        let user_bal = Self::maybe_share_token_balance(&env, &user).unwrap_or_else(|| {
            Self::dynamic_get(&env, &DataKey::Balance(user.clone())).unwrap_or(0)
        });
        if shares > user_bal {
            panic_with_error!(&env, Error::InsufficientUserShares);
        }
        let total = Self::total_shares_internal(&env);
        if shares > total {
            panic_with_error!(&env, Error::InsufficientShares);
        }
        let gross_out = if total == 0 {
            0
        } else {
            let numerator = shares
                .checked_mul(nav)
                .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
            cm::div(numerator,total)
        };
        let net_out = Self::apply_fee_bps(gross_out, fees.redeem_bps);
        let denom: Asset = match store.get(&DataKey::Denomination) {
            Some(d) => d,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        if Self::liquid_balance_internal(&env, &denom.contract) < net_out {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }

        Self::burn_shares_from(&env, &user, shares);
        Self::add_liquid_balance(&env, &denom.contract, -net_out);
        Self::transfer_from_vault(&env, &denom.contract, &user, net_out);
        crate::compact_storage::instance(&env)
            .set(&DataKey::Aum, &(cm::sub(nav,net_out)));
        env.events()
            .publish((EVENT_REDEEM,), (user.clone(), shares, net_out));
        net_out
    }

    pub fn enable_managed_withdrawals(env: Env, caller: Address, policy: ManagedPolicy) {
        Self::managed_enable(&env, &caller, policy);
    }

    pub fn managed_withdrawal_policy(env: Env) -> Option<ManagedPolicy> {
        Self::managed_policy(&env)
    }

    pub fn enable_managed_portfolio(env: Env, caller: Address, policy: ManagedPolicy, portfolio: ManagedPortfolioPolicy) {
        Self::managed_enable_portfolio(&env, &caller, policy, portfolio);
    }

    // Experimental opt-in only on a NEW empty portfolio. Existing V3/legacy
    // state is not migrated or reconfigured by this entry point.
    pub fn enable_managed_routes(env: Env, caller: Address, policy: ManagedPolicy, portfolio: ManagedPortfolioPolicy, bindings: Vec<ManagedRouteBinding>) {
        Self::managed_bindings_init(&env, &caller, &bindings);
        Self::managed_enable_portfolio(&env, &caller, policy, portfolio);
    }

    pub fn managed_routes(env: Env) -> Vec<ManagedRouteBinding> { Self::managed_route_bindings(&env) }

    pub fn prepare_asset_liquidity(env: Env, caller: Address, step: SwapStep) -> i128 {
        Self::managed_prepare_asset(&env, &caller, step.amount_in, &step)
    }

    // Distinguish collateral withdrawn from the amount traded under the
    // EXISTING trade-size policy. Unswapped assets stay accounted as assets,
    // never denomination cash or a claim reservation.
    pub fn prepare_blend_asset(env: Env, caller: Address, withdraw_amount: i128, step: SwapStep) -> i128 {
        Self::managed_prepare_asset(&env, &caller, withdraw_amount, &step)
    }

    pub fn managed_portfolio_policy(env: Env) -> Option<ManagedPortfolioPolicy> {
        Self::managed_portfolio(&env)
    }

    pub fn pay_withdrawal(env: Env, id: u64) -> i128 {
        Self::managed_pay(&env, id)
    }

    pub fn redeem_liquid(env: Env, owner: Address, shares: i128) -> i128 {
        Self::managed_redeem_liquid(&env, &owner, shares)
    }

    pub fn liquidate_withdrawal(env: Env, caller: Address, step: SwapStep) -> i128 {
        Self::managed_liquidate_spot(&env, &caller, &step)
    }

    pub fn portfolio_liquidation_steps(env: Env, max_value: i128) -> Vec<SwapStep> {
        Self::managed_spot_steps(&env, max_value)
    }

    pub fn portfolio_trade_quote(env: Env, asset: Address, amount: i128, sell: bool) -> SwapStep {
        Self::managed_trade_quote(&env, &asset, amount, sell)
    }

    pub fn managed_queue_state(env: Env) -> ManagedQueue {
        Self::managed_queue(&env)
    }

    pub fn request_withdrawal(env: Env, owner: Address, shares: i128) -> ManagedRequest {
        Self::managed_request(&env, &owner, shares)
    }

    pub fn cancel_withdrawal(env: Env, owner: Address, id: u64) -> ManagedRequest {
        Self::managed_cancel(&env, &owner, id)
    }

    pub fn settle_withdrawals(env: Env, max_requests: u32) -> ManagedSettlement {
        Self::managed_settle(&env, max_requests)
    }

    pub fn claim_withdrawal(env: Env, owner: Address, id: u64) -> i128 {
        Self::managed_claim(&env, &owner, id)
    }

    pub fn prepare_withdrawal_liquidity(env: Env, caller: Address, amount: i128) -> i128 {
        Self::managed_prepare(&env, &caller, amount)
    }

    pub fn withdrawal_request(env: Env, id: u64) -> Option<ManagedRequest> {
        Self::managed_get_request(&env, id)
    }

    pub fn withdrawal_status(env: Env) -> ManagedStatus {
        Self::managed_status(&env)
    }

    pub fn withdrawal_requests(env: Env, start: u64, limit: u32) -> Vec<ManagedRequest> {
        if start == 0 || limit == 0 || limit > 32 { panic_with_error!(&env, Error::ManagedInvalidRequest); }
        let mut out = Vec::new(&env); let q = Self::managed_queue(&env);
        for offset in 0..limit {
            let id = start.checked_add(offset as u64).unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
            if id >= q.next_id { break; }
            if let Some(r) = Self::managed_get_request(&env, id) { out.push_back(r); }
        }
        out
    }

    pub fn rebalance(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        Self::rebalance_internal(env, manager, steps, false)
    }

    // Executes an automatically selected route. Every venue must be explicitly
    // enabled for AUTO in the governed venue registry.
    pub fn rebalance_auto(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        Self::rebalance_internal(env, manager, steps, true)
    }

    fn rebalance_internal(
        env: Env,
        manager: Address,
        steps: Vec<SwapStep>,
        auto_execution: bool,
    ) -> i128 {
        if Self::managed_portfolio(&env).is_some() {
            Self::require_manager(&env, &manager);
            if steps.is_empty() || steps.len() > 8 { panic_with_error!(&env, Error::ManagedInvalidRequest); }
            let mut result = 0;
            for step in steps.iter() {
                if let Some(binding) = Self::managed_binding_for(&env, &step) {
                    Self::managed_validate_binding(&env, &binding, auto_execution);
                } else if auto_execution { Self::assert_global_venue_auto_allowed(&env, &step.router_addr); }
                result = Self::managed_portfolio_swap(&env, &step, false, None);
            }
            return result;
        }
        Self::managed_assert_legacy_mode(&env);
        Self::require_manager(&env, &manager);
        Self::settle_fees_internal(&env);
        let store = crate::compact_storage::instance(&env);
        let router_internal: Address = match store.get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::RouterNotSet),
        };
        let self_addr = env.current_contract_address();
        let latest = env.ledger().sequence();
        let exp: u32 = latest + 100_000;
        let mut total_out: i128 = 0;
        let mut internal_steps: Vec<RouterStep> = Vec::new(&env);
        let mut first_internal_in: Option<(Address, i128)> = None;
        let mut last_internal_out: Option<Address> = None;

        for s in steps.iter() {
            Self::enforce_swap_risk_policy_for_step(&env, &s, &router_internal, auto_execution, None);
            if Self::liquid_balance_internal(&env, &s.asset_in.contract) < s.amount_in {
                panic_with_error!(&env, Error::InsufficientLiquidity);
            }
            if s.router_addr != router_internal {
                Self::add_liquid_balance(&env, &s.asset_in.contract, -s.amount_in);
                let args_approve = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    s.router_addr.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                    exp.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &s.asset_in.contract,
                    &symbol_short!("approve"),
                    args_approve,
                );
                let mut path: Vec<Address> = Vec::new(&env);
                path.push_back(s.asset_in.contract.clone());
                path.push_back(s.asset_out.contract.clone());
                let deadline: u64 = env.ledger().timestamp() + 1800u64;
                let args_swap = vec![
                    &env,
                    s.amount_in.into_val(&env),
                    s.min_out.into_val(&env),
                    path.into_val(&env),
                    self_addr.clone().into_val(&env),
                    deadline.into_val(&env),
                ];
                let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
                let amounts: Vec<i128> = env.invoke_contract(&s.router_addr, &func, args_swap);
                let mut out: i128 = 0;
                for v in amounts.iter() {
                    out = v;
                }
                Self::add_liquid_balance(&env, &s.asset_out.contract, out);
                total_out += out;
            } else {
                if first_internal_in.is_none() {
                    first_internal_in = Some((s.asset_in.contract.clone(), s.amount_in));
                }
                last_internal_out = Some(s.asset_out.contract.clone());
                Self::add_liquid_balance(&env, &s.asset_in.contract, -s.amount_in);
                let args_transfer = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    s.adapter.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                ];
                Self::invoke_with_contract_auth::<()>(
                    &env,
                    &s.asset_in.contract,
                    "transfer",
                    args_transfer,
                );
                internal_steps.push_back(RouterStep {
                    adapter: s.adapter,
                    pool_id: s.pool_id,
                    amount_in: s.amount_in,
                    min_out: s.min_out,
                    asset_out: s.asset_out.clone(),
                });
            }
        }

        if internal_steps.len() > 0 {
            let args = vec![
                &env,
                manager.clone().into_val(&env),
                self_addr.clone().into_val(&env),
                internal_steps.into_val(&env),
            ];
            let out_internal: i128 =
                env.invoke_contract(&router_internal, &Symbol::new(&env, "execute_for"), args);
            if let Some(asset) = last_internal_out {
                Self::add_liquid_balance(&env, &asset, out_internal);
            }
            total_out += out_internal;
        }

        Self::refresh_aum(&env);
        Self::settle_fees_internal(&env);
        env.events()
            .publish((EVENT_PROFIT,), (total_out, steps.len() as u32));
        total_out
    }

    fn blend_lend_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::managed_check_supply(env, adapter, market_id, asset, amount);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        if Self::liquid_balance_internal(env, &effective_asset) < amount {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Lend,
            market_id,
            amount,
        );
        let mut position = Self::read_blend_position_internal(env, market_id, &effective_asset)
            .unwrap_or(BlendPosition {
                market_id,
                asset: effective_asset.clone(),
                collateral_amount: 0,
                debt_amount: 0,
            });
        if position.asset != effective_asset {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        // Blend accrues collateral in shares. Read the post-action position so
        // Arka records the withdrawable amount, not the requested amount.
        // Without this reconciliation a full withdrawal can leave a one-stroop
        // internal remainder when the pool rounds the share conversion down.
        let collateral_amount = Self::read_blend_collateral_amount(env, adapter, &effective_asset);
        if collateral_amount <= 0 {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        position.collateral_amount = collateral_amount;
        Self::write_blend_adapter(env, market_id, adapter);
        Self::add_liquid_balance(env, &effective_asset, -amount);
        Self::write_blend_position(env, &position);
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("lend"), market_id, amount));
        amount
    }

    fn blend_borrow_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::managed_assert_legacy_mode(env);
        Self::require_manager(env, manager);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let mut position = Self::read_blend_position_internal(env, market_id, &effective_asset)
            .unwrap_or(BlendPosition {
                market_id,
                asset: effective_asset.clone(),
                collateral_amount: 0,
                debt_amount: 0,
            });
        if position.asset != effective_asset {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        // Debt in Blend is represented by shares and rounded up on repayment.
        // Read it before enforcing policy so older positions cannot understate
        // their live liability after accrual or an earlier contract version.
        position.debt_amount = Self::read_blend_debt_amount(env, adapter, &effective_asset);
        Self::assert_credit_borrow_policy(
            env,
            &CreditProtocol::Blend,
            market_id,
            &effective_asset,
            position.debt_amount,
            amount,
        );
        Self::assert_blend_v2_risk_source(env, market_id, adapter);
        let out = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Borrow,
            market_id,
            amount,
        );
        position.debt_amount = Self::read_blend_debt_amount(env, adapter, &effective_asset);
        Self::write_blend_adapter(env, market_id, adapter);
        Self::add_liquid_balance(env, &effective_asset, out);
        Self::write_blend_position(env, &position);
        // Soroban calls are atomic: if this full post-borrow validation fails,
        // the external borrow and all local state changes are reverted. Keeping
        // the check after the adapter call validates the actual resulting pool
        // position without paying for the same complete diagnostic pass twice.
        Self::assert_blend_risky_actions_allowed(env, market_id);
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("borrow"), market_id, out));
        out
    }

    fn blend_repay_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::managed_assert_legacy_mode(env);
        Self::require_manager(env, manager);
        Self::assert_global_venue_exit_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let mut position =
            Self::reconcile_blend_position_from_pool(env, adapter, market_id, &effective_asset);
        if position.debt_amount < amount {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        if Self::liquid_balance_internal(env, &effective_asset) < amount {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Repay,
            market_id,
            amount,
        );
        position.debt_amount = Self::read_blend_debt_amount(env, adapter, &effective_asset);
        Self::add_liquid_balance(env, &effective_asset, -amount);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, market_id).is_empty() {
            Self::clear_blend_adapter(env, market_id);
        } else {
            Self::write_blend_adapter(env, market_id, adapter);
        }
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("repay"), market_id, amount));
        amount
    }

    fn blend_withdraw_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::managed_check_market(env, adapter, market_id, asset);
        Self::assert_global_venue_exit_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let mut position =
            Self::reconcile_blend_position_from_pool(env, adapter, market_id, &effective_asset);
        // Collateral accrues in Blend shares. The reconciled position lets the
        // manager withdraw the live amount even if its old local record was
        // rounded down or removed.
        if position.collateral_amount < amount {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        let out = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Withdraw,
            market_id,
            amount,
        );
        position.collateral_amount =
            Self::read_blend_collateral_amount(env, adapter, &effective_asset);
        Self::add_liquid_balance(env, &effective_asset, out);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, market_id).is_empty() {
            Self::clear_blend_adapter(env, market_id);
        } else {
            Self::write_blend_adapter(env, market_id, adapter);
        }
        // With no debt, withdrawing collateral cannot create a credit risk.
        // Avoid an expensive redundant diagnostic read after the external pool
        // call; any withdrawal that leaves debt still receives the full check.
        if position.debt_amount > 0 {
            Self::assert_blend_risky_actions_allowed(env, market_id);
        }
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("wdrw"), market_id, out));
        out
    }

    pub fn credit_supply(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_for_credit_action(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Supply);
        match protocol {
            CreditProtocol::Blend => Self::blend_lend_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_borrow(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_for_credit_action(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Borrow);
        match protocol {
            CreditProtocol::Blend => Self::blend_borrow_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_repay(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_for_credit_action(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Repay);
        match protocol {
            CreditProtocol::Blend => Self::blend_repay_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_withdraw(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_for_credit_action(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Withdraw);
        match protocol {
            CreditProtocol::Blend => Self::blend_withdraw_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn blend_lend(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Supply);
        Self::blend_lend_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_borrow(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Borrow);
        Self::blend_borrow_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_repay(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Repay);
        Self::blend_repay_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_withdraw(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(
            &env,
            &adapter,
            market_id,
            &CreditAction::Withdraw,
        );
        Self::blend_withdraw_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn manager(env: Env) -> Address {
        match crate::compact_storage::instance(&env).get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn router(env: Env) -> Address {
        match crate::compact_storage::instance(&env).get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::RouterNotSet),
        }
    }

    pub fn denomination(env: Env) -> Asset {
        match crate::compact_storage::instance(&env).get(&DataKey::Denomination) {
            Some(d) => d,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn shares_of(env: Env, user: Address) -> i128 {
        if let Some(balance) = Self::maybe_share_token_balance(&env, &user) {
            return balance;
        }
        Self::dynamic_get(&env, &DataKey::Balance(user)).unwrap_or(0)
    }

    pub fn total_shares(env: Env) -> i128 {
        Self::total_shares_internal(&env)
    }

    pub fn share_token(env: Env) -> Option<Address> {
        crate::compact_storage::instance(&env).get(&DataKey::ShareToken)
    }

    pub fn governor(env: Env) -> Option<Address> {
        crate::compact_storage::instance(&env).get(&DataKey::Governor)
    }

    pub fn fees(env: Env) -> FeeStructure {
        crate::compact_storage::instance(&env)
            .get(&DataKey::Fees)
            .unwrap_or(FeeStructure {
                mgmt_bps: 0,
                perf_bps: 0,
                deposit_bps: 0,
                redeem_bps: 0,
            })
    }

    pub fn protocol_treasury(env: Env) -> Option<Address> {
        Self::protocol_treasury_internal(&env)
    }

    pub fn protocol_fee_policy(env: Env) -> ProtocolFeePolicy {
        Self::protocol_fee_policy_internal(&env)
    }

    pub fn fee_state(env: Env) -> FeeState {
        Self::fee_state_internal(&env)
    }

    pub fn preview_fee_settlement(env: Env) -> FeeSettlement {
        Self::preview_fee_settlement_internal(&env)
    }

    pub fn settle_fees(env: Env) -> FeeSettlement {
        Self::settle_fees_internal(&env)
    }

    pub fn whitelist(env: Env) -> Vec<Asset> {
        crate::compact_storage::instance(&env)
            .get(&DataKey::Whitelist)
            .unwrap_or(Vec::new(&env))
    }

    pub fn swap_risk_policy(env: Env) -> SwapRiskPolicy {
        Self::read_swap_risk_policy_internal(&env)
    }

    pub fn swap_oracle(env: Env) -> Option<Address> {
        Self::read_swap_oracle_internal(&env)
    }

    pub fn valuation_oracle(env: Env) -> Option<ValuationOracleConfig> {
        Self::read_valuation_oracle_config_internal(&env)
    }

    pub fn allowed_routers(env: Env) -> Vec<Address> {
        Self::read_allowed_routers_internal(&env)
    }

    pub fn allowed_adapters(env: Env) -> Vec<Address> {
        Self::read_allowed_adapters_internal(&env)
    }

    pub fn venue_registry(env: Env) -> Option<Address> {
        Self::read_venue_registry_internal(&env)
    }

    pub fn nav(env: Env) -> i128 {
        Self::total_nav_internal(&env)
    }

    pub fn liquid_balance(env: Env, asset: Address) -> i128 {
        Self::liquid_balance_internal(&env, &asset)
    }

    pub fn blend_markets(env: Env) -> Vec<u128> {
        Self::dynamic_get(&env, &DataKey::BlendMarkets).unwrap_or(Vec::new(&env))
    }

    pub fn blend_market_assets(env: Env, market_id: u128) -> Vec<Address> {
        Self::read_blend_market_assets_internal(&env, market_id)
    }

    pub fn blend_position(env: Env, market_id: u128, asset: Address) -> Option<BlendPosition> {
        Self::read_blend_position_internal(&env, market_id, &asset)
    }

    pub fn blend_positions(env: Env, market_id: u128) -> Vec<BlendPosition> {
        let mut positions = Vec::new(&env);
        for asset in Self::read_blend_market_assets_internal(&env, market_id).iter() {
            if let Some(position) = Self::read_blend_position_internal(&env, market_id, &asset) {
                positions.push_back(position);
            }
        }
        positions
    }

    pub fn blend_position_value(
        env: Env,
        market_id: u128,
        asset: Address,
    ) -> Option<BlendPositionValue> {
        Self::blend_position_value_internal(&env, market_id, &asset)
    }

    pub fn blend_position_values(env: Env, market_id: u128) -> Vec<BlendPositionValue> {
        let mut values = Vec::new(&env);
        for asset in Self::read_blend_market_assets_internal(&env, market_id).iter() {
            if let Some(value) = Self::blend_position_value_internal(&env, market_id, &asset) {
                values.push_back(value);
            }
        }
        values
    }

    pub fn blend_market_value(env: Env, market_id: u128) -> Option<BlendMarketValue> {
        Self::blend_market_value_internal(&env, market_id)
    }

    pub fn blend_health_factor(env: Env, market_id: u128) -> Option<i128> {
        Self::blend_market_value_internal(&env, market_id).map(|position| position.health_factor)
    }

    pub fn blend_risk_policy(env: Env, market_id: u128) -> BlendRiskPolicy {
        Self::read_blend_risk_policy_internal(&env, market_id)
    }

    pub fn blend_external_diagnostics(env: Env, market_id: u128) -> bool {
        Self::read_blend_external_diagnostics_internal(&env, market_id)
    }

    pub fn blend_v2_risk_source(env: Env, market_id: u128) -> Option<BlendV2RiskSource> {
        Self::read_blend_v2_risk_source_internal(&env, market_id)
    }

    pub fn blend_market_status(env: Env, market_id: u128) -> Option<BlendMarketStatus> {
        Self::blend_market_status_internal(&env, market_id)
    }

    pub fn credit_markets(env: Env, protocol: CreditProtocol) -> Vec<u128> {
        Self::read_credit_markets_internal(&env, &protocol)
    }

    pub fn credit_protocols(env: Env) -> Vec<CreditProtocol> {
        Self::dynamic_get(&env, &DataKey::CreditProtocols).unwrap_or(Vec::new(&env))
    }

    pub fn credit_market_config(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketConfig> {
        Self::read_credit_market_config_internal(&env, &protocol, market_id)
    }

    pub fn credit_market_configs(env: Env, protocol: CreditProtocol) -> Vec<CreditMarketConfig> {
        Self::read_credit_market_configs_internal(&env, &protocol)
    }

    pub fn credit_borrow_policy(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
    ) -> Option<CreditBorrowPolicy> {
        Self::read_credit_borrow_policy_internal(&env, &protocol, market_id, &asset)
    }

    pub fn credit_market_assets(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<Address> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_assets(env, market_id),
        }
    }

    pub fn credit_position(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
    ) -> Option<CreditPosition> {
        match protocol {
            CreditProtocol::Blend => Self::blend_position(env, market_id, asset).map(Into::into),
        }
    }

    pub fn credit_positions(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<CreditPosition> {
        let mut positions = Vec::new(&env);
        match protocol {
            CreditProtocol::Blend => {
                for position in Self::blend_positions(env.clone(), market_id).iter() {
                    positions.push_back(position.into());
                }
            }
        }
        positions
    }

    pub fn credit_position_value(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
    ) -> Option<CreditPositionValue> {
        match protocol {
            CreditProtocol::Blend => {
                Self::blend_position_value(env, market_id, asset).map(Into::into)
            }
        }
    }

    pub fn credit_position_values(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<CreditPositionValue> {
        let mut values = Vec::new(&env);
        match protocol {
            CreditProtocol::Blend => {
                for value in Self::blend_position_values(env.clone(), market_id).iter() {
                    values.push_back(value.into());
                }
            }
        }
        values
    }

    pub fn credit_market_value(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketValue> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_value(env, market_id).map(Into::into),
        }
    }

    pub fn credit_health_factor(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<i128> {
        match protocol {
            CreditProtocol::Blend => Self::blend_health_factor(env, market_id),
        }
    }

    pub fn credit_risk_policy(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> CreditRiskPolicy {
        match protocol {
            CreditProtocol::Blend => Self::blend_risk_policy(env, market_id).into(),
        }
    }

    pub fn credit_market_status(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketStatus> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_status(env, market_id).map(Into::into),
        }
    }
}

#[cfg(test)]
mod test;
