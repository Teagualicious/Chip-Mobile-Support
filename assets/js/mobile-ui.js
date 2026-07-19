(function initChipMobileDeliveryLayer() {
  "use strict";

  const frame = document.getElementById("chip-frame");
  if (!frame) {
    return;
  }

  const pageMode = document.body.dataset.page || "dashboard";
  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("./assets/js/mobile-ui.js", window.location.href).href;
  const mobileStylesheetUrl = new URL("../css/mobile.css", scriptUrl).href;
  const narrowViewport = window.matchMedia("(max-width: 820px)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");

  let childDocument = null;
  let cleanupCallbacks = [];
  let resizeFrameId = 0;
  let tutorialInteractions = 0;
  let tutorialUiSeen = false;
  let tutorialComplete = false;
  let tourClosureTimer = 0;

  function detectDeviceMode() {
    const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const uaMobile = Boolean(
      navigator.userAgentData &&
      typeof navigator.userAgentData.mobile === "boolean" &&
      navigator.userAgentData.mobile,
    );

    return narrowViewport.matches || (coarsePointer.matches && touchCapable) || uaMobile
      ? "mobile"
      : "desktop";
  }

  function scheduleMapResize() {
    window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = window.requestAnimationFrame(function firstFrame() {
      resizeFrameId = window.requestAnimationFrame(function secondFrame() {
        const childWindow = frame.contentWindow;
        if (!childWindow) {
          return;
        }

        try {
          const possibleMaps = [
            childWindow.map,
            childWindow.chipMap,
            childWindow.mapInstance,
          ];
          possibleMaps.forEach(function resizeCandidate(candidate) {
            if (candidate && typeof candidate.resize === "function") {
              candidate.resize();
            }
          });
          childWindow.dispatchEvent(new Event("resize"));
        } catch (error) {
          // Same-origin access is expected on GitHub Pages. A guarded fallback
          // keeps the original application usable if a browser blocks access.
        }
      });
    });
  }

  function setDeviceMode() {
    const mode = detectDeviceMode();
    document.documentElement.dataset.device = mode;

    if (!childDocument) {
      return;
    }

    childDocument.documentElement.dataset.device = mode;
    const controls = childDocument.getElementById("ctrl") || childDocument.querySelector(".ctrl");
    if (controls && mode === "desktop") {
      controls.classList.remove("open", "hidden");
      childDocument.body.classList.remove("chip-controls-open");
    }
    if (controls && mode === "mobile" && !controls.dataset.chipMobileInitialized) {
      controls.classList.remove("open", "hidden");
    }

    scheduleMapResize();
  }

  function injectViewportMetadata(doc) {
    let viewport = doc.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = doc.createElement("meta");
      viewport.name = "viewport";
      doc.head.appendChild(viewport);
    }

    const current = viewport.getAttribute("content") || "width=device-width, initial-scale=1";
    if (!current.includes("viewport-fit=cover")) {
      viewport.setAttribute("content", current + ", viewport-fit=cover");
    }
  }

  function injectMobileStyles(doc) {
    if (doc.getElementById("chip-mobile-support-styles")) {
      return;
    }

    const link = doc.createElement("link");
    link.id = "chip-mobile-support-styles";
    link.rel = "stylesheet";
    link.href = mobileStylesheetUrl;
    link.addEventListener("load", scheduleMapResize, { once: true });
    doc.head.appendChild(link);
  }

  function applyMobileMapFit(doc) {
    if (detectDeviceMode() !== "mobile" || doc.getElementById("chip-mobile-map-fit")) {
      return;
    }

    // The original applications fit the market bounds with 360-380px of side
    // padding reserved for the desktop panels. On narrow viewports that
    // padding exceeds the map size, MapLibre cannot compute the camera, and
    // the map falls back to a world view. `map` and `BOUNDS` are top-level
    // lexical bindings in the original inline scripts, so the refit has to
    // run as a script inside the child document rather than through
    // `contentWindow` property access.
    const script = doc.createElement("script");
    script.id = "chip-mobile-map-fit";
    script.textContent = [
      "(function chipMobileMapFit() {",
      "  try {",
      "    if (typeof map === \"undefined\" || typeof BOUNDS === \"undefined\") { return; }",
      "    if (!map || typeof map.fitBounds !== \"function\") { return; }",
      "    map.fitBounds(BOUNDS, {",
      "      padding: { top: 76, right: 28, bottom: 96, left: 28 },",
      "      duration: 0",
      "    });",
      "  } catch (error) {}",
      "})();",
    ].join("\n");
    doc.body.appendChild(script);
  }

  function applyMobileLabelTuning(doc) {
    if (detectDeviceMode() !== "mobile" || doc.getElementById("chip-mobile-label-tuning")) {
      return;
    }

    // The original `positionLabels` hides every county label below zoom 7.2
    // because small counties collide at desktop label sizes. The mobile
    // full-market view sits near zoom 6.7, so the default view showed no
    // labels at all. Keep labels visible while zooming out, growing them
    // modestly for readability, and only hide once the market itself is too
    // small to label. `map`, `positionLabels`, and the label elements live in
    // the child document, so the tuner runs as an injected script. Wrapping
    // `positionLabels` covers handlers registered after this script runs;
    // the extra map listeners cover handlers registered before it.
    const script = doc.createElement("script");
    script.id = "chip-mobile-label-tuning";
    script.textContent = [
      "(function chipMobileLabelTuning() {",
      "  try {",
      "    if (typeof map === \"undefined\" || !map || typeof map.on !== \"function\") { return; }",
      "    if (typeof positionLabels !== \"function\") { return; }",
      "    var BASE_ZOOM = 7.2;",
      "    var MIN_ZOOM = 5.2;",
      "    var MAX_SIZE = 13.5;",
      "    function tuneLabels() {",
      "      var z = map.getZoom();",
      "      var labels = document.querySelectorAll(\"#labels .clab\");",
      "      if (!labels.length) { return; }",
      "      var boosted = z < BASE_ZOOM;",
      "      var visible = z >= MIN_ZOOM;",
      "      var size = Math.min(MAX_SIZE, 11 + (BASE_ZOOM - z) * 0.9);",
      "      for (var i = 0; i < labels.length; i++) {",
      "        if (!boosted || !visible) { labels[i].style.removeProperty(\"font-size\"); }",
      "        if (!boosted) { continue; }",
      "        labels[i].style.opacity = visible ? 1 : 0;",
      "        if (visible) {",
      "          /* The mobile stylesheet pins .clab to 11px with !important. */",
      "          labels[i].style.setProperty(\"font-size\", size.toFixed(1) + \"px\", \"important\");",
      "        }",
      "      }",
      "    }",
      "    var originalPositionLabels = positionLabels;",
      "    positionLabels = function () { originalPositionLabels(); tuneLabels(); };",
      "    map.on(\"move\", tuneLabels);",
      "    map.on(\"zoom\", tuneLabels);",
      "    tuneLabels();",
      "  } catch (error) {}",
      "})();",
    ].join("\n");
    doc.body.appendChild(script);
  }

  function createBackdrop(doc) {
    let backdrop = doc.querySelector(".chip-mobile-backdrop");
    if (backdrop) {
      return backdrop;
    }

    backdrop = doc.createElement("button");
    backdrop.className = "chip-mobile-backdrop";
    backdrop.type = "button";
    backdrop.tabIndex = -1;
    backdrop.setAttribute("aria-label", "Close controls");
    doc.body.appendChild(backdrop);
    return backdrop;
  }

  function buildDrawerFurniture(doc, controls) {
    const scroll = controls.querySelector(".ctrl__scroll");
    if (!scroll) {
      return;
    }

    // Header row with the drawer's only always-visible close action. The
    // button just drops the `open` class; the class MutationObserver in
    // enhanceControls owns the rest of the close bookkeeping.
    if (!controls.querySelector(".chip-drawer-header")) {
      const header = doc.createElement("div");
      header.className = "chip-drawer-header";
      const title = doc.createElement("b");
      title.textContent = "Map controls";
      const close = doc.createElement("button");
      close.type = "button";
      close.className = "chip-drawer-close";
      close.setAttribute("aria-label", "Close controls");
      close.textContent = "×";
      header.appendChild(title);
      header.appendChild(close);
      controls.insertBefore(header, controls.firstChild);
    }

    // The market-intro copy collapses behind this toggle on mobile. The
    // `.hdr` element itself is untouched apart from the state class, and on
    // desktop the class has no effect, so the protected baseline holds.
    const hdr = scroll.querySelector(".hdr");
    const firstGroup = scroll.querySelector("details.grp");
    if (hdr && !scroll.querySelector(".chip-drawer-about-toggle")) {
      hdr.id = hdr.id || "chipAboutMarket";
      hdr.classList.add("chip-about-collapsed");
      const aboutToggle = doc.createElement("button");
      aboutToggle.type = "button";
      aboutToggle.className = "chip-drawer-about-toggle";
      aboutToggle.setAttribute("aria-expanded", "false");
      aboutToggle.setAttribute("aria-controls", hdr.id);
      const aboutLabel = doc.createElement("span");
      aboutLabel.textContent = "About this market";
      const chevron = doc.createElement("span");
      chevron.className = "chip-chevron";
      chevron.setAttribute("aria-hidden", "true");
      aboutToggle.appendChild(aboutLabel);
      aboutToggle.appendChild(chevron);
      aboutToggle.addEventListener("click", function toggleAbout() {
        const collapsed = hdr.classList.toggle("chip-about-collapsed");
        aboutToggle.setAttribute("aria-expanded", String(!collapsed));
      });
      scroll.insertBefore(aboutToggle, firstGroup);
    }

    // Give the dashboard a way back into the guided tour (the tutorial page
    // already has its own launcher). `target="_top"` escapes the iframe.
    if (pageMode === "dashboard" && !scroll.querySelector(".chip-drawer-tour")) {
      const tourLink = doc.createElement("a");
      tourLink.className = "chip-drawer-tour";
      tourLink.href = "tutorial.html?replay=1";
      tourLink.target = "_top";
      tourLink.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        "<span>Replay the guided tour</span>";
      scroll.insertBefore(tourLink, firstGroup);
    }

    // The sample-data disclaimer lives inside the collapsed copy, so a
    // compact footer note keeps it visible at all times.
    if (!scroll.querySelector(".chip-drawer-note")) {
      const note = doc.createElement("p");
      note.className = "chip-drawer-note";
      note.textContent = "Illustrative sample data for demonstration purposes.";
      scroll.appendChild(note);
    }
  }

  function enhanceControls(doc) {
    const controls = doc.getElementById("ctrl") || doc.querySelector(".ctrl");
    const toggle = doc.getElementById("mtoggle") || doc.querySelector(".mtoggle");
    if (!controls || !toggle) {
      return;
    }

    controls.id = controls.id || "ctrl";
    controls.dataset.chipMobileInitialized = "true";
    controls.classList.remove("hidden");
    toggle.setAttribute("aria-controls", controls.id);
    toggle.setAttribute("aria-expanded", "false");

    buildDrawerFurniture(doc, controls);

    const backdrop = createBackdrop(doc);

    function isOpen() {
      return controls.classList.contains("open");
    }

    function syncOpenState() {
      const open = isOpen() && detectDeviceMode() === "mobile";
      toggle.setAttribute("aria-expanded", String(open));
      doc.body.classList.toggle("chip-controls-open", open);
      backdrop.tabIndex = open ? 0 : -1;
      scheduleMapResize();
    }

    function closeControls(options) {
      controls.classList.remove("open", "hidden");
      syncOpenState();
      if (options && options.restoreFocus) {
        toggle.focus({ preventScroll: true });
      }
    }

    function handleToggleFallback() {
      const wasOpen = isOpen();
      window.setTimeout(function ensureToggleWorked() {
        if (isOpen() === wasOpen) {
          controls.classList.toggle("open");
        }
        controls.classList.remove("hidden");
        syncOpenState();
      }, 0);
    }

    function handleEscape(event) {
      if (event.key === "Escape" && isOpen()) {
        event.preventDefault();
        closeControls({ restoreFocus: true });
      }
    }

    function handleFocusTrap(event) {
      if (event.key !== "Tab" || !isOpen() || detectDeviceMode() !== "mobile") {
        return;
      }

      const focusable = Array.from(
        controls.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(function visible(element) {
        return element.getClientRects().length > 0;
      });

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener("click", handleToggleFallback);
    backdrop.addEventListener("click", function handleBackdrop() {
      closeControls({ restoreFocus: true });
    });
    const drawerClose = controls.querySelector(".chip-drawer-close");
    if (drawerClose) {
      drawerClose.addEventListener("click", function handleDrawerClose() {
        closeControls({ restoreFocus: true });
      });
    }
    doc.addEventListener("keydown", handleEscape);
    doc.addEventListener("keydown", handleFocusTrap);

    const observer = new frame.contentWindow.MutationObserver(syncOpenState);
    observer.observe(controls, { attributes: true, attributeFilter: ["class"] });

    if (detectDeviceMode() === "mobile") {
      closeControls();
    } else {
      syncOpenState();
    }

    cleanupCallbacks.push(function cleanupControls() {
      observer.disconnect();
      toggle.removeEventListener("click", handleToggleFallback);
      doc.removeEventListener("keydown", handleEscape);
      doc.removeEventListener("keydown", handleFocusTrap);
    });
  }

  function enhanceMapState(doc) {
    const toggle = doc.getElementById("mtoggle") || doc.querySelector(".mtoggle");
    const metricSelect = doc.getElementById("metric");
    const legendBar = doc.getElementById("legendBar");
    const legMin = doc.getElementById("legMin");
    const legMax = doc.getElementById("legMax");
    const modeAE = doc.getElementById("modeAE");
    if (!toggle || !metricSelect || !legendBar) {
      return;
    }

    let badge = toggle.querySelector(".chip-filter-badge");
    if (!badge) {
      badge = doc.createElement("span");
      badge.className = "chip-filter-badge";
      badge.hidden = true;
      badge.setAttribute("aria-hidden", "true");
      toggle.appendChild(badge);
    }

    let legend = doc.querySelector(".chip-map-legend");
    if (!legend) {
      legend = doc.createElement("div");
      legend.className = "chip-map-legend";
      legend.hidden = true;
      // The chip mirrors information already exposed inside the drawer, so
      // it stays out of the accessibility tree.
      legend.setAttribute("aria-hidden", "true");
      legend.innerHTML =
        '<div class="chip-map-legend__title">' +
        '<span class="chip-map-legend__metric"></span>' +
        '<span class="chip-map-legend__mode"></span>' +
        "</div>" +
        '<div class="chip-map-legend__bar"></div>' +
        '<div class="chip-map-legend__scale"><span></span><span></span></div>';
      doc.body.appendChild(legend);
    }

    const metricLabel = legend.querySelector(".chip-map-legend__metric");
    const modeLabel = legend.querySelector(".chip-map-legend__mode");
    const bar = legend.querySelector(".chip-map-legend__bar");
    const scale = legend.querySelectorAll(".chip-map-legend__scale span");

    function activeFilterCount() {
      let count = 0;
      ["vertFilter", "chanFilter"].forEach(function countFilter(id) {
        const select = doc.getElementById(id);
        if (select && select.value && select.value !== "all") {
          count += 1;
        }
      });
      return count;
    }

    function syncMapState() {
      const filters = activeFilterCount();
      badge.hidden = filters === 0;
      badge.textContent = String(filters);
      toggle.setAttribute(
        "aria-label",
        filters === 0
          ? "Toggle controls"
          : "Toggle controls, " + filters + (filters === 1 ? " filter active" : " filters active"),
      );

      // The original app builds its UI only after the basemap loads; until
      // the metric select has options there is nothing truthful to mirror,
      // so the chip stays hidden (see STATUS.md on offline resilience).
      const option = metricSelect.selectedOptions && metricSelect.selectedOptions[0];
      if (!option) {
        legend.hidden = true;
        return;
      }
      metricLabel.textContent = option.textContent;
      modeLabel.textContent = modeAE && modeAE.classList.contains("on") ? "AE" : "Prospect";
      bar.style.background = legendBar.style.background || "";
      scale[0].textContent = legMin ? legMin.textContent : "";
      scale[1].textContent = legMax ? legMax.textContent : "";
      legend.hidden = false;
    }

    function handleStateChange() {
      // Runs after the app's own change/click handlers (document-level
      // bubble for changes, a macrotask for Reset's programmatic writes).
      window.setTimeout(syncMapState, 0);
    }

    function handleResetClick(event) {
      const target = event.target instanceof frame.contentWindow.Element
        ? event.target.closest("#resetFilters")
        : null;
      if (target) {
        handleStateChange();
      }
    }

    doc.addEventListener("change", handleStateChange);
    doc.addEventListener("click", handleResetClick);

    const observer = new frame.contentWindow.MutationObserver(syncMapState);
    observer.observe(legendBar, { attributes: true, attributeFilter: ["style"] });
    if (modeAE) {
      observer.observe(modeAE, { attributes: true, attributeFilter: ["class"] });
    }
    if (legMin) {
      observer.observe(legMin, { childList: true, characterData: true, subtree: true });
    }
    if (legMax) {
      observer.observe(legMax, { childList: true, characterData: true, subtree: true });
    }
    syncMapState();

    cleanupCallbacks.push(function cleanupMapState() {
      observer.disconnect();
      doc.removeEventListener("change", handleStateChange);
      doc.removeEventListener("click", handleResetClick);
    });
  }

  function enhanceDetails(doc) {
    const detail = doc.querySelector(".detail");
    if (!detail) {
      return;
    }

    if (!detail.hasAttribute("role")) {
      detail.setAttribute("role", "dialog");
    }
    detail.setAttribute("aria-modal", "false");

    // Half-sheet grab handle. The sheet opens at half height so the tapped
    // county stays visible; the handle (tap, keyboard, or a short drag)
    // expands it to near-full height. Sits outside .detail__scroll, so the
    // app's innerHTML re-renders never remove it.
    let grab = detail.querySelector(".chip-sheet-grab");
    if (!grab) {
      grab = doc.createElement("button");
      grab.type = "button";
      grab.className = "chip-sheet-grab";
      grab.setAttribute("aria-label", "Expand county details");
      grab.setAttribute("aria-expanded", "false");
      detail.insertBefore(grab, detail.firstChild);
    }

    function setSheetTall(tall) {
      detail.classList.toggle("chip-sheet-tall", tall);
      grab.setAttribute("aria-expanded", String(tall));
      grab.setAttribute("aria-label", tall ? "Collapse county details" : "Expand county details");
      scheduleMapResize();
    }

    let dragStartY = null;
    let dragConsumed = false;

    function handleGrabPointerDown(event) {
      dragStartY = event.clientY;
    }

    function handleGrabPointerUp(event) {
      if (dragStartY === null) {
        return;
      }
      const delta = event.clientY - dragStartY;
      dragStartY = null;
      if (Math.abs(delta) >= 24) {
        dragConsumed = true;
        setSheetTall(delta < 0);
        // The suppressing click (if any) fires before this macrotask, so a
        // drag that ends without a click cannot swallow the next tap.
        window.setTimeout(function clearDragConsumed() {
          dragConsumed = false;
        }, 0);
      }
    }

    function handleGrabClick() {
      if (dragConsumed) {
        dragConsumed = false;
        return;
      }
      setSheetTall(!detail.classList.contains("chip-sheet-tall"));
    }

    grab.addEventListener("pointerdown", handleGrabPointerDown);
    grab.addEventListener("pointerup", handleGrabPointerUp);
    grab.addEventListener("pointercancel", function handleGrabCancel() {
      dragStartY = null;
    });
    grab.addEventListener("click", handleGrabClick);

    const controls = doc.getElementById("ctrl") || doc.querySelector(".ctrl");
    let detailWasVisible = false;
    const observer = new frame.contentWindow.MutationObserver(function handleDetailChange() {
      const computed = frame.contentWindow.getComputedStyle(detail);
      const visible = computed.display !== "none" && computed.visibility !== "hidden";
      doc.body.classList.toggle("chip-detail-open", visible && detectDeviceMode() === "mobile");
      if (visible && !detailWasVisible) {
        // Every fresh selection starts at half height.
        setSheetTall(false);
      }
      detailWasVisible = visible;
      if (visible && controls && detectDeviceMode() === "mobile") {
        controls.classList.remove("open");
        doc.body.classList.remove("chip-controls-open");
      }
      scheduleMapResize();
    });

    observer.observe(detail, {
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });
    cleanupCallbacks.push(function cleanupDetailObserver() {
      observer.disconnect();
      grab.removeEventListener("pointerdown", handleGrabPointerDown);
      grab.removeEventListener("pointerup", handleGrabPointerUp);
      grab.removeEventListener("click", handleGrabClick);
    });
  }

  function elementText(target) {
    if (!(target instanceof frame.contentWindow.Element)) {
      return "";
    }
    const actionable = target.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!actionable) {
      return "";
    }
    return String(actionable.innerText || actionable.value || actionable.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof frame.contentWindow.Element)) {
      return false;
    }
    const style = frame.contentWindow.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && element.getClientRects().length > 0;
  }

  function visibleTutorialUi(doc) {
    const selectors = [
      '[id*="tutorial" i]',
      '[class*="tutorial" i]',
      '[id*="tour" i]',
      '[class*="tour" i]',
      '[id*="walkthrough" i]',
      '[class*="walkthrough" i]',
      '[id*="guide" i]',
      '[class*="guide" i]',
      '[id*="coach" i]',
      '[class*="coach" i]',
    ];

    return Array.from(doc.querySelectorAll(selectors.join(","))).some(isVisible);
  }

  function markTutorialComplete(source) {
    if (tutorialComplete || pageMode !== "tutorial") {
      return;
    }
    tutorialComplete = true;
    if (window.ChipTutorialState) {
      window.ChipTutorialState.markCompleted(source);
    }
  }

  function setupTutorialCompletion(doc) {
    if (pageMode !== "tutorial" || !window.ChipTutorialState) {
      return;
    }

    const completionPattern = /^(finish(?: (?:the )?(?:tutorial|tour))?|done|complete(?: (?:the )?(?:tutorial|tour))?|end (?:the )?tour|explore (?:the )?dashboard|open (?:the )?dashboard|start exploring)$/i;
    const progressionPattern = /^(next|continue|begin|start(?: (?:the )?(?:tutorial|tour))?|show me|let(?:'|’)s go)$/i;

    function checkForClosedTour() {
      window.clearTimeout(tourClosureTimer);
      tourClosureTimer = window.setTimeout(function confirmClosure() {
        const visible = visibleTutorialUi(doc);
        if (visible) {
          tutorialUiSeen = true;
        } else if (tutorialUiSeen && tutorialInteractions >= 2) {
          markTutorialComplete("tutorial-interface-closed");
        }
      }, 700);
    }

    function handleTutorialClick(event) {
      const text = elementText(event.target);
      if (!text) {
        return;
      }

      if (completionPattern.test(text)) {
        markTutorialComplete("tutorial-finish-action");
        return;
      }

      const actionable = event.target.closest('button, a, [role="button"]');
      const inTutorialUi = actionable && actionable.closest(
        '[id*="tutorial" i], [class*="tutorial" i], [id*="tour" i], [class*="tour" i], [id*="walkthrough" i], [class*="walkthrough" i], [id*="guide" i], [class*="guide" i]',
      );

      if (progressionPattern.test(text) || inTutorialUi) {
        tutorialInteractions += 1;
        tutorialUiSeen = tutorialUiSeen || Boolean(inTutorialUi) || visibleTutorialUi(doc);
        checkForClosedTour();
      }
    }

    function handleExplicitCompletionEvent() {
      markTutorialComplete("tutorial-completion-event");
    }

    doc.addEventListener("click", handleTutorialClick, true);
    doc.addEventListener("tutorial:complete", handleExplicitCompletionEvent);
    doc.addEventListener("tour:complete", handleExplicitCompletionEvent);
    doc.addEventListener("chip:tutorial-complete", handleExplicitCompletionEvent);

    const observer = new frame.contentWindow.MutationObserver(checkForClosedTour);
    if (doc.body) {
      observer.observe(doc.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden"],
      });
    }

    tutorialUiSeen = visibleTutorialUi(doc);

    cleanupCallbacks.push(function cleanupTutorial() {
      observer.disconnect();
      window.clearTimeout(tourClosureTimer);
      doc.removeEventListener("click", handleTutorialClick, true);
      doc.removeEventListener("tutorial:complete", handleExplicitCompletionEvent);
      doc.removeEventListener("tour:complete", handleExplicitCompletionEvent);
      doc.removeEventListener("chip:tutorial-complete", handleExplicitCompletionEvent);
    });
  }

  function setupTourMobileLayout(doc) {
    const tourRoot = doc.getElementById("tourRoot");
    const kicker = doc.getElementById("tourKicker");
    const card = tourRoot && tourRoot.querySelector(".tour-card");
    const controls = doc.getElementById("ctrl") || doc.querySelector(".ctrl");
    if (!tourRoot || !kicker || !card || !controls) {
      return;
    }

    // Tour steps that highlight controls living inside the mobile drawer.
    // Mirrors the frozen step order in CHIPv.4.2-tutorial.html; unmatched
    // selectors are simply ignored if the source ever changes.
    const drawerStepTargets = [".hdr", "#modeSeg", ".field", "#dmaClientFilters"];
    // Step 6 ("Review the detail panel") falls back to highlighting the app
    // bar when no county is selected. On mobile the detail sheet is hidden
    // until a selection exists, so the step showed nothing useful.
    const detailStepIndex = 5;
    let autoOpenedDrawer = false;
    let autoSelectedCounty = false;
    let autoExpandedAbout = false;
    let rerenderTimer = 0;
    let layoutFrameId = 0;

    // Tour step 1 highlights `.hdr`, which the mobile drawer keeps collapsed
    // behind the "About this market" toggle. Expand it for that step only,
    // and restore the collapsed state on the way out.
    function setAboutExpanded(expanded) {
      const hdr = controls.querySelector(".hdr");
      const aboutToggle = controls.querySelector(".chip-drawer-about-toggle");
      if (!hdr) {
        return;
      }
      if (expanded && hdr.classList.contains("chip-about-collapsed")) {
        hdr.classList.remove("chip-about-collapsed");
        autoExpandedAbout = true;
        if (aboutToggle) {
          aboutToggle.setAttribute("aria-expanded", "true");
        }
      } else if (!expanded && autoExpandedAbout) {
        autoExpandedAbout = false;
        hdr.classList.add("chip-about-collapsed");
        if (aboutToggle) {
          aboutToggle.setAttribute("aria-expanded", "false");
        }
      }
    }

    // `selectCounty`, `deselect`, and `GEO` are top-level bindings in the
    // original inline scripts; `GEO` is a const, so the sample-selection
    // helpers must run as a script inside the child document.
    if (!doc.getElementById("chip-tour-detail-helpers")) {
      const helperScript = doc.createElement("script");
      helperScript.id = "chip-tour-detail-helpers";
      helperScript.textContent = [
        "(function chipTourDetailHelpers() {",
        "  if (window.__chipTourShowDetailSample) { return; }",
        "  window.__chipTourShowDetailSample = function () {",
        "    try {",
        "      var detail = document.getElementById(\"detail\");",
        "      if (!detail || detail.classList.contains(\"open\")) { return false; }",
        "      if (typeof selectCounty !== \"function\" || typeof GEO === \"undefined\") { return false; }",
        "      var features = (GEO.counties && GEO.counties.features) || [];",
        "      var feature = null;",
        "      for (var i = 0; i < features.length; i++) {",
        "        var props = features[i] && features[i].properties;",
        "        if (props && props.name === \"Cuyahoga\") { feature = features[i]; break; }",
        "      }",
        "      feature = feature || features[0];",
        "      if (!feature || feature.id === undefined) { return false; }",
        "      selectCounty(feature.id);",
        "      return true;",
        "    } catch (error) { return false; }",
        "  };",
        "  window.__chipTourClearDetailSample = function () {",
        "    try { if (typeof deselect === \"function\") { deselect(); } } catch (error) {}",
        "  };",
        "})();",
      ].join("\n");
      doc.body.appendChild(helperScript);
    }

    function clearDetailSample() {
      doc.body.classList.remove("chip-tour-detail-step");
      if (!autoSelectedCounty) {
        return;
      }
      autoSelectedCounty = false;
      try {
        frame.contentWindow.__chipTourClearDetailSample();
      } catch (error) {
        // Losing the deselect only leaves a county selected, which the
        // user can clear by tapping the map.
      }
    }

    function requestTourRerender() {
      window.clearTimeout(rerenderTimer);
      rerenderTimer = window.setTimeout(function rerenderTour() {
        try {
          frame.contentWindow.dispatchEvent(new Event("resize"));
        } catch (error) {
          // The tour re-renders on its own resize listener; losing one
          // refresh only delays the focus ring, so failures are safe.
        }
      }, 260);
    }

    // The tour positions its card and focus ring from getBoundingClientRect
    // without ever scrolling a target into view or keeping the card inside
    // the viewport. On short desktop screens the panel targets sit below the
    // fold, so steps highlighted nothing and the card ran off the bottom.
    // The clamp only rewrites the card's inline position when it overflows,
    // so full-size desktop layouts are untouched.
    let clampFrameId = 0;
    function scheduleCardClamp() {
      window.cancelAnimationFrame(clampFrameId);
      clampFrameId = window.requestAnimationFrame(function clampTourCard() {
        if (tourRoot.hidden || detectDeviceMode() === "mobile") {
          return;
        }
        const win = frame.contentWindow;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        // The card transitions top/left, so its rect lags behind the tour's
        // most recent placement; clamp the intended inline position instead.
        const styleTop = parseFloat(card.style.top);
        const styleLeft = parseFloat(card.style.left);
        if (Number.isNaN(styleTop) || Number.isNaN(styleLeft)) {
          return;
        }
        const margin = 14;
        const top = Math.min(Math.max(styleTop, margin), Math.max(margin, win.innerHeight - rect.height - margin));
        const left = Math.min(Math.max(styleLeft, margin), Math.max(margin, win.innerWidth - rect.width - margin));
        if (Math.abs(top - styleTop) > 1) {
          card.style.top = Math.round(top) + "px";
        }
        if (Math.abs(left - styleLeft) > 1) {
          card.style.left = Math.round(left) + "px";
        }
      });
    }

    function syncTourState() {
      const mobile = detectDeviceMode() === "mobile";
      const active = !tourRoot.hidden;
      doc.body.classList.toggle("chip-tour-active", mobile && active);

      if (!active) {
        doc.body.style.removeProperty("--chip-tour-card-height");
        clearDetailSample();
        setAboutExpanded(false);
        if (autoOpenedDrawer) {
          autoOpenedDrawer = false;
          controls.classList.remove("open");
        }
        return;
      }

      const stepMatch = /(\d+)/.exec(kicker.textContent || "");
      const stepIndex = stepMatch ? Number(stepMatch[1]) - 1 : -1;
      const selector = stepIndex >= 0 && stepIndex < drawerStepTargets.length
        ? drawerStepTargets[stepIndex]
        : null;
      const target = selector ? doc.querySelector(selector) : null;
      const drawerTarget = target && target.closest("#ctrl, .ctrl") ? target : null;

      if (!mobile) {
        doc.body.style.removeProperty("--chip-tour-card-height");
        clearDetailSample();
        if (drawerTarget) {
          window.cancelAnimationFrame(layoutFrameId);
          layoutFrameId = window.requestAnimationFrame(function revealDesktopTarget() {
            try {
              drawerTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            } catch (error) {
              drawerTarget.scrollIntoView();
            }
            requestTourRerender();
          });
        }
        scheduleCardClamp();
        return;
      }

      setAboutExpanded(stepIndex === 0);

      if (drawerTarget) {
        if (!controls.classList.contains("open")) {
          controls.classList.add("open");
          autoOpenedDrawer = true;
        }
      } else if (autoOpenedDrawer) {
        autoOpenedDrawer = false;
        controls.classList.remove("open");
      }

      if (stepIndex === detailStepIndex) {
        doc.body.classList.add("chip-tour-detail-step");
        try {
          if (frame.contentWindow.__chipTourShowDetailSample()) {
            autoSelectedCounty = true;
          }
        } catch (error) {
          // Without a sample selection the tour falls back to its original
          // app-bar highlight for this step.
        }
      } else {
        clearDetailSample();
      }

      window.cancelAnimationFrame(layoutFrameId);
      layoutFrameId = window.requestAnimationFrame(function fitTourCard() {
        const cardHeight = Math.ceil(card.getBoundingClientRect().height);
        doc.body.style.setProperty("--chip-tour-card-height", cardHeight + "px");
        if (drawerTarget) {
          layoutFrameId = window.requestAnimationFrame(function revealTourTarget() {
            try {
              drawerTarget.scrollIntoView({ block: "center", inline: "nearest" });
            } catch (error) {
              drawerTarget.scrollIntoView();
            }
            requestTourRerender();
          });
        }
      });

      requestTourRerender();
    }

    const observer = new frame.contentWindow.MutationObserver(syncTourState);
    observer.observe(tourRoot, { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(kicker, { childList: true, characterData: true, subtree: true });

    // The tour also re-renders on its own scroll/resize listeners, which
    // bypass syncTourState. Watching the card's inline style keeps the clamp
    // applied after every reposition; the clamp settles because it only
    // writes when the card actually overflows.
    const cardObserver = new frame.contentWindow.MutationObserver(scheduleCardClamp);
    cardObserver.observe(card, { attributes: true, attributeFilter: ["style"] });
    syncTourState();

    cleanupCallbacks.push(function cleanupTourLayout() {
      observer.disconnect();
      cardObserver.disconnect();
      window.clearTimeout(rerenderTimer);
      window.cancelAnimationFrame(layoutFrameId);
      window.cancelAnimationFrame(clampFrameId);
      doc.body.style.removeProperty("--chip-tour-card-height");
      doc.body.classList.remove("chip-tour-detail-step");
    });
  }

  function cleanupFrameEnhancements() {
    cleanupCallbacks.forEach(function runCleanup(cleanup) {
      try {
        cleanup();
      } catch (error) {
        // Cleanup must not block re-enhancement after an iframe reload.
      }
    });
    cleanupCallbacks = [];
  }

  function enhanceFrame() {
    cleanupFrameEnhancements();

    try {
      childDocument = frame.contentDocument || frame.contentWindow.document;
    } catch (error) {
      childDocument = null;
      return;
    }

    if (!childDocument || !childDocument.head || !childDocument.body) {
      return;
    }

    injectViewportMetadata(childDocument);
    injectMobileStyles(childDocument);
    setDeviceMode();
    applyMobileMapFit(childDocument);
    applyMobileLabelTuning(childDocument);
    enhanceControls(childDocument);
    enhanceMapState(childDocument);
    enhanceDetails(childDocument);
    setupTourMobileLayout(childDocument);
    setupTutorialCompletion(childDocument);
    scheduleMapResize();
  }

  function handleViewportChange() {
    setDeviceMode();
    scheduleMapResize();
  }

  frame.addEventListener("load", enhanceFrame);
  try {
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
      window.requestAnimationFrame(enhanceFrame);
    }
  } catch (error) {
    // The normal load handler remains the fallback if early access is blocked.
  }

  window.addEventListener("resize", handleViewportChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportChange, { passive: true });
  document.addEventListener("visibilitychange", function handleVisibility() {
    if (!document.hidden) {
      scheduleMapResize();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportChange, { passive: true });
  }
  if (typeof narrowViewport.addEventListener === "function") {
    narrowViewport.addEventListener("change", handleViewportChange);
    coarsePointer.addEventListener("change", handleViewportChange);
  }

  setDeviceMode();
})();
