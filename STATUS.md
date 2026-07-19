# STATUS

> The single source of truth for project state. Every coding session reads this and `project.md` first, then updates this file last.

## Current phase

Phase 3 — approved UI-review improvements (navigation, drawer IA, map-state surfaces, half-height detail sheet, landing compression)

## Done

- Preserved the original regular and tutorial applications unchanged at the repository root and as byte-identical copies under `original/`.
- Added `index.html`, a minimal CHIP-branded landing page with tutorial and dashboard choices.
- Added versioned first-time visitor state with guarded `localStorage` access (`chip:tutorial-completed:v1`).
- Added `app.html` and `tutorial.html` as full-viewport same-origin shells around the original source files.
- Added mobile device classification using viewport, pointer, touch, and User-Agent Client Hints when available.
- Reconciled the existing mobile controls mismatch around the `open` state without changing the source application.
- Added a mobile controls backdrop, close action, Escape support, focus containment, safe-area handling, dynamic viewport sizing, larger touch targets, and detail-sheet constraints.
- Added tutorial completion detection for explicit finish actions and guided-interface closure after real tutorial interaction.
- Added map resize signaling after panel, viewport, orientation, and visibility changes.
- Replaced the Python-template documentation with project-specific `README.md` and `CLAUDE.md` guidance.
- Replaced the release-oriented workflow with static validation and added a GitHub Pages Actions deployment workflow.
- Added repository-level static tests in `tests/test_site.py`.
- Opened draft pull request #1 from `agent/github-pages-mobile-demo` into `main`; merged to `main`.
- Validation completed: local `pytest -q` passed 11 tests, all three browser scripts passed `node --check`, and pull-request CI run #7 completed successfully.
- Fixed the mobile initial map view (branch `claude/mobile-tutorial-ui-bugs-6yi1qf`): the original apps fit `BOUNDS` with 360/380px desktop-panel padding, which exceeds a phone-width map and made MapLibre fall back to a zoom-0 world view. `mobile-ui.js` now injects a one-shot script into the child document (needed because `map`/`BOUNDS` are top-level lexical bindings, not `window` properties) that re-fits the market bounds with phone-sized padding on mobile only.
- Fixed the mobile tutorial layout (same branch): the tour card is now a fixed bottom sheet on mobile (safe-area aware, scrollable copy, 44px buttons always on screen), and `mobile-ui.js` auto-opens the controls drawer during tour steps 1-4 (whose targets live inside the off-canvas drawer, previously producing a sliver focus ring at the left edge and a card cut off below the viewport), scrolls the step target into view, re-renders the tour after the drawer transition, and closes the drawer for the map step and at tour end. The drawer height is capped while the tour is open so drawer and card do not overlap.
- Validated the fixes in headless Chromium (iPhone 13 viewport): map zoom 6.66 centered on Cleveland-Akron on both `tutorial.html` and `app.html`; tour steps 1-5 all render the card fully on screen with Next reachable; drawer opens/closes per step; desktop run (1440x900) confirmed unchanged behavior (no injected fit, original camera and card positioning).
- Made mobile tour step 6 ("Review the detail panel") show the real detail sheet: the delivery layer injects helpers that call the original `selectCounty`/`deselect` functions with the Cuyahoga sample county when the step opens (only if no county is already selected), moves the tour card to the top of the screen for that step, caps the sheet height so card and sheet never overlap, and deselects when leaving the step or ending the tour. Previously the step fell back to highlighting the app bar because the detail sheet is hidden on mobile until a county is tapped.
- Kept county labels visible when zooming out on mobile: the original `positionLabels` hides all labels below zoom 7.2, but the mobile full-market view sits near zoom 6.7, so the default view showed none. `mobile-ui.js` now injects a mobile-only tuner that wraps `positionLabels` (and adds its own move/zoom listeners) to keep labels visible down to zoom 5.2, growing them from 11px up to 13.5px as the map zooms out (inline `font-size` set with `important` priority because the mobile stylesheet pins `.clab` to 11px with `!important`), and hiding them below zoom 5.2 where the market is too small to label. Behavior at zoom 7.2 and above is unchanged, desktop is untouched.
- Made the desktop tour responsive to short screens (small laptops): the original tour never scrolls a step target into view or keeps its card inside the viewport, so on short viewports steps 3-4 highlighted content below the panel fold (no visible ring) and the card ran off the bottom of the screen. `mobile-ui.js` now, on desktop, scrolls panel-hosted step targets into view (`scrollIntoView` block "nearest") before re-rendering the ring, and clamps the tour card's inline position into the viewport (comparing the intended inline `top`/`left` rather than the transitioning rect, and only rewriting when the card actually overflows, so full-size desktop layouts are pixel-identical). A style observer on the card keeps the clamp applied after the tour's own scroll/resize re-renders. Updated the `test_mobile_tour_adapts_to_short_screens` observer-count contract (4 to 5) and added assertions for the desktop reveal and clamp.
- Investigated the report that the desktop landing page is missing on the deployed site: could NOT reproduce a repo-level defect. `index.html`, `landing.js`, and `tutorial-state.js` are unchanged since their initial commit, all six Pages deploy runs succeeded with the latest deploying current `main`, the deploy artifact copies `index.html` to the site root, and a local desktop render of `main` shows the landing page correctly. Most likely a client-side cause (cached deep link, bookmark, or browser autocomplete going to `app.html`/`CHIPv.4.2.html` directly).

