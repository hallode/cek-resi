// Tab "Banyak Resi" (spec 003, 005). Only fetches and renders; validation and
// per-item errors come from POST /api/track/bulk.

import { navigate, replaceParams } from "./router.js";
import { announce, copyButton, formatDateTime, h, icon, statusOf } from "./ui.js";

const COURIER_KEY = "cekresi.bulk.courier";
const MAX_AWBS = 10; // enforced by the API; shown here only as a hint
const REQUEST_TIMEOUT_MS = 15_000;
const AUTO = ""; // "Otomatis": no courier, the gateway detects it (spec 002)

// Works without detect-rust: two found, one not found.
const EXAMPLE = { courier: "sicepat", awbs: ["004000123456", "004000654321", "004000999999"] };

const $ = (id) => document.getElementById(id);
const state = {
  couriers: [],
  selected: AUTO,
  shown: null, // permalink key of the results on screen
  controller: null,
};

/** One AWB per line, or separated by commas/spaces. */
const splitAwbs = (text) => text.split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase());
const unique = (list) => [...new Set(list)];
const courierName = (code) => state.couriers.find((c) => c.code === code)?.name ?? code;
const chipCodes = () => [AUTO, ...state.couriers.map((c) => c.code)];

// ------------------------------------------------------------------ init

export function init() {
  state.selected = localStorage.getItem(COURIER_KEY) ?? AUTO;

  $("bulk-form").addEventListener("submit", onSubmit);
  $("bulk-awbs").addEventListener("input", () => {
    syncHint();
    clearFieldError();
  });
  $("bulk-awbs").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      $("bulk-form").requestSubmit();
    }
  });

  const couriers = $("bulk-couriers");
  couriers.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-code]");
    if (btn) selectCourier(btn.dataset.code);
  });
  couriers.addEventListener("keydown", onCourierKey);

  syncHint();
  renderEmpty();
  renderCouriersLoading();
  loadCouriers();
}

/** Called by the router each time the tab is entered: #/bulk?courier=jne&awb=A,B */
export function enter(params) {
  const awbs = unique(splitAwbs(params.awb ?? ""));
  if (awbs.length === 0) return;
  const courier = (params.courier ?? "").trim().toLowerCase();
  if (state.shown === permalinkKey(courier, awbs)) return; // keep what is shown (F4)
  search(courier, awbs);
}

async function loadCouriers() {
  try {
    const res = await fetch("/api/couriers");
    if (!res.ok) throw new Error(String(res.status));
    state.couriers = await res.json();
    if (!chipCodes().includes(state.selected)) state.selected = AUTO;
    renderCouriers();
  } catch {
    $("bulk-couriers").replaceChildren(
      h("p", { class: "field-error", role: "alert" }, "Gagal memuat daftar ekspedisi. ",
        h("button", { type: "button", class: "link-btn", onclick: () => {
          renderCouriersLoading();
          loadCouriers();
        } }, "Coba lagi")),
    );
  }
}

// -------------------------------------------------------------- courier chips

function renderCouriersLoading() {
  $("bulk-couriers").replaceChildren(
    ...Array.from({ length: 4 }, () => h("span", { class: "chip skeleton-line", style: "width:96px;margin:0", "aria-hidden": "true" })),
  );
}

function renderCouriers() {
  $("bulk-couriers").replaceChildren(
    ...chipCodes().map((code) => {
      const active = code === state.selected;
      return h("button", {
        type: "button",
        class: `chip${active ? " is-active" : ""}`,
        role: "radio",
        "aria-checked": String(active),
        tabindex: active ? "0" : "-1",
        "data-code": code,
        text: code === AUTO ? "Otomatis" : courierName(code),
      });
    }),
  );
}

function selectCourier(code, { focus = false } = {}) {
  state.selected = code;
  localStorage.setItem(COURIER_KEY, code);
  renderCouriers();
  if (focus) {
    const btn = $("bulk-couriers").querySelector(`[data-code="${CSS.escape(code)}"]`);
    btn?.focus();
    btn?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }
}

