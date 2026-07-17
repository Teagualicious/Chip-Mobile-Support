# CHIP GitHub Pages Conversion Project

## Project Objective

Convert the existing CHIP HTML demo into a clean, GitHub Pages–compatible static website while preserving the current desktop application, functionality, visual design, data, and interactions as closely as possible.

The finished site will add:

1. A simple landing page that lets visitors choose between the regular CHIP dashboard and the guided tutorial.
2. A first-time visitor recommendation system that emphasizes the tutorial without forcing visitors into it.
3. Improved mobile-device detection and a mobile-specific interface.
4. A GitHub Pages–ready repository structure.
5. Preserved copies of the original source files for reference and rollback.

This is a presentation-quality executive demo. It does not need a backend or production-grade data services.

---

## Source Files

The initial source is expected to include two standalone HTML files:

- `CHIPv.4.2.html` — regular CHIP dashboard
- `CHIPv.4.2-tutorial.html` — tutorial version

These files currently contain the application structure, styles, scripts, data, and map behavior.

Before making functional changes, copy the untouched source files into an `original/` directory.

---

## Core Constraints

### Preserve the Existing Product

The regular desktop dashboard should remain visually and functionally identical except where a change is required for:

- Mobile usability
- Mobile-device detection
- GitHub Pages compatibility
- Navigation between the landing page, dashboard, and tutorial
- Correcting existing mobile-interface defects

Do not redesign the desktop dashboard.

Do not alter:

- Map appearance
- Desktop layout
- Desktop colors
- Desktop typography
- Data values
- Simulation logic
- Existing dashboard copy
- Charts, cards, controls, or filters
- Existing desktop interaction patterns

### Allowed New Design Work

New visual design is permitted only for:

- The landing page
- Mobile layouts and controls
- Small navigation elements needed to move between site pages
- Mobile safe-area and viewport fixes
- Accessibility improvements that do not visibly redesign the desktop experience

### Technical Constraints

- Keep the site static.
- Do not add a backend.
- Do not require a database.
- Do not introduce a framework unless absolutely necessary.
- Do not add a build step unless the existing source makes one unavoidable.
- Prefer plain HTML, CSS, and JavaScript.
- Use relative file paths so the project works from a GitHub Pages project URL.
- Preserve the ability to open the application locally where practical.

---

## Recommended Repository Structure

```text
/
├── index.html
├── app.html
├── tutorial.html
├── assets/
│   ├── css/
│   │   ├── landing.css
│   │   └── mobile.css
│   └── js/
│       ├── landing.js
│       └── mobile-ui.js
├── original/
│   ├── CHIPv.4.2.html
│   └── CHIPv.4.2-tutorial.html
├── .nojekyll
├── README.md
└── project.md
```

### File Responsibilities

#### `index.html`

The new landing page.

It introduces CHIP and lets the visitor select:

- Guided Tutorial
- Regular Dashboard

#### `app.html`

The regular CHIP dashboard based on `CHIPv.4.2.html`.

Desktop behavior and design should remain unchanged.

#### `tutorial.html`

The guided tutorial based on `CHIPv.4.2-tutorial.html`.

It should record tutorial completion when the visitor reaches the tutorial’s existing completion point or deliberately exits after completing the guided sequence.

#### `assets/css/landing.css`

Styles used only by the landing page.

#### `assets/css/mobile.css`

Mobile-specific overrides shared by `app.html` and, where appropriate, `tutorial.html`.

Avoid placing unrelated desktop restyling in this file.

#### `assets/js/landing.js`

Controls the landing-page recommendation state.

#### `assets/js/mobile-ui.js`

Handles device classification, mobile controls, orientation changes, viewport changes, and map resizing.

#### `original/`

Contains exact, untouched copies of the two source HTML files.

#### `.nojekyll`

Ensures GitHub Pages serves the static files directly without Jekyll processing.

---

## Landing Page

## Purpose

The landing page should make the two available experiences immediately understandable without becoming a large marketing website.

It should be a single, clean screen or a very short page.

