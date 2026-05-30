(function () {
  const vscode = acquireVsCodeApi();
  const state = window.__GRAPH_STATE__;
  const kindSelect = document.getElementById("kind");
  const refreshBtn = document.getElementById("refresh");
  const warningsEl = document.getElementById("warnings");
  const viewport = document.getElementById("viewport");
  const diagram = document.getElementById("diagram");

  if (kindSelect) {
    kindSelect.value = state.kind || "projectDeps";
    kindSelect.addEventListener("change", () => {
      vscode.postMessage({ type: "setKind", kind: kindSelect.value });
    });
  }
  refreshBtn?.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));

  if (warningsEl && state.warnings?.length) {
    warningsEl.hidden = false;
    warningsEl.textContent = state.warnings.map((w) => `${w.code}: ${w.message}`).join(" | ");
  }

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function applyTransform() {
    if (diagram) {
      diagram.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
  }

  viewport?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.min(3, Math.max(0.2, scale * delta));
    applyTransform();
  });

  viewport?.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    applyTransform();
  });

  async function renderMermaid(code) {
    if (!diagram || !window.mermaid) return;
    diagram.innerHTML = "";
    try {
      window.mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
      const { svg, bindFunctions } = await window.mermaid.render("beskidGraph", code);
      diagram.innerHTML = svg;
      bindFunctions?.(diagram);
      diagram.querySelectorAll(".node").forEach((nodeEl) => {
        nodeEl.addEventListener("click", () => {
          const label = nodeEl.textContent?.trim() ?? "";
          const match = (state.nodes ?? []).find((n) => n.label === label || label.includes(n.label));
          vscode.postMessage({
            type: "nodeClick",
            id: match?.id,
            label: match?.label ?? label,
          });
        });
      });
    } catch (err) {
      diagram.textContent = String(err);
    }
  }

  renderMermaid(state.mermaid || "flowchart LR\n  empty[No graph]");
  applyTransform();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg?.type === "update" && msg.state) {
      Object.assign(state, msg.state);
      if (kindSelect && msg.state.kind) kindSelect.value = msg.state.kind;
      if (warningsEl) {
        if (msg.state.warnings?.length) {
          warningsEl.hidden = false;
          warningsEl.textContent = msg.state.warnings.map((w) => `${w.code}: ${w.message}`).join(" | ");
        } else {
          warningsEl.hidden = true;
        }
      }
      renderMermaid(msg.state.mermaid);
    }
  });
})();
