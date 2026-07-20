/*
 * CHIP dashboard refinements (delivery layer, app.html + tutorial.html).
 *
 * 2026-07-20 "final touch ups" round, all runtime enhancements over the
 * frozen originals:
 *   1. Drop the two population-index metrics from "Color counties by" and
 *      the detail-pane demographics table.
 *   2. Scale desktop county labels with zoom (mobile-ui.js already tunes
 *      mobile labels).
 *   3. Move the Methodology and Get/Keep/Grow reference dropdowns out of
 *      the control panel into a popup that opens where the detail pane
 *      sits, launched from the app bar's Methodology button (and a drawer
 *      link on phones, where that button is hidden).
 *   4. Clicking a county gently zooms and centers it, keeping it clear of
 *      whichever panel covers part of the map.
 *   5. Rank the AE client book by priority (churn risk, then spend) and
 *      recolor the KEEP pill red for urgency.
 *   6. Collapse the long detail-pane sections into dropdowns, and shift
 *      the floating Take-the-tour / Ask CHIP chips off any open pane.
 *   7. Put the mode-switch button at the top of both panes: the existing
 *      "Switch to the Prospecting Tool" moves up, and the prospecting
 *      pane gains a matching "Switch to the AE Interface".
 *
 * The original applications stay byte-identical: everything here works
 * through the same-origin iframe. Top-level `function` declarations in
 * the child (renderDetail, clientRowsHTML, setMode, selectCounty) are
 * window properties and can be wrapped from the parent; `const`/`let`
 * bindings (map, GEO, METRICS) are only reachable from a script injected
 * into the child document, so the pieces that need them run there.
 */
