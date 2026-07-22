<h2><B></B>PROJECT URL</h2>

URL:
```text
https://teagualicious.github.io/Chip-Mobile-Support/
```

# CHIP Mobile Support and GitHub Pages Demo

This repository turns the existing CHIP Cleveland–Akron market visualizer into a static, presentation-ready GitHub Pages site while preserving the original dashboard and tutorial source files.

## Experience flow

The root page offers two choices:

- **Take the Guided Tour** — recommended until the visitor completes the tutorial.
- **Explore the Dashboard** — available immediately and recommended on later visits.

Tutorial completion is stored in the visitor's browser with the versioned key:

```text
chip:tutorial-completed:v1
```

Storage access is guarded. If `localStorage` is unavailable, both experiences still work and the landing page safely treats the visitor as new.

## Repository layout

```text
.
├── index.html                       # Experience-selection landing page
├── app.html                         # Responsive shell for the regular dashboard
├── tutorial.html                    # Responsive shell for the guided tutorial
├── CHIPv.4.2.html                   # Untouched regular source application
├── CHIPv.4.2-tutorial.html          # Untouched tutorial source application
├── original/                        # Byte-identical preserved copies
├── assets/
│   ├── css/
│   │   ├── landing.css
│   │   ├── frame-shell.css
│   │   └── mobile.css
│   └── js/
│       ├── tutorial-state.js
│       ├── landing.js
│       └── mobile-ui.js
├── tests/test_site.py               # Static behavior-contract tests
├── .github/workflows/ci.yml         # Validation on pushes and pull requests
├── .github/workflows/pages.yml      # GitHub Pages deployment from main
├── project.md                       # Approved project specification
└── STATUS.md                        # Multi-agent handoff state
```

## Why wrapper pages are used

`app.html` and `tutorial.html` load the original documents in same-origin, full-viewport iframes. The delivery script then injects only the mobile stylesheet and accessibility behavior into those documents.

This preserves the original source byte-for-byte, prevents mobile overrides from leaking into the desktop baseline, and still allows the map and controls to behave as one application on GitHub Pages.

## Mobile behavior

The delivery layer combines:

- The existing 820px responsive breakpoint
- Viewport width
- Coarse-pointer detection
- Touch capability
- `navigator.userAgentData.mobile` where supported

On mobile it:

- Repairs the controls-panel `open` state mismatch
- Starts the controls drawer closed
- Adds a dismissible backdrop and close control
- Updates `aria-expanded` and traps focus while the drawer is open
- Treats the detail view as a safe-area-aware bottom sheet
- Uses dynamic viewport units and device safe-area insets
- Enlarges critical touch targets
- Dispatches map resize events after layout and orientation changes

Desktop CSS and application source remain unchanged.

## Tutorial completion detection

The tutorial wrapper watches for explicit completion actions such as **Finish**, **Done**, **Complete tutorial**, or **Explore dashboard**. It also recognizes a guided interface closing after multiple tutorial interactions. Completion is not recorded merely because the tutorial page opened.

## Run locally

Opening the wrapper pages directly with `file://` can prevent same-origin iframe access in some browsers. Serve the repository with a basic local server instead:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Validate

```bash
python -m pip install -r requirements.txt
pytest
```

The tests verify required files, relative links, original-file preservation, first-visit state wiring, mobile contracts, and the Pages workflow.

## Deploy to GitHub Pages

The repository is designed for **Settings → Pages → Source: GitHub Actions**.

A push to `main` runs `.github/workflows/pages.yml`, validates the site, stages the public static files, and deploys them with GitHub's official Pages actions. No deployment secret or custom build service is required.

Expected project URLs:

```text
https://teagualicious.github.io/Chip-Mobile-Support/
```

All navigation and assets use relative paths, so the repository name does not need to be hard-coded.

## Original source and data notice

The original CHIP files are retained both at the repository root and under `original/`. They contain illustrative market and sales data intended only for demonstration.

## Known limitations

- The live map and externally hosted fonts/libraries require network access.
- Browser storage is device- and browser-profile-specific.
- Automated tests validate static contracts; final visual QA should still be performed in iOS Safari, Android Chrome, and representative desktop browsers after deployment.
