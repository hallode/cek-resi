// Hash router: one page, one tab per feature (spec 000, F1-F4).
// Shows/hides sections, marks the active tab, and calls the tab's enter(params).

const TABS = { resi: "Cek Resi", bulk: "Banyak Resi", ongkir: "Cek Ongkir" };
const DEFAULT_TAB = "resi";

/** "#/resi?courier=jne&awb=X" → { tab: "resi", params: { courier: "jne", awb: "X" } }; tab is null when unknown. */
export function parseHash(hash = location.hash) {
  const m = /^#\/([^?]*)(?:\?(.*))?$/.exec(hash);
  const tab = m && Object.hasOwn(TABS, m[1]) ? m[1] : null;
  return { tab, params: Object.fromEntries(new URLSearchParams(m?.[2] ?? "")) };
}

export function buildHash(tab, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== ""),
  )
    .toString()
    .replaceAll("%2C", ","); // keep "awb=A,B" readable in shared links
  return `#/${tab}${qs ? `?${qs}` : ""}`;
}

/** Updates the URL for sharing without navigating (replaceState does not fire hashchange). */
export function replaceParams(tab, params) {
  history.replaceState(null, "", buildHash(tab, params));
}

/** Moves to another tab, e.g. navigate("resi", { courier, awb }) (F7). */
export function navigate(tab, params) {
  location.hash = buildHash(tab, params);
}

/** handlers: { [tab]: (params) => void }, called each time the tab is entered. */
export function startRouter(handlers) {
  const render = () => {
    let { tab, params } = parseHash();
    if (!tab) {
      tab = DEFAULT_TAB;
      params = {};
      history.replaceState(null, "", buildHash(tab));
    }
    for (const section of document.querySelectorAll("[data-view]")) {
      section.hidden = section.dataset.view !== tab;
    }
    for (const link of document.querySelectorAll("[data-tab]")) {
      if (link.dataset.tab === tab) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = `${TABS[tab]} · cekresi`;
    handlers[tab]?.(params);
  };
  addEventListener("hashchange", render);
  render();
}
