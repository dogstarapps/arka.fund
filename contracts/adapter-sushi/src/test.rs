use super::*;
use soroban_sdk::{contract, contractimpl, testutils::{Address as _, MockAuth, MockAuthInvoke}, token::{StellarAssetClient, TokenClient}};

#[contract]
struct Factory;
#[contractimpl]
impl Factory {
    pub fn bind(e: Env, pool: Address, a: Address, b: Address) { e.storage().instance().set(&0u32, &(pool,a,b)); }
    pub fn get_pool(e: Env, token_a: Address, token_b: Address, fee: u32) -> Option<Address> {
        let (pool,a,b): (Address,Address,Address) = e.storage().instance().get(&0u32).unwrap();
        if a == token_a && b == token_b && fee == 3000 { Some(pool) } else { None }
    }
}

#[contract]
struct Pool;
#[contractimpl]
impl Pool {
    pub fn __constructor(e: Env, factory: Address, a: Address, b: Address) { e.storage().instance().set(&0u32, &(factory,a,b)); }
    pub fn factory(e: Env) -> Address { let (f,_,_):(Address,Address,Address)=e.storage().instance().get(&0u32).unwrap(); f }
    pub fn token0(e: Env) -> Address { let (_,a,_):(Address,Address,Address)=e.storage().instance().get(&0u32).unwrap(); a }
    pub fn token1(e: Env) -> Address { let (_,_,b):(Address,Address,Address)=e.storage().instance().get(&0u32).unwrap(); b }
    pub fn fee(_e: Env) -> u32 { 3000 }
    pub fn mode(e: Env, mode: u32) { e.storage().instance().set(&1u32,&mode); }
    pub fn is_paused(e: Env) -> bool { e.storage().instance().get::<_,u32>(&1u32) == Some(4) }
    pub fn get_oracle_hints(_e: Env) -> OracleHints { OracleHints {checkpoint:7,checkpoint_min:3,slot:11} }
    pub fn swap(e: Env, sender: Address, recipient: Address, zero_for_one: bool, amount_specified: i128, sqrt_price_limit_x96: U256, hints: OracleHints) -> SwapResult {
        sender.require_auth();
        assert!(hints.checkpoint == 7 && hints.checkpoint_min == 3 && hints.slot == 11);
        assert!(sqrt_price_limit_x96 > U256::from_u32(&e,0));
        let mode:u32=e.storage().instance().get(&1u32).unwrap_or(0);
        let (input,output)=if zero_for_one {(Self::token0(e.clone()),Self::token1(e.clone()))}else{(Self::token1(e.clone()),Self::token0(e.clone()))};
        let spend=if mode==2 {amount_specified-1}else{amount_specified};
        let receive=if mode==1 {1}else{amount_specified*2};
        TokenClient::new(&e,&input).transfer(&sender,&e.current_contract_address(),&spend);
        TokenClient::new(&e,&output).transfer(&e.current_contract_address(),&recipient,&receive);
        let reported=if mode==3 {receive+1}else{receive};
        let (amount0,amount1)=if zero_for_one{(amount_specified,-reported)}else{(-reported,amount_specified)};
        SwapResult {amount0,amount1,liquidity:1000,sqrt_price_x96:sqrt_price_limit_x96,tick:0}
    }
}

struct Fixture<'a> { env:&'a Env, admin:Address, owner:Address, adapter:Address, pool:Address, factory:Address, a:Address, b:Address }
impl<'a> Fixture<'a> {
    fn new(env:&'a Env)->Self {
        env.mock_all_auths();
        let admin=Address::generate(env);let owner=Address::generate(env);
        let a=env.register_stellar_asset_contract_v2(admin.clone()).address();let b=env.register_stellar_asset_contract_v2(admin.clone()).address();
        let factory=env.register(Factory,());let pool=env.register(Pool,(&factory,&a,&b));FactoryClient::new(env,&factory).bind(&pool,&a,&b);
        let adapter=env.register(SushiAdapter,(&admin,&factory));
        let f=Self{env,admin,owner,adapter,pool,factory,a,b};
        f.client().set_caller(&f.admin,&f.owner,&true);
        f.client().set_pool_route(&f.admin,&1,&f.route(false));f.client().set_pool_route(&f.admin,&2,&f.route(true));
        for token in [&f.a,&f.b] {StellarAssetClient::new(env,token).mint(&f.pool,&10000);StellarAssetClient::new(env,token).mint(&f.adapter,&100);}
        f
    }
    fn client(&self)->SushiAdapterClient<'a>{SushiAdapterClient::new(self.env,&self.adapter)}
    fn route(&self,reverse:bool)->SushiPoolRoute {SushiPoolRoute{pool:self.pool.clone(),token_in:if reverse{self.b.clone()}else{self.a.clone()},token_out:if reverse{self.a.clone()}else{self.b.clone()},fee:3000}}
    fn execute(&self,id:u128,amount:i128,min:i128)->i128 {
        let args=(self.owner.clone(),id,amount,min,self.owner.clone()).into_val(self.env);
        self.client().mock_auths(&[MockAuth {address:&self.owner,invoke:&MockAuthInvoke{contract:&self.adapter,fn_name:"execute",args,sub_invokes:&[]}}]).execute(&self.owner,&id,&amount,&min,&self.owner)
    }
}