/** Radio-group keyboard support: arrows move and select, Home/End jump. */
function onCourierKey(ev) {
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const codes = chipCodes();
  const i = Math.max(0, codes.indexOf(state.selected));
  let next;
  if (ev.key in keys) next = (i + keys[ev.key] + codes.length) % codes.length;
  else if (ev.key === "Home") next = 0;
  else if (ev.key === "End") next = codes.length - 1;
  else return;
  ev.preventDefault();
  selectCourier(codes[next], { focus: true });
}

// ----------------------------------------------------------------- form

function syncHint() {
  const n = unique(splitAwbs($("bulk-awbs").value)).length;
  const hint = $("bulk-hint");
  hint.textContent = `${n} dari maks. ${MAX_AWBS} resi · Ctrl/⌘+Enter untuk cek`;
  hint.classList.toggle("is-over", n > MAX_AWBS);
}

function showFieldError(message) {
  const input = $("bulk-awbs");
  input.setAttribute("aria-invalid", "true");
  const err = $("bulk-error");
  err.textContent = message;
  err.hidden = false;
  input.focus();
}

function clearFieldError() {
  $("bulk-awbs").removeAttribute("aria-invalid");
  $("bulk-error").hidden = true;
}

function onSubmit(ev) {
  ev.preventDefault();
  const awbs = splitAwbs($("bulk-awbs").value);
  if (awbs.length === 0) return showFieldError("Masukkan minimal satu nomor resi.");
  search(state.selected, awbs);
}

function setLoading(on) {
  const btn = $("bulk-submit");
  btn.disabled = on;
  btn.replaceChildren(
    ...(on
      ? [h("span", { class: "spinner", "aria-hidden": "true" }), h("span", { text: "Mengecek…" })]
      : [h("span", { text: "Cek Semua" })]),
  );
  $("bulk-state").setAttribute("aria-busy", String(on));
}

// ---------------------------------------------------------------- search

const permalinkKey = (courier, awbs) => `${courier}|${awbs.join(",")}`;

async function search(courier, awbs) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;

  state.selected = courier;
  if (state.couriers.length > 0) renderCouriers();
  $("bulk-awbs").value = awbs.join("\n");
  syncHint();
  clearFieldError();
  setLoading(true);
  renderSkeleton(Math.min(awbs.length, MAX_AWBS));
  announce("Mengecek resi…");

  try {
    const res = await fetch("/api/track/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: awbs.map((awb) => (courier ? { awb, courier } : { awb })) }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    const body = await res.json().catch(() => ({}));
    if (controller !== state.controller) return; // superseded by a newer search

    if (res.ok && Array.isArray(body.results)) {
      const shown = body.results.map((r) => r.awb);
      state.shown = permalinkKey(courier, shown);
      replaceParams("bulk", { courier, awb: shown.join(",") });
      renderResults(body.results, courier);
      const found = body.results.filter((r) => r.ok).length;
      announce(`Selesai. ${found} dari ${body.results.length} resi ditemukan.`);
      $("bulk-result-title")?.focus();
    } else if (res.status >= 400 && res.status < 500) {
      renderEmpty();
      showFieldError(body.error || "Permintaan tidak valid.");
      announce(body.error || "Permintaan tidak valid.");
    } else {
      renderRetryableError(courier, awbs);
    }
  } catch {
    if (controller.signal.aborted) return; // superseded
    renderRetryableError(courier, awbs);
  } finally {
    if (controller === state.controller) setLoading(false);
  }
}

// ------------------------------------------------------------------ state

function show(...nodes) {
  $("bulk-state").replaceChildren(...nodes);
}

function renderEmpty() {
  show(
    h("section", { class: "card state-card" },
      h("div", { class: "state-icon" }, icon("package", 28)),
      h("h2", { text: "Cek banyak resi sekaligus" }),
      h("p", { class: "muted", text: `Tempel sampai ${MAX_AWBS} nomor resi di atas, lalu tekan Cek Semua.` }),
      h("p", { class: "muted examples-label", text: "Coba contoh:" }),
      h("div", { class: "chips" },
        h("button", {
          type: "button",
          class: "chip",
          onclick: () => search(EXAMPLE.courier, EXAMPLE.awbs),
          text: `SiCepat · ${EXAMPLE.awbs.length} resi`,
        })),
    ),
  );
}

