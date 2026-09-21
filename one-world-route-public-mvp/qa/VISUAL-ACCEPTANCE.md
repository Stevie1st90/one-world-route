# Visual acceptance workflow

ONE WORLD ROUTE treats browser screenshots as a release-quality artifact, not as ad-hoc manual evidence.

## Standard flow

For UI-relevant changes:

1. Run the normal platform validation workflow.
2. Run the regional Playwright browser suite on the CI smoke matrix:
   - desktop 1440
   - mobile 390
3. Upload the Playwright output as the `regional-browser-qa-<run-id>` artifact.
4. Review the screenshots visually before treating the branch as UI-ready.
5. Classify findings:
   - P0 — broken/unusable or materially misleading
   - P1 — clear regression, missing context or visibly incorrect presentation
   - P2 — polish/readability/consistency improvement
6. Fix P0/P1 findings, rerun the complete workflow and review the new artifact.
7. Before a major release, also run the wider local/manual matrix supported by Playwright:
   - desktop 1440 and 1920
   - mobile 360, 390 and 430

A green functional test run is necessary but does not replace screenshot review.

## Required screenshot surfaces

The CI artifact should cover the normal route surfaces plus representative interactive states.

### Core route views

- Flagship world route — desktop + mobile
- Each current regional route — desktop + mobile
- Flagship → regional → flagship route switch — desktop + mobile
- Regional terrain — desktop

### Representative interaction states

- Route Library — desktop + mobile
- Traveller Context — desktop + mobile
- Regional mobile detail sheet for each current regional route
- Regional Settings — desktop + mobile
- Regional Story — desktop + mobile
- Regional Methodology — desktop + mobile
- Route Fit filtering — desktop + mobile

These screenshots should be captured inside existing browser flows wherever possible. Do not add duplicate page starts only to obtain screenshots.

## Visual review checklist

### Global

- No horizontal overflow or clipped primary controls.
- No unintended open drawers, modals or stale overlays.
- Typography is readable and hierarchy is clear.
- Current trip identity remains visible where needed.
- Header, map/globe and timeline do not collide.
- No placeholder-like values such as `0 min` for unknown data.

### Globe / map

- Active segment is visually dominant.
- Inactive route remains legible without forming excessive 3D loops.
- Ground transport stays visually close to the globe surface.
- Water transport has moderate arc height.
- Air transport can use higher arcs.
- Active labels do not overlap and remain inside the viewport.

### Mobile

- Left and right panels start closed and outside the interaction flow.
- Closed panels are not focusable/clickable.
- Opening one panel closes the other.
- Route title/context remains identifiable.
- Timeline and Filters/Details affordances remain reachable.
- Modal/sheet content fits within the viewport.

### Detail panels

- Unknown duration/cost values render as unavailable, not zero.
- Extension-specific context (cruise, road, border) is understandable.
- Source cards are readable and do not dominate the route itself.

## Architecture rule

Visual fixes must remain data-driven and renderer-generic.

Do not introduce route-specific branches such as:

```js
if (trip.id === 'italy-grand-tour') { ... }
if (trip.kind === 'cruise') { ... }
```

Trip specialization belongs in registered extension presenters or declarative rendering metadata.

## Deployment rule

Screenshot QA on development branches does not require a Vercel deployment. Use the CI/local static server. Production deployment remains a separate release step.
