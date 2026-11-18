// Tab "Cek Ongkir" (spec 004, 005). Only fetches and renders; pricing and validation live in ongkir-py.
// The pure helpers below touch no DOM, so they can be unit tested in Node.

import { announce, h, icon } from "./ui.js";

const REQUEST_TIMEOUT_MS = 10_000;

const ZONE_LABEL = {
  DALAM_KOTA: "Dalam kota",
  SATU_PULAU: "Satu pulau",
  ANTAR_PULAU: "Antar pulau",
};

// ------------------------------------------------------------------ pure helpers

/** 22000 → "Rp 22.000" */
export function formatRupiah(amount) {
  return `Rp ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** {min: 3, max: 4} → "3–4 hari"; {min: 1, max: 1} → "1 hari" */
export function formatEtd({ min, max }) {
  return min === max ? `${min} hari` : `${min}–${max} hari`;
}

/** Index of the lowest price (first one on a tie), or -1 when empty. */
export function cheapestIndex(options) {
  let best = -1;
  options.forEach((o, i) => {
    if (best === -1 || o.price < options[best].price) best = i;
  });
  return best;
}

// ------------------------------------------------------------------ state

const $ = (id) => document.getElementById(id);
const state = {
  loaded: false,
  courierNames: new Map(), // code → name, best effort (from tracking); falls back to the code
  controller: null, // AbortController of the in-flight request
};

const courierName = (code) => state.courierNames.get(code) ?? code.toUpperCase();

// ------------------------------------------------------------------ init

export function init() {
  $("ongkir-form").addEventListener("submit", onSubmit);
  $("o-dims-toggle").addEventListener("click", toggleDims);
  for (const id of ["o-weight", "o-length", "o-width", "o-height"]) {
    $(id).addEventListener("input", clearFieldError);
  }
}

/** Called by the router each time the tab is entered; loads the city list once. */
export function enter() {
  if (state.loaded) return;
  state.loaded = true;
  loadCities();
  loadCourierNames();
}

async function loadCities() {
  setSelectsLoading();
  try {
    const res = await fetch("/api/ongkir/cities");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cities = await res.json();
    for (const id of ["o-origin", "o-destination"]) {
      $(id).replaceChildren(...cities.map((c) => h("option", { value: c.code, text: c.name })));
      $(id).disabled = false;
    }
    if (cities.length > 1) $("o-destination").value = cities[1].code;
  } catch {
    state.loaded = false; // try again next time the tab is opened
    for (const id of ["o-origin", "o-destination"]) {
      $(id).replaceChildren(h("option", { value: "", text: "Gagal memuat kota" }));
    }
    renderError({
      title: "Daftar kota gagal dimuat",
      text: "Layanan sedang sibuk. Coba lagi.",
      action: { label: "Coba lagi", onClick: () => enter() },
    });
  }
}

function setSelectsLoading() {
  for (const id of ["o-origin", "o-destination"]) {
    $(id).replaceChildren(h("option", { value: "", text: "Memuat kota…" }));
    $(id).disabled = true;
  }
}

// Names are a nicety: the table must still render when tracking is down.
async function loadCourierNames() {
  try {
    const res = await fetch("/api/couriers");
    if (!res.ok) return;
    const list = await res.json();
    if (Array.isArray(list)) for (const c of list) state.courierNames.set(c.code, c.name);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ form

function toggleDims() {
  const open = $("o-dims").hidden;
  $("o-dims").hidden = !open;
  $("o-dims-toggle").setAttribute("aria-expanded", String(open));
  $("o-dims-toggle").textContent = open ? "Sembunyikan dimensi paket" : "Tambah dimensi paket (opsional)";
}

function showFieldError(message) {
  $("o-error").textContent = message;
  $("o-error").hidden = false;
  $("o-weight").setAttribute("aria-invalid", "true");
  announce(message);
}

function clearFieldError() {
  $("o-error").hidden = true;
  $("o-weight").removeAttribute("aria-invalid");
}

function onSubmit(ev) {
  ev.preventDefault();
  search();
}

function setLoading(on) {
  const btn = $("o-submit");
  btn.disabled = on;
  btn.replaceChildren(
    ...(on ? [h("span", { class: "spinner", "aria-hidden": "true" }), h("span", { text: "Mencari…" })] : [h("span", { text: "Cek Ongkir" })]),
  );
  $("o-state").setAttribute("aria-busy", String(on));
}

// ------------------------------------------------------------------ request

async function search() {
  clearFieldError();

  // Send what the user typed as-is; the server owns validation (spec 004 R6-R8).
  const params = new URLSearchParams({
    origin: $("o-origin").value,
    destination: $("o-destination").value,
    weight: $("o-weight").value,
  });
  if (!$("o-dims").hidden) {
    for (const [key, id] of [["length", "o-length"], ["width", "o-width"], ["height", "o-height"]]) {
      if ($(id).value !== "") params.set(key, $(id).value);
    }
  }

  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  setLoading(true);
  renderSkeleton();
  announce("Mencari tarif…");

  try {
    const res = await fetch(`/api/ongkir?${params}`, { signal: controller.signal });
    const body = await res.json();
    if (res.ok) {
      renderResult(body);
      const best = body.options[cheapestIndex(body.options)];
      announce(`${body.options.length} pilihan ditemukan. Termurah ${courierName(best.courier)} ${best.service}, ${formatRupiah(best.price)}.`);
    } else if (res.status >= 500) {
      renderRetryableError();
    } else {
      show(); // 4xx: the message belongs next to the form, not in a result card
      showFieldError(body.error || "Permintaan tidak valid.");
      $("o-weight").focus();
    }
  } catch {
    if (state.controller !== controller) return; // superseded by a newer search
    renderRetryableError();
  } finally {
    clearTimeout(timer);
    if (state.controller === controller) setLoading(false);
  }
}

// ------------------------------------------------------------------ render

function show(...nodes) {
  $("o-state").replaceChildren(...nodes);
}

function renderSkeleton() {
  show(
    h("section", { class: "card search-card", "aria-hidden": "true" },
      h("div", { class: "skeleton-line", style: "width:45%" }),
      h("div", { class: "skeleton-block" }),
      h("div", { class: "skeleton-line", style: "width:70%" }),
      h("div", { class: "skeleton-line", style: "width:60%" }),
    ),
  );
}

function renderError({ title, text, action }) {
  show(
    h("section", { class: "card state-card is-error", role: "alert" },
      h("div", { class: "state-icon" }, icon("alert", 28)),
      h("h2", { text: title }),
      h("p", { class: "muted", text: text }),
      action && h("button", { type: "button", class: "btn", onclick: action.onClick }, icon("refresh", 18), h("span", { text: action.label })),
    ),
  );
}

function renderRetryableError() {
  renderError({
    title: "Layanan sedang sibuk",
    text: "Tarif belum bisa dimuat. Coba lagi sebentar lagi.",
    action: { label: "Coba lagi", onClick: search },
  });
  announce("Layanan sedang sibuk. Coba lagi.");
}

function renderResult(r) {
  const cheapest = cheapestIndex(r.options);
  const title = h("h2", { id: "o-result-title", tabindex: "-1", text: `${r.origin.name} → ${r.destination.name}` });

  const rows = r.options.map((o, i) =>
    h("tr", { class: i === cheapest ? "is-cheapest" : null },
      h("td", {}, courierName(o.courier), i === cheapest && h("span", { class: "tag", text: "Termurah" })),
      h("td", { text: o.service }),
      h("td", { text: formatEtd(o.etd_days) }),
      h("td", { class: "num", text: formatRupiah(o.price) }),
    ),
  );

  show(
    h("section", { class: "card search-card", "aria-labelledby": "o-result-title" },
      title,
      h("p", { class: "muted", text: `${ZONE_LABEL[r.zone] ?? r.zone} · berat tertagih ${r.billable_weight_kg} kg` }),
      h("table", { class: "quotes" },
        h("caption", { class: "visually-hidden", text: "Tarif ongkir per ekspedisi, termurah di atas" }),
        h("thead", {}, h("tr", {}, ...["Kurir", "Layanan", "Estimasi"].map((t) => h("th", { scope: "col", text: t })), h("th", { scope: "col", class: "num", text: "Harga" }))),
        h("tbody", {}, ...rows),
      ),
    ),
  );
  title.focus();
}