(function () {
  "use strict";

  const frame = document.getElementById("chip-frame");
  if (!frame) {
    return;
  }

  let childDocument = null;

  function isMobile() {
    return document.documentElement.dataset.device === "mobile";
  }

  /* ---------- 1, 2, 4: child-side lexical refinements ---------- */

  function injectLexicalRefinements(doc) {
    if (doc.getElementById("chip-app-refinements")) {
      return;
    }

    const script = doc.createElement("script");
    script.id = "chip-app-refinements";
    script.textContent = [
      "(function chipAppRefinements() {",
      "  /* Remove the Black / African American and Hispanic population",
      "     index metrics. buildUI() runs on map load, which is normally",
      "     after this script, so splicing METRICS is enough for both the",
      "     dropdown and the demographics rows; the option sweep covers a",
      "     map that loaded first. */",
      "  try {",
      '    var dropped = ["pct_black", "hispanic_index"];',
      '    if (typeof METRICS !== "undefined" && Array.isArray(METRICS)) {',
      "      for (var i = METRICS.length - 1; i >= 0; i--) {",
      "        if (dropped.indexOf(METRICS[i][0]) >= 0) { METRICS.splice(i, 1); }",
      "      }",
      "    }",
      '    var sel = document.getElementById("metric");',
      "    if (sel && sel.options.length) {",
      "      dropped.forEach(function (value) {",
      "        var option = sel.querySelector('option[value=\"' + value + '\"]');",
      "        if (!option) { return; }",
      "        if (sel.value === value) {",
      "          sel.value = METRICS[0][0];",
      '          sel.dispatchEvent(new Event("change"));',
      "        }",
      "        option.remove();",
      "      });",
      "    }",
      "  } catch (error) {}",
      "",
      "  /* Desktop county labels scale with zoom. The frozen positionLabels",
      "     pins 12px and hides labels below zoom 7.2; keep that baseline at",
      "     7.2 and grow toward 19px as the user zooms in. Mobile keeps its",
      "     own tuner from mobile-ui.js, so this one stands down there. */",
      "  try {",
      '    if (typeof map !== "undefined" && map && typeof positionLabels === "function") {',
      "      var BASE_ZOOM = 7.2;",
      "      function scaleDesktopLabels() {",
      '        if (document.documentElement.dataset.device === "mobile") { return; }',
      "        var z = map.getZoom();",
      "        var size = Math.max(10.5, Math.min(19, 12 + (z - BASE_ZOOM) * 2.4));",
      '        var labels = document.querySelectorAll("#labels .clab");',
      "        for (var i = 0; i < labels.length; i++) {",
      '          labels[i].style.fontSize = size.toFixed(1) + "px";',
      "        }",
      "      }",
      "      var chipPrevPositionLabels = positionLabels;",
      "      positionLabels = function () { chipPrevPositionLabels(); scaleDesktopLabels(); };",
      '      map.on("move", scaleDesktopLabels);',
      '      map.on("zoom", scaleDesktopLabels);',
      "      scaleDesktopLabels();",
      "    }",
      "  } catch (error) {}",
      "",
      "  /* Selecting a county gently zooms and centers it. The offset keeps",
      "     the county visible beside the desktop detail pane / above the",
      "     mobile sheet. MapLibre treats the animation as non-essential, so",
      "     prefers-reduced-motion collapses it to an instant move. */",
      "  try {",
      '    if (typeof map !== "undefined" && typeof GEO !== "undefined" && typeof selectCounty === "function") {',
      "      var chipPrevSelectCounty = selectCounty;",
      "      selectCounty = function (id) {",
      "        chipPrevSelectCounty(id);",
      "        try {",
      "          var feature = GEO.counties.features.find(function (f) { return f.id === id; });",
      "          if (!feature || !feature.properties || !feature.properties.label_pt) { return; }",
      "          var z = map.getZoom();",
      "          var offset = [0, 0];",
      '          if (document.documentElement.dataset.device === "mobile") {',
      "            offset = [0, -Math.round(window.innerHeight * 0.18)];",
      "          } else {",
      '            var detail = document.getElementById("detail");',
      '            if (detail && detail.classList.contains("open")) {',
      "              var rect = detail.getBoundingClientRect();",
      "              offset = [-Math.round((window.innerWidth - rect.left) / 2), 0];",
      "            }",
      "          }",
      "          map.easeTo({",
      "            center: feature.properties.label_pt,",
      "            zoom: z < 8.4 ? Math.min(z + 0.55, 8.4) : z,",
      "            offset: offset,",
      "            duration: 650",
      "          });",
      "        } catch (error) {}",
      "      };",
      "    }",
      "  } catch (error) {}",
      "})();",
    ].join("\n");
    doc.body.appendChild(script);
  }

  /* ---------- 5: client book ranked by priority ---------- */

  function installClientRanking(win) {
    const original = win.clientRowsHTML;
    if (typeof original !== "function" || original.chipRanked) {
      return;
    }

    // Priority = revenue in danger first: churn tier (the original's own
    // High >= 22% / Med >= 12% cut points), KEEP-before-GROW inside a
    // tier because KEEP means "defend now", then book size.
    const churnTier = (client) =>
      client.projectedChurn >= 22 ? 3 : client.projectedChurn >= 12 ? 2 : 1;
    const bookSize = (client) => client.totalSpend || client.spend || 0;

    const ranked = function (cs) {
      if (!Array.isArray(cs)) {
        return original(cs);
      }
      const sorted = cs.slice().sort(function (a, b) {
        return (
          churnTier(b) - churnTier(a) ||
          (b.posture === "KEEP") - (a.posture === "KEEP") ||
          bookSize(b) - bookSize(a)
        );
      });
      return original(sorted);
    };
    ranked.chipRanked = true;
    win.clientRowsHTML = ranked;
  }

  /* ---------- 6, 7: detail-pane post-processing ---------- */

  // Open/closed choices survive re-renders (filter changes, mode flips)
  // for the rest of the visit.
  const accordionState = new Map();
  const DEFAULT_OPEN = new Set(["market read", "priority get targets"]);

  function sectionKey(title) {
    return title.textContent.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function moveSwitchButtonsToTop(doc, scroll) {
    const header = scroll.querySelector(".dh");
    if (!header) {
      return;
    }

    const bar = doc.createElement("div");
    bar.className = "chip-mode-switchbar";

    const toProspect = scroll.querySelector("#toProspect");
    if (toProspect) {
      // AE pane: the frozen button keeps its bindDetail() listener when
      // moved, so it still switches modes.
      bar.appendChild(toProspect);
    } else {
      // Prospecting pane (the frozen app has no way back at all).
      const name = (header.querySelector(".dh__name") || {}).textContent || "";
      const county = name.replace(/\s*County\s*$/, "").trim();
      const back = doc.createElement("button");
      back.type = "button";
      back.id = "chipToAE";
      back.className = "btn btn--go";
      back.textContent =
        "Switch to the AE Interface" + (county ? " for " + county : "") + " →";
      back.addEventListener("click", function () {
        try {
          frame.contentWindow.setMode("ae");
        } catch (error) {}
      });
      bar.appendChild(back);
    }
    header.insertAdjacentElement("afterend", bar);
  }

  function addClientRankingNote(doc, scroll) {
    const tbody = scroll.querySelector("#clientTableBody");
    if (!tbody) {
      return;
    }
    const table = tbody.closest("table");
    if (!table || !tbody.querySelector("td:nth-child(2)")) {
      return;
    }
    const note = doc.createElement("div");
    note.className = "note chip-rank-note";
    note.textContent =
      "Ranked by priority — highest churn risk first, then spend.";
    table.insertAdjacentElement("beforebegin", note);
  }

  function collapseSections(doc, scroll) {
    scroll.querySelectorAll(".block").forEach(function (block) {
      const title = block.querySelector(":scope > .block__t");
      if (!title || block.querySelector(":scope > details.chip-acc")) {
        return;
      }

      const details = doc.createElement("details");
      details.className = "chip-acc";
      const summary = doc.createElement("summary");
      summary.className = "chip-acc__head";
      const body = doc.createElement("div");
      body.className = "chip-acc__body";

      while (block.firstChild) {
        const child = block.firstChild;
        if (child === title) {
          summary.appendChild(child);
        } else {
          body.appendChild(child);
        }
      }
      const chevron = doc.createElement("span");
      chevron.className = "chip-acc__chev";
      summary.appendChild(chevron);
      details.appendChild(summary);
      details.appendChild(body);
      block.appendChild(details);

      const key = sectionKey(title);
      details.open = accordionState.has(key)
        ? accordionState.get(key)
        : DEFAULT_OPEN.has(key);
      details.addEventListener("toggle", function () {
        accordionState.set(key, details.open);
      });
    });
  }

  function refineDetailPane(doc) {
    const scroll = doc.getElementById("detailScroll");
    if (!scroll || scroll.dataset.chipRefined === "true") {
      return;
    }
    scroll.dataset.chipRefined = "true";
    moveSwitchButtonsToTop(doc, scroll);
    addClientRankingNote(doc, scroll);
    collapseSections(doc, scroll);
  }

  function installDetailPipeline(win, doc) {
    const original = win.renderDetail;
    if (typeof original !== "function" || original.chipWrapped) {
      return;
    }
    const wrapped = function (feature) {
      original(feature);
      try {
        const scroll = doc.getElementById("detailScroll");
        if (scroll) {
          // renderDetail rebuilds innerHTML, so every render starts clean.
          delete scroll.dataset.chipRefined;
        }
        // A fresh county selection replaces whatever the popup showed.
        const pop = doc.getElementById("chipMethodPop");
        if (pop) {
          pop.classList.remove("open");
        }
        refineDetailPane(doc);
        updatePaneState(win, doc);
      } catch (error) {}
    };
    wrapped.chipWrapped = true;
    win.renderDetail = wrapped;
  }

  /* ---------- 3: methodology popup ---------- */

  function buildMethodologyPopup(doc, win) {
    if (doc.getElementById("chipMethodPop")) {
      return;
    }

    const methodology = doc.getElementById("methodologyDetails");
    if (!methodology) {
      return;
    }
    const reference = Array.from(
      doc.querySelectorAll(".ctrl__scroll > details.grp"),
    );

    const pop = doc.createElement("aside");
    pop.id = "chipMethodPop";
    // Borrowing the frozen .panel/.detail classes gives the popup the
    // detail pane's exact geometry and theming on both form factors.
    pop.className = "panel detail chip-method-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Methodology and framework");
    pop.innerHTML =
      '<div class="dh">' +
      '<button class="dh__x" id="chipMethodClose" type="button" aria-label="Close methodology">×</button>' +
      '<div class="dh__cat">Reference</div>' +
      '<div class="dh__name">Methodology &amp; framework</div>' +
      '<div class="dh__code">How the scores, postures and sample data fit together</div>' +
      "</div>" +
      '<div class="detail__scroll chip-method-pop__scroll" id="chipMethodScroll"></div>';
    doc.body.appendChild(pop);

    const scroll = doc.getElementById("chipMethodScroll");
    reference.forEach(function (group) {
      scroll.appendChild(group);
    });

    function openPop() {
      methodology.open = true;
      pop.classList.add("open");
      updatePaneState(win, doc);
      const close = doc.getElementById("chipMethodClose");
      if (close) {
        close.focus({ preventScroll: true });
      }
    }
    function closePop() {
      pop.classList.remove("open");
      updatePaneState(win, doc);
    }

    doc.getElementById("chipMethodClose").addEventListener("click", closePop);
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && pop.classList.contains("open")) {
        closePop();
      }
    });

    // The app bar's Methodology button used to open the dropdown inside
    // the control panel; the dropdown lives in the popup now.
    doc.querySelectorAll(".appnav__item").forEach(function (button) {
      if (button.textContent.trim() === "Methodology") {
        button.removeAttribute("onclick");
        button.setAttribute("aria-haspopup", "dialog");
        button.addEventListener("click", openPop);
      }
    });

    // Phones hide the app nav, so the drawer gets a link (styled and
    // ordered by mobile.css alongside the other drawer furniture).
    const ctrlScroll = doc.querySelector(".ctrl__scroll");
    if (ctrlScroll && !doc.querySelector(".chip-drawer-method-link")) {
      const link = doc.createElement("button");
      link.type = "button";
      link.className = "chip-drawer-method-link";
      link.setAttribute("aria-haspopup", "dialog");
      link.textContent = "Methodology & framework";
      link.addEventListener("click", function () {
        const ctrl = doc.getElementById("ctrl");
        if (ctrl) {
          ctrl.classList.remove("open");
        }
        openPop();
      });
      ctrlScroll.appendChild(link);
    }
  }

  /* ---------- 6: floating chips clear whichever pane is open ---------- */

  function updatePaneState(win, doc) {
    const detail = doc.getElementById("detail");
    const pop = doc.getElementById("chipMethodPop");
    const openPane =
      (pop && pop.classList.contains("open") && pop) ||
      (detail && detail.classList.contains("open") && detail) ||
      null;

    // While the tour runs, the chips are highlight targets; moving or
    // hiding them mid-step would strand the focus ring.
    const extra = doc.getElementById("chipTourExtra");
    const tourActive =
      doc.body.classList.contains("chip-tour-active") ||
      document.documentElement.classList.contains("chip-tour-open") ||
      (extra && !extra.hidden);

    // Only touch classList when the state actually flips: the watcher
    // observes the parent root's class attribute, so an unconditional
    // remove()/add() would re-trigger it forever.
    const roots = [document.documentElement, doc.documentElement];
    if (!openPane || tourActive) {
      roots.forEach(function (root) {
        if (root.classList.contains("chip-pane-open")) {
          root.classList.remove("chip-pane-open");
          root.style.removeProperty("--chip-pane-clear");
        }
      });
      return;
    }

    const rect = openPane.getBoundingClientRect();
    const clear = Math.max(0, Math.round(win.innerWidth - rect.left)) + 16;
    roots.forEach(function (root) {
      if (!root.classList.contains("chip-pane-open")) {
        root.classList.add("chip-pane-open");
      }
      root.style.setProperty("--chip-pane-clear", clear + "px");
    });
  }

  function watchPanes(win, doc) {
    if (win.__chipPaneWatchInstalled) {
      return;
    }
    win.__chipPaneWatchInstalled = true;

    const update = function () {
      try {
        updatePaneState(win, doc);
      } catch (error) {}
    };
    const observer = new win.MutationObserver(update);
    const detail = doc.getElementById("detail");
    if (detail) {
      observer.observe(detail, { attributes: true, attributeFilter: ["class"] });
    }
    const pop = doc.getElementById("chipMethodPop");
    if (pop) {
      observer.observe(pop, { attributes: true, attributeFilter: ["class"] });
    }
    // Tour start/end must also re-sync the chips: while it runs they are
    // highlight targets and stay put, afterwards any still-open pane
    // needs them shifted again even if the pane itself never mutated.
    observer.observe(doc.body, { attributes: true, attributeFilter: ["class"] });
    const extra = doc.getElementById("chipTourExtra");
    if (extra) {
      observer.observe(extra, { attributes: true, attributeFilter: ["hidden"] });
    }
    const parentObserver = new MutationObserver(update);
    parentObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    win.addEventListener("resize", update);
    update();
  }

  /* ---------- wiring ---------- */

  function enhanceFrame() {
    try {
      childDocument = frame.contentDocument || frame.contentWindow.document;
    } catch (error) {
      childDocument = null;
      return;
    }
    if (!childDocument || !childDocument.head || !childDocument.body) {
      return;
    }

    const win = frame.contentWindow;
    injectLexicalRefinements(childDocument);
    installClientRanking(win);
    installDetailPipeline(win, childDocument);
    buildMethodologyPopup(childDocument, win);
    watchPanes(win, childDocument);
  }

  frame.addEventListener("load", enhanceFrame);
  try {
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
      window.requestAnimationFrame(enhanceFrame);
    }
  } catch (error) {
    // The load handler remains the fallback if early access is blocked.
  }
})();
