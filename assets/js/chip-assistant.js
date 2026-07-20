(function initChipAssistant() {
  "use strict";

  // Runs on the dashboard and tutorial shells (the tour's bonus steps
  // spotlight the launcher, so it must exist on the tutorial page too).
  const frame = document.getElementById("chip-frame");
  const page = document.body.dataset.page || "dashboard";
  if (!frame || (page !== "dashboard" && page !== "tutorial")) {
    return;
  }

  const API_URL = "https://api.anthropic.com/v1/messages";
  const ANTHROPIC_VERSION = "2023-06-01";
  const KEY_STORAGE = "chip:assistant-key:v1";
  const MODEL_STORAGE = "chip:assistant-model:v1";
  const MAX_TOOL_ROUNDS = 5;
  const MAX_HISTORY_ENTRIES = 16;
  const MODELS = [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 — best quality" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — lowest cost" },
  ];

  const COUNTIES = [
    "Ashland", "Ashtabula", "Carroll", "Cuyahoga", "Erie", "Geauga", "Holmes",
    "Huron", "Lake", "Lorain", "Medina", "Portage", "Richland", "Stark",
    "Summit", "Tuscarawas", "Wayne",
  ];

  const SYSTEM_PROMPT = [
    "You are the CHIP assistant embedded in the Cleveland-Akron (Canton) market",
    "visualizer demo. Answer from the provided tools only - never invent",
    "numbers. All client, prospect, revenue and budget figures are illustrative",
    "sample data; add a brief 'sample data' note when quoting them.",
    "Style: talk like a sharp teammate, not a report. Lead with a one-sentence",
    "takeaway in **bold** that interprets the data (ahead/behind plan, strong or",
    "weak ground, who to call first). Then at most three short bullet lines",
    "starting with '• ', each carrying only the numbers that answer the",
    "question, rounded ($4.1M, 38%). Skip stats the user didn't ask about.",
    "Stay under 70 words unless they ask for more detail. The only formatting",
    "available is **bold** and '• ' bullets - no headings, tables or other",
    "markdown. The tools also select the county on the map, so you can say",
    "it's on the map now. If a question is outside this market demo, say in",
    "one line what you can help with. Counties: " + COUNTIES.join(", ") + ".",
  ].join(" ");

  const TOOLS = [
    {
      name: "get_county_overview",
      description:
        "Snapshot for one Cleveland-Akron DMA county: population, median " +
        "household income, tailwind score and rank, client book (count, " +
        "Grow/Keep split, booked revenue, share of wallet, projected churn), " +
        "annual budget target and attainment, and prospect counts. Also " +
        "selects the county on the map in AE mode. Call this whenever the " +
        "user asks how a county is doing or for its numbers.",
      input_schema: {
        type: "object",
        properties: {
          county: { type: "string", description: "County name, e.g. 'Summit' or 'Erie'" },
        },
        required: ["county"],
        additionalProperties: false,
      },
    },
    {
      name: "get_top_prospects",
      description:
        "Highest-priority Get targets (non-client prospects ranked by Get " +
        "score = 50% county tailwind + 50% account fit) in one county, with " +
        "vertical, estimated ad budget, current budget holder and channels. " +
        "Also switches the dashboard to Prospecting mode and selects the " +
        "county. Call this when the user asks about prospects, leads, or Get " +
        "targets.",
      input_schema: {
        type: "object",
        properties: {
          county: { type: "string", description: "County name" },
          limit: { type: "integer", description: "How many targets, 1-10 (default 3)" },
        },
        required: ["county"],
        additionalProperties: false,
      },
    },
  ];

  /* ---------------- storage (guarded: private mode may throw) ---------------- */

  function readStore(key) {
    try {
      return window.sessionStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function writeStore(key, value) {
    try {
      if (value) {
        window.sessionStorage.setItem(key, value);
      } else {
        window.sessionStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  let memoryKey = "";
  function getApiKey() {
    return readStore(KEY_STORAGE) || memoryKey;
  }
  function setApiKey(value) {
    memoryKey = value;
    writeStore(KEY_STORAGE, value);
  }
  function getModel() {
    const stored = readStore(MODEL_STORAGE);
    return MODELS.some(function (m) { return m.id === stored; }) ? stored : MODELS[0].id;
  }

  /* ---------------- data facade inside the child document ---------------- */

  // GEO/CLIENTS/PROSPECTS/BUDGETS/TAILWIND_RANK and selectCounty/setMode are
  // top-level lexical bindings in the original inline scripts, so the facade
  // must run as a script inside the child document (same pattern as the
  // delivery layer's map-fit and label-tuning injections).
  function injectDataFacade(doc) {
    if (!doc || doc.getElementById("chip-assistant-data")) {
      return;
    }
    const script = doc.createElement("script");
    script.id = "chip-assistant-data";
    script.textContent = [
      "(function chipAssistantData() {",
      "  if (window.__chipAssistantData) { return; }",
      "  function featureByName(name) {",
      "    var q = String(name || \"\").trim().toLowerCase().replace(/\\s+county$/, \"\");",
      "    var fs = GEO.counties.features;",
      "    for (var i = 0; i < fs.length; i++) {",
      "      if (fs[i].properties.name.toLowerCase() === q) { return fs[i]; }",
      "    }",
      "    return null;",
      "  }",
      "  function focus(feature, mode) {",
      "    try { if (mode && typeof setMode === \"function\") { setMode(mode); } } catch (e) {}",
      "    function attempt() {",
      "      try {",
      "        if (typeof selectCounty === \"function\" && feature.id !== undefined) {",
      "          selectCounty(feature.id);",
      "          return true;",
      "        }",
      "      } catch (e) {}",
      "      return false;",
      "    }",
      "    /* selectCounty needs the map layers; retry once if the style is",
      "       still loading, and give up silently if the basemap never loads",
      "       (data answers still work without the map). */",
      "    if (!attempt()) { setTimeout(attempt, 900); }",
      "  }",
      "  window.__chipAssistantData = {",
      "    countyOverview: function (name) {",
      "      try {",
      "        var f = featureByName(name);",
      "        if (!f) { return { error: \"Unknown county: \" + name }; }",
      "        var p = f.properties, fips = p.fips;",
      "        var clients = CLIENTS[fips] || [];",
      "        var booked = 0, total = 0, churnW = 0, grow = 0;",
      "        clients.forEach(function (c) {",
      "          booked += c.spend; total += c.totalSpend;",
      "          churnW += c.projectedChurn * c.spend;",
      "          if (c.posture === \"GROW\") { grow += 1; }",
      "        });",
      "        var pros = PROSPECTS[fips] || [];",
      "        var open = pros.filter(function (b) { return b.isGet; });",
      "        var priority = open.filter(function (b) { return b.getPriority; });",
      "        var estAll = 0;",
      "        pros.forEach(function (b) { estAll += (b.est || 0); });",
      "        var budget = (typeof BUDGETS !== \"undefined\" && BUDGETS[fips]) || null;",
      "        focus(f, \"ae\");",
      "        return {",
      "          county: p.name + \" County\",",
      "          population: p.population,",
      "          land_sq_mi: p.land_sq_mi,",
      "          median_household_income: p.demo_median_income,",
      "          tailwind_score: p.demo_tailwind,",
      "          tailwind_rank_of_17: (typeof TAILWIND_RANK !== \"undefined\" ? TAILWIND_RANK[fips] : null),",
      "          clients: {",
      "            count: clients.length,",
      "            grow: grow,",
      "            keep: clients.length - grow,",
      "            booked_annual_revenue: Math.round(booked),",
      "            share_of_wallet_pct: total ? +(100 * booked / total).toFixed(1) : null,",
      "            projected_churn_pct: booked ? +(churnW / booked).toFixed(1) : null",
      "          },",
      "          annual_budget_target: budget,",
      "          budget_attainment_pct: budget ? +(100 * booked / budget).toFixed(1) : null,",
      "          tracked_businesses: pros.length,",
      "          open_get_prospects: open.length,",
      "          dma_priority_get_targets: priority.length,",
      "          estimated_local_ad_spend: Math.round(estAll),",
      "          note: \"Client, prospect, revenue and budget figures are illustrative sample data.\"",
      "        };",
      "      } catch (e) { return { error: \"Dashboard data unavailable: \" + e.message }; }",
      "    },",
      "    topProspects: function (name, limit) {",
      "      try {",
      "        var f = featureByName(name);",
      "        if (!f) { return { error: \"Unknown county: \" + name }; }",
      "        var fips = f.properties.fips;",
      "        var n = Math.max(1, Math.min(10, Number(limit) || 3));",
      "        var list = (PROSPECTS[fips] || [])",
      "          .filter(function (b) { return b.isGet; })",
      "          .sort(function (a, b) { return b.getScore - a.getScore; })",
      "          .slice(0, n)",
      "          .map(function (b) {",
      "            return {",
      "              name: b.name,",
      "              vertical: b.vertical,",
      "              get_score: b.getScore,",
      "              fit_score: b.fit,",
      "              dma_priority: !!b.getPriority,",
      "              estimated_ad_budget: b.est || null,",
      "              current_budget_holder: b.holder || null,",
      "              channels: b.chans || []",
      "            };",
      "          });",
      "        focus(f, \"prospect\");",
      "        return {",
      "          county: f.properties.name + \" County\",",
      "          top_get_targets: list,",
      "          note: \"Prospect figures are illustrative sample data.\"",
      "        };",
      "      } catch (e) { return { error: \"Dashboard data unavailable: \" + e.message }; }",
      "    }",
      "  };",
      "})();",
    ].join("\n");
    doc.body.appendChild(script);
  }

  function dataApi() {
    try {
      injectDataFacade(frame.contentDocument);
      return frame.contentWindow.__chipAssistantData || null;
    } catch (error) {
      return null;
    }
  }

  function runTool(name, input) {
    const api = dataApi();
    if (!api) {
      return { error: "The dashboard is still loading — try again in a moment." };
    }
    const args = input || {};
    try {
      if (name === "get_county_overview") {
        return api.countyOverview(args.county);
      }
      if (name === "get_top_prospects") {
        return api.topProspects(args.county, args.limit);
      }
    } catch (error) {
      return { error: "Tool failed: " + error.message };
    }
    return { error: "Unknown tool: " + name };
  }

  /* ---------------- Claude client (raw fetch; no key ever committed) ------- */

  const history = [];

  function trimmedHistory() {
    while (history.length > MAX_HISTORY_ENTRIES) {
      history.shift();
      history.shift();
    }
    return history.slice();
  }

  async function callClaude(messages) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getApiKey(),
        "anthropic-version": ANTHROPIC_VERSION,
        // Required opt-in for direct browser -> api.anthropic.com calls.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: messages,
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = (body && body.error && body.error.message) || "";
      } catch (error) {
        detail = "";
      }
      const err = new Error(detail || "HTTP " + response.status);
      err.status = response.status;
      throw err;
    }
    return response.json();
  }

  async function askClaude(question) {
    const working = trimmedHistory();
    working.push({ role: "user", content: question });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const message = await callClaude(working);

      if (message.stop_reason === "tool_use") {
        working.push({ role: "assistant", content: message.content });
        const results = message.content
          .filter(function (block) { return block.type === "tool_use"; })
          .map(function (block) {
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(runTool(block.name, block.input)),
            };
          });
        working.push({ role: "user", content: results });
        continue;
      }

      if (message.stop_reason === "refusal") {
        return "I can't help with that request — try asking about the market data instead.";
      }

      let text = message.content
        .filter(function (block) { return block.type === "text"; })
        .map(function (block) { return block.text; })
        .join("\n\n")
        .trim();
      if (message.stop_reason === "max_tokens") {
        text += "\n\n(Answer truncated — ask a narrower question for the rest.)";
      }
      return text || "I didn't get an answer back — try rephrasing the question.";
    }
    return "I hit the tool-call limit before finishing — try a narrower question.";
  }

  /* ---------------- keyless local fallback ---------------- */

  function money(value) {
    if (value === null || value === undefined) { return "n/a"; }
    if (Math.abs(value) >= 1e6) { return "$" + (value / 1e6).toFixed(1) + "M"; }
    if (Math.abs(value) >= 1e3) { return "$" + Math.round(value / 1e3) + "K"; }
    return "$" + Math.round(value);
  }

  function matchCounties(question) {
    const q = question.toLowerCase();
    return COUNTIES.filter(function (name) {
      return q.indexOf(name.toLowerCase()) !== -1;
    });
  }

  function overviewText(data) {
    const c = data.clients;
    const attainment = data.budget_attainment_pct;
    const verdict = attainment === null
      ? "ranks #" + data.tailwind_rank_of_17 + " of 17 on tailwind"
      : (attainment >= 100
        ? "is ahead of plan (" + Math.round(attainment) + "% of budget)"
        : "is behind plan (" + Math.round(attainment) + "% of budget)")
        + ", on #" + data.tailwind_rank_of_17 + "-of-17 ground";
    const lines = ["**" + data.county + " " + verdict + ".**", ""];
    if (c.count) {
      lines.push("• " + c.count + " clients, " + money(c.booked_annual_revenue) +
        " booked (" + c.grow + " Grow / " + c.keep + " Keep)");
      if (c.share_of_wallet_pct !== null) {
        lines.push("• " + Math.round(c.share_of_wallet_pct) + "% share of wallet, " +
          Math.round(c.projected_churn_pct) + "% projected churn");
      }
    } else {
      lines.push("• No active clients on the book yet");
    }
    lines.push("• " + data.open_get_prospects + " open Get targets — " +
      data.dma_priority_get_targets + " worth calling first");
    lines.push("");
    lines.push("It's on the map now. Sample data throughout.");
    return lines.join("\n");
  }

  function prospectsText(data) {
    const first = data.top_get_targets[0];
    if (!first) {
      return "**No open prospects left in " + data.county + "** — the whole tracked universe is already on the book. Sample data.";
    }
    const lines = ["**In " + data.county + ", start with " + first.name + ".**", ""];
    data.top_get_targets.forEach(function (p, index) {
      lines.push(
        (index + 1) + ". **" + p.name + "**" + (p.dma_priority ? " ★" : "") +
        " — " + p.vertical + ", ~" + money(p.estimated_ad_budget) +
        " budget, now with " + (p.current_budget_holder || "no measured media"),
      );
    });
    lines.push("");
    lines.push(
      (data.top_get_targets.some(function (p) { return p.dma_priority; }) ? "★ = top quartile DMA-wide. " : "") +
      "They're on the map in Prospecting mode. Sample data.",
    );
    return lines.join("\n");
  }

  function compareText(a, b) {
    return [
      "**" + a.county.replace(" County", "") + " vs " + b.county.replace(" County", "") + ":**",
      "",
      "• Tailwind: #" + a.tailwind_rank_of_17 + " vs #" + b.tailwind_rank_of_17 + " of 17",
      "• Booked: " + money(a.clients.booked_annual_revenue) + " (" + a.clients.count +
        " clients) vs " + money(b.clients.booked_annual_revenue) + " (" + b.clients.count + ")",
      "• Budget attainment: " + Math.round(a.budget_attainment_pct || 0) + "% vs " +
        Math.round(b.budget_attainment_pct || 0) + "%",
      "• Open Get targets: " + a.open_get_prospects + " vs " + b.open_get_prospects,
      "",
      b.county + " is on the map. Sample data.",
    ].join("\n");
  }

  function answerLocally(question) {
    const api = dataApi();
    if (!api) {
      return "The dashboard is still loading — try again in a moment.";
    }
    const names = matchCounties(question);
    const wantsProspects = /\bprospects?\b|\btargets?\b|\bleads?\b|\bget\b|\bwhitespace\b/i.test(question);

    if (!names.length) {
      return [
        "Try me on:",
        "• \"How is Summit County doing?\"",
        "• \"Top prospects in Erie\"",
        "• \"Compare Cuyahoga and Stark\"",
        "",
        "Add an API key (⚙) and Claude answers free-form questions too.",
      ].join("\n");
    }

    if (wantsProspects) {
      const data = api.topProspects(names[0], 3);
      return data.error ? data.error : prospectsText(data);
    }

    if (names.length >= 2) {
      const a = api.countyOverview(names[0]);
      const b = api.countyOverview(names[1]);
      if (!a.error && !b.error) {
        return compareText(a, b);
      }
    }

    const data = api.countyOverview(names[0]);
    return data.error ? data.error : overviewText(data);
  }

  /* ---------------- UI ---------------- */

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "chip-assistant-launcher";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path class="bubble" d="M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8.2L6 20.5v-4H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"></path>' +
    '<path class="sparkle" d="M12 6.9l1.1 2.5 2.5 1.1-2.5 1.1-1.1 2.5-1.1-2.5-2.5-1.1 2.5-1.1z"></path>' +
    "</svg>" +
    "<span>Ask CHIP</span>";

  const panel = document.createElement("section");
  panel.className = "chip-assistant-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "CHIP assistant chat");
  panel.innerHTML =
    '<div class="chip-assistant-head">' +
    "<b>CHIP assistant</b>" +
    '<span class="chip-assistant-mode"></span>' +
    '<button type="button" class="chip-assistant-iconbtn" data-act="settings" aria-label="Assistant settings">⚙</button>' +
    '<button type="button" class="chip-assistant-iconbtn" data-act="close" aria-label="Close assistant">✕</button>' +
    "</div>" +
    '<div class="chip-assistant-settings" hidden>' +
    "<label for=\"chip-assistant-key\">Anthropic API key (this session only)</label>" +
    '<input id="chip-assistant-key" type="password" autocomplete="off" placeholder="Paste a spend-capped workspace key">' +
    "<label for=\"chip-assistant-model\">Model</label>" +
    '<select id="chip-assistant-model"></select>' +
    '<div class="row">' +
    '<button type="button" class="primary" data-act="save-key">Save</button>' +
    '<button type="button" data-act="clear-key">Clear key</button>' +
    "</div>" +
    '<p class="hint">The key stays in this tab’s session storage and is sent only to api.anthropic.com, straight from your browser. Nothing is stored in the site. Use a low-spend-cap workspace key and rotate it after demos. Without a key, the assistant answers county and prospect questions from the local sample data.</p>' +
    "</div>" +
    '<div class="chip-assistant-log" aria-live="polite"></div>' +
    '<div class="chip-assistant-chips">' +
    "<button type=\"button\">How is Summit County doing?</button>" +
    "<button type=\"button\">Top prospects in Erie</button>" +
    "<button type=\"button\">Compare Cuyahoga and Stark</button>" +
    "</div>" +
    '<form class="chip-assistant-form">' +
    '<input type="text" name="q" placeholder="Ask about a county or prospects…" aria-label="Ask the CHIP assistant" autocomplete="off">' +
    '<button type="submit">Send</button>' +
    "</form>";

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const modeChip = panel.querySelector(".chip-assistant-mode");
  const settingsBox = panel.querySelector(".chip-assistant-settings");
  const keyInput = panel.querySelector("#chip-assistant-key");
  const modelSelect = panel.querySelector("#chip-assistant-model");
  const log = panel.querySelector(".chip-assistant-log");
  const chips = panel.querySelector(".chip-assistant-chips");
  const form = panel.querySelector(".chip-assistant-form");
  const input = form.querySelector("input");
  const sendButton = form.querySelector("button");

  MODELS.forEach(function (model) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    modelSelect.appendChild(option);
  });
  modelSelect.value = getModel();

  function syncMode() {
    if (getApiKey()) {
      modeChip.textContent = getModel() === "claude-haiku-4-5" ? "Claude · Haiku" : "Claude · Opus";
      modeChip.classList.add("is-live");
    } else {
      modeChip.textContent = "Demo mode";
      modeChip.classList.remove("is-live");
    }
  }

  // Bot bubbles support exactly one bit of formatting: **bold** spans.
  // Everything is built from text nodes, so replies can never inject markup.
  function renderRich(element, text) {
    String(text).split("**").forEach(function (chunk, index) {
      if (!chunk) {
        return;
      }
      if (index % 2) {
        const strong = document.createElement("strong");
        strong.textContent = chunk;
        element.appendChild(strong);
      } else {
        element.appendChild(document.createTextNode(chunk));
      }
    });
  }

  function addMessage(kind, text) {
    const bubble = document.createElement("div");
    bubble.className = "chip-assistant-msg " + kind;
    if (kind === "bot") {
      renderRich(bubble, text);
    } else {
      bubble.textContent = text;
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.hidden = true;
    if (!log.childElementCount) {
      addMessage("bot", "Hi! Ask about any of the 17 counties — I'll pull the numbers and show it on the map.");
    }
    syncMode();
    input.focus({ preventScroll: true });
  }

  function closePanel() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener("click", openPanel);
  panel.querySelector('[data-act="close"]').addEventListener("click", closePanel);
  document.addEventListener("keydown", function handleEscape(event) {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
    }
  });

  panel.querySelector('[data-act="settings"]').addEventListener("click", function toggleSettings() {
    settingsBox.hidden = !settingsBox.hidden;
    if (!settingsBox.hidden) {
      keyInput.focus({ preventScroll: true });
    }
  });

  panel.querySelector('[data-act="save-key"]').addEventListener("click", function saveKey() {
    setApiKey(keyInput.value.trim());
    writeStore(MODEL_STORAGE, modelSelect.value);
    keyInput.value = "";
    settingsBox.hidden = true;
    syncMode();
    addMessage("bot", getApiKey()
      ? "Key saved for this session — questions now go to Claude."
      : "No key set — staying in local demo mode.");
  });

  panel.querySelector('[data-act="clear-key"]').addEventListener("click", function clearKey() {
    setApiKey("");
    syncMode();
    addMessage("bot", "Key cleared — back to local demo mode.");
  });

  modelSelect.addEventListener("change", function persistModel() {
    writeStore(MODEL_STORAGE, modelSelect.value);
    syncMode();
  });

  chips.addEventListener("click", function handleChip(event) {
    const button = event.target.closest("button");
    if (button) {
      input.value = button.textContent;
      form.requestSubmit();
    }
  });

  function friendlyError(error) {
    if (error && error.status === 401) {
      return "That API key was rejected (401) — open settings and check it.";
    }
    if (error && error.status === 429) {
      return "Rate limited (429) — wait a moment and try again.";
    }
    if (error && error.status >= 500) {
      return "Claude is briefly overloaded (" + error.status + ") — try again shortly.";
    }
    if (error && error.status === 400) {
      return "The request was rejected (400): " + error.message;
    }
    return "Couldn't reach the Claude API from this browser — check the network and try again.";
  }

  let pending = false;
  form.addEventListener("submit", async function handleSubmit(event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || pending) {
      return;
    }
    input.value = "";
    chips.hidden = true;
    addMessage("user", question);

    if (!getApiKey()) {
      const reply = answerLocally(question);
      addMessage("bot", reply);
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: reply });
      return;
    }

    pending = true;
    sendButton.disabled = true;
    const busy = addMessage("busy", "Thinking…");
    try {
      const reply = await askClaude(question);
      busy.remove();
      addMessage("bot", reply);
      // Persist only the plain text turns; tool blocks stay within one ask.
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: reply });
    } catch (error) {
      busy.remove();
      addMessage("error", friendlyError(error));
    } finally {
      pending = false;
      sendButton.disabled = false;
      input.focus({ preventScroll: true });
    }
  });

  // Dock the chat beside the county detail panel on wide screens instead of
  // covering it (assistant.css scopes the class to >=1280px viewports).
  function watchDetailPanel() {
    try {
      const doc = frame.contentDocument;
      const detail = doc && doc.getElementById("detail");
      if (!detail || detail.dataset.chipAssistantWatched) {
        return;
      }
      detail.dataset.chipAssistantWatched = "true";
      const sync = function () {
        panel.classList.toggle("beside-detail", detail.classList.contains("open"));
      };
      const observer = new frame.contentWindow.MutationObserver(sync);
      observer.observe(detail, { attributes: true, attributeFilter: ["class"] });
      sync();
    } catch (error) {
      // Without the observer the chat simply overlays the detail panel.
    }
  }

  // Prepare the facade as soon as the frame is ready so the first question
  // doesn't pay injection latency; harmless if the frame reloads (re-guarded).
  function prime() {
    dataApi();
    watchDetailPanel();
  }
  frame.addEventListener("load", function primeFacade() {
    window.setTimeout(prime, 0);
  });
  window.setTimeout(prime, 0);
  syncMode();
})();
