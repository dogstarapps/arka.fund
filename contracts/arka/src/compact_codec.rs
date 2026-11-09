//! Shared, schema-checked WASM record codec. The native SDK codecs and all
//! embedded SDK-generated specifications remain unchanged.
//! SAFETY: schemas below are generated only by record! for the exact Rust type.
//! offset_of! supplies real field offsets, not an assumed repr/layout. Pointers
//! never escape a call, each typed callback reads/writes only its own field,
//! and compile-time needs_drop checks make partial initialization error-safe.
//! No wider arithmetic, unchecked Val conversion or relaxed schema validation.
use soroban_sdk::{ConversionError,Env,EnvBase,MapObject,TryFromVal,Val};
use crate::*;

// Stack reservation for this revision's largest statically generated record;
// not a limit on user amounts, requests, routes or other financial inputs.
const GENERATED_FIELD_COUNT:usize=14;
pub(crate) struct Field{pub offset:u8,pub codec:u8,pub key:u8}
#[repr(C,packed)] #[derive(Copy,Clone)] struct Name{start:u16,len:u8}
const NAME_TEXT:&str="adapteraddressallow_borrowallow_repayallow_supplyallow_withdrawamountamount_inassetasset_inasset_outauto_payoutb_rateb_supplybackstop_creditbalanceblend_adapterblend_market_idbstop_ratebuffer_bpsc_factorcancel_lock_secondscancelled_sharescashclaimable_assetsclaimed_assetscollateralcollateral_amountcollateral_sharescollateral_valueconfigconfig_hashcontractcreated_atcumulative_management_sharescumulative_manager_sharescumulative_performance_sharescumulative_protocol_sharesd_rated_supplydatadebt_amountdebt_sharesdebt_valuedecimalsdeposit_bpseligible_atenabledepoch_secondsexecutorfail_close_actionsfail_close_navfamilyhas_disabled_reservehas_future_oracle_timestamphas_invalid_oracle_datahas_live_pricinghas_stale_oracleheadhealth_factorhigh_water_markhigh_water_mark_afterhigh_water_mark_beforeholderidindexinstant_cashir_modl_factorlast_settled_atlast_settlement_tslast_timeliabilitiesmanagement_fee_sharesmanagement_fee_valuemanager_fee_sharesmanager_windowmarket_idmax_allowed_fee_bpsmax_borrow_per_actionmax_debt_for_assetmax_oracle_agemax_oracle_age_secondsmax_positionsmax_price_agemax_price_impact_bpsmax_slippage_bpsmax_spread_bpsmax_trade_size_bpsmax_twap_deviation_bpsmax_utilmgmt_bpsmgmt_protocol_bpsmin_collateralmin_health_factormin_outmin_request_sharesnavnav_beforenav_blockednet_valuenext_idoracleoracle_ageoracle_checks_enabledoracle_timestampownerpathpending_countpending_sharesperf_bpsperf_protocol_bpsperformance_fee_sharesperformance_fee_valuepoolpool_factorypool_idpool_indexpool_statuspriceprotocolprotocol_fee_sharesqueuer_baser_oner_threer_tworeactivityrecovery_availablerecovery_neededrecovery_public_atredeem_bpsrequest_typerequested_sharesreserved_assetsrisky_actions_blockedrouterrouter_addrroutesscalarsettle_capacitysettled_sharesshare_price_aftershare_price_beforestatussupplysupply_captimestamptoken_intoken_outtokenstotal_sharestotal_shares_aftertotal_shares_beforeutilvenuevisitedfeehead_afterhead_before";
const NAME_INDEX:[Name;160]=[Name{start:0,len:7},Name{start:7,len:7},Name{start:14,len:12},Name{start:26,len:11},Name{start:37,len:12},Name{start:49,len:14},Name{start:63,len:6},Name{start:69,len:9},Name{start:78,len:5},Name{start:83,len:8},Name{start:91,len:9},Name{start:100,len:11},Name{start:111,len:6},Name{start:117,len:8},Name{start:125,len:15},Name{start:140,len:7},Name{start:147,len:13},Name{start:160,len:15},Name{start:175,len:10},Name{start:185,len:10},Name{start:195,len:8},Name{start:203,len:19},Name{start:222,len:16},Name{start:238,len:4},Name{start:242,len:16},Name{start:258,len:14},Name{start:272,len:10},Name{start:282,len:17},Name{start:299,len:17},Name{start:316,len:16},Name{start:332,len:6},Name{start:338,len:11},Name{start:349,len:8},Name{start:357,len:10},Name{start:367,len:28},Name{start:395,len:25},Name{start:420,len:29},Name{start:449,len:26},Name{start:475,len:6},Name{start:481,len:8},Name{start:489,len:4},Name{start:493,len:11},Name{start:504,len:11},Name{start:515,len:10},Name{start:525,len:8},Name{start:533,len:11},Name{start:544,len:11},Name{start:555,len:7},Name{start:562,len:13},Name{start:575,len:8},Name{start:583,len:18},Name{start:601,len:14},Name{start:615,len:6},Name{start:621,len:20},Name{start:641,len:27},Name{start:668,len:23},Name{start:691,len:16},Name{start:707,len:16},Name{start:723,len:4},Name{start:727,len:13},Name{start:740,len:15},Name{start:755,len:21},Name{start:776,len:22},Name{start:798,len:6},Name{start:804,len:2},Name{start:806,len:5},Name{start:811,len:12},Name{start:823,len:6},Name{start:829,len:8},Name{start:837,len:15},Name{start:852,len:18},Name{start:870,len:9},Name{start:879,len:11},Name{start:890,len:21},Name{start:911,len:20},Name{start:931,len:18},Name{start:949,len:14},Name{start:963,len:9},Name{start:972,len:19},Name{start:991,len:21},Name{start:1012,len:18},Name{start:1030,len:14},Name{start:1044,len:22},Name{start:1066,len:13},Name{start:1079,len:13},Name{start:1092,len:20},Name{start:1112,len:16},Name{start:1128,len:14},Name{start:1142,len:18},Name{start:1160,len:22},Name{start:1182,len:8},Name{start:1190,len:8},Name{start:1198,len:17},Name{start:1215,len:14},Name{start:1229,len:17},Name{start:1246,len:7},Name{start:1253,len:18},Name{start:1271,len:3},Name{start:1274,len:10},Name{start:1284,len:11},Name{start:1295,len:9},Name{start:1304,len:7},Name{start:1311,len:6},Name{start:1317,len:10},Name{start:1327,len:21},Name{start:1348,len:16},Name{start:1364,len:5},Name{start:1369,len:4},Name{start:1373,len:13},Name{start:1386,len:14},Name{start:1400,len:8},Name{start:1408,len:17},Name{start:1425,len:22},Name{start:1447,len:21},Name{start:1468,len:4},Name{start:1472,len:12},Name{start:1484,len:7},Name{start:1491,len:10},Name{start:1501,len:11},Name{start:1512,len:5},Name{start:1517,len:8},Name{start:1525,len:19},Name{start:1544,len:5},Name{start:1549,len:6},Name{start:1555,len:5},Name{start:1560,len:7},Name{start:1567,len:5},Name{start:1572,len:10},Name{start:1582,len:18},Name{start:1600,len:15},Name{start:1615,len:18},Name{start:1633,len:10},Name{start:1643,len:12},Name{start:1655,len:16},Name{start:1671,len:15},Name{start:1686,len:21},Name{start:1707,len:6},Name{start:1713,len:11},Name{start:1724,len:6},Name{start:1730,len:6},Name{start:1736,len:15},Name{start:1751,len:14},Name{start:1765,len:17},Name{start:1782,len:18},Name{start:1800,len:6},Name{start:1806,len:6},Name{start:1812,len:10},Name{start:1822,len:9},Name{start:1831,len:8},Name{start:1839,len:9},Name{start:1848,len:6},Name{start:1854,len:12},Name{start:1866,len:18},Name{start:1884,len:19},Name{start:1903,len:4},Name{start:1907,len:5},Name{start:1912,len:7},Name{start:1919,len:3},Name{start:1922,len:10},Name{start:1932,len:11}];
#[inline(never)] pub(crate) fn field_name(id:u8)->&'static str{let n=NAME_INDEX[id as usize];&NAME_TEXT[n.start as usize..n.start as usize+n.len as usize]}
macro_rules! key_id{(head_after)=>{158};(head_before)=>{159};(fee)=>{157};(adapter)=>{0};(address)=>{1};(allow_borrow)=>{2};(allow_repay)=>{3};(allow_supply)=>{4};(allow_withdraw)=>{5};(amount)=>{6};(amount_in)=>{7};(asset)=>{8};(asset_in)=>{9};(asset_out)=>{10};(auto_payout)=>{11};(b_rate)=>{12};(b_supply)=>{13};(backstop_credit)=>{14};(balance)=>{15};(blend_adapter)=>{16};(blend_market_id)=>{17};(bstop_rate)=>{18};(buffer_bps)=>{19};(c_factor)=>{20};(cancel_lock_seconds)=>{21};(cancelled_shares)=>{22};(cash)=>{23};(claimable_assets)=>{24};(claimed_assets)=>{25};(collateral)=>{26};(collateral_amount)=>{27};(collateral_shares)=>{28};(collateral_value)=>{29};(config)=>{30};(config_hash)=>{31};(contract)=>{32};(created_at)=>{33};(cumulative_management_shares)=>{34};(cumulative_manager_shares)=>{35};(cumulative_performance_shares)=>{36};(cumulative_protocol_shares)=>{37};(d_rate)=>{38};(d_supply)=>{39};(data)=>{40};(debt_amount)=>{41};(debt_shares)=>{42};(debt_value)=>{43};(decimals)=>{44};(deposit_bps)=>{45};(eligible_at)=>{46};(enabled)=>{47};(epoch_seconds)=>{48};(executor)=>{49};(fail_close_actions)=>{50};(fail_close_nav)=>{51};(family)=>{52};(has_disabled_reserve)=>{53};(has_future_oracle_timestamp)=>{54};(has_invalid_oracle_data)=>{55};(has_live_pricing)=>{56};(has_stale_oracle)=>{57};(head)=>{58};(health_factor)=>{59};(high_water_mark)=>{60};(high_water_mark_after)=>{61};(high_water_mark_before)=>{62};(holder)=>{63};(id)=>{64};(index)=>{65};(instant_cash)=>{66};(ir_mod)=>{67};(l_factor)=>{68};(last_settled_at)=>{69};(last_settlement_ts)=>{70};(last_time)=>{71};(liabilities)=>{72};(management_fee_shares)=>{73};(management_fee_value)=>{74};(manager_fee_shares)=>{75};(manager_window)=>{76};(market_id)=>{77};(max_allowed_fee_bps)=>{78};(max_borrow_per_action)=>{79};(max_debt_for_asset)=>{80};(max_oracle_age)=>{81};(max_oracle_age_seconds)=>{82};(max_positions)=>{83};(max_price_age)=>{84};(max_price_impact_bps)=>{85};(max_slippage_bps)=>{86};(max_spread_bps)=>{87};(max_trade_size_bps)=>{88};(max_twap_deviation_bps)=>{89};(max_util)=>{90};(mgmt_bps)=>{91};(mgmt_protocol_bps)=>{92};(min_collateral)=>{93};(min_health_factor)=>{94};(min_out)=>{95};(min_request_shares)=>{96};(nav)=>{97};(nav_before)=>{98};(nav_blocked)=>{99};(net_value)=>{100};(next_id)=>{101};(oracle)=>{102};(oracle_age)=>{103};(oracle_checks_enabled)=>{104};(oracle_timestamp)=>{105};(owner)=>{106};(path)=>{107};(pending_count)=>{108};(pending_shares)=>{109};(perf_bps)=>{110};(perf_protocol_bps)=>{111};(performance_fee_shares)=>{112};(performance_fee_value)=>{113};(pool)=>{114};(pool_factory)=>{115};(pool_id)=>{116};(pool_index)=>{117};(pool_status)=>{118};(price)=>{119};(protocol)=>{120};(protocol_fee_shares)=>{121};(queue)=>{122};(r_base)=>{123};(r_one)=>{124};(r_three)=>{125};(r_two)=>{126};(reactivity)=>{127};(recovery_available)=>{128};(recovery_needed)=>{129};(recovery_public_at)=>{130};(redeem_bps)=>{131};(request_type)=>{132};(requested_shares)=>{133};(reserved_assets)=>{134};(risky_actions_blocked)=>{135};(router)=>{136};(router_addr)=>{137};(routes)=>{138};(scalar)=>{139};(settle_capacity)=>{140};(settled_shares)=>{141};(share_price_after)=>{142};(share_price_before)=>{143};(status)=>{144};(supply)=>{145};(supply_cap)=>{146};(timestamp)=>{147};(token_in)=>{148};(token_out)=>{149};(tokens)=>{150};(total_shares)=>{151};(total_shares_after)=>{152};(total_shares_before)=>{153};(util)=>{154};(venue)=>{155};(visited)=>{156};}
pub(crate) use key_id;
pub(crate) trait FieldType{const CODEC:u8;}
struct Codec{
    decode:unsafe fn(&Env,&Val,*mut u8)->Result<(),ConversionError>,
    encode:unsafe fn(&Env,*const u8)->Result<Val,ConversionError>,
}
#[inline(never)]
pub(crate) unsafe fn decode_field<T:TryFromVal<Env,Val>>(env:&Env,val:&Val,out:*mut u8)->Result<(),ConversionError>{
    const { assert!(!core::mem::needs_drop::<T>()); }
    let value=T::try_from_val(env,val).map_err(|_|ConversionError)?;
    // SAFETY: record! binds T and offset_of!(Record,field) together.
    unsafe{out.cast::<T>().write(value);} Ok(())
}
#[inline(never)]
pub(crate) unsafe fn encode_field<T>(env:&Env,value:*const u8)->Result<Val,ConversionError> where Val:TryFromVal<Env,T>{
    // SAFETY: value points to the live, aligned field in the input record.
    Val::try_from_val(env,unsafe{&*value.cast::<T>()}).map_err(|_|ConversionError)
}
#[inline(never)]
#[cfg(target_family="wasm")]
pub(crate) unsafe fn read_record(env:&Env,val:&Val,fields:&[Field],out:*mut u8)->Result<(),ConversionError>{
    let mut values=[Val::VOID.to_val();GENERATED_FIELD_COUNT];
    let mut keys=["";GENERATED_FIELD_COUNT];for(i,f)in fields.iter().enumerate(){keys[i]=field_name(f.key);}
    let map:MapObject=(*val).try_into().map_err(|_|ConversionError)?;
    env.map_unpack_to_slice(map,&keys[..fields.len()],&mut values[..fields.len()]).map_err(|_|ConversionError)?;
    for (i,field) in fields.iter().enumerate(){
        // SAFETY: caller passes its generated schema and MaybeUninit<Record>.
        unsafe{(CODECS[field.codec as usize].decode)(env,&values[i],out.add(field.offset as usize))?;}
    }
    Ok(())
}
#[inline(never)]
#[cfg(target_family="wasm")]
pub(crate) unsafe fn write_record(env:&Env,value:*const u8,fields:&[Field])->Result<Val,ConversionError>{
    let mut values=[Val::VOID.to_val();GENERATED_FIELD_COUNT];
    let mut keys=["";GENERATED_FIELD_COUNT];
    for (i,field) in fields.iter().enumerate(){
        keys[i]=field_name(field.key);
        // SAFETY: generated field schema belongs to the live input record.
        values[i]=unsafe{(CODECS[field.codec as usize].encode)(env,value.add(field.offset as usize))?};
    }
    Ok(env.map_new_from_slices(&keys[..fields.len()],&values[..fields.len()]).map_err(|_|ConversionError)?.into())
}
impl FieldType for i32{const CODEC:u8=0;}
impl FieldType for i128{const CODEC:u8=1;}
impl FieldType for u64{const CODEC:u8=2;}
impl FieldType for Address{const CODEC:u8=3;}
impl FieldType for Asset{const CODEC:u8=4;}
impl FieldType for u128{const CODEC:u8=5;}
impl FieldType for bool{const CODEC:u8=6;}
impl FieldType for CreditProtocol{const CODEC:u8=7;}
impl FieldType for u32{const CODEC:u8=8;}
impl FieldType for BlendReserveConfig{const CODEC:u8=9;}
impl FieldType for BlendReserveData{const CODEC:u8=10;}
impl FieldType for Map<u32, i128>{const CODEC:u8=11;}
impl FieldType for Option<Address>{const CODEC:u8=12;}
impl FieldType for Vec<ManagedSpotRoute>{const CODEC:u8=13;}
impl FieldType for ManagedQueue{const CODEC:u8=14;}
impl FieldType for BytesN<32>{const CODEC:u8=15;}
impl FieldType for ManagedRouteFamily{const CODEC:u8=16;}
impl FieldType for Vec<Address>{const CODEC:u8=17;}
#[cfg(target_family="wasm")]
const CODECS:[Codec;18]=[Codec{decode:decode_field::<i32>,encode:encode_field::<i32>},Codec{decode:decode_field::<i128>,encode:encode_field::<i128>},Codec{decode:decode_field::<u64>,encode:encode_field::<u64>},Codec{decode:decode_field::<Address>,encode:encode_field::<Address>},Codec{decode:decode_field::<Asset>,encode:encode_field::<Asset>},Codec{decode:decode_field::<u128>,encode:encode_field::<u128>},Codec{decode:decode_field::<bool>,encode:encode_field::<bool>},Codec{decode:decode_field::<CreditProtocol>,encode:encode_field::<CreditProtocol>},Codec{decode:decode_field::<u32>,encode:encode_field::<u32>},Codec{decode:decode_field::<BlendReserveConfig>,encode:encode_field::<BlendReserveConfig>},Codec{decode:decode_field::<BlendReserveData>,encode:encode_field::<BlendReserveData>},Codec{decode:decode_field::<Map<u32, i128>>,encode:encode_field::<Map<u32, i128>>},Codec{decode:decode_field::<Option<Address>>,encode:encode_field::<Option<Address>>},Codec{decode:decode_field::<Vec<ManagedSpotRoute>>,encode:encode_field::<Vec<ManagedSpotRoute>>},Codec{decode:decode_field::<ManagedQueue>,encode:encode_field::<ManagedQueue>},Codec{decode:decode_field::<BytesN<32>>,encode:encode_field::<BytesN<32>>},Codec{decode:decode_field::<ManagedRouteFamily>,encode:encode_field::<ManagedRouteFamily>},Codec{decode:decode_field::<Vec<Address>>,encode:encode_field::<Vec<Address>>}];
macro_rules! record {
    ($name:ident, $spec:path; $(($i:literal,$field:ident,$ty:ty)),+ $(,)?) => {
        impl $name{pub(crate) const COMPACT_KEYS:&'static[u8]=&[$(crate::compact_codec::key_id!($field)),+];}
        #[cfg(target_family="wasm")]
        impl $name {pub const fn spec_xdr()->[u8;<$spec>::spec_xdr().len()]{<$spec>::spec_xdr()}}
        #[cfg(target_family="wasm")]
        impl soroban_sdk::TryFromVal<soroban_sdk::Env,soroban_sdk::Val> for $name {
            type Error=soroban_sdk::ConversionError;
            #[inline(always)]
            fn try_from_val(env:&soroban_sdk::Env,val:&soroban_sdk::Val)->Result<Self,Self::Error>{
                const FIELDS:&[crate::compact_codec::Field]=&[$(crate::compact_codec::Field{
                    offset:{const O:usize=core::mem::offset_of!($name,$field);assert!(O<=u8::MAX as usize);O as u8},
                    codec:<$ty as crate::compact_codec::FieldType>::CODEC,
                    key:crate::compact_codec::key_id!($field),
                }),+];
                const{assert!(!core::mem::needs_drop::<$name>());assert!([$(stringify!($field)),+].len()<=14);}
                let mut out=core::mem::MaybeUninit::<Self>::uninit();
                // SAFETY: fields and type are generated together; all fields
                // are initialized on success, and none require Drop on error.
                unsafe{crate::compact_codec::read_record(env,val,FIELDS,out.as_mut_ptr().cast())?;Ok(out.assume_init())}
            }
        }
        #[cfg(target_family="wasm")]
        impl soroban_sdk::TryFromVal<soroban_sdk::Env,$name> for soroban_sdk::Val {
            type Error=soroban_sdk::ConversionError;
            #[inline(always)]
            fn try_from_val(env:&soroban_sdk::Env,val:&$name)->Result<Self,Self::Error>{
                const FIELDS:&[crate::compact_codec::Field]=&[$(crate::compact_codec::Field{
                    offset:{const O:usize=core::mem::offset_of!($name,$field);assert!(O<=u8::MAX as usize);O as u8},
                    codec:<$ty as crate::compact_codec::FieldType>::CODEC,
                    key:crate::compact_codec::key_id!($field),
                }),+];
                // SAFETY: val is a fully initialized, borrowed $name and each
                // offset/callback has exactly the corresponding field type.
                unsafe{crate::compact_codec::write_record(env,(val as *const $name).cast(),FIELDS)}
            }
        }
        #[cfg(target_family="wasm")]
        impl soroban_sdk::TryFromVal<soroban_sdk::Env,&$name> for soroban_sdk::Val {
            type Error=soroban_sdk::ConversionError;
            #[inline(always)]
            fn try_from_val(env:&soroban_sdk::Env,val:&&$name)->Result<Self,Self::Error>{
                <Self as soroban_sdk::TryFromVal<soroban_sdk::Env,$name>>::try_from_val(env,*val)
            }
        }
    };
}
pub(crate) use record;
