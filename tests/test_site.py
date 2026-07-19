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
        "assets/js/tutorial-state.js",
        "assets/js/landing.js",
        "assets/js/mobile-ui.js",
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


def test_wrapper_pages_reference_untouched_sources() -> None:
    assert 'src="./CHIPv.4.2.html"' in read("app.html")
    tutorial = read("tutorial.html")
    assert 'src="./CHIPv.4.2-tutorial.html"' in tutorial
    assert 'src="./assets/js/tutorial-state.js"' in tutorial


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
    # reloads: controls, detail, tutorial-completion, tour state, tour card.
    assert script.count("new frame.contentWindow.MutationObserver") == 5
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
        )
    )
    assert not re.search(r"https://[^\s\"']+\.github\.io/", text)
