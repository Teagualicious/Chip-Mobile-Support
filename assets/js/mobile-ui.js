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

    const backdrop = createBackdrop(doc);
    let closeButton = controls.querySelector(".chip-mobile-close");
    if (!closeButton) {
      closeButton = doc.createElement("button");
      closeButton.className = "chip-mobile-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close controls");
      closeButton.innerHTML = '<span aria-hidden="true">×</span>';
      controls.insertBefore(closeButton, controls.firstChild);
    }

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
    closeButton.addEventListener("click", function handleCloseButton() {
      closeControls({ restoreFocus: true });
    });
    backdrop.addEventListener("click", function handleBackdrop() {
      closeControls({ restoreFocus: true });
    });
    doc.addEventListener("keydown", handleEscape);
    doc.addEventListener("keydown", handleFocusTrap);

    const observer = new MutationObserver(syncOpenState);
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

  function enhanceDetails(doc) {
    const detail = doc.querySelector(".detail");
    if (!detail) {
      return;
    }

    if (!detail.hasAttribute("role")) {
      detail.setAttribute("role", "dialog");
    }
    detail.setAttribute("aria-modal", "false");

    const controls = doc.getElementById("ctrl") || doc.querySelector(".ctrl");
    const observer = new MutationObserver(function handleDetailChange() {
      const computed = frame.contentWindow.getComputedStyle(detail);
      const visible = computed.display !== "none" && computed.visibility !== "hidden";
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

    const observer = new MutationObserver(checkForClosedTour);
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
    const controls = doc.getElementById("ctrl") || doc.querySelector(".ctrl");
    if (!tourRoot || !kicker || !controls) {
      return;
    }

    // Tour steps that highlight controls living inside the mobile drawer.
    // Mirrors the frozen step order in CHIPv.4.2-tutorial.html; unmatched
    // selectors are simply ignored if the source ever changes.
    const drawerStepTargets = [".hdr", "#modeSeg", ".field", "#dmaClientFilters"];
    let autoOpenedDrawer = false;
    let rerenderTimer = 0;

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

    function syncTourState() {
      const mobile = detectDeviceMode() === "mobile";
      const active = !tourRoot.hidden;
      doc.body.classList.toggle("chip-tour-active", mobile && active);

      if (!mobile) {
        return;
      }

      if (!active) {
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

      if (target && target.closest("#ctrl, .ctrl")) {
        if (!controls.classList.contains("open")) {
          controls.classList.add("open");
          autoOpenedDrawer = true;
        }
        try {
          target.scrollIntoView({ block: "center" });
        } catch (error) {
          target.scrollIntoView();
        }
      } else if (autoOpenedDrawer) {
        autoOpenedDrawer = false;
        controls.classList.remove("open");
      }

      requestTourRerender();
    }

    const observer = new MutationObserver(syncTourState);
    observer.observe(tourRoot, { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(kicker, { childList: true, characterData: true, subtree: true });
    syncTourState();

    cleanupCallbacks.push(function cleanupTourLayout() {
      observer.disconnect();
      window.clearTimeout(rerenderTimer);
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
    enhanceControls(childDocument);
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
