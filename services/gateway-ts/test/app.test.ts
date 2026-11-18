import { readFileSync } from "node:fs";
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
): Promise<string> {
  return listen(t, createApp({ webDir, upstreams: { tracking: trackingUrl }, upstreamTimeoutMs }));
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

test("serves every local asset referenced by index.html, plus the modules they import", async (t) => {
  const base = await startGateway(t, "http://127.0.0.1:1");
  const html = readFileSync(join(webDir, "index.html"), "utf8");
  const types: Record<string, RegExp> = {
    css: /^text\/css/,
    js: /^text\/javascript/,
  };

  const queue = [...html.matchAll(/(?:href|src)="([^"#:]+\.(?:css|js))"/g)].map(
    (m) => m[1] as string,
  );
  t.assert.equal(
    queue.length >= 4,
    true,
    `expected css + js assets in index.html, found ${queue.length}`,
  );

  const seen = new Set<string>();
  while (queue.length > 0) {
    const path = queue.shift() as string;
    if (seen.has(path)) continue;
    seen.add(path);

    const res = await fetch(`${base}/${path}`);
    t.assert.equal(res.status, 200, path);
    t.assert.match(
      res.headers.get("content-type") ?? "",
      types[path.split(".").pop() as string] as RegExp,
      path,
    );

    // follow relative ES module imports ("./js/resi.js", "./router.js") so a broken import fails here
    if (path.endsWith(".js")) {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
      const src = await res.text();
      for (const m of src.matchAll(/from "\.\/([^"]+\.js)"/g)) queue.push(`${dir}${m[1]}`);
    }
  }
  for (const module of ["js/resi.js", "js/router.js", "js/ui.js"]) {
    t.assert.equal(seen.has(module), true, `${module} not reached; saw ${[...seen].join(", ")}`);
  }
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
