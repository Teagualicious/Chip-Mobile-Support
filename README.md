<div align="center">

<img src="assets/brand/chip-mark.svg" alt="CHIP logo" width="88" height="88">

# CHIP · Cleveland–Akron Market Visualizer

**Spectrum Reach market intelligence, packaged as a static, presentation-ready GitHub Pages demo.**

[**Live demo**](https://teagualicious.github.io/Chip-Mobile-Support/) ·
[Guided tour](https://teagualicious.github.io/Chip-Mobile-Support/tutorial.html) ·
[Dashboard](https://teagualicious.github.io/Chip-Mobile-Support/app.html)

[![Validate static site](https://github.com/Teagualicious/Chip-Mobile-Support/actions/workflows/ci.yml/badge.svg)](https://github.com/Teagualicious/Chip-Mobile-Support/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/Teagualicious/Chip-Mobile-Support/actions/workflows/pages.yml/badge.svg)](https://github.com/Teagualicious/Chip-Mobile-Support/actions/workflows/pages.yml)

</div>

---

## Contents

- [What this is](#what-this-is)
- [Quick start](#quick-start)
- [Experience flow](#experience-flow)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [What the delivery layer does](#what-the-delivery-layer-does)
- [Deployment](#deployment)
- [Data notice and limitations](#data-notice-and-limitations)

## What this is

This repository turns the existing CHIP Cleveland–Akron market visualizer into a static GitHub Pages site while preserving the original dashboard and tutorial applications **byte-for-byte**. A minimal landing page recommends the guided tour to first-time visitors, and a small delivery layer makes the experience work reliably on phones and small laptops — without editing the original source files.

## Quick start

| I want to… | Do this |
| --- | --- |
| See the site | Open the [live demo](https://teagualicious.github.io/Chip-Mobile-Support/) |
| Run it locally | `python -m http.server 8000` then open `http://localhost:8000/` |
| Run the tests | `python -m pip install -r requirements.txt && pytest` |

> **Note:** opening the wrapper pages directly with `file://` can block same-origin iframe access in some browsers — always use a local server.

The tests verify required files, relative links, original-file preservation, first-visit state wiring, mobile behavior contracts, and the Pages workflow.

## Experience flow

The landing page offers two choices:

- **Take the Guided Tour** — recommended until the visitor completes the tutorial.
- **Explore the Dashboard** — available immediately and recommended on later visits.

Tutorial completion is stored in the visitor's browser under the versioned key `chip:tutorial-completed:v1`. Storage access is guarded: if `localStorage` is unavailable, both experiences still work and the visitor is safely treated as new. Completion is recorded on explicit finish actions (**Finish**, **Done**, **Complete tutorial**, **Explore dashboard**) or when the guided interface closes after real tutorial interaction — never merely because the page opened.

## Architecture

`app.html` and `tutorial.html` load the original documents in same-origin, full-viewport iframes. A delivery script (`assets/js/mobile-ui.js`) then injects the mobile stylesheet and behavior into those documents at runtime.

This design:

- preserves the original source byte-for-byte and provides a clean rollback baseline,
- prevents mobile overrides from leaking into the protected desktop rendering,
- still lets the map, controls, and tour behave as one application on GitHub Pages.

## Repository layout

```text
.
├── index.html                       # Experience-selection landing page
├── app.html                         # Responsive shell for the dashboard
├── tutorial.html                    # Responsive shell for the guided tutorial
├── CHIPv.4.2.html                   # Untouched dashboard source application
├── CHIPv.4.2-tutorial.html          # Untouched tutorial source application
├── original/                        # Byte-identical preserved copies of both
├── assets/
│   ├── brand/chip-mark.svg          # Brand mark used by this README
│   ├── css/
│   │   ├── landing.css              # Landing page styles
│   │   ├── frame-shell.css          # Wrapper-page shell styles
│   │   └── mobile.css               # Mobile layer injected into the apps
│   └── js/
│       ├── landing.js               # First-visit recommendation logic
│       ├── tutorial-state.js        # Guarded localStorage completion state
│       └── mobile-ui.js             # Device detection + injected behavior
├── tests/test_site.py               # Static behavior-contract tests
├── .github/workflows/ci.yml         # Validation on pushes and pull requests
├── .github/workflows/pages.yml      # GitHub Pages deployment from main
├── project.md                       # Approved project specification
└── STATUS.md                        # Session-to-session handoff state
```

## What the delivery layer does

Device classification combines the existing 820px breakpoint, viewport width, coarse-pointer and touch detection, and `navigator.userAgentData.mobile` where supported.

**On mobile**

- Fits the map to the Cleveland–Akron market at load (the original desktop-panel padding otherwise breaks the initial zoom on narrow screens).
- Keeps county labels visible while zooming out, scaling them up modestly, and hides them only when the market is too small to label.
- Runs the controls panel as a drawer: closed at start, dismissible backdrop, `aria-expanded` syncing, focus containment, and repaired `open`-state handling.
- Treats the county detail view as a safe-area-aware bottom sheet.
- Pins the tour card as a bottom sheet, opens the drawer for tour steps that highlight drawer controls, and opens the detail sheet with a sample county for the detail-panel step.
- Uses dynamic viewport units, device safe-area insets, and enlarged touch targets, and dispatches map resize events after layout and orientation changes.

**On desktop**

- Scrolls tour targets into view on short screens and keeps the tour card inside the viewport (full-size layouts are pixel-identical to the original).
- Opens the detail panel with a sample county during the detail-panel tour step, and keeps the card from covering it.
- Everything else — CSS, copy, calculations, map appearance — remains the unchanged original application.

## Deployment

The repository deploys via **Settings → Pages → Source: GitHub Actions**. A push to `main` runs `.github/workflows/pages.yml`, which validates the site with `pytest`, stages the public static files, and deploys them with GitHub's official Pages actions. No secrets or build services are required.

All navigation and assets use relative paths, so the site works under any project path:

```text
https://teagualicious.github.io/Chip-Mobile-Support/
```

## Data notice and limitations

- The original CHIP files (repository root and `original/`) contain **illustrative demonstration data only**.
- The live map and externally hosted fonts require network access.
- Browser storage is device- and profile-specific.
- Automated tests validate static contracts; final visual QA still belongs in iOS Safari, Android Chrome, and representative desktop browsers after deployment.