The landing page should contain:

1. CHIP product name
2. A concise description of the tool
3. Two large experience-selection cards
4. A recommendation label
5. A brief illustrative-data disclaimer

Do not add:

- A complex navigation bar
- Multiple marketing sections
- Long feature lists
- Testimonials
- Pricing
- Unnecessary animation
- A large scrolling website
- New product claims not present in the source

---

## Landing Page Choices

### Guided Tutorial

Suggested copy:

**Take the Guided Tour**

A guided walkthrough of the dashboard, controls, and market-opportunity insights.

Primary button:

**Start Guided Tour**

For a first-time visitor, this card should display:

**Recommended for first-time visitors**

### Regular Dashboard

Suggested copy:

**Explore the Dashboard**

Open the full interactive CHIP experience immediately.

Button:

**Open Dashboard**

---

## First-Time Visitor Behavior

Do not automatically redirect a first-time visitor into the tutorial.

Instead, recommend the tutorial visually while preserving the visitor’s ability to choose the regular dashboard.

Use a versioned `localStorage` key:

```javascript
const TUTORIAL_STORAGE_KEY = "chip:tutorial-completed:v1";
```

### First Visit

When the completion key is absent:

- Guided Tutorial is the primary recommendation.
- Display “Recommended for first-time visitors.”
- Regular Dashboard remains fully available.

### After Tutorial Completion

When the completion key is present:

- Regular Dashboard becomes the primary recommendation.
- Guided Tutorial becomes a secondary “Replay the Guided Tour” option.
- Remove the first-time recommendation label.

Suggested stored value:

```javascript
localStorage.setItem("chip:tutorial-completed:v1", "true");
```

### Storage Failure

Wrap storage access in `try/catch`.

If browser storage is unavailable:

- The site must still work.
- Treat the visitor as new for recommendation purposes.
- Never create a redirect loop.
- Never block access to either experience.

Example utility:

```javascript
function hasCompletedTutorial() {
  try {
    return localStorage.getItem("chip:tutorial-completed:v1") === "true";
  } catch {
    return false;
  }
}
```

---

## Tutorial Completion

The tutorial should mark itself complete at the most logical existing completion event.

Preferred order:

1. Existing final tutorial step
2. Existing “Finish,” “Done,” or equivalent action
3. A newly added final action that does not disrupt the current tutorial
4. Returning to the landing page after completing the guided sequence

Do not mark the tutorial complete merely because `tutorial.html` was opened.

A replay should not erase completion status.

Optional direct replay URL:

```text
tutorial.html?replay=1
```

The replay parameter may be used for presentation links, but the tutorial should remain accessible without it.

---

## Navigation

The following direct URLs should work:

```text
/
index.html
app.html
tutorial.html
```

On GitHub Pages, that will produce links similar to:

```text
https://OWNER.github.io/REPOSITORY/
https://OWNER.github.io/REPOSITORY/app.html
https://OWNER.github.io/REPOSITORY/tutorial.html
```

Use relative navigation:

```html
<a href="./app.html">Open Dashboard</a>
<a href="./tutorial.html">Start Guided Tour</a>
```

Do not hard-code an organization name, repository name, or full GitHub Pages URL.

### In-App Navigation

Add only minimal navigation where necessary.

Acceptable examples:

- A small “Home” or CHIP logo link to `index.html`
- A “Back to choices” action
- A tutorial completion action returning to the landing page

These elements must not materially alter the existing desktop dashboard layout.

---

## Landing Page Visual Direction

The landing page should feel like part of the existing CHIP product.

Use the existing visual language:

- Spectrum Reach–style navy, white, blue, and aqua palette
- Existing or closely matched typography
- Rounded cards
- Soft shadows or borders consistent with the product
- Clear hierarchy
- Spacious layout
- Large, easily selectable buttons

The page should not attempt to reproduce the full dashboard.

A useful layout is:

