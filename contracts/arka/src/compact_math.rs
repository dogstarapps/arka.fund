//! Identical i128 operations behind non-inlined boundaries. Overflow checks
//! stay enabled by the unchanged release profile. No wider intermediates,
//! saturating arithmetic, changed rounding, error policy or financial caps.
#[inline(never)] pub(crate) fn add(a:i128,b:i128)->i128 { a+b }
#[inline(never)] pub(crate) fn sub(a:i128,b:i128)->i128 { a-b }
#[inline(never)] pub(crate) fn mul(a:i128,b:i128)->i128 { a*b }
#[inline(never)] pub(crate) fn div(a:i128,b:i128)->i128 { a/b }
