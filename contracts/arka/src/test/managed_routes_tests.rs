use super::*;
use soroban_sdk::{token::{Client as Token, StellarAssetClient as Mint}, xdr::ToXdr};
use adapter_sushi::{SushiAdapter, SushiAdapterClient, SushiPoolRoute, OracleHints, SwapResult};
use venue_registry::{VenueRegistry, VenueRegistryClient};
use crate::managed_routes::ManagedSushiRoute;

#[contract]
struct SushiVenue;
#[contractimpl]
impl SushiVenue {
    pub fn configure(env:Env,a:Address,b:Address,short:bool){env.storage().instance().set(&symbol_short!("a"),&a);env.storage().instance().set(&symbol_short!("b"),&b);env.storage().instance().set(&symbol_short!("short"),&short);}
    pub fn factory(env:Env)->Address{env.current_contract_address()}
    pub fn token0(env:Env)->Address{env.storage().instance().get(&symbol_short!("a")).unwrap()}
    pub fn token1(env:Env)->Address{env.storage().instance().get(&symbol_short!("b")).unwrap()}
    pub fn fee(_env:Env)->u32{3000}
    pub fn is_paused(_env:Env)->bool{false}
    pub fn get_pool(env:Env,token_a:Address,token_b:Address,fee:u32)->Option<Address>{if token_a==Self::token0(env.clone())&&token_b==Self::token1(env.clone())&&fee==3000{Some(env.current_contract_address())}else{None}}
    pub fn get_oracle_hints(_env:Env)->OracleHints{OracleHints{checkpoint:0,checkpoint_min:0,slot:0}}
    pub fn swap(env:Env,sender:Address,recipient:Address,zero_for_one:bool,amount_specified:i128,sqrt_price_limit_x96:soroban_sdk::U256,_hints:OracleHints)->SwapResult{
        sender.require_auth();let (input,output)=if zero_for_one{(Self::token0(env.clone()),Self::token1(env.clone()))}else{(Self::token1(env.clone()),Self::token0(env.clone()))};let me=env.current_contract_address();
        Token::new(&env,&input).transfer(&sender,&me,&amount_specified);
        let short:bool=env.storage().instance().get(&symbol_short!("short")).unwrap();let received=amount_specified-if short{1}else{0};
        Token::new(&env,&output).transfer(&me,&recipient,&received);let(amount0,amount1)=if zero_for_one{(amount_specified,-received)}else{(-received,amount_specified)};SwapResult{amount0,amount1,liquidity:5000,sqrt_price_x96:sqrt_price_limit_x96,tick:0}
    }
}
struct F<'a>{c:ArkaContractClient<'a>,owner:Address,manager:Address,a:Address,b:Address,oracle:Address,adapter:Address,router:Address,venue:Address,blend:Address,pool:BlendRouterMockClient<'a>,registry:VenueRegistryClient<'a>}
fn fixture(env:&Env)->F<'_>{fixture_risk(env,false)}
fn fixture_risk(env:&Env,risk:bool)->F<'_>{
    // Root mock signatures only. Nested CONTRACT auth must be furnished by the
    // actual V3/adapter code; non-root wallet-auth mocking is NOT enabled.
    env.mock_all_auths();env.budget().reset_unlimited();env.ledger().set_timestamp(1000);
    let owner=Address::generate(env);let manager=Address::generate(env);
    let a=env.register_stellar_asset_contract_v2(manager.clone()).address();let b=env.register_stellar_asset_contract_v2(manager.clone()).address();
    let fund=env.register_contract(None,ArkaContract);let c=ArkaContractClient::new(env,&fund);
    c.set_manager(&manager,&manager);
    c.init(&a,&0,&0,&0,&0,&vec![env,a.clone(),b.clone()],&manager);
    let oracle=env.register_contract(None,DummyOracle);let o=DummyOracleClient::new(env,&oracle);o.set_price(&a,&10_000_000,&1000);o.set_price(&b,&10_000_000,&1000);
    c.set_valuation_oracle(&manager,&oracle,&300);
    if risk {c.set_swap_oracle(&manager,&oracle);c.set_swap_risk_policy(&manager,&true,&true,&300,&300,&350,&900,&2500);}
    let router=env.register(Router,(None::<Address>,None::<Address>,0u64));c.set_router(&manager,&router);
    let venue=env.register_contract(None,SushiVenue);SushiVenueClient::new(env,&venue).configure(&a,&b,&false);
    let adapter = env.register(SushiAdapter, (&manager,&venue));
    let ac=SushiAdapterClient::new(env,&adapter);
    ac.set_caller(&manager,&fund,&true);
    ac.set_pool_route(&manager,&1,&SushiPoolRoute{pool:venue.clone(),token_in:a.clone(),token_out:b.clone(),fee:3000});ac.set_pool_route(&manager,&2,&SushiPoolRoute{pool:venue.clone(),token_in:b.clone(),token_out:a.clone(),fee:3000});
    let poolid=env.register_contract(None,BlendRouterMock);let pool=BlendRouterMockClient::new(env,&poolid);pool.set_oracle(&oracle);
    pool.set_reserve(&a,&0,&9_000_000,&1_000_000_000_000,&1_000_000_000_000,&10_000_000);
    pool.set_reserve(&b,&1,&9_000_000,&1_000_000_000_000,&1_000_000_000_000,&10_000_000);
    let blend=env.register(BlendAdapter,(&manager,&poolid));
    c.configure_credit_market(&manager,&CreditProtocol::Blend,&1,&blend,&true,&false,&false,&true,&true);
    let reg = env.register(VenueRegistry, (&manager, &Some(manager.clone()), &100_000u64,));
    let registry=VenueRegistryClient::new(env,&reg);
    registry.set_venue_status(&manager,&adapter,&1);registry.set_venue_status(&manager,&blend,&1);c.set_venue_registry(&manager,&reg);
    c.set_allowed_venues(&manager,&Vec::new(env),&vec![env,adapter.clone()]);
    let mut bindings=Vec::new(env);for(pool_id,input,output)in [(1,a.clone(),b.clone()),(2,b.clone(),a.clone())]{let route=ManagedSushiRoute{pool:venue.clone(),token_in:input.clone(),token_out:output.clone(),fee:3000};bindings.push_back(ManagedRouteBinding{family:ManagedRouteFamily::Sushi,adapter:adapter.clone(),executor:router.clone(),venue:venue.clone(),pool_id,path:vec![env,input,output],config_hash:env.crypto().sha256(&route.to_xdr(env)).to_bytes()});}
    c.enable_managed_routes(&manager,&ManagedPolicy{epoch_seconds:60,manager_window:60,min_request_shares:1,buffer_bps:0,blend_market_id:1,blend_adapter:Some(blend.clone())},&ManagedPortfolioPolicy{routes:vec![env,ManagedSpotRoute{asset:b.clone(),router:router.clone()}],instant_cash:true,auto_payout:false,max_slippage_bps:100,cancel_lock_seconds:3600},&bindings);
    for token in [&a,&b]{Mint::new(env,token).mint(&owner,&5000);Mint::new(env,token).mint(&venue,&5000);Token::new(env,token).approve(&owner,&fund,&5000,&1000);}
    c.deposit_protected(&owner,&Asset{contract:a.clone()},&400,&400);c.deposit_protected(&owner,&Asset{contract:b.clone()},&600,&600);
    F{c,owner,manager,a,b,oracle,adapter,router,venue,blend,pool,registry}
}
fn step(f:&F,sell:bool,amount:i128,min:i128)->SwapStep{SwapStep{adapter:f.adapter.clone(),pool_id:if sell{2}else{1},asset_in:Asset{contract:if sell{f.b.clone()}else{f.a.clone()}},asset_out:Asset{contract:if sell{f.a.clone()}else{f.b.clone()}},amount_in:amount,min_out:min,router_addr:f.router.clone()}}
fn advance(env:&Env,f:&F,t:u64){env.ledger().set_timestamp(t);let o=DummyOracleClient::new(env,&f.oracle);o.set_price(&f.a,&10_000_000,&t);o.set_price(&f.b,&10_000_000,&t);}
fn supplied(env:&Env)->F<'_>{let f=fixture(env);f.c.credit_supply(&f.manager,&CreditProtocol::Blend,&1,&f.b,&600);f}
#[test]
fn settlement_reports_bounded_dust_progress_and_keeps_the_next_investor() {
    let env=Env::default();let f=fixture(&env);let other=Address::generate(&env);
    Mint::new(&env,&f.a).mint(&other,&100);Token::new(&env,&f.a).approve(&other,&f.c.address,&100,&1000);
    f.c.deposit_protected(&other,&Asset{contract:f.a.clone()},&100,&100);
    let dust=f.c.request_withdrawal(&f.owner,&1);
    advance(&env,&f,1021);DummyOracleClient::new(&env,&f.oracle).set_price(&f.b,&5_000_000,&1021);
    let next=f.c.request_withdrawal(&other,&100);let free=f.c.shares_of(&f.owner);
    let out=f.c.settle_withdrawals(&16);
    assert_eq!((out.head_before,out.head_after,out.visited,out.settled_shares),(1,2,2,0));
    assert_eq!(f.c.shares_of(&f.owner),free+1);
    assert_eq!(f.c.withdrawal_request(&dust.id).unwrap().cancelled_shares,1);
    assert_eq!(f.c.withdrawal_request(&next.id).unwrap().pending_shares,100);
    let unchanged=f.c.settle_withdrawals(&16);
    assert_eq!((unchanged.head_before,unchanged.head_after,unchanged.settled_shares),(2,2,0));
    advance(&env,&f,1080);DummyOracleClient::new(&env,&f.oracle).set_price(&f.b,&5_000_000,&1080);
    let paid=f.c.settle_withdrawals(&16);assert_eq!((paid.head_before,paid.head_after,paid.settled_shares),(2,3,100));
    assert_eq!(f.c.claim_withdrawal(&other,&next.id),paid.reserved_assets);
    assert_eq!(f.c.managed_queue_state().reserved_assets,0);
}
#[test]
fn instant_cash_skips_any_closed_prefix_without_skipping_pending_investors() {
    for count in [0, 15, 16, 17, 34] {
        let env=Env::default();let f=fixture(&env);
        for _ in 0..count {let r=f.c.request_withdrawal(&f.owner,&1);f.c.cancel_withdrawal(&f.owner,&r.id);}
        assert_eq!(f.c.managed_queue_state().pending_shares,0);
        assert_eq!(f.c.redeem_liquid(&f.owner,&400),400);
        assert_eq!(f.c.shares_of(&f.owner),600);
        assert_eq!(f.c.managed_queue_state().reserved_assets,0);
        assert_eq!(f.c.managed_queue_state().head,f.c.managed_queue_state().next_id);
        // The remainder is invested, so an attempted cash exit still reverts.
        assert!(f.c.try_redeem_liquid(&f.owner,&600).is_err());
        assert_eq!(f.c.shares_of(&f.owner),600);
        let pending=f.c.request_withdrawal(&f.owner,&100);
        assert!(f.c.try_redeem_liquid(&f.owner,&1).is_err());
        assert_eq!(f.c.withdrawal_request(&pending.id).unwrap().pending_shares,100);
        assert_eq!(f.c.managed_queue_state().pending_shares,100);
    }
}
#[test]
fn instant_cash_preserves_other_owners_fixed_claim_after_closed_prefix() {
    let env=Env::default();let f=fixture(&env);
    let other=Address::generate(&env);Mint::new(&env,&f.a).mint(&other,&100);
    Token::new(&env,&f.a).approve(&other,&f.c.address,&100,&1000);
    f.c.deposit_protected(&other,&Asset{contract:f.a.clone()},&100,&100);
    let r=f.c.request_withdrawal(&other,&100);advance(&env,&f,1020);
    assert_eq!(f.c.settle_withdrawals(&16).reserved_assets,100);
    for _ in 0..34 {let c=f.c.request_withdrawal(&f.owner,&1);f.c.cancel_withdrawal(&f.owner,&c.id);}
    assert_eq!(f.c.redeem_liquid(&f.owner,&400),400);
    assert_eq!(f.c.managed_queue_state().reserved_assets,100);
    assert_eq!(f.c.withdrawal_request(&r.id).unwrap().claimable_assets,100);
    assert_eq!(f.c.claim_withdrawal(&other,&r.id),100);
    assert_eq!(f.c.managed_queue_state().reserved_assets,0);
}
#[test]
fn withdrawal_lots_balance_integer_tail_and_fully_redeem_without_loosening_trading() {
    let env=Env::default();let f=fixture_risk(&env,true);
    f.c.deposit_protected(&f.owner,&Asset{contract:f.b.clone()},&3,&3);
    let request=f.c.request_withdrawal(&f.owner,&1003);advance(&env,&f,1080);
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,151,150)).is_err());
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,1,1)).is_err());
    assert!(f.c.portfolio_liquidation_steps(&120).is_empty());
    let mut amounts=Vec::new(&env);
    for _ in 0..6 {
        let plan=f.c.portfolio_liquidation_steps(&10_000);
        if plan.is_empty(){break;}
        assert_eq!(plan.len(),1);let s=plan.first().unwrap();assert!(s.amount_in<=150);
        amounts.push_back(s.amount_in);f.c.liquidate_withdrawal(&f.owner,&s);
        if amounts.len()==1 {assert!(f.c.try_rebalance(&f.manager,&vec![&env,step(&f,true,121,120)]).is_err());}
    }
    assert_eq!(amounts,vec![&env,121i128,121,121,120,120]);
    assert_eq!(f.c.liquid_balance(&f.b),0);assert_eq!(f.c.nav(),1003);
    assert_eq!(f.c.settle_withdrawals(&16).settled_shares,1003);
    assert_eq!(f.c.claim_withdrawal(&f.owner,&request.id),1003);
    assert_eq!(f.c.withdrawal_request(&request.id).unwrap().pending_shares,0);
    assert_eq!(f.c.shares_of(&f.owner),0);assert_eq!(f.c.total_shares(),0);assert_eq!(f.c.nav(),0);
    assert_eq!(Token::new(&env,&f.b).balance(&f.c.address),0);
}
#[test]
fn withdrawal_lot_does_not_reset_after_a_partial_claim_or_leak_to_next_request() {
    let env=Env::default();let f=fixture_risk(&env,true);let request=f.c.request_withdrawal(&f.owner,&1000);advance(&env,&f,1080);
    f.c.liquidate_withdrawal(&f.owner,&f.c.portfolio_liquidation_steps(&10_000).first().unwrap());
    f.c.settle_withdrawals(&16);f.c.claim_withdrawal(&f.owner,&request.id);
    assert_eq!(f.c.portfolio_liquidation_steps(&10_000).first().unwrap().amount_in,150);
    for _ in 0..4 {let plan=f.c.portfolio_liquidation_steps(&10_000);if plan.is_empty(){break;}f.c.liquidate_withdrawal(&f.owner,&plan.first().unwrap());}
    f.c.settle_withdrawals(&16);f.c.claim_withdrawal(&f.owner,&request.id);assert_eq!(f.c.total_shares(),0);
    f.c.deposit_protected(&f.owner,&Asset{contract:f.b.clone()},&40,&40);let next=f.c.request_withdrawal(&f.owner,&40);assert_ne!(request.id,next.id);advance(&env,&f,1200);
    assert_eq!(f.c.portfolio_liquidation_steps(&10_000).first().unwrap().amount_in,10);
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,11,11)).is_err());
}
#[test]
fn withdrawal_lots_keep_fifo_other_owners_and_cash_buffer_backing() {
    let env=Env::default();let f=fixture_risk(&env,true);let other=Address::generate(&env);
    Mint::new(&env,&f.a).mint(&other,&100);Token::new(&env,&f.a).approve(&other,&f.c.address,&100,&1000);
    f.c.deposit_protected(&other,&Asset{contract:f.a.clone()},&100,&100);
    let r=f.c.request_withdrawal(&f.owner,&1000);advance(&env,&f,1080);
    for _ in 0..8 {let plan=f.c.portfolio_liquidation_steps(&10_000);if plan.is_empty(){break;}let s=plan.first().unwrap();assert!(s.amount_in<=150);f.c.liquidate_withdrawal(&f.owner,&s);}
    f.c.settle_withdrawals(&16);assert_eq!(f.c.claim_withdrawal(&f.owner,&r.id),1000);
    assert_eq!(f.c.shares_of(&other),100);assert_eq!(f.c.nav(),100);assert_eq!(f.c.total_shares(),100);assert!(f.c.liquid_balance(&f.b)>0);
}
#[test]
fn cancelled_head_cannot_supply_the_next_requests_lot_reference() {
    let env=Env::default();let f=fixture_risk(&env,true);let first=f.c.request_withdrawal(&f.owner,&1000);advance(&env,&f,1080);
    f.c.liquidate_withdrawal(&f.owner,&f.c.portfolio_liquidation_steps(&10_000).first().unwrap());
    advance(&env,&f,4680);f.c.cancel_withdrawal(&f.owner,&first.id);let next=f.c.request_withdrawal(&f.owner,&1000);assert_ne!(first.id,next.id);advance(&env,&f,4800);
    let plan=f.c.portfolio_liquidation_steps(&10_000);let s=plan.first().unwrap();assert!(s.amount_in<=112);assert_eq!(s.amount_in,90);f.c.liquidate_withdrawal(&f.owner,&s);
}
#[test]
fn withdrawal_lots_preserve_window_oracle_venue_slippage_and_current_policy() {
    let env=Env::default();let f=fixture_risk(&env,true);f.c.request_withdrawal(&f.owner,&1000);
    assert!(f.c.try_liquidate_withdrawal(&f.manager,&step(&f,true,150,150)).is_err());advance(&env,&f,1020);
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,150,150)).is_err());advance(&env,&f,1080);
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,150,140)).is_err());
    f.registry.set_venue_status(&f.manager,&f.adapter,&0);assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,150,150)).is_err());f.registry.set_venue_status(&f.manager,&f.adapter,&1);
    f.c.liquidate_withdrawal(&f.owner,&f.c.portfolio_liquidation_steps(&10_000).first().unwrap());
    f.c.set_swap_risk_policy(&f.manager,&true,&true,&300,&300,&350,&900,&1000);
    assert!(f.c.portfolio_liquidation_steps(&10_000).first().unwrap().amount_in<=60);
    assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,61,61)).is_err());
    env.ledger().set_timestamp(3000);assert!(f.c.try_portfolio_liquidation_steps(&10_000).is_err());assert!(f.c.try_liquidate_withdrawal(&f.owner,&step(&f,true,50,50)).is_err());
    assert_eq!(f.c.liquid_balance(&f.b),450);
}
#[test]fn deprecated_credit_allows_existing_withdrawal_and_emergency_disable_preserves_cash_claims(){
    let env=Env::default();let f=supplied(&env);f.registry.set_venue_status(&f.manager,&f.blend,&3);
    assert!(f.c.try_credit_supply(&f.manager,&CreditProtocol::Blend,&1,&f.b,&1).is_err());
    assert_eq!(f.c.credit_withdraw(&f.manager,&CreditProtocol::Blend,&1,&f.b,&100),100);assert_eq!(f.pool.collateral(&f.c.address,&f.b),500);assert_eq!(f.c.nav(),1000);
    f.registry.set_venue_status(&f.manager,&f.blend,&0);assert!(f.c.try_credit_withdraw(&f.manager,&CreditProtocol::Blend,&1,&f.b,&1).is_err());assert_eq!(f.c.nav(),1000);
    let request=f.c.request_withdrawal(&f.owner,&300);advance(&env,&f,1020);assert_eq!(f.c.settle_withdrawals(&16).reserved_assets,300);assert_eq!(f.c.claim_withdrawal(&f.owner,&request.id),300);assert_eq!(f.c.nav(),700);assert_eq!(f.pool.collateral(&f.c.address,&f.b),500);
}
#[test]fn bound_real_sushi_dispatch_measures_balances_and_has_no_allowance(){let env=Env::default();let f=fixture(&env);assert_eq!(f.c.rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]),100);assert_eq!(f.c.liquid_balance(&f.a),500);assert_eq!(f.c.liquid_balance(&f.b),500);assert_eq!(Token::new(&env,&f.b).balance(&f.adapter),0);assert_eq!(Token::new(&env,&f.b).allowance(&f.adapter,&f.venue),0);assert_eq!(f.c.nav(),1000);}
#[test]fn generator_preserves_actual_direction_and_nonzero_pool_id(){let env=Env::default();let f=fixture(&env);let q=f.c.portfolio_trade_quote(&f.b,&10,&true);assert_eq!(q.pool_id,2);assert_eq!(q.adapter,f.adapter);let q=f.c.portfolio_trade_quote(&f.b,&10,&false);assert_eq!(q.pool_id,1);}
#[test]fn auto_requires_admission_of_effective_adapter_not_internal_router(){let env=Env::default();let f=fixture(&env);assert!(f.c.try_rebalance_auto(&f.manager,&vec![&env,step(&f,true,100,100)]).is_err());assert_eq!(f.c.liquid_balance(&f.b),600);f.registry.set_venue_status(&f.manager,&f.adapter,&2);assert_eq!(f.c.rebalance_auto(&f.manager,&vec![&env,step(&f,true,100,100)]),100);}
#[test]fn pinned_sushi_route_cannot_be_retargeted(){let env=Env::default();let f=fixture(&env);assert!(SushiAdapterClient::new(&env,&f.adapter).try_set_pool_route(&f.manager,&2,&SushiPoolRoute{pool:f.venue.clone(),token_in:f.b.clone(),token_out:f.a.clone(),fee:3000}).is_err());assert_eq!(f.c.rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]),100);}
#[test]fn pool_identity_drift_rolls_back_before_swap(){let env=Env::default();let f=fixture(&env);SushiVenueClient::new(&env,&f.venue).configure(&Address::generate(&env),&f.b,&false);assert!(f.c.try_rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]).is_err());assert_eq!(f.c.liquid_balance(&f.b),600);assert_eq!(Token::new(&env,&f.b).balance(&f.adapter),0);}
#[test]fn wrong_adapter_and_fabricated_pool_zero_do_not_fallback(){let env=Env::default();let f=fixture(&env);let mut s=step(&f,true,100,100);s.pool_id=0;assert!(f.c.try_rebalance(&f.manager,&vec![&env,s]).is_err());let mut s=step(&f,true,100,100);s.adapter=Address::generate(&env);assert!(f.c.try_rebalance(&f.manager,&vec![&env,s]).is_err());assert_eq!(f.c.nav(),1000);}
#[test]fn short_actual_receipt_rolls_back_entire_prefunded_swap(){let env=Env::default();let f=fixture(&env);SushiVenueClient::new(&env,&f.venue).configure(&f.a,&f.b,&true);assert!(f.c.try_rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]).is_err());assert_eq!(f.c.liquid_balance(&f.b),600);assert_eq!(Token::new(&env,&f.b).balance(&f.c.address),600);assert_eq!(Token::new(&env,&f.b).balance(&f.adapter),0);}
#[test]fn split_legs_are_measured_separately_and_keep_total_nav(){let env=Env::default();let f=fixture(&env);assert_eq!(f.c.rebalance(&f.manager,&vec![&env,step(&f,true,50,50),step(&f,true,70,70)]),70);assert_eq!(f.c.liquid_balance(&f.a),520);assert_eq!(f.c.liquid_balance(&f.b),480);assert_eq!(f.c.nav(),1000);}
#[test]fn cross_asset_blend_recovery_full_fifo_claim_preserves_receipt(){let env=Env::default();let f=supplied(&env);let r=f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,1020);assert_eq!(f.c.withdrawal_status().recovery_needed,500);assert_eq!(f.c.prepare_asset_liquidity(&f.manager,&step(&f,true,500,500)),500);assert_eq!(f.c.managed_queue_state().reserved_assets,0);assert_eq!(f.c.withdrawal_request(&r.id).unwrap().pending_shares,900);assert_eq!(f.c.settle_withdrawals(&16).reserved_assets,900);assert_eq!(f.c.claim_withdrawal(&f.owner,&r.id),900);assert_eq!(f.c.withdrawal_request(&r.id).unwrap().claimed_assets,900);assert!(f.c.try_claim_withdrawal(&f.owner,&r.id).is_err());assert_eq!(f.c.nav(),100);assert_eq!(f.pool.collateral(&f.c.address,&f.b),100);}
#[test]fn failed_swap_reverts_blend_withdrawal_cash_position_and_queue(){let env=Env::default();let f=supplied(&env);let r=f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,1020);SushiVenueClient::new(&env,&f.venue).configure(&f.a,&f.b,&true);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,500,500)).is_err());assert_eq!(f.pool.collateral(&f.c.address,&f.b),600);assert_eq!(Token::new(&env,&f.b).balance(&f.pool.address),600);assert_eq!(f.c.liquid_balance(&f.a),400);assert_eq!(f.c.liquid_balance(&f.b),0);assert_eq!(f.c.managed_queue_state().reserved_assets,0);assert_eq!(f.c.withdrawal_request(&r.id).unwrap().pending_shares,900);}
#[test]fn recovery_respects_eligible_manager_window_and_permissionless_escape(){let env=Env::default();let f=supplied(&env);f.c.request_withdrawal(&f.owner,&900);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,100,100)).is_err());advance(&env,&f,1020);assert!(f.c.try_prepare_asset_liquidity(&f.owner,&step(&f,true,100,100)).is_err());advance(&env,&f,1080);assert_eq!(f.c.prepare_asset_liquidity(&f.owner,&step(&f,true,100,100)),100);}
#[test]fn debt_blocks_cross_asset_recovery_without_erasing_obligations(){let env=Env::default();let f=supplied(&env);let r=f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,1020);f.pool.set_debt(&f.c.address,&f.a,&1);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,100,100)).is_err());assert_eq!(f.c.withdrawal_request(&r.id).unwrap().pending_shares,900);assert_eq!(f.pool.collateral(&f.c.address,&f.b),600);}
#[test]fn excessive_recovery_and_borrow_are_rejected(){let env=Env::default();let f=supplied(&env);f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,1020);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,501,501)).is_err());assert!(f.c.try_credit_borrow(&f.manager,&CreditProtocol::Blend,&1,&f.b,&1).is_err());}
#[test]fn cancellation_after_escape_preserves_shares_and_no_reservation(){let env=Env::default();let f=supplied(&env);let r=f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,4620);assert_eq!(f.c.cancel_withdrawal(&f.owner,&r.id).cancelled_shares,900);assert_eq!(f.c.shares_of(&f.owner),1000);assert_eq!(f.c.managed_queue_state().reserved_assets,0);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,100,100)).is_err());}
#[test]fn stale_oracle_and_disabled_venue_fail_closed(){let env=Env::default();let f=fixture(&env);env.ledger().set_timestamp(2000);assert!(f.c.try_rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]).is_err());advance(&env,&f,2000);f.registry.set_venue_status(&f.manager,&f.adapter,&0);assert!(f.c.try_rebalance(&f.manager,&vec![&env,step(&f,true,100,100)]).is_err());}
#[test]fn configured_v3_cannot_change_router_or_reinitialize_bindings(){let env=Env::default();let f=fixture(&env);assert!(f.c.try_set_router(&f.manager,&Address::generate(&env)).is_err());let p=f.c.managed_withdrawal_policy().unwrap();let q=f.c.managed_portfolio_policy().unwrap();assert!(f.c.try_enable_managed_routes(&f.manager,&p,&q,&f.c.managed_routes()).is_err());assert_eq!(f.c.nav(),1000);}
#[test]fn existing_twentyfive_percent_policy_is_preserved_in_partial_recovery(){let env=Env::default();let f=fixture_risk(&env,true);f.c.credit_supply(&f.manager,&CreditProtocol::Blend,&1,&f.b,&600);let r=f.c.request_withdrawal(&f.owner,&900);advance(&env,&f,1020);assert!(f.c.try_prepare_asset_liquidity(&f.manager,&step(&f,true,500,500)).is_err());assert_eq!(f.pool.collateral(&f.c.address,&f.b),600);assert_eq!(f.c.prepare_blend_asset(&f.manager,&500,&step(&f,true,125,125)),125);assert_eq!(f.c.liquid_balance(&f.b),375);assert_eq!(f.pool.collateral(&f.c.address,&f.b),100);assert_eq!(f.c.managed_queue_state().reserved_assets,0);assert_eq!(f.c.settle_withdrawals(&16).reserved_assets,525);assert_eq!(f.c.withdrawal_request(&r.id).unwrap().pending_shares,375);assert_eq!(f.c.claim_withdrawal(&f.owner,&r.id),525);assert_eq!(f.c.managed_queue_state().pending_shares,375);advance(&env,&f,4620);let receipt=f.c.cancel_withdrawal(&f.owner,&r.id);assert_eq!(receipt.cancelled_shares,375);assert_eq!(receipt.claimed_assets,525);assert_eq!(f.c.shares_of(&f.owner),475);assert_eq!(f.c.nav(),475);}
