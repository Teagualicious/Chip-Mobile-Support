(function initLandingPage() {
  "use strict";

  const state = window.ChipTutorialState;
  if (!state) {
    return;
  }

  const root = document.documentElement;
  const tutorialCard = document.querySelector('[data-experience="tutorial"]');
  const dashboardCard = document.querySelector('[data-experience="dashboard"]');
  const tutorialRecommendation = document.getElementById("tutorial-recommendation");
  const dashboardRecommendation = document.getElementById("dashboard-recommendation");
  const tutorialAction = document.querySelector("#tutorial-action span");
  const visitorState = document.getElementById("visitor-state");

  function render() {
    const completed = state.hasCompleted();
    root.dataset.visitorState = completed ? "returning" : "first-time";

    tutorialCard.classList.toggle("is-recommended", !completed);
    dashboardCard.classList.toggle("is-recommended", completed);

    tutorialRecommendation.textContent = completed
      ? "Available whenever you need it"
      : "Recommended for first-time visitors";
    dashboardRecommendation.textContent = completed
      ? "Recommended for returning visitors"
      : "Open without the walkthrough";
    tutorialAction.textContent = completed ? "Replay Guided Tour" : "Start Guided Tour";
    visitorState.textContent = completed
      ? "Welcome back. The full dashboard is now recommended."
      : "The guided tour is recommended for your first visit.";
  }

  render();
  window.addEventListener("pageshow", render);
  window.addEventListener("storage", function handleStorage(event) {
    if (event.key === state.storageKey) {
      render();
    }
  });
})();
