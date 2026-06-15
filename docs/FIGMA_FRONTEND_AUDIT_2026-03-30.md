# Figma Frontend Audit

Date: 2026-03-30

## Executive Summary

This audit supersedes the softer wording from the previous pass.

The current frontend is **not yet a faithful implementation of the Figma file** at the level of:

- typography
- spacing scale
- panel proportions
- desktop layout rhythm
- component silhouette
- information pacing

What is true today:

- the frontend uses the same broad color family as the Figma exports
- the frontend keeps a right rail, neon CTA language and dark control-room intent
- the frontend is fully functional and operationally rich

What is **not** true today:

- it is not an implementation-grade translation of the real Figma
- it does not consistently match the Figma shell, density, or proportions
- several routes remain structurally different, not just “fine-tuned differently”

## Methodology

This audit used:

- live Figma MCP connectivity, revalidated on 2026-03-30
- the exported design references in `arkafund-assets/screens`
- regenerated current screenshots from `arkafund-dapp/e2e/design-audit.spec.ts`

Important limitation:

- the available live Figma context for large frames is still partial
- because of that, exact implementation data for every child node, token and padding value is not yet available through the current probe path
- exported screens therefore remain the most reliable visual source for comparison

## Honest Answer To “Are We Implementing The Real Figma?”

**Not fully yet.**

Current state:

- real Figma file access: `Yes`
- exported Figma visual assets: `Yes`
- full node-by-node implementation context from Figma: `No`
- exact fonts, paddings, token values and layout rules extracted route-by-route: `No`

So the accurate statement is:

- we are implementing **against the real Figma source material**
- but we are **not yet implementing it with full implementation-grade fidelity**

## High-Level Findings

### 1. Typography is still off

The current UI still reads more like a condensed operations dashboard than the Figma product shell.

Main issues:

- title treatment is too narrow and too compressed
- numeric cards and captions are more utilitarian than in the Figma
- overall text hierarchy is more cramped and less theatrical than the exports

### 2. Layout proportions are materially different

The Figma desktop screens use:

- broader hero and stage areas
- clearer horizontal composition
- more breathing room between major blocks
- larger panel silhouettes

The current frontend still uses:

- tighter stacked sections
- more compressed content columns
- more operational density than the Figma shell supports visually

### 3. Several routes are still structurally derived, not visually faithful

This matters most on:

- `dashboard`
- `factory/create`
- `ops`
- `arkas/[id]`

These are not just slightly different implementations. They are still different compositions.

### 4. The right rail is directionally correct, but not exact

The rail exists and the CTA language is broadly aligned, but:

- proportions are off
- spacing is tighter
- the utility block composition is still more compact and less premium than the Figma exports

## Route-by-Route Verdict

| Route family | Verdict | Notes |
| --- | --- | --- |
| `dashboard` | `Fail on fidelity` | Same broad palette and rail idea, but the Figma uses a much wider, more premium hero/chart composition. Current layout is still too columnar and operational. |
| `factory/create` | `Fail on fidelity` | Current route is much denser and more system-console-like. The exported Figma is far more visual, staged and spacious. |
| `ops` | `Partial` | Functionally strong, but visually still more compressed than the Figma control-room language. |
| `tiers` | `Partial` | Coherent with the app, but still derived rather than clearly backed by a matching Figma screen. |
| `vaults` / `discover` | `Partial` | These are closer in spirit, but still too dense and less polished than the exports. |
| `managers` / `assets` | `Partial` | Reasonable family consistency, but not enough evidence for exact parity. |
| `arkas` | `Partial` | Useful operationally, but more like an internal admin surface than the branded desktop shell. |
| `arkas/[id]` | `Fail on fidelity` | Strongest divergence after create. The screen is too dense, too form-heavy and too stacked compared to the Figma visual rhythm. |

## Most Important Visual Deviations

### Dashboard

Reference:

- broad hero chart
- fewer, larger blocks
- more visual emphasis on portfolio stage

Current:

- too many independent panels
- too much leaderboard/admin density
- hero does not dominate enough

### Create

Reference:

- strong staged flow
- large illustrative policy cards
- right-side progress ladder with strong visual weight

Current:

- feels like a configuration console
- too many compact cards and tables
- not enough stage separation

### Ops

Reference:

- large telemetry framing
- cleaner macro grouping

Current:

- too much text and too many small cells too early
- not enough macro-to-detail pacing

### Live Vault Execution

Reference family:

- fewer competing blocks on first read
- stronger command focus

Current:

- very high density
- too many forms and tables visible at once
- the route reads like a debug/operator console more than a premium execution surface

## What Is Good Enough To Keep

These are not the main problem anymore:

- dark violet brand direction
- right rail as product shell concept
- neon CTA language
- functional route coverage
- test coverage and live route wiring

## What Must Be Reopened

This should be treated as real redesign work, not polish only:

1. `dashboard`
2. `factory/create`
3. `arkas/[id]`
4. shell spacing and right-rail proportions

Then, after those:

5. `ops`
6. `vaults/discover`
7. `tiers`

## Recommendation

Do **not** call the frontend “Figma-aligned” yet in a strict sense.

The right operational framing is:

- functional frontend: `Yes`
- coherent dark brand system: `Yes`
- faithful implementation of the real Figma: `Not yet`

The next productive move is not another generic polish pass.

The next productive move is a **true Figma-first rebuild of the highest-divergence screens**, starting with:

1. `dashboard`
2. `create`
3. `live vault execution`

