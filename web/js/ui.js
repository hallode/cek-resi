// Shared UI helpers (spec 005). Date/time helpers are pure so they run without a DOM.

const TZ = "Asia/Jakarta"; // all tracking times are WIB (+07:00)
const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const longDateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const relFmt = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

/** "13:47" */
export const formatTime = (iso) => timeFmt.format(new Date(iso));

/** "11 Nov 2026, 13:47 WIB" */
export function formatDateTime(iso) {
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)} WIB`;
}

/** "2 jam yang lalu", "kemarin", ... */
export function relativeTime(iso, now = Date.now()) {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return relFmt.format(0, "second");
  if (abs < 3600) return relFmt.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(sec / 3600), "hour");
  return relFmt.format(Math.round(sec / 86400), "day");
}

/**
 * Groups events (already ordered) by calendar day in WIB.
 * Returns [{ key: "2026-11-11", label: "Hari ini" | "Kemarin" | "Rabu, 11 November 2026", items }].
 */
export function groupByDate(events, now = Date.now()) {
  const today = dayKeyFmt.format(now);
  const yesterday = dayKeyFmt.format(now - 86_400_000);
  const groups = [];
  for (const e of events) {
    const d = new Date(e.time);
    const key = dayKeyFmt.format(d);
    let g = groups.at(-1);
    if (!g || g.key !== key) {
      const label = key === today ? "Hari ini" : key === yesterday ? "Kemarin" : longDateFmt.format(d);
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  return groups;
}

// ---------------------------------------------------------------- DOM

/** Creates an element. props: class, text, on<event>, other keys become attributes. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

const ICONS = {
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  "search-x": '<path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="8"/><path d="m13.5 8.5-5 5"/><path d="m8.5 8.5 5 5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
};

/** Inline SVG icon (decorative; pair with visible text). */
export function icon(name, size = 20) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name] ?? ""; // static strings above, never user data
  return svg;
}

/** Announces a message to screen readers through the #live region. */
export function announce(message) {
  const live = document.getElementById("live");
  if (!live) return;
  live.textContent = "";
  requestAnimationFrame(() => {
    live.textContent = message;
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h("textarea", { readonly: true, style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Button that copies `text` and shows "Tersalin" for 2 seconds. */
export function copyButton({ label, text, iconName = "copy", className = "btn" }) {
  const labelEl = h("span", { text: label });
  const btn = h("button", { type: "button", class: className }, icon(iconName, 18), labelEl);
  btn.addEventListener("click", async () => {
    const ok = await copyText(typeof text === "function" ? text() : text);
    labelEl.textContent = ok ? "Tersalin" : "Gagal menyalin";
    btn.classList.toggle("is-copied", ok);
    announce(ok ? "Tersalin ke clipboard" : "Gagal menyalin");
    setTimeout(() => {
      labelEl.textContent = label;
      btn.classList.remove("is-copied");
    }, 2000);
  });
  return btn;
}
