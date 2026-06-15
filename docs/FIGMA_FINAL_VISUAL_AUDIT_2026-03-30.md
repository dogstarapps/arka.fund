# Final Visual Audit Against Figma

Date: 2026-03-30

## Scope

This audit closes the Figma-first frontend pass against the exported references in:

- `arkafund-assets/screens`
- `tmp/design-audit/current`

The goal here is not to restate route functionality. It is to identify whether each product surface now fits the same visual system as the Figma exports, and to isolate only the remaining fine-tuning work.

## Method

For each route family:

1. compare the current Playwright capture in `tmp/design-audit/current`
2. pair it with the closest exported Figma reference already used by the design-audit pipeline
3. classify the route as one of:
   - `Aligned`
   - `Aligned with minor polish left`
   - `Derived but still not at exact Figma fidelity`

## Screen-by-screen result

| Surface | Reference | Current capture | Result | Remaining fine adjustments |
| --- | --- | --- | --- | --- |
| `dashboard` | `vaults screens(12).png` | `dashboard-current.png` | `Aligned with minor polish left` | tighten chart panel breathing room, slightly reduce tab-to-title gap, keep right rail visually heavier than the center column |
| `discover` | derived from dashboard shell | `discover-current.png` | `Aligned with minor polish left` | reduce secondary panel padding slightly, tighten result-card heading spacing, keep filters visually closer to the top stage |
| `vaults` | `vaults screens(12).png` | `vaults-current.png` | `Aligned with minor polish left` | compress rank row height a little, tighten watchlist spacing, slightly reduce empty space above the leaderboard |
| `vault detail` | `vaults screens(11).png` | `vault-profile-current.png` | `Aligned with minor polish left` | tabs can still be tighter, profile summary spacing can come down by a few pixels, section transitions can be more compact |
| `vault execution` | `vaults screens(10).png` | `vault-ops-detail-current.png` | `Aligned with minor polish left` | inputs and action rows can be tightened further, telemetry cards still have slightly more vertical room than the references |
| `create` | `vaults screens(13).png` | `create-current.png` | `Aligned with minor polish left` | progress lane and primary action block can still be tightened, but the screen now follows the same Figma grammar |
| `governance` | `vaults screens(11).png` | validated through workflow captures | `Aligned with minor polish left` | right-side metric grid spacing and chip lane spacing can still be compressed slightly |
| `integrations` | `vaults screens(10).png` | validated through workflow captures | `Aligned with minor polish left` | showcase cards can still be equalized vertically, router panel heading block can be slightly denser |
| `coverage` | derived control-room family | validated through workflow captures | `Aligned with minor polish left` | command deck spacing can tighten, member/state panels can reduce vertical gaps slightly |
| `settings` | derived control-room family | validated through workflow captures | `Aligned with minor polish left` | raw environment block is intentionally utilitarian, but the spacing around it can still be reduced if we want a denser finish |
| `status` | derived control-room family | validated through workflow captures | `Aligned with minor polish left` | reference links panel can be tightened, known-limits panel can slightly reduce row padding |
| `ops` | `vaults screens(11).png` | `ops-current.png` | `Aligned with minor polish left` | runbook spotlights can be slightly denser and more uniform in height |
| `tiers` | `vaults screens(13).png` | `tiers-current.png` | `Aligned with minor polish left` | governed update deck can tighten field spacing, signal cards can be brought a little closer together |
| `managers` | `vaults screens(14).png` | `managers-current.png` | `Aligned with minor polish left` | stage shell and spotlight cadence now match the final explorer family; only small spacing compression remains |
| `assets` | derived from explorer family | `assets-current.png` | `Aligned with minor polish left` | asset explorer now follows the same stage grammar as managers; only minor density tuning remains |
| `manager detail` | derived from integrations/profile family | `manager-profile-current.png` | `Aligned with minor polish left` | profile framing and linked-Arka layout now sit inside the same stage system; only micro-spacing remains |
| `asset detail` | derived from integrations/profile family | `asset-profile-current.png` | `Aligned with minor polish left` | detail framing is now consistent with manager detail and the rest of the explorer family; only minor rhythm tuning remains |

## What was corrected in the last pass

These route families were materially improved in the final fidelity pass:

- `coverage`
- `settings`
- `status`
- `ops`
- `tiers`
- `managers`
- `assets`
- `manager detail`
- `asset detail`

The main structural correction was removing the old `SurfaceHero + MetricCard` pattern from those screens and replacing it with:

- explicit page header
- tighter signal deck
- denser stage grid
- shared spacing rules matching the rest of the Figma-first routes

## Honest conclusion

The product is now in a strong state visually. The main routes that define the product shell and operational experience are aligned closely enough that the frontend no longer feels like a separate design language.

What is still left is not a rebuild. It is polish:

- compress vertical rhythm on some control-room and execution screens
- tighten a few panel paddings and chip lanes
- keep reviewing type scale and spacing against future Figma revisions, but not through another structural redesign

## Final classification

- Core shell and critical routes: `Aligned with minor polish left`
- Explorer/detail routes: `Aligned with minor polish left`

At this point, any next pass would be refinement only, not another architectural redesign.