function renderSkeleton(rows) {
  show(
    h("section", { class: "card", "aria-hidden": "true" },
      h("div", { class: "skeleton-line", style: "width:35%" }),
      Array.from({ length: rows }, () => h("div", { class: "skeleton-line" })),
    ),
  );
}

function renderRetryableError(courier, awbs) {
  show(
    h("section", { class: "card state-card is-error", role: "alert" },
      h("div", { class: "state-icon" }, icon("alert", 28)),
      h("h2", { text: "Layanan sedang sibuk" }),
      h("p", { class: "muted", text: "Kami belum bisa mengecek resimu. Coba lagi sebentar lagi." }),
      h("button", { type: "button", class: "btn", onclick: () => search(courier, awbs) }, icon("refresh", 18), "Coba lagi"),
    ),
  );
  announce("Layanan sedang sibuk. Coba lagi.");
}

// ----------------------------------------------------------------- result

function renderResults(results, courier) {
  const found = results.filter((r) => r.ok).length;
  const failed = results.length - found;
  const link = () => {
    const awb = results.map((r) => encodeURIComponent(r.awb)).join(",");
    const qs = courier ? `courier=${encodeURIComponent(courier)}&awb=${awb}` : `awb=${awb}`;
    return `${location.origin}${location.pathname}#/bulk?${qs}`;
  };

  show(
    h("article", { class: "card", "aria-labelledby": "bulk-result-title" },
      h("header", { class: "result-head" },
        h("div", {},
          h("h2", { id: "bulk-result-title", class: "bulk-title", tabindex: "-1", text: `Hasil cek ${results.length} resi` }),
          h("p", { class: "muted small", text: `${found} ditemukan${failed ? ` · ${failed} gagal` : ""}` }),
        ),
        copyButton({ label: "Salin link", text: link, iconName: "link" }),
      ),
      h("table", { class: "bulk-table" },
        h("thead", {},
          h("tr", {},
            h("th", { scope: "col", text: "Resi" }),
            h("th", { scope: "col", text: "Kurir" }),
            h("th", { scope: "col", text: "Status" }),
            h("th", { scope: "col", text: "Update terakhir" }),
            h("th", { scope: "col" }, h("span", { class: "visually-hidden", text: "Aksi" })),
          )),
        h("tbody", {}, results.map(renderRow)),
      ),
    ),
  );
}

function renderRow(r) {
  const st = r.ok ? statusOf(r.status) : null;
  return h("tr", {},
    h("td", { "data-label": "Resi" }, h("span", { class: "mono bulk-awb", text: r.awb })),
    h("td", { "data-label": "Kurir" },
      r.courier ? courierName(r.courier) : "—",
      r.detected ? h("div", { class: "muted small", text: "Terdeteksi otomatis" }) : null,
    ),
    h("td", { "data-label": "Status" },
      r.ok
        ? h("span", { class: `badge tone-${st.tone}` }, icon(st.icon, 16), st.label)
        : h("span", { class: "badge tone-bad" }, icon("alert", 16), r.error),
    ),
    h("td", { "data-label": "Update terakhir" },
      r.last_event
        ? [
            h("time", { datetime: r.last_event.time, text: formatDateTime(r.last_event.time) }),
            h("div", { class: "tl-loc", text: r.last_event.location }),
          ]
        : "—",
    ),
    h("td", { class: "bulk-action" },
      r.ok
        ? h("button", {
            type: "button",
            class: "btn",
            "aria-label": `Detail ${r.awb}`,
            onclick: () => navigate("resi", { courier: r.courier, awb: r.awb }),
          }, "Detail", icon("arrow-right", 16))
        : null,
    ),
  );
}
