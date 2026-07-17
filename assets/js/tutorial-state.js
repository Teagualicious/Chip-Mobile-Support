(function initChipTutorialState(global) {
  "use strict";

  const STORAGE_KEY = "chip:tutorial-completed:v1";
  let memoryCompleted = false;

  function readStorage() {
    try {
      return global.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(value) {
    try {
      global.localStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasCompleted() {
    return memoryCompleted || readStorage() === "true";
  }

  function markCompleted(source) {
    memoryCompleted = true;
    const persisted = writeStorage("true");

    global.dispatchEvent(
      new CustomEvent("chip:tutorial-completed", {
        detail: {
          source: source || "unknown",
          persisted: persisted,
        },
      }),
    );

    return persisted;
  }

  global.ChipTutorialState = Object.freeze({
    storageKey: STORAGE_KEY,
    hasCompleted: hasCompleted,
    markCompleted: markCompleted,
  });
})(window);
