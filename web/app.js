// Frontend only renders what the API returns. Keep business logic in Go.

const HISTORY_KEY = "cekresi.history";
const HISTORY_MAX = 10;

const STATUS_LABEL = {
  PICKED_UP: "Pickup",
  IN_TRANSIT: "Dalam Perjalanan",
  OUT_FOR_DELIVERY: "Sedang Diantar",
  DELIVERED: "Terkirim",
  RETURNED: "Diretur",
};

const $ = (id) => document.getElementById(id);
let couriers = [];
let selected = null;

async function loadCouriers() {
  const res = await fetch("/api/couriers");
  couriers = await res.json();
  selected = couriers[0]?.code ?? null;
  renderCouriers();
}

function renderCouriers() {
  const box = $("couriers");
  box.replaceChildren(
    ...couriers.map((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = c.name;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(c.code === selected));
      btn.className = c.code === selected ? "active" : "";
      btn.onclick = () => {
        selected = c.code;
        renderCouriers();
        $("awb").focus();
      };
      return btn;
    }),
  );
}

async function track(courier, awb) {
  awb = awb.trim().toUpperCase();
  if (!courier || !awb) return;

  selected = courier;
  renderCouriers();
  $("awb").value = awb;
  showMessage("Memuat...");
  $("result").hidden = true;

  try {
    const res = await fetch(`/api/track?courier=${encodeURIComponent(courier)}&awb=${encodeURIComponent(awb)}`);
    const body = await res.json();
    if (!res.ok) {
      showMessage(body.error || "Gagal memuat data", true);
      return;
    }
    hideMessage();
    renderResult(body);
    saveHistory(courier, awb);
  } catch {
    showMessage("Tidak dapat terhubung ke server", true);
  }
}

function renderResult(r) {
  $("r-awb").textContent = r.awb;
  $("r-courier").textContent = r.courier.name;
  $("r-service").textContent = r.service;
  $("r-sender").textContent = `${r.sender} (${r.origin})`;
  $("r-receiver").textContent = `${r.receiver} (${r.destination})`;

  const badge = $("r-status");
  badge.textContent = STATUS_LABEL[r.status] || r.status;
  badge.className = `badge status-${r.status.toLowerCase()}`;

  $("r-history").replaceChildren(
    ...r.history.map((e) => {
      const tr = document.createElement("tr");
      const time = document.createElement("td");
      time.textContent = formatTime(e.time);
      const desc = document.createElement("td");
      desc.textContent = e.description;
      const loc = document.createElement("div");
      loc.className = "muted small";
      loc.textContent = e.location;
      desc.append(loc);
      tr.append(time, desc);
      return tr;
    }),
  );
  $("result").hidden = false;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function showMessage(text, isError = false) {
  const m = $("message");
  m.textContent = text;
  m.classList.toggle("error", isError);
  m.hidden = false;
}

function hideMessage() {
  $("message").hidden = true;
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(courier, awb) {
  const list = loadHistory().filter((h) => !(h.courier === courier && h.awb === awb));
  list.unshift({ courier, awb });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  $("history").hidden = list.length === 0;
  $("history-list").replaceChildren(
    ...list.map((h) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      const name = couriers.find((c) => c.code === h.courier)?.name || h.courier;
      btn.textContent = `${name} · ${h.awb}`;
      btn.onclick = () => track(h.courier, h.awb);
      return btn;
    }),
  );
}

$("track-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  track(selected, $("awb").value);
});

loadCouriers()
  .then(renderHistory)
  .catch(() => showMessage("Gagal memuat daftar kurir", true));
