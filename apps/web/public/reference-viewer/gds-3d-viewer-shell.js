(function () {
  const LOADING_RE = /^loading/i;

  function textOf(element) {
    return (element?.textContent || "").trim();
  }

  function normalize(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function getTitleElement() {
    return document.getElementById("instanceClassTitle");
  }

  function getInfoElement() {
    return document.getElementById("information");
  }

  function getLoadingElement() {
    return document.getElementById("loadingStatus");
  }

  function setControlsOpen(open) {
    document.body.classList.toggle("controls-open", Boolean(open));
  }

  function syncReadyState() {
    const loading = getLoadingElement();
    const visible = !loading?.hidden && textOf(loading) !== "";
    document.body.classList.toggle("model-ready", !visible);
    window.parent?.postMessage(
      {
        type: "gds-3d-viewer-ready",
        ready: !visible,
      },
      window.location.origin,
    );
  }

  function selectionSnapshot() {
    const title = normalize(textOf(getTitleElement()));
    const info = normalize(textOf(getInfoElement()));
    return {
      title: LOADING_RE.test(title) ? "" : title,
      info: LOADING_RE.test(info) ? "" : info,
    };
  }

  function notifySelection() {
    window.parent?.postMessage(
      {
        type: "gds-3d-viewer-selection",
        selection: selectionSnapshot(),
      },
      window.location.origin,
    );
  }

  function allControllerRows() {
    return Array.from(document.querySelectorAll(".lil-gui .controller"));
  }

  function controllerName(row) {
    return normalize(textOf(row.querySelector(".name")));
  }

  function findController(label) {
    const target = normalize(label).toLowerCase();
    return (
      allControllerRows().find((row) => controllerName(row).toLowerCase() === target) ||
      allControllerRows().find((row) => controllerName(row).toLowerCase().includes(target))
    );
  }

  function findFolder(label) {
    const target = normalize(label).toLowerCase();
    return Array.from(document.querySelectorAll(".lil-gui .title")).find(
      (node) => normalize(textOf(node)).toLowerCase() === target,
    );
  }

  function layerRows() {
    const folderTitle = findFolder("Layers");
    if (!folderTitle?.parentElement) {
      return [];
    }
    return Array.from(folderTitle.parentElement.querySelectorAll(".controller.boolean")).filter((row) => {
      const name = controllerName(row);
      return Boolean(name) && name !== "ALL";
    });
  }

  function clickButton(label) {
    const row = findController(label);
    const button = row?.querySelector("button");
    if (!button || button.disabled) {
      return false;
    }
    button.click();
    return true;
  }

  function setToggle(label, enabled) {
    const row = findController(label);
    const input = row?.querySelector('input[type="checkbox"]');
    if (!input) {
      return false;
    }
    if (Boolean(input.checked) !== Boolean(enabled)) {
      input.click();
    }
    return true;
  }

  function setOnlyToggle(label) {
    const rows = layerRows();
    if (!rows.length) {
      return false;
    }

    const target = normalize(label).toLowerCase();
    let matched = false;

    rows.forEach((row) => {
      const input = row.querySelector('input[type="checkbox"]');
      if (!input) {
        return;
      }
      const name = controllerName(row).toLowerCase();
      const shouldEnable = name === target || name.includes(target);
      if (shouldEnable) {
        matched = true;
      }
      if (Boolean(input.checked) !== shouldEnable) {
        input.click();
      }
    });

    return matched;
  }

  function showAllLayers() {
    const rows = layerRows();
    if (!rows.length) {
      return false;
    }

    rows.forEach((row) => {
      const input = row.querySelector('input[type="checkbox"]');
      if (input && !input.checked) {
        input.click();
      }
    });

    return true;
  }

  window.gds3dViewerShell = {
    setControlsOpen,
    toggleControls() {
      setControlsOpen(!document.body.classList.contains("controls-open"));
    },
    getSelection: selectionSnapshot,
    clickButton,
    setToggle,
    setOnlyToggle,
    showAllLayers,
  };

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || !event.data) {
      return;
    }
    const payload = event.data;
    if (payload.type === "gds-3d-viewer-set-controls-open") {
      setControlsOpen(payload.open);
    }
  });

  document.getElementById("viewerBackdrop")?.addEventListener("click", () => setControlsOpen(false));

  const selectionObserver = new MutationObserver(() => notifySelection());
  const readyObserver = new MutationObserver(() => syncReadyState());

  function attachObservers() {
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("auxclick", (event) => event.preventDefault());
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    }

    const title = getTitleElement();
    const info = getInfoElement();
    const loading = getLoadingElement();
    if (title) {
      selectionObserver.observe(title, { childList: true, subtree: true, characterData: true });
    }
    if (info) {
      selectionObserver.observe(info, { childList: true, subtree: true, characterData: true });
    }
    if (loading) {
      readyObserver.observe(loading, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    notifySelection();
    syncReadyState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachObservers, { once: true });
  } else {
    attachObservers();
  }
})();
