// Tab "Cek Resi" (spec 001, 002, 005). Only fetches and renders; business logic lives in the backend.

import { replaceParams } from "./router.js";
import {
  announce, copyButton, formatDateTime, formatTime, groupByDate, h, icon, relativeTime,
} from "./ui.js";

const COURIER_KEY = "cekresi.courier";
const HISTORY_KEY = "cekresi.history";
const HISTORY_MAX = 10;
const REQUEST_TIMEOUT_MS = 10_000;

// "Otomatis": no courier is sent; the gateway detects it from the AWB (spec 002).
const AUTO = "auto";
const AUTO_OPTION = { code: AUTO, name: "Otomatis" };

// Demo shortcuts shown in the empty state (dummy data, see README).
const EXAMPLES = [
  { courier: "sicepat", awb: "004000123456" },
  { courier: "jne", awb: "CGK1A00012345" },
  { courier: "jnt", awb: "JP1234567890" },
];

const STATUS = {
  PICKED_UP: { label: "Dijemput", icon: "package", tone: "info" },
  IN_TRANSIT: { label: "Dalam Perjalanan", icon: "truck", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Sedang Diantar", icon: "bike", tone: "warn" },
  DELIVERED: { label: "Terkirim", icon: "check-circle", tone: "ok" },
  RETURNED: { label: "Diretur", icon: "undo", tone: "bad" },
};
const STEPS = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

const $ = (id) => document.getElementById(id);
const state = {
  couriers: [],
  selected: AUTO,
  detected: null, // courier code found by the last automatic search
  current: null, // { courier, awb } currently displayed
  controller: null, // AbortController of the in-flight request
};

const normalizeAwb = (s) => s.trim().toUpperCase();
const courierOptions = () => [AUTO_OPTION, ...state.couriers];
const courierName = (code) => courierOptions().find((c) => c.code === code)?.name ?? code;
const statusOf = (s) => STATUS[s] ?? { label: s, icon: "package", tone: "info" };

// ------------------------------------------------------------------ init

export function init() {
  state.selected = localStorage.getItem(COURIER_KEY) ?? AUTO;

  $("track-form").addEventListener("submit", onSubmit);
  $("awb").addEventListener("input", () => {
    syncClear();
    clearFieldError();
  });
  $("awb-clear").addEventListener("click", () => {
    $("awb").value = "";
    syncClear();
    $("awb").focus();
  });
  $("history-clear").addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
  });

  const couriers = $("couriers");
  couriers.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-code]");
    if (btn) selectCourier(btn.dataset.code);
  });
  couriers.addEventListener("keydown", onCourierKey);

  renderEmpty();
  renderHistory();
  renderCouriersLoading();
  loadCouriers();

  // Autofocus only where a physical keyboard is likely (avoid the mobile keyboard covering the screen).
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) $("awb").focus();
}

/** Called by the router each time the tab is entered. */
export function enter(params) {
  const awb = params.awb ? normalizeAwb(params.awb) : "";
  const courier = (params.courier ?? "").trim().toLowerCase() || state.selected;
  if (!awb || !courier) return;
  if (state.current?.awb === awb && state.current.courier === courier) return; // keep what is shown (F4)
  search(courier, awb);
}

