import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../src/spectest.ts";

// web/js/ongkir.js is a browser ES module whose pure helpers do not touch the DOM at import time.
const { formatRupiah, formatEtd, cheapestIndex } = (await import(
  pathToFileURL(join(repoRoot(), "web", "js", "ongkir.js")).href
)) as {
  formatRupiah: (n: number) => string;
  formatEtd: (etd: { min: number; max: number }) => string;
  cheapestIndex: (options: { price: number }[]) => number;
};

test("formatRupiah uses Indonesian thousands separators", (t) => {
  t.assert.equal(formatRupiah(0), "Rp 0");
  t.assert.equal(formatRupiah(999), "Rp 999");
  t.assert.equal(formatRupiah(7000), "Rp 7.000");
  t.assert.equal(formatRupiah(22000), "Rp 22.000");
  t.assert.equal(formatRupiah(1000000), "Rp 1.000.000");
});

test("formatEtd shows a range, or a single value when min equals max", (t) => {
  t.assert.equal(formatEtd({ min: 3, max: 4 }), "3–4 hari");
  t.assert.equal(formatEtd({ min: 1, max: 1 }), "1 hari");
});

test("cheapestIndex picks the lowest price, first one on a tie", (t) => {
  t.assert.equal(cheapestIndex([]), -1);
  t.assert.equal(cheapestIndex([{ price: 5 }]), 0);
  t.assert.equal(cheapestIndex([{ price: 9 }, { price: 3 }, { price: 3 }]), 1);
});
