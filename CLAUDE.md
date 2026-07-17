# CLAUDE.md

Instructions for coding-agent sessions in this repository. Read `STATUS.md` and `project.md` before making changes.

## Project overview

This repository packages the existing CHIP Cleveland–Akron market visualizer as a static GitHub Pages demo. Completion means the original desktop dashboard and tutorial remain intact, a minimal experience-selection landing page recommends the tutorial to first-time visitors, mobile controls work reliably, and the site deploys through GitHub Actions.

## Stack

- Static HTML, CSS, and browser JavaScript
- Existing self-contained MapLibre-based CHIP source files
- GitHub Pages deployed through GitHub Actions
- Python 3.12 plus pytest for repository-level static validation only
- No application backend, database, framework, package manager, or runtime build step

## Source-of-truth files

- `project.md` — approved product scope and acceptance criteria
- `STATUS.md` — current implementation state and handoff notes
- `CHIPv.4.2.html` and `CHIPv.4.2-tutorial.html` — untouched source applications
- `original/` — byte-identical preserved copies of those source applications

## Workflow rules

1. Read `STATUS.md` and `project.md` at the start of every session.
2. Keep desktop rendering of the original CHIP applications as the protected baseline.
3. Make delivery-layer changes in `index.html`, wrapper pages, or `assets/` before considering edits to the original source files.
4. Use relative URLs so the site works under a GitHub Pages project path.
5. Run `pytest` before declaring work complete.
6. Update `STATUS.md` at the end of every session with completed work, remaining work, decisions, and validation results.
7. Keep commits focused and leave enough context for another agent to continue without conversation history.

## Code style

- Prefer plain, dependency-free browser JavaScript.
- Use semantic HTML and accessible names for new controls.
- Scope mobile CSS with the existing 820px breakpoint and/or `data-device="mobile"`.
- Avoid desktop overrides unless required to correct a functional defect.
- Use `try/catch` around browser storage and same-origin iframe access boundaries.
- Do not introduce speculative abstractions or a frontend framework.

## Data and design hygiene

- The checked-in application contains illustrative demonstration data; do not replace it with real client or campaign exports.
- Do not add credentials, private endpoints, or analytics tokens.
- Do not change existing dashboard copy, calculations, map appearance, desktop colors, typography, or interaction patterns unless the user explicitly expands scope.
