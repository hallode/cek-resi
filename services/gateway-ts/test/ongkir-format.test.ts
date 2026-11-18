import { createRequire } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { repoRoot } from "../src/spectest.ts";

// web/ongkir-format.js is a plain browser script that also exports for Node.
const require = createRequire(import.meta.url);
const { formatRupiah, formatEtd, cheapestIndex } = require(
  join(repoRoot(), "web", "ongkir-format.js"),
) as {
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
