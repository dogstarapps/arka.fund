# Figma Frontend Audit

Date: 2026-03-29

## Scope

This audit compares the current frontend against:

- the live Figma design source
- the local exported design references in `arkafund-assets/screens`
- the current screenshot capture set in `tmp/design-audit/current`

The purpose of this document is to distinguish clearly between:

- routes that are strongly grounded in the available Figma material
- routes that were derived because the Figma file does not provide an explicit final screen for that feature
- visual differences that still exist even after the redesign pass

## Methodology

Inputs used in this audit:

- live Figma metadata for `0:1` (`Page 1`)
- live Figma inspection of `1:2` (`vaults screens`)
- local reference screens:
  - `vaults screens(10).png`
  - `vaults screens(11).png`
  - `vaults screens(12).png`
  - `vaults screens(13).png`
  - `vaults screens(14).png`
- current route screenshots from `tmp/design-audit/current`
- the generated side-by-side report in `tmp/design-audit/report.md`

Important limitation:

- the live Figma file does not expose a clean one-frame-per-route mapping for every implemented feature
- the strongest explicit frame available is `1:2` (`vaults screens`), which captures the core product shell and visual grammar
- several implemented routes therefore had to be designed as equivalent derived screens rather than literal 1:1 reproductions of an explicit Figma page

## What The Figma Clearly Establishes

The live Figma and exported screens clearly define these system-level rules:

- deep violet / indigo canvas with neon-magenta and cyan accents
- a strong right-side navigation rail
- neon-green connect-wallet CTA language
- thin bright borders and glowing panel chrome
- compact, high-density information grouping
- geometric display typography for titles and large numerics
- control-room hierarchy rather than consumer-card layouts

This visual language is present in the current frontend and is now consistent across product and ops surfaces.

## Audit Verdict

### Overall verdict

- shell and visual system alignment: `Pass`
- route-family consistency: `Pass`
- direct pixel-parity against explicit Figma pages: `Partial`
- derived-screen coherence for features not present in Figma: `Pass`

### Why the verdict is `Partial` on strict parity

The current frontend is visually aligned with the Figma system, but it is not accurate to claim full pixel-parity for all routes because:

- the Figma source does not provide explicit final mocks for every implemented feature
- some current routes intentionally prioritize dense operational finance UX over illustration-heavy or marketing-heavy compositions present in some reference art
- spacing, panel proportions, and information packing are coherent, but not always literal copies of one exported frame

## Route-Family Matrix

| Family | Figma backing | Verdict | Notes |
| --- | --- | --- | --- |
| Dashboard shell | Direct / strong | Strong alignment | Right rail, palette, CTA language, panel chrome and density are clearly aligned. |
| Managers leaderboard | Direct / strong | Strong alignment | The route now reads as a dense leaderboard rather than a generic card view. |
| Create flow | Partial / concept-strong | Good derived alignment | Uses the same shell and wizard framing, but replaces illustration-first sections with denser deploy telemetry and real controls. |
| Governance | Partial / style-strong | Good derived alignment | Matches the governance/control-room visual family from the references, not a literal final Figma page. |
| Discover | Derived | Coherent derived screen | Uses the same shell and density rules; no exact direct mock was available. |
| Vaults leaderboard | Derived from shell and dashboard grammar | Coherent derived screen | Reads as product browsing within the established Figma system. |
| Vault profile | Derived | Coherent derived screen | Tabs, contrast and panel hierarchy fit the system; not backed by a single explicit Figma frame. |
| Managers detail / Assets detail | Derived | Coherent derived screen | Strong family consistency, no explicit direct page in Figma. |
| Coverage | Derived | Coherent derived screen | Uses the control-deck language properly, but this feature was not explicitly mocked in the Figma material reviewed. |
| Settings / Status | Derived | Coherent derived screen | Operational surfaces built faithfully from the shell grammar rather than from explicit reference screens. |
| Ops control room | Derived from governance/control-room language | Good derived alignment | Strong visual fit with the system; not a literal exported Figma page. |
| Manager tiers | Derived from wizard/control-room language | Good derived alignment | Coherent visual integration, no exact page match in Figma. |
| Live vault ops index | Derived | Coherent derived screen | Clearly part of the same family and now reads as an execution workspace. |
| Live vault execution | Derived | Good derived alignment | Operationally dense and visually consistent, but not a direct frame-for-frame copy of an explicit Figma screen. |

## Differences That Still Exist

These are the real remaining differences between the frontend and the Figma source material.

### 1. The product is denser and more operational than some Figma compositions

The implemented frontend often favors:

- more telemetry
- more status signals
- more command surfaces
- more finance-style density

The Figma references, especially around create/onboarding-style areas, sometimes spend more space on:

- illustration
- branded empty space
- staged wizard emphasis
- softer content pacing

This is not random drift, but it is a real difference.

### 2. Several derived routes are system-faithful rather than screen-faithful

For routes like:

- `discover`
- `coverage`
- `settings`
- `status`
- `ops`
- `tiers`
- `arkas`
- `arkas/[id]`

the implementation is best described as:

- faithful to the Figma system
- not guaranteed to be faithful to a non-existent dedicated Figma screen

### 3. Some panel proportions differ from the exported artboards

The current frontend uses:

- tighter vertical stacking
- slightly narrower content columns in some routes
- more frequent table/list use inside panels

The exported screens sometimes use:

- larger hero bands
- more generous content breathing room
- bigger illustration blocks

### 4. The right-rail utility block is functionally aligned but more compact

The current implementation keeps:

- the right rail
- active-state behavior
- wallet CTA language
- utility grouping

But the exact proportions and spacing of that block are more compact than in several reference exports.

## What Is Already Good Enough To Close

These areas are strong enough that I would not reopen them as “major redesign” work:

- shell, rail, palette, border language, CTA language
- dashboard and leaderboard family
- manager and asset explorers
- governance and integrations family
- create flow as a productized deployment wizard
- operational surfaces using the same visual system

## What I Would Reopen Only As Fine-Tuning

If we want a final polish pass before calling the frontend fully closed, I would only reopen:

1. create-flow panel proportions and visual pacing
2. a small spacing pass on control-room routes (`ops`, `status`, `settings`, `tiers`)
3. live-vault execution density and hierarchy tuning on `/arkas/[id]`
4. right-rail utility block spacing and CTA proportions

This is refinement work, not structural redesign.

## Final Conclusion

The frontend now matches the Figma design system and brand grammar strongly enough to say:

- the redesign is coherent
- the shell is faithful
- the derived screens are visually consistent with the source system
- the previous “generated from screenshots and full of errors” state has been materially corrected

What I would **not** say is:

- “every implemented route is a pixel-perfect copy of an explicit Figma page”

That would overstate what the source material actually provides.

The accurate conclusion is:

- direct-reference routes are in strong alignment
- non-referenced routes were resolved with equivalent, coherent design
- remaining differences are mostly refinement-level, not architectural or stylistic mismatches
