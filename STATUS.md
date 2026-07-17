# STATUS

> The single source of truth for project state. Every coding session reads this and `project.md` first, then updates this file last.

## Current phase

Phase 1 — GitHub Pages delivery layer implemented; review and deployed-device QA pending

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
- Opened draft pull request #1 from `agent/github-pages-mobile-demo` into `main`.
- Validation completed: local `pytest -q` passed 11 tests, all three browser scripts passed `node --check`, and pull-request CI run #7 completed successfully.

## Next up

1. Review draft pull request #1 and inspect the Pages site after merge to `main`.
2. Complete visual QA on iPhone Safari, Android Chrome, iPad Safari, and representative desktop sizes.
3. Record any device-specific defects here before making follow-up changes.

## Decisions log

- 2026-07-17 — Keep the original HTML files byte-for-byte unchanged — protects the existing desktop design and provides a clean rollback baseline.
- 2026-07-17 — Use same-origin wrapper pages for the active dashboard and tutorial — allows a separate mobile delivery layer without rewriting two very large self-contained HTML files.
- 2026-07-17 — Recommend rather than force the tutorial — preserves presenter and returning-user control.
- 2026-07-17 — Deploy through GitHub Actions — matches the repository's configured GitHub Pages source.
- 2026-07-17 — Retain pytest only for static repository validation — no Python runs in the deployed application.

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
