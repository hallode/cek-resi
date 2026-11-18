// Pure formatting helpers for the "Cek Ongkir" tab (spec 004). No DOM access.
// Loaded as a plain <script> by index.html; also exported for node:test.

/** 22000 -> "Rp 22.000" */
function formatRupiah(amount) {
  return `Rp ${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** {min: 3, max: 4} -> "3–4 hari"; {min: 1, max: 1} -> "1 hari" */
function formatEtd({ min, max }) {
  return min === max ? `${min} hari` : `${min}–${max} hari`;
}

/** Index of the lowest price (first one on a tie), or -1 when empty. */
function cheapestIndex(options) {
  let best = -1;
  options.forEach((o, i) => {
    if (best === -1 || o.price < options[best].price) best = i;
  });
  return best;
}

if (typeof module !== "undefined") module.exports = { formatRupiah, formatEtd, cheapestIndex };
