import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { repoRoot } from "../src/spectest.ts";
import { fakeUpstream, listen } from "./helpers.ts";

const webDir = join(repoRoot(), "web");

async function startGateway(
  t: Parameters<typeof listen>[0],
  trackingUrl: string,
  upstreamTimeoutMs = 3000,
  ongkirUrl = "http://127.0.0.1:1",
): Promise<string> {
  return listen(
    t,
    createApp({
      webDir,
      upstreams: { tracking: trackingUrl, ongkir: ongkirUrl },
      upstreamTimeoutMs,
    }),
  );
}

test("serves index.html at /", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  const res = await fetch(`${base}/`);
  t.assert.equal(res.status, 200);
  t.assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  t.assert.match(await res.text(), /<title>Cek Resi<\/title>/);
});

test("serves static assets with content type", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  const res = await fetch(`${base}/app.js`);
  t.assert.equal(res.status, 200);
  t.assert.match(res.headers.get("content-type") ?? "", /^text\/javascript/);
});

test("blocks path traversal", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  for (const path of ["/..%2fmise.toml", "/%2e%2e/mise.toml", "/..%2f..%2fetc%2fpasswd"]) {
    const res = await fetch(base + path);
    t.assert.equal(res.status, 404, path);
  }
});

test("unknown file and unknown api path are 404", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  t.assert.equal((await fetch(`${base}/nope.js`)).status, 404);
  const res = await fetch(`${base}/api/nope`);
  t.assert.equal(res.status, 404);
  t.assert.deepEqual(await res.json(), { error: "endpoint tidak ditemukan" });
});

test("proxies tracking paths with query, status and body unchanged", async (t) => {
  const tracking = await fakeUpstream(t, (req, res) => {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "resi tidak ditemukan", seen: req.url }));
  });
  const base = await startGateway(t, tracking);

  const res = await fetch(`${base}/api/track?courier=sicepat&awb=X`);
  t.assert.equal(res.status, 404);
  t.assert.deepEqual(await res.json(), {
    error: "resi tidak ditemukan",
    seen: "/api/track?courier=sicepat&awb=X",
  });
});

test("upstream down → 502", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  const res = await fetch(`${base}/api/couriers`);
  t.assert.equal(res.status, 502);
  t.assert.deepEqual(await res.json(), { error: "layanan tracking tidak tersedia" });
});

test("upstream timeout → 502", async (t) => {
  const tracking = await fakeUpstream(t, () => {
    // never responds
  });
  const base = await startGateway(t, tracking, 100);
  const res = await fetch(`${base}/api/couriers`);
  t.assert.equal(res.status, 502);
});

test("proxies ongkir paths with query, status and body unchanged", async (t) => {
  const seen: string[] = [];
  const ongkir = await fakeUpstream(t, (req, res) => {
    seen.push(req.url ?? "");
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "kota asal tidak dikenal" }));
  });
  const base = await startGateway(t, "http://127.0.0.1:1", 3000, ongkir);

  const res = await fetch(`${base}/api/ongkir?origin=XXX&destination=BDG&weight=1000`);
  t.assert.equal(res.status, 400);
  t.assert.deepEqual(await res.json(), { error: "kota asal tidak dikenal" });

  await fetch(`${base}/api/ongkir/cities`);
  t.assert.deepEqual(seen, [
    "/api/ongkir?origin=XXX&destination=BDG&weight=1000",
    "/api/ongkir/cities",
  ]);
});

test("ongkir upstream down → 502", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  for (const path of ["/api/ongkir?origin=JKT&destination=BDG&weight=1000", "/api/ongkir/cities"]) {
    const res = await fetch(base + path);
    t.assert.equal(res.status, 502, path);
    t.assert.deepEqual(await res.json(), { error: "layanan ongkir tidak tersedia" });
  }
});
