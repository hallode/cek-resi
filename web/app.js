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

const ZONE_LABEL = {
  DALAM_KOTA: "Dalam kota",
  SATU_PULAU: "Satu pulau",
  ANTAR_PULAU: "Antar pulau",
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

// ---------------------------------------------------------------- Cek Ongkir

function showTab(name) {
  for (const t of ["resi", "ongkir"]) {
    const active = t === name;
    $(`panel-${t}`).hidden = !active;
    $(`tab-${t}`).classList.toggle("active", active);
    $(`tab-${t}`).setAttribute("aria-selected", String(active));
  }
}

$("tab-resi").addEventListener("click", () => showTab("resi"));
$("tab-ongkir").addEventListener("click", () => showTab("ongkir"));

async function loadCities() {
  const res = await fetch("/api/ongkir/cities");
  const cities = await res.json();
  for (const id of ["o-origin", "o-destination"]) {
    $(id).replaceChildren(
      ...cities.map((c) => {
        const opt = document.createElement("option");
        opt.value = c.code;
        opt.textContent = c.name;
        return opt;
      }),
    );
  }
  if (cities.length > 1) $("o-destination").value = cities[1].code;
}

function showOngkirMessage(text, isError = false) {
  const m = $("o-message");
  m.textContent = text;
  m.classList.toggle("error", isError);
  m.hidden = false;
}

$("o-dims-toggle").addEventListener("click", () => {
  const open = $("o-dims").hidden;
  $("o-dims").hidden = !open;
  $("o-dims-toggle").setAttribute("aria-expanded", String(open));
  $("o-dims-toggle").textContent = `${open ? "−" : "+"} Dimensi paket (opsional)`;
});

async function checkOngkir() {
  // Send what the user typed as-is; the server owns validation (spec 004).
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

  showOngkirMessage("Memuat...");
  $("o-result").hidden = true;

  try {
    const res = await fetch(`/api/ongkir?${params}`);
    const body = await res.json();
    if (!res.ok) {
      showOngkirMessage(body.error || "Gagal memuat data", true);
      return;
    }
    $("o-message").hidden = true;
    renderOngkir(body);
  } catch {
    showOngkirMessage("Tidak dapat terhubung ke server", true);
  }
}

// Names come from /api/couriers (tracking); ongkir must still render if that call failed.
function courierName(code) {
  const known = Array.isArray(couriers) ? couriers.find((c) => c.code === code) : null;
  return known?.name || code.toUpperCase();
}

function renderOngkir(r) {
  $("o-summary").textContent =
    `${r.origin.name} → ${r.destination.name} · ${ZONE_LABEL[r.zone] || r.zone} · ` +
    `berat tertagih ${r.billable_weight_kg} kg`;

  const cheapest = cheapestIndex(r.options);
  $("o-rows").replaceChildren(
    ...r.options.map((o, i) => {
      const tr = document.createElement("tr");
      if (i === cheapest) tr.className = "cheapest";

      const courier = document.createElement("td");
      courier.textContent = courierName(o.courier);
      if (i === cheapest) {
        const tag = document.createElement("span");
        tag.className = "badge badge-cheapest";
        tag.textContent = "Termurah";
        courier.append(tag);
      }

      const service = document.createElement("td");
      service.textContent = o.service;
      const etd = document.createElement("td");
      etd.textContent = formatEtd(o.etd_days);
      const price = document.createElement("td");
      price.className = "num";
      price.textContent = formatRupiah(o.price);

      tr.append(courier, service, etd, price);
      return tr;
    }),
  );
  $("o-result").hidden = false;
}

$("ongkir-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  checkOngkir();
});

loadCities().catch(() => showOngkirMessage("Gagal memuat daftar kota", true));