```text
CHIP
Market intelligence and campaign opportunity visualization

┌──────────────────────────────┐
│ Recommended for first-time   │
│ Take the Guided Tour         │
│ [ Start Guided Tour ]        │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Explore the Dashboard        │
│ [ Open Dashboard ]           │
└──────────────────────────────┘

Illustrative sales and market data for demonstration purposes.
```

On desktop, the cards may appear side by side.

On mobile, they should stack vertically.

---

## Mobile Strategy

## Existing Mobile Issue

The current source contains partial mobile support, including a mobile controls button and CSS intended to hide or move the controls panel.

However, the existing JavaScript toggles an `open` class while the current styles appear to use a different state class. The implementation should be reconciled so the mobile controls button reliably opens and closes the controls interface.

Do not remove existing mobile behavior without first understanding it.

---

## Device Classification

Use responsive CSS as the primary layout mechanism.

JavaScript may add a device classification for behavior that cannot be handled cleanly by CSS alone.

Use a combination of:

- Viewport width
- Pointer type
- Touch capability
- `navigator.userAgentData.mobile` where supported

Do not rely entirely on the user-agent string.

Suggested approach:

```javascript
function detectDeviceMode() {
  const narrowViewport = window.matchMedia("(max-width: 820px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;

  const uaMobile =
    navigator.userAgentData &&
    typeof navigator.userAgentData.mobile === "boolean"
      ? navigator.userAgentData.mobile
      : false;

  return narrowViewport || (coarsePointer && touchCapable) || uaMobile
    ? "mobile"
    : "desktop";
}

document.documentElement.dataset.device = detectDeviceMode();
```

Recalculate when appropriate:

- Orientation changes
- Significant viewport changes
- Resizing from desktop to mobile widths
- Mobile browser chrome changes

Avoid excessive resize processing. Debounce or use `requestAnimationFrame`.

---

## Mobile Breakpoint

Preserve the existing approximate mobile breakpoint of:

```css
@media (max-width: 820px)
```

Additional breakpoints may be added only when necessary to handle very narrow devices.

Suggested minimum narrow-device check:

```css
@media (max-width: 480px)
```

Do not create tablet-specific redesign work unless the existing interface requires it.

---

## Mobile Layout Requirements

### General

- Use `100dvh` where appropriate instead of relying exclusively on `100vh`.
- Respect iPhone and Android safe areas.
- Prevent critical buttons from sitting beneath browser chrome or device notches.
- Maintain touch targets of approximately 44px or larger.
- Avoid hover-only interactions.
- Prevent horizontal page scrolling.
- Keep the map visible whenever practical.
- Preserve the existing visual hierarchy.

Suggested safe-area usage:

```css
padding-top: max(12px, env(safe-area-inset-top));
padding-right: max(12px, env(safe-area-inset-right));
padding-bottom: max(12px, env(safe-area-inset-bottom));
padding-left: max(12px, env(safe-area-inset-left));
```

### Mobile Controls

The desktop controls panel should become a reliable mobile drawer, sheet, or overlay.

Preferred behavior:

1. A clearly visible Controls button opens the panel.
2. The panel can be closed with:
   - A close button
   - The Controls button
   - Tapping outside the panel, where appropriate
   - The Escape key when a keyboard is present
3. Body or map interactions should not accidentally pass through the open overlay.
4. Focus should move sensibly when the panel opens and closes.
5. The open state should use one consistent class or data attribute.

Suggested state:

```html
<aside class="ctrl" data-open="false">
```

or:

```css
.ctrl.open { ... }
```

Use one method consistently in both CSS and JavaScript.

### Mobile Detail Panel

The current mobile detail experience may continue to use a bottom-sheet style.

Ensure that it:

- Fits inside the visible viewport
- Can be dismissed
- Does not cover all context unnecessarily
- Allows internal scrolling
- Respects the bottom safe area
- Does not trap the user behind an invisible overlay

### Map Resizing

MapLibre must be told to resize when surrounding panels change size or visibility.

Call the existing map instance’s resize method after:

- Opening the controls panel
- Closing the controls panel
- Opening or closing the detail sheet
- Orientation changes
- Mobile viewport changes
- Returning to the dashboard from a hidden or background state where needed