#[test]
fn exact_input_both_directions_use_real_nested_token_authorization_and_preserve_dust() {
    let e=Env::default();let f=Fixture::new(&e);
    assert_eq!(f.execute(1,10,19),20);assert_eq!(TokenClient::new(&e,&f.a).balance(&f.adapter),90);assert_eq!(TokenClient::new(&e,&f.b).balance(&f.adapter),100);assert_eq!(TokenClient::new(&e,&f.b).balance(&f.owner),20);
    assert_eq!(f.execute(2,10,19),20);assert_eq!(TokenClient::new(&e,&f.a).balance(&f.adapter),90);assert_eq!(TokenClient::new(&e,&f.b).balance(&f.adapter),90);assert_eq!(TokenClient::new(&e,&f.a).balance(&f.owner),20);
    assert_eq!(TokenClient::new(&e,&f.a).allowance(&f.adapter,&f.pool),0);
}

#[test]
fn short_output_partial_input_and_fabricated_results_roll_back_all_token_movements() {
    for mode in [1,2,3] {let e=Env::default();let f=Fixture::new(&e);PoolClient::new(&e,&f.pool).mode(&mode);
        let before=(TokenClient::new(&e,&f.a).balance(&f.adapter),TokenClient::new(&e,&f.b).balance(&f.adapter),TokenClient::new(&e,&f.a).balance(&f.pool),TokenClient::new(&e,&f.b).balance(&f.pool));
        let args=(f.owner.clone(),1u128,10i128,19i128,f.owner.clone()).into_val(&e);
        assert!(f.client().mock_auths(&[MockAuth {address:&f.owner,invoke:&MockAuthInvoke{contract:&f.adapter,fn_name:"execute",args,sub_invokes:&[]}}]).try_execute(&f.owner,&1,&10,&19,&f.owner).is_err());
        assert_eq!(before,(TokenClient::new(&e,&f.a).balance(&f.adapter),TokenClient::new(&e,&f.b).balance(&f.adapter),TokenClient::new(&e,&f.a).balance(&f.pool),TokenClient::new(&e,&f.b).balance(&f.pool)));
    }
}

#[test]
fn paused_or_unregistered_pool_fails_before_spending() {
    let e=Env::default();let f=Fixture::new(&e);PoolClient::new(&e,&f.pool).mode(&4);
    assert!(f.client().try_execute(&f.owner,&1,&10,&1,&f.owner).is_err());
    PoolClient::new(&e,&f.pool).mode(&0);FactoryClient::new(&e,&f.factory).bind(&Address::generate(&e),&f.a,&f.b);
    assert!(f.client().try_execute(&f.owner,&1,&10,&1,&f.owner).is_err());assert_eq!(TokenClient::new(&e,&f.a).balance(&f.adapter),100);
}

#[test]
fn configuration_cannot_be_retargeted_or_changed_by_another_caller() {
    let e=Env::default();let f=Fixture::new(&e);
    assert!(f.client().try_set_pool_route(&f.admin,&1,&f.route(false)).is_err());
    assert!(f.client().try_set_pool_route(&f.owner,&3,&f.route(false)).is_err());
    let mut wrong=f.route(false);wrong.fee=500;assert!(f.client().try_set_pool_route(&f.admin,&3,&wrong).is_err());
    assert!(f.client().try_execute(&f.owner,&1,&0,&1,&f.owner).is_err());assert!(f.client().try_execute(&f.owner,&1,&10,&0,&f.owner).is_err());assert!(f.client().try_execute(&f.owner,&1,&101,&1,&f.owner).is_err());
    assert!(f.client().try_execute(&f.owner,&1,&10,&1,&f.admin).is_err());
}

#[test]
fn unauthorized_or_revoked_caller_cannot_spend_adapter_dust() {
    let e=Env::default();let f=Fixture::new(&e);let stranger=Address::generate(&e);
    assert!(!f.client().is_caller(&stranger));
    assert!(f.client().try_set_caller(&stranger,&stranger,&true).is_err());
    assert!(f.client().try_execute(&stranger,&1,&10,&1,&stranger).is_err());
    f.client().set_caller(&f.admin,&f.owner,&false);
    assert!(f.client().try_execute(&f.owner,&1,&10,&1,&f.owner).is_err());
    assert_eq!(TokenClient::new(&e,&f.a).balance(&f.adapter),100);
    assert_eq!(TokenClient::new(&e,&f.b).balance(&f.adapter),100);
}