async function loadCouriers() {
  try {
    const res = await fetch("/api/couriers");
    if (!res.ok) throw new Error(String(res.status));
    state.couriers = await res.json();
    if (!courierOptions().some((c) => c.code === state.selected)) state.selected = AUTO;
    renderCouriers();
    renderHistory();
    if (!state.current) renderEmpty();
  } catch {
    $("couriers").replaceChildren(
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
  $("couriers").replaceChildren(
    ...Array.from({ length: 4 }, () => h("span", { class: "chip skeleton-line", style: "width:96px;margin:0", "aria-hidden": "true" })),
  );
}

function renderCouriers() {
  $("couriers").replaceChildren(
    ...courierOptions().map((c) => {
      const active = c.code === state.selected;
      const detected = !active && c.code === state.detected;
      return h("button", {
        type: "button",
        class: `chip${active ? " is-active" : ""}${detected ? " is-detected" : ""}`,
        role: "radio",
        "aria-checked": String(active),
        tabindex: active ? "0" : "-1",
        "data-code": c.code,
        text: c.name,
      });
    }),
  );
}

function selectCourier(code, { focus = false } = {}) {
  state.selected = code;
  state.detected = null;
  localStorage.setItem(COURIER_KEY, code);
  renderCouriers();
  if (focus) {
    const btn = $("couriers").querySelector(`[data-code="${CSS.escape(code)}"]`);
    btn?.focus();
    btn?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }
}

/** Radio-group keyboard support: arrows move and select, Home/End jump. */
function onCourierKey(ev) {
  const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const codes = courierOptions().map((c) => c.code);
  if (codes.length === 0) return;
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

function syncClear() {
  $("awb-clear").hidden = $("awb").value === "";
}

function showFieldError(message) {
  const input = $("awb");
  input.setAttribute("aria-invalid", "true");
  const err = $("awb-error");
  err.textContent = message;
  err.hidden = false;
  input.focus();
}

function clearFieldError() {
  $("awb").removeAttribute("aria-invalid");
  $("awb-error").hidden = true;
}

function onSubmit(ev) {
  ev.preventDefault();
  const awb = normalizeAwb($("awb").value);
  if (!awb) return showFieldError("Masukkan nomor resi terlebih dahulu.");
  if (!state.selected) return showFieldError("Pilih ekspedisi terlebih dahulu.");
  search(state.selected, awb);
}

function setLoading(on) {
  const btn = $("submit");
  btn.disabled = on;
  btn.replaceChildren(
    ...(on
      ? [h("span", { class: "spinner", "aria-hidden": "true" }), h("span", { text: "Mencari…" })]
      : [h("span", { text: "Cek Resi" })]),
  );
  $("state").setAttribute("aria-busy", String(on));
}

// ---------------------------------------------------------------- search

async function search(courier, awb) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;

  state.selected = courier;
  state.detected = null;
  localStorage.setItem(COURIER_KEY, courier);
  renderCouriers();
  $("awb").value = awb;
  syncClear();
  clearFieldError();
  setLoading(true);
  renderSkeleton();
  announce("Mencari paket…");

  try {
    const params = new URLSearchParams({ awb });
    if (courier !== AUTO) params.set("courier", courier);
    const res = await fetch(`/api/track?${params}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    const body = await res.json().catch(() => ({}));
    if (controller !== state.controller) return; // superseded by a newer search

    if (res.ok) {
      // Store the resolved courier, so history and permalink skip detection next time.
      const found = body.courier.code;
      if (body.detected) {
        state.detected = found;
        renderCouriers();
      }
      state.current = { courier: found, awb: body.awb };
      renderResult(body);
      addHistory(found, body.awb);
      replaceParams("resi", { courier: found, awb: body.awb });
      announce(`Paket ditemukan. Status: ${statusOf(body.status).label}.`);
      $("result-title")?.focus();
    } else if (res.status === 400) {
      renderEmpty();
      showFieldError(body.error || "Permintaan tidak valid.");
      announce(body.error || "Permintaan tidak valid.");
    } else if (res.status === 404) {
      renderError({
        icon: "search-x",
        title: "Resi tidak ditemukan",
        text: "Periksa kembali nomor resi, atau coba pilih ekspedisi lain.",
      });
      announce("Resi tidak ditemukan.");
    } else {
      renderRetryableError(courier, awb);
    }
  } catch {
    if (controller.signal.aborted) return; // superseded
    renderRetryableError(courier, awb);
  } finally {
    if (controller === state.controller) setLoading(false);
  }
}

// ------------------------------------------------------------------ state

function show(...nodes) {
  $("state").replaceChildren(...nodes);
}

function renderEmpty() {
  show(
    h("section", { class: "card state-card" },
      h("div", { class: "state-icon" }, icon("package", 28)),
      h("h2", { text: "Cek posisi paketmu" }),
      h("p", { class: "muted", text: "Tempel nomor resi di atas, lalu tekan Enter." }),
      h("p", { class: "muted examples-label", text: "Coba contoh:" }),
      h("div", { class: "chips" },
        EXAMPLES.map((ex) =>
          h("button", { type: "button", class: "chip mono", onclick: () => search(ex.courier, ex.awb), text: `${courierName(ex.courier)} · ${ex.awb}` }))),
    ),
  );
}

function renderSkeleton() {
  show(
    h("section", { class: "card", "aria-hidden": "true" },
      h("div", { class: "skeleton-line", style: "width:40%" }),
      h("div", { class: "skeleton-block" }),
      h("div", { class: "skeleton-line", style: "width:70%" }),
      h("div", { class: "skeleton-line", style: "width:55%" }),
      h("div", { class: "skeleton-line", style: "width:62%" }),
    ),
  );
}

function renderError({ icon: iconName, title, text, action }) {
  show(
    h("section", { class: "card state-card is-error", role: "alert" },
      h("div", { class: "state-icon" }, icon(iconName, 28)),
      h("h2", { text: title }),
      h("p", { class: "muted", text }),
      action,
    ),
  );
}

function renderRetryableError(courier, awb) {
  renderError({
    icon: "alert",
    title: "Layanan sedang sibuk",
    text: "Kami belum bisa mengambil data paketmu. Coba lagi sebentar lagi.",
    action: h("button", { type: "button", class: "btn", onclick: () => search(courier, awb) }, icon("refresh", 18), "Coba lagi"),
  });
  announce("Layanan sedang sibuk. Coba lagi.");
}

// ----------------------------------------------------------------- result

function renderResult(r) {
  const st = statusOf(r.status);
  const latest = r.history[0];
  const link = () => `${location.origin}${location.pathname}#/resi?courier=${encodeURIComponent(r.courier.code)}&awb=${encodeURIComponent(r.awb)}`;

  const summary = h("div", { class: "result-summary" },
    h("div", { class: `status-hero tone-${st.tone}` },
      h("div", { class: "status-icon" }, icon(st.icon, 28)),
      h("div", {},
        h("div", { class: "status-label", text: st.label }),
        latest
          ? [
              h("p", { text: latest.description }),
              h("p", { class: "small", text: `${formatDateTime(latest.time)} · ${relativeTime(latest.time)}` }),
            ]
          : h("p", { text: "Belum ada riwayat perjalanan." }),
      ),
    ),
    h("p", { class: "route" }, r.origin, icon("arrow-right", 16), r.destination),
    r.status === "RETURNED"
      ? h("div", { class: "banner tone-bad", role: "note" }, icon("undo", 20), "Paket diretur ke pengirim")
      : renderStepper(r.status),
    h("dl", { class: "meta" },
      h("dt", { text: "Layanan" }), h("dd", { text: r.service }),
      h("dt", { text: "Pengirim" }), h("dd", { text: r.sender }),
      h("dt", { text: "Penerima" }), h("dd", { text: r.receiver }),
    ),
    h("div", { class: "result-actions" },
      copyButton({ label: "Salin link", text: link, iconName: "link" }),
      h("button", { type: "button", class: "btn", onclick: () => search(r.courier.code, r.awb) }, icon("refresh", 18), "Perbarui"),
    ),
  );

  const timeline = h("div", { class: "result-timeline" },
    h("h3", { text: "Perjalanan Paket" }),
    r.history.length === 0
      ? h("p", { class: "muted", text: "Belum ada pergerakan." })
      : groupByDate(r.history).map((g, gi) =>
          h("section", {},
            h("h4", { class: "tl-date", text: g.label }),
            h("ol", { class: "timeline" },
              g.items.map((e, i) =>
                h("li", { class: `tl-item${gi === 0 && i === 0 ? " is-latest" : ""}` },
                  h("time", { datetime: e.time, text: formatTime(e.time) }),
                  h("div", {},
                    h("div", { class: "tl-desc", text: e.description }),
                    h("div", { class: "tl-loc", text: e.location }),
                  ),
                )),
            ),
          )),
  );

  show(
    h("article", { class: "card result", "aria-labelledby": "result-title" },
      h("header", { class: "result-head" },
        h("div", { class: "courier" },
          h("div", { class: "avatar", "aria-hidden": "true", text: r.courier.name.charAt(0).toUpperCase() }),
          h("div", {},
            h("h2", { id: "result-title", class: "result-title", tabindex: "-1", text: r.awb }),
            h("p", { class: "muted small", text: r.courier.name }),
            r.detected
              ? h("p", { class: "muted small", text: `Kurir terdeteksi otomatis: ${r.courier.name}` })
              : null,
          ),
        ),
        copyButton({ label: "Salin resi", text: r.awb }),
      ),
      h("div", { class: "result-body" }, summary, timeline),
    ),
  );
}

function renderStepper(status) {
  const current = STEPS.indexOf(status);
  return h("ol", { class: "stepper", "aria-label": "Progres pengiriman" },
    STEPS.map((s, i) =>
      h("li", {
        class: `step${i <= current ? " is-done" : ""}${i === current ? " is-current" : ""}`,
        "aria-current": i === current ? "step" : null,
        text: STATUS[s].label,
      })),
  );
}

// ---------------------------------------------------------------- history

function loadHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
}

function addHistory(courier, awb) {
  saveHistory([{ courier, awb }, ...loadHistory().filter((x) => !(x.courier === courier && x.awb === awb))]);
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  $("history").hidden = list.length === 0;
  $("history-list").replaceChildren(
    ...list.map((x) =>
      h("span", { class: "chip-group" },
        h("button", { type: "button", class: "chip mono", onclick: () => search(x.courier, x.awb), text: `${courierName(x.courier)} · ${x.awb}` }),
        h("button", {
          type: "button",
          class: "chip chip-x",
          "aria-label": `Hapus ${x.awb} dari riwayat`,
          onclick: () => {
            saveHistory(loadHistory().filter((y) => !(y.courier === x.courier && y.awb === x.awb)));
            renderHistory();
          },
        }, icon("x", 16)),
      )),
  );
}