Example:

```javascript
function resizeMapSoon() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (window.map && typeof window.map.resize === "function") {
        window.map.resize();
      }
    });
  });
}
```

Adapt this to the actual map variable in the source.

---

## Desktop Preservation

Desktop is the baseline.

Before modifying application CSS:

1. Capture screenshots of the original dashboard at representative desktop sizes.
2. Compare the modified version against those screenshots.
3. Confirm that mobile overrides do not leak into desktop styles.

Recommended desktop test sizes:

- 1920 × 1080
- 1440 × 900
- 1366 × 768
- 1280 × 720

Desktop acceptance standard:

- No unintended spacing changes
- No moved controls
- No altered typography
- No changed map framing
- No altered card sizes
- No changed color treatment
- No removed functionality

---

## Mobile Test Sizes

At minimum, test:

- 320 × 568
- 360 × 800
- 375 × 667
- 390 × 844
- 393 × 852
- 412 × 915
- 430 × 932
- 768 × 1024
- Landscape orientation on at least one phone-sized viewport

Where possible, verify in:

- iOS Safari
- Android Chrome
- Desktop Chrome responsive mode
- Desktop Safari or Firefox for regression checks

---

## Accessibility Requirements

Do not attempt a full redesign, but ensure new work follows basic accessibility practices.

New elements should include:

- Semantic buttons and links
- Visible keyboard focus
- Sufficient color contrast
- Meaningful labels
- `aria-expanded` on the mobile controls trigger
- `aria-controls` linking the trigger and panel
- Appropriate dialog or navigation semantics where useful
- Reduced-motion handling for new animations

Example:

```html
<button
  id="mobileControlsButton"
  aria-controls="controlsPanel"
  aria-expanded="false"
>
  Controls
</button>
```

Do not remove accessibility attributes already present in the source.

---

## GitHub Pages Requirements

The repository should publish from the root of the `main` branch.

Required root files:

- `index.html`
- `.nojekyll`

All asset paths must be relative.

Good:

```html
<link rel="stylesheet" href="./assets/css/landing.css">
<script src="./assets/js/landing.js" defer></script>
```

Avoid:

```html
<link rel="stylesheet" href="/assets/css/landing.css">
```

A root-relative path can break when the site is hosted under:

```text
https://OWNER.github.io/REPOSITORY/
```

### GitHub Pages Setup

After pushing the repository:

1. Open repository **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` branch.
5. Select the `/ (root)` folder.
6. Save.

No custom GitHub Actions workflow should be necessary for this static version unless branch deployment is unavailable in the destination repository.

---

## External Assets

The existing source may use external libraries or fonts.

Preserve them unless they prevent GitHub Pages operation.

Confirm that:

- All external resources use HTTPS.
- MapLibre loads correctly.
- Fonts load correctly.
- No resource expects a local development server.
- No cross-origin failure blocks the application.
- The application remains usable if a nonessential font request fails.

Do not change the mapping library or data implementation merely to reorganize the repository.

---

## Version Control Plan

### Baseline Preservation

The first commit should contain the original source without modifications.

Suggested commit:

```text
chore: import original CHIP 4.2 source
```

Create an optional tag:

```text
original-chip-4.2
```

### Recommended Commit Sequence

1. `chore: import original CHIP 4.2 source`
2. `chore: add GitHub Pages site structure`
3. `feat: add CHIP experience landing page`
4. `feat: add tutorial completion recommendation state`
5. `fix: repair mobile controls panel behavior`
6. `feat: improve mobile layout and device handling`
7. `fix: resize map after responsive UI transitions`
8. `docs: add setup and deployment instructions`
9. `test: complete desktop and mobile regression review`

Keep commits focused enough that a specific feature can be reverted without discarding the full conversion.

---

## README Requirements

The finished `README.md` should include:

1. Project purpose
2. Link to the deployed GitHub Pages site
3. File structure
4. Local usage instructions
5. GitHub Pages deployment instructions
6. Explanation of tutorial-completion storage
7. Explanation of mobile behavior
8. Statement that the data is illustrative
9. Source-file preservation notes
10. Known limitations

Suggested local usage:

```text
Open index.html directly, or serve the folder with a basic local static server.
```

If direct file access causes browser restrictions, recommend:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

---

## Illustrative Data Disclaimer

The landing page should include a brief disclaimer such as:

> This prototype uses illustrative market and sales data for demonstration purposes.

Do not add legal language or detailed disclaimers unless requested later.

---

## Functional Acceptance Criteria

The project is complete when all of the following are true.

### Landing Page

- `index.html` loads successfully.
- Both experience cards are visible.
- Both links work.
- First-time visitors see the tutorial recommendation.
- Returning visitors who completed the tutorial see the dashboard recommendation.
- Storage failure does not break the page.
- The landing page works on desktop and mobile.

### Regular Dashboard

- `app.html` loads successfully.
- Desktop appearance matches the original.
- Existing controls and interactions work.
- Existing map behavior works.
- No data or simulation logic has been intentionally altered.
- Direct linking works.

### Tutorial

- `tutorial.html` loads successfully.
- Existing tutorial behavior is preserved.
- Completion is recorded only at the appropriate completion point.
- Visitors can replay the tutorial.
- Direct linking works.

### Mobile

- Mobile controls open and close reliably.
- The class or state used by CSS matches the JavaScript implementation.
- Map interactions remain usable.
- Detail content is readable.
- No critical interface is outside the viewport.
- Safe areas are respected.
- Portrait and landscape modes work.
- The map resizes after layout transitions.
- No horizontal page scrolling occurs.

### GitHub Pages

- The root URL opens the landing page.
- Assets load from the GitHub Pages project path.
- `app.html` and `tutorial.html` work when opened directly.
- Refreshing any direct page does not produce a 404.
- No build step is required.
- `.nojekyll` is present.

### Preservation

- Exact original files remain in `original/`.
- Desktop visual regressions have been checked.
- Changes are limited to approved scope.

---

## Non-Goals

This project does not include:

- A production backend
- User accounts
- Authentication
- Real customer data
- Live database integration
- Analytics implementation
- CMS support
- A full marketing website
- Major desktop redesign
- Rebuilding CHIP in React, Vue, Angular, or another framework
- Replacing MapLibre
- Rewriting existing simulation logic
- Production security certification
- App-store packaging

---

## Implementation Order

Follow this order to minimize risk:

1. Copy the original source files into `original/`.
2. Rename working copies to `app.html` and `tutorial.html`.
3. Confirm both working copies still function without modifications.
4. Add `.nojekyll`.
5. Create the landing page.
6. Add first-time and returning-visitor recommendation logic.
7. Identify the tutorial’s real completion event.
8. Record completion at that event.
9. Audit the existing mobile CSS and JavaScript.
10. Repair the controls-panel state mismatch.
11. Add mobile layout improvements.
12. Add safe-area and dynamic viewport support.
13. Add map resize handling.
14. Test direct links and relative asset paths.
15. Perform desktop visual regression testing.
16. Perform mobile and orientation testing.
17. Write the README.
18. Enable GitHub Pages.
19. Test the deployed site rather than relying only on local testing.

---

## Decision Summary

The approved visitor flow is:

```text
GitHub Pages URL
        ↓
Landing page
        ↓
┌─────────────────────┬─────────────────────┐
│ Guided Tutorial     │ Regular Dashboard   │
│ Recommended at first│ Always available    │
└─────────────────────┴─────────────────────┘
```

After tutorial completion:

```text
Landing page
        ↓
┌─────────────────────┬─────────────────────┐
│ Replay Tutorial     │ Regular Dashboard   │
│ Secondary option    │ Recommended         │
└─────────────────────┴─────────────────────┘
```

The tutorial is recommended, not forced.

The landing page is intentionally minimal.

The desktop dashboard remains the protected baseline.

Mobile improvements are the only substantial changes permitted inside the existing application interface.
