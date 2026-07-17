# STATUS

> The single source of truth for project state. Every coding session reads this and `project.md` first, then updates this file last.

## Current phase

Phase 2 — post-merge mobile QA fixes for the tutorial layout and initial map zoom

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
- Investigated the report that the desktop landing page is missing on the deployed site: could NOT reproduce a repo-level defect. `index.html`, `landing.js`, and `tutorial-state.js` are unchanged since their initial commit, all six Pages deploy runs succeeded with the latest deploying current `main`, the deploy artifact copies `index.html` to the site root, and a local desktop render of `main` shows the landing page correctly. Most likely a client-side cause (cached deep link, bookmark, or browser autocomplete going to `app.html`/`CHIPv.4.2.html` directly).

## Next up

1. Re-verify the tutorial and initial zoom on physical iPhone Safari and Android Chrome after this branch deploys.
2. Complete remaining visual QA on iPad Safari and representative desktop sizes.
3. Record any device-specific defects here before making follow-up changes.

## Decisions log

- 2026-07-17 — Keep the original HTML files byte-for-byte unchanged — protects the existing desktop design and provides a clean rollback baseline.
- 2026-07-17 — Use same-origin wrapper pages for the active dashboard and tutorial — allows a separate mobile delivery layer without rewriting two very large self-contained HTML files.
- 2026-07-17 — Recommend rather than force the tutorial — preserves presenter and returning-user control.
- 2026-07-17 — Deploy through GitHub Actions — matches the repository's configured GitHub Pages source.
- 2026-07-17 — Retain pytest only for static repository validation — no Python runs in the deployed application.
- 2026-07-17 — Fix the mobile map view and tutorial layout entirely in the delivery layer (`assets/js/mobile-ui.js`, `assets/css/mobile.css`) — the original HTML files stay byte-identical. The tour-step drawer targets (`.hdr`, `#modeSeg`, `.field`, `#dmaClientFilters`) are mirrored in `mobile-ui.js`; if the frozen source ever changes step order, unmatched selectors are ignored harmlessly.

## Noticed

- The original application depends on external map/font/library resources, so fully offline rendering is not expected.
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