- Completed the approved 2026-07-19 UI review (branch `claude/ui-mobile-desktop-review-xq1l6m`), one commit per phase, all in the delivery layer:
  - Phase A — the mobile controls drawer opens straight onto the controls: injected "Map controls" header with a 44px close button, the market-intro `.hdr` copy moved below the controls with flex `order` (DOM order untouched so tour selectors keep matching) and collapsed behind an "About this market" toggle, a "Replay the guided tour" link (dashboard only, `target="_top"`), and a persistent sample-data footer note. Tour step 1 auto-expands the collapsed copy and restores it afterwards. Replaced the old "no injected close button" test contract, which this review reversed.
  - Phase B — mobile map-state surfaces: a bottom-left legend chip mirroring the drawer's metric label, color ramp, min/max and panel mode (hidden while the drawer, tour, or detail sheet is open, and never shown if the app's UI fails to build), plus an active-filter count badge on the Controls button with a matching aria-label. Child-window MutationObserver count contract is now six.
  - Phase C — the mobile detail sheet opens at 55dvh with an injected grab handle (tap, keyboard, or short drag) expanding to 84dvh (88dvh under 480px); each fresh selection resets to half height; the tour detail-step height caps still win; the original `.open` display toggle is untouched.
  - Phase D — approved desktop-visible navigation: the app-bar brand acts as a link to `index.html` on both pages (pointer cursor, native tooltip, focus ring; no resting visual change), phones get a 44px Home chip in the app bar, and desktop `app.html` gains a "? Take the tour" launcher cloned from the tutorial page's `.tour-launch` styling (hidden on mobile).
  - Phase E — landing-page phone compression in `landing.css` only: phone-scale hero type, tighter cards without the decorative icon, left-aligned recommendation badge under 430px, and the non-recommended card condenses to kicker + title + action (follows the `is-recommended` class landing.js moves, so the returning-visitor state condenses the tutorial card instead).
- Validation for the above: `pytest -q` 18 passed; `node --check` clean on all three browser scripts; headless Chromium sweep (CARTO tiles stubbed for determinism) at 320×568, 360×800, 375×667, 390×844, 393×852, 412×915, 430×932, 768×1024, and 844×390 landscape — no horizontal scroll, 44px targets, drawer open/close via the new button, legend chip visible, sheet opens at half height inside the viewport; full 7-step mobile tour walkthrough with completion recorded; desktop 1440×900 and 1280×720 — every mobile-only element `display:none`, panel copy and layout unchanged, the only visible desktop additions being the two approved phase D affordances. Landing: primary CTA above the fold at 320×568/375×667/390×844, both CTAs plus the disclaimer on one screen at 390×844, desktop landing byte-identical CSS path.

## Next up

1. Re-verify the tutorial, initial zoom, and the new drawer/sheet/legend surfaces on physical iPhone Safari and Android Chrome after this branch deploys.
2. Complete remaining visual QA on iPad Safari and representative desktop sizes.
3. Record any device-specific defects here before making follow-up changes.

## Decisions log

- 2026-07-17 — Keep the original HTML files byte-for-byte unchanged — protects the existing desktop design and provides a clean rollback baseline.
- 2026-07-17 — Use same-origin wrapper pages for the active dashboard and tutorial — allows a separate mobile delivery layer without rewriting two very large self-contained HTML files.
- 2026-07-17 — Recommend rather than force the tutorial — preserves presenter and returning-user control.
- 2026-07-17 — Deploy through GitHub Actions — matches the repository's configured GitHub Pages source.
- 2026-07-17 — Retain pytest only for static repository validation — no Python runs in the deployed application.
- 2026-07-17 — Fix the mobile map view and tutorial layout entirely in the delivery layer (`assets/js/mobile-ui.js`, `assets/css/mobile.css`) — the original HTML files stay byte-identical. The tour-step drawer targets (`.hdr`, `#modeSeg`, `.field`, `#dmaClientFilters`) are mirrored in `mobile-ui.js`; if the frozen source ever changes step order, unmatched selectors are ignored harmlessly.

- 2026-07-19 — Reverse the earlier "no injected close button" decision: the approved UI review adds a visible drawer header with a 44px close button (`chip-drawer-close`), and the test contract now asserts its presence.
- 2026-07-19 — Desktop-visible additions are limited to the two affordances approved in the review: the brand-as-home link (no resting visual change) and the `? Take the tour` launcher on `app.html` mirroring the tutorial's own launcher. Everything else ships mobile-scoped.
- 2026-07-19 — Reorder the drawer visually with flex `order` instead of moving DOM nodes, so the frozen tour step selectors and app listeners stay valid.

## Noticed

- The original application depends on external map/font/library resources, so fully offline rendering is not expected.
- The original app builds its controls UI only after the basemap style loads (`buildUI()` runs inside `map.on("load")`): if the CARTO CDN is unreachable, the panel renders with an empty metric select and no message. Fixing this would require editing the frozen originals, so it is recorded here instead; the delivery layer's legend chip guards against it by staying hidden until the metric select has options.
- Static CI cannot replace physical-device visual testing of mobile Safari browser chrome and safe areas.

## How to run

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

## How to validate

```bash
python -m pip install -r requirements.txt
pytest
```
