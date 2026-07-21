from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[tuple[str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append((tag, name, value))


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_required_site_files_exist() -> None:
    required = {
        "index.html",
        "app.html",
        "tutorial.html",
        "CHIPv.4.2.html",
        "CHIPv.4.2-tutorial.html",
        "original/CHIPv.4.2.html",
        "original/CHIPv.4.2-tutorial.html",
        "assets/css/landing.css",
        "assets/css/frame-shell.css",
        "assets/css/mobile.css",
        "assets/css/assistant.css",
        "assets/js/tutorial-state.js",
        "assets/js/landing.js",
        "assets/js/mobile-ui.js",
        "assets/js/app-refinements.js",
        "assets/js/chip-assistant.js",
        ".nojekyll",
        ".github/workflows/pages.yml",
    }
    missing = sorted(path for path in required if not (ROOT / path).is_file())
    assert not missing, f"Missing required files: {missing}"


def test_original_files_are_preserved_byte_for_byte() -> None:
    pairs = [
        ("CHIPv.4.2.html", "original/CHIPv.4.2.html"),
        ("CHIPv.4.2-tutorial.html", "original/CHIPv.4.2-tutorial.html"),
    ]
    for source, preserved in pairs:
        assert (ROOT / source).read_bytes() == (ROOT / preserved).read_bytes()


def test_business_verticals_use_the_consolidated_taxonomy() -> None:
    allowed = {
        "Adult",
        "Auto Aftermarket",
        "Auto Dealer",
        "Auto Dealer Association",
        "Auto Manufacturer",
        "Automall/Used Cars",
        "Education",
        "Financial Services and Insurance",
        "Government and Military",
        "Grocery/Food and Beverage",
        "Healthcare",
        "Home Improvement",
        "Legal Services",
        "Marketing",
        "Media",
        "Pharma",
        "Political",
        "Real Estate",
        "Restaurant",
        "Retail",
        "RV/Cycles Vehicles",
        "Telecommunications",
        "Travel/Leisure/Entertainment",
    }
    expected_populated = {
        "Auto Aftermarket",
        "Auto Dealer",
        "Automall/Used Cars",
        "Grocery/Food and Beverage",
        "Healthcare",
        "Home Improvement",
        "Restaurant",
        "Retail",
    }
    vertical_sets = []
    for path in ("CHIPv.4.2.html", "CHIPv.4.2-tutorial.html"):
        verticals = set(re.findall(r'"vertical":"([^"]+)"', read(path)))
        assert verticals <= allowed
        assert verticals == expected_populated
        vertical_sets.append(verticals)
    assert vertical_sets[0] == vertical_sets[1]


def test_landing_page_links_to_both_experiences() -> None:
    html = read("index.html")
    assert 'href="./app.html"' in html
    assert 'href="./tutorial.html"' in html
    assert "Recommended for first-time visitors" in html
    assert "Illustrative market and sales data" in html


def test_landing_compresses_hero_and_secondary_card_on_phones() -> None:
    css = read("assets/css/landing.css")
    # Phone hero must not use the display-size type scale, and the
    # non-recommended card condenses so both actions fit the first screen.
    assert "font-size: clamp(1.7rem, 7.5vw, 2.4rem)" in css
    assert ".experience-card:not(.is-recommended) h2 + p" in css
    assert "flex-direction: column" in css


def test_wrapper_pages_reference_untouched_sources() -> None:
    assert 'src="./CHIPv.4.2.html"' in read("app.html")
    tutorial = read("tutorial.html")
    assert 'src="./CHIPv.4.2-tutorial.html"' in tutorial
    assert 'src="./assets/js/tutorial-state.js' in tutorial


def test_html_uses_project_relative_internal_urls() -> None:
    for name in ("index.html", "app.html", "tutorial.html"):
        parser = AssetParser()
        parser.feed(read(name))
        bad = [
            value
            for _, _, value in parser.references
            if value.startswith("/") and not value.startswith("//")
        ]
        assert not bad, f"{name} contains root-relative URLs: {bad}"


def test_tutorial_state_is_versioned_and_guarded() -> None:
    script = read("assets/js/tutorial-state.js")
    assert 'chip:tutorial-completed:v1' in script
    assert 'localStorage.getItem' in script
    assert 'localStorage.setItem' in script
    assert script.count("try {") >= 2
    assert 'markCompleted' in script


def test_landing_switches_recommendation_after_completion() -> None:
    script = read("assets/js/landing.js")
    assert 'state.hasCompleted()' in script
    assert 'Replay Guided Tour' in script
    assert 'dashboardCard.classList.toggle("is-recommended", completed)' in script


def test_mobile_layer_contains_required_detection_and_controls_contracts() -> None:
    script = read("assets/js/mobile-ui.js")
    required_fragments = {
        'matchMedia("(max-width: 820px)")',
        'matchMedia("(pointer: coarse)")',
        'navigator.maxTouchPoints',
        'navigator.userAgentData',
        'aria-expanded',
        'classList.contains("open")',
        'chip-mobile-backdrop',
        'orientationchange',
        'visualViewport',
        'dispatchEvent(new Event("resize"))',
        'tutorial-finish-action',
    }
    missing = sorted(fragment for fragment in required_fragments if fragment not in script)
    assert not missing, f"Missing mobile behavior contracts: {missing}"


def test_mobile_drawer_opens_on_controls_with_a_visible_close_action() -> None:
    # 2026-07-19: the earlier "no injected close button" decision was
    # reversed in the approved UI review — the drawer now has an explicit
    # header with a 44px close button, opens straight onto the controls, and
    # collapses the market-intro copy behind an "About this market" toggle
    # that the tour re-expands for step 1.
    script = read("assets/js/mobile-ui.js")
    css = read("assets/css/mobile.css")
    for fragment in ("chip-drawer-header", "chip-drawer-close", "chip-drawer-about-toggle"):
        assert fragment in script, f"mobile-ui.js missing {fragment}"
        assert fragment in css, f"mobile.css missing {fragment}"
    assert 'tourLink.target = "_top"' in script
    assert "chip-about-collapsed" in script
    assert "setAboutExpanded(stepIndex === 0)" in script
    # The reordering must be visual only (flex order), never DOM reordering,
    # so the tour's step selectors keep matching.
    assert ".ctrl__scroll > .hdr { order: 6; }" in css


def test_mobile_map_view_surfaces_legend_and_filter_state() -> None:
    script = read("assets/js/mobile-ui.js")
    css = read("assets/css/mobile.css")
    for fragment in ("chip-map-legend", "chip-filter-badge"):
        assert fragment in script, f"mobile-ui.js missing {fragment}"
        assert fragment in css, f"mobile.css missing {fragment}"
    # The chip must stay hidden when the map UI never builds (offline CARTO)
    # and never compete with the drawer, the tour, or the detail sheet.
    assert "legend.hidden = true" in script
    assert "body.chip-controls-open .chip-map-legend" in css
    assert "body.chip-tour-active .chip-map-legend" in css
    assert "body.chip-detail-open .chip-map-legend" in css


def test_mobile_detail_sheet_opens_half_height_with_grab_handle() -> None:
    script = read("assets/js/mobile-ui.js")
    css = read("assets/css/mobile.css")
    assert "chip-sheet-grab" in script
    assert "chip-sheet-tall" in script
    assert "chip-sheet-grab" in css
    assert ".detail.chip-sheet-tall" in css
    assert "min(55dvh" in css
    # Every fresh selection must start at half height, and the original's
    # display none/flex toggling via `.open` must stay untouched.
    assert "setSheetTall(false)" in script
    assert re.search(r"html\[data-device=\"mobile\"\] \.detail \{[^}]*display", css) is None


def test_assistant_chat_is_wired_without_committed_credentials() -> None:
    # 2026-07-20: the assistant now loads on the tutorial page too, so the
    # tour's bonus step can spotlight a real launcher there.
    for page in ("app.html", "tutorial.html"):
        html = read(page)
        assert 'href="./assets/css/assistant.css' in html, page
        assert 'src="./assets/js/chip-assistant.js' in html, page

    script = read("assets/js/chip-assistant.js")
    # Direct browser calls to the Claude API require this opt-in header, and
    # the key is entered at runtime (session storage, guarded) — never shipped.
    assert "anthropic-dangerous-direct-browser-access" in script
    assert "anthropic-version" in script
    assert "claude-opus-4-8" in script
    assert "sessionStorage" in script
    assert "answerLocally" in script  # keyless demo-mode fallback
    assert 'stop_reason === "refusal"' in script
    assert 'stop_reason === "tool_use"' in script


def test_tour_detail_step_shows_the_sample_county_on_both_devices() -> None:
    # Step 6 ("Review the detail panel") must not fall back to the app-bar
    # highlight: both the mobile and desktop sync branches drive the sample
    # county selection through the injected helper.
    script = read("assets/js/mobile-ui.js")
    assert script.count("frame.contentWindow.__chipTourShowDetailSample()") == 2


def test_tour_gains_bonus_steps_for_assistant_and_replay() -> None:
    # The original steps array is closure-local in the frozen tutorial, so
    # the two bonus steps (Ask CHIP, tour replay) are a delivery-layer
    # overlay reusing the tour's own classes, started from the Finish click.
    script = read("assets/js/mobile-ui.js")
    assert "setupTourExtension" in script
    assert "chipTourExtra" in script
    assert '"Ask CHIP anything"' in script
    assert '"Replay this tour anytime"' in script
    assert "chip-assistant-launcher" in script  # bonus step measures the real button
    # The walkthrough reads as one continuous nine-step tour: the frozen
    # tour's "Step N of 7" / seven dots / "Finish" renders are relabeled,
    # and Back from step 8 replays the main tour to land on step 7.
    assert "relabelMainTour" in script
    assert "TOTAL_STEPS" in script
    assert "returnToMainTour" in script
    # The assistant hides while the original tour runs (it floats above the
    # shade) and returns as the bonus step's highlight target.
    assert "chip-tour-open" in script
    assert "chip-tour-open" in read("assets/css/assistant.css")


def test_app_refinements_cover_the_final_touch_up_round() -> None:
    # 2026-07-20 "final touch ups": everything lives in one delivery-layer
    # module so the frozen originals and the mobile-ui.js observer-count
    # contract stay untouched.
    for page in ("app.html", "tutorial.html"):
        assert 'src="./assets/js/app-refinements.js' in read(page), page

    script = read("assets/js/app-refinements.js")
    # Population-index metrics leave the dropdown and demographics table.
    assert '"pct_black", "hispanic_index"' in script
    # County labels scale with zoom on both devices; the mobile-ui.js
    # zoom-out tuner keeps ownership below the 7.2 baseline on phones,
    # and desktop keeps labels visible (shrunken) when zooming out.
    assert "scaleLabelsWithZoom" in script
    assert "mobile && z < BASE_ZOOM" in script
    assert "z >= 5.2" in script
    # Prospecting pane: County spend leads, tailwind below, both fixed open.
    assert "reorderProspectPane" in script
    assert '"county spend"' in script and '"county tailwind"' in script
    # Pane-state sync must survive a lost observer or an iframe reload.
    assert "wrappedDeselect" in script
    assert "parentObserver.disconnect()" in script
    # Clicking a county gently zooms and centers it.
    assert "map.easeTo({" in script
    # AE client book ranks by priority via a wrap of the frozen renderer,
    # with a user toggle between churn risk and growth upside.
    assert "clientRowsHTML" in script and "churnTier" in script
    assert "chip-sort-bar" in script
    assert "postureScore" in script  # growth-upside comparator
    assert "refreshOpenDetail()" in script  # toggle re-renders through the app
    # Detail sections become dropdowns and both panes get a top switch button.
    # 2026-07-20 cleanup: the money sections never collapse, the client
    # book starts open, and demographics + revenue-by-vertical merge into
    # a bottom "County data" dropdown.
    assert "chip-acc" in script
    assert "NEVER_COLLAPSE_PREFIXES" in script and '"sales snapshot"' in script
    assert "mergeCountyData" in script
    assert '"client book"' in script  # default-open working list
    assert "chipToAE" in script and "#toProspect" in script
    assert "chip-btn-ae" in script  # AE-green so the two directions differ
    # Methodology + Get/Keep/Grow move into a popup where the detail pane is.
    assert "chipMethodPop" in script
    assert "methodologyDetails" in script


def test_detail_panes_collapse_and_floating_chips_clear_open_panes() -> None:
    css = read("assets/css/mobile.css")
    assert ".chip-acc" in css
    assert ".chip-mode-switchbar" in css
    assert ".chip-method-pop" in css
    assert ".chip-drawer-method-link" in css
    # KEEP pill reads as urgent, and the rank toggle is styled.
    assert ".pst--keep" in css
    assert ".chip-sort-bar" in css
    # The AE switch is green and phone tap targets are full size.
    assert ".chip-btn-ae" in css
    assert 'html[data-device="mobile"] .chip-acc > .chip-acc__head' in css
    # Merged County data sub-heads keep the frozen heading look.
    assert ".chip-subhead" in css
    # 2026-07-20: the chips hide while any pane is open, on both devices
    # (the earlier desktop left-shift stranded them mid-map), and touch
    # devices never show the stranded hover tooltip.
    assert "html.chip-pane-open .chip-tour-launch" in css
    assert 'html[data-device="mobile"] #tip' in css
    acss = read("assets/css/assistant.css")
    assert "html.chip-pane-open .chip-assistant-launcher" in acss
    assert "var(--chip-pane-clear" in acss  # chat panel still docks beside
    # Phones put the launcher top-right (mirroring the Controls chip) and
    # count the near-fullscreen drawer as an open pane.
    assert "top: calc(env(safe-area-inset-top, 0px) + 72px)" in acss
    script = read("assets/js/app-refinements.js")
    assert "drawerOpen" in script


def test_app_bar_tabs_replace_the_desktop_floating_pills() -> None:
    # 2026-07-21 feedback: Take the tour and Ask CHIP become app-bar tabs
    # (Methodology moves to the end), joined by two demo-connection tabs;
    # desktop floating pills retire, phones keep their own affordances
    # and reach the demo connections from the Controls drawer.
    script = read("assets/js/app-refinements.js")
    assert "enhanceAppNav" in script
    assert "chip-nav-tour" in script and "chip-nav-ask" in script
    assert "Open Architect" in script and "Open Salesforce" in script
    assert "chipConnectPop" in script
    assert "This is a demo of how CHIP could connect" in script
    assert "chip-drawer-connect-link" in script
    css = read("assets/css/mobile.css")
    assert ".chip-connect" in css
    assert ".chip-drawer-connect-link" in css
    assert 'html:not([data-device="mobile"]) .tour-launch' in css
    assert 'html[data-device="mobile"] .appnav' in css
    acss = read("assets/css/assistant.css")
    assert 'html:not([data-device="mobile"]) .chip-assistant-launcher' in acss
    # The tour's bonus steps follow the relocated targets.
    mobile_ui = read("assets/js/mobile-ui.js")
    assert "chip-nav-ask" in mobile_ui and "chip-nav-tour" in mobile_ui


def test_asset_references_are_cache_busted() -> None:
    # 2026-07-20 field debugging: a stale-CSS/fresh-JS split from browser
    # caches produced mixed chip states on deployed devices. Every local
    # asset reference carries a version query, and mobile-ui.js forwards
    # it to the stylesheet it injects into the iframe.
    pattern = re.compile(r'(?:href|src)="\./assets/[^"?]+(?:\?v=([0-9a-z-]+))?"')
    versions = set()
    for page in ("index.html", "app.html", "tutorial.html"):
        for match in pattern.finditer(read(page)):
            assert match.group(1), f"unversioned asset in {page}: {match.group(0)}"
            versions.add(match.group(1))
    assert len(versions) == 1, f"asset versions out of step: {versions}"
    script = read("assets/js/mobile-ui.js")
    assert 'searchParams.get("v")' in script


def test_no_api_keys_committed_to_the_delivery_layer() -> None:
    for path in (
        "index.html",
        "app.html",
        "tutorial.html",
        "assets/js/chip-assistant.js",
        "assets/js/mobile-ui.js",
        "assets/js/app-refinements.js",
        "assets/js/landing.js",
        "assets/js/tutorial-state.js",
        "assets/css/assistant.css",
        "README.md",
        "STATUS.md",
    ):
        assert "sk-ant-" not in read(path), f"credential-like string in {path}"


def test_navigation_affordances_link_home_and_into_the_tour() -> None:
    # Approved desktop-visible additions from the 2026-07-19 UI review: the
    # brand links home with no resting visual change, phones get a Home chip
    # in the app bar, and the dashboard gains the tutorial's tour launcher.
    script = read("assets/js/mobile-ui.js")
    css = read("assets/css/mobile.css")
    assert 'brand.setAttribute("role", "link")' in script
    assert "chip-home-link" in script and "chip-home-link" in css
    assert "chip-tour-launch" in script and "chip-tour-launch" in css
    # Everything that leaves the iframe must target the top window.
    assert script.count('target = "_top"') >= 3
    # The launcher is desktop-only; mobile uses the drawer's replay link.
    assert ".chip-tour-launch {\n    display: none !important;\n  }" in css


def test_mobile_map_fit_reasserts_until_the_market_view_sticks() -> None:
    # 2026-07-20 field report: one refit at iframe load still left a real
    # iPhone at the constructor's world-view fallback. The injected fit now
    # re-checks after style load and on a short backoff, refitting only
    # while the camera is clearly at world scale (zoom < 4) and the user
    # has not touched the map.
    script = read("assets/js/mobile-ui.js")
    assert "chipEnsureMarketView" in script
    assert "chipFitMarket" in script
    assert "userMoved" in script
    assert "z >= 4" in script


def test_mobile_collapses_the_default_expanded_map_attribution() -> None:
    # MapLibre's compact attribution pops out expanded by default on
    # phone-width maps. The delivery layer collapses it to its info toggle
    # (attribution stays one tap away) and must never override a user's own
    # explicit toggle.
    script = read("assets/js/mobile-ui.js")
    assert "maplibregl-compact-show" in script
    assert "maplibregl-ctrl-attrib-button" in script
    assert "chipUserExpanded" in script
    assert "event.isTrusted" in script


def test_mobile_css_is_scoped_and_safe_area_aware() -> None:
    css = read("assets/css/mobile.css")
    assert "max-width: 820px" in css
    assert 'html[data-device="mobile"]' in css
    assert ".ctrl.open" in css
    assert ".chip-mobile-backdrop" in css
    assert "100dvh" in css
    assert "safe-area-inset-top" in css
    assert "safe-area-inset-bottom" in css


def test_mobile_tour_adapts_to_short_screens() -> None:
    css = read("assets/css/mobile.css")
    script = read("assets/js/mobile-ui.js")
    assert "--chip-tour-card-height" in css
    assert "max-height: 540px" in css
    assert "min-width: 520px" in css
    assert "width: calc(48vw" in css
    assert 'style.setProperty("--chip-tour-card-height"' in script
    assert 'scrollIntoView({ block: "center", inline: "nearest" })' in script
    # Observers must come from the child window so they survive iframe
    # reloads: controls, map-state legend, detail, tutorial-completion,
    # tour state, tour card, nine-step tour relabel.
    assert script.count("new frame.contentWindow.MutationObserver") == 7
    # Desktop tour responsiveness: reveal panel targets and clamp the card.
    assert 'scrollIntoView({ block: "nearest", inline: "nearest" })' in script
    assert "scheduleCardClamp" in script


def test_pages_workflow_uses_official_actions_and_validates_first() -> None:
    workflow = read(".github/workflows/pages.yml")
    required = {
        "actions/configure-pages@v5",
        "actions/upload-pages-artifact@v3",
        "actions/deploy-pages@v4",
        "pages: write",
        "id-token: write",
        "pytest",
        "path: _site",
    }
    missing = sorted(fragment for fragment in required if fragment not in workflow)
    assert not missing, f"Missing Pages workflow contracts: {missing}"


def test_no_hard_coded_github_pages_owner_or_repo_path() -> None:
    text = "\n".join(
        read(path)
        for path in (
            "index.html",
            "app.html",
            "tutorial.html",
            "assets/js/landing.js",
            "assets/js/mobile-ui.js",
            "assets/js/app-refinements.js",
            "assets/js/chip-assistant.js",
        )
    )
    assert not re.search(r"https://[^\s\"']+\.github\.io/", text)
