import type { ServerResponse } from "node:http";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { createApp } from "../src/app.ts";
import { repoRoot } from "../src/spectest.ts";
import { fakeUpstream, listen } from "./helpers.ts";

const DEAD = "http://127.0.0.1:1";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Fake detect-rust that always returns the given candidate codes. */
function fakeDetect(t: TestContext, codes: string[], seen: string[] = []): Promise<string> {
  return fakeUpstream(t, (req, res) => {
    seen.push(req.url ?? "");
    json(res, 200, { awb: "AWB1", candidates: codes.map((code) => ({ code })) });
  });
}

/** Fake tracking-go: `found` code → 200, others → given miss status. */
function fakeTracking(
  t: TestContext,
  found: string | null,
  seen: string[] = [],
  missStatus = 404,
): Promise<string> {
  return fakeUpstream(t, (req, res) => {
    seen.push(req.url ?? "");
    const courier = new URL(req.url ?? "", "http://x").searchParams.get("courier");
    if (courier === found) json(res, 200, { awb: "AWB1", courier: { code: courier } });
    else json(res, missStatus, { error: "miss" });
  });
}

function gateway(t: TestContext, tracking: string, detect: string, timeoutMs = 3000) {
  return listen(
    t,
    createApp({
      webDir: join(repoRoot(), "web"),
      upstreams: { tracking, detect, ongkir: DEAD },
      upstreamTimeoutMs: timeoutMs,
    }),
  );
}

test("tries candidates in order, returns first hit with detected: true", async (t) => {
  const trackSeen: string[] = [];
  const detectSeen: string[] = [];
  const base = await gateway(
    t,
    await fakeTracking(t, "b", trackSeen),
    await fakeDetect(t, ["a", "b", "c"], detectSeen),
  );

  const res = await fetch(`${base}/api/track?awb=%20awb1%20`);
  t.assert.equal(res.status, 200);
  t.assert.deepEqual(await res.json(), { awb: "AWB1", courier: { code: "b" }, detected: true });
  t.assert.deepEqual(detectSeen, ["/api/detect?awb=+awb1+"]);
  // Uses the AWB normalized by detect-rust; stops after the first hit.
  t.assert.deepEqual(trackSeen, ["/api/track?courier=a&awb=AWB1", "/api/track?courier=b&awb=AWB1"]);
});

test("blank courier param also triggers detection", async (t) => {
  const base = await gateway(t, await fakeTracking(t, "a"), await fakeDetect(t, ["a"]));
  const res = await fetch(`${base}/api/track?courier=%20&awb=AWB1`);
  t.assert.equal((await res.json()).detected, true);
});

test("unknown courier / not supported count as a miss", async (t) => {
  for (const status of [400, 501]) {
    const base = await gateway(
      t,
      await fakeTracking(t, "b", [], status),
      await fakeDetect(t, ["a", "b"]),
    );
    const res = await fetch(`${base}/api/track?awb=AWB1`);
    t.assert.equal(res.status, 200, `miss status ${status}`);
  }
});

test("no candidates → 400", async (t) => {
  const base = await gateway(t, DEAD, await fakeDetect(t, []));
  const res = await fetch(`${base}/api/track?awb=ABC`);
  t.assert.equal(res.status, 400);
  t.assert.deepEqual(await res.json(), {
    error: "kurir tidak terdeteksi, pilih kurir secara manual",
  });
});

test("all candidates miss → 404", async (t) => {
  const base = await gateway(t, await fakeTracking(t, null), await fakeDetect(t, ["a", "b"]));
  const res = await fetch(`${base}/api/track?awb=AWB1`);
  t.assert.equal(res.status, 404);
  t.assert.deepEqual(await res.json(), { error: "resi tidak ditemukan" });
});

test("detect down → 502", async (t) => {
  const base = await gateway(t, DEAD, DEAD);
  const res = await fetch(`${base}/api/track?awb=AWB1`);
  t.assert.equal(res.status, 502);
  t.assert.deepEqual(await res.json(), { error: "layanan deteksi tidak tersedia" });
});

test("detect timeout → 502", async (t) => {
  const detect = await fakeUpstream(t, () => {
    // never responds
  });
  const base = await gateway(t, DEAD, detect, 100);
  const res = await fetch(`${base}/api/track?awb=AWB1`);
  t.assert.equal(res.status, 502);
});

test("detect input error is passed through", async (t) => {
  const detect = await fakeUpstream(t, (_req, res) =>
    json(res, 400, { error: "parameter awb wajib diisi" }),
  );
  const base = await gateway(t, DEAD, detect);
  const res = await fetch(`${base}/api/track`);
  t.assert.equal(res.status, 400);
  t.assert.deepEqual(await res.json(), { error: "parameter awb wajib diisi" });
});

test("tracking down during candidate loop → 502", async (t) => {
  const base = await gateway(t, DEAD, await fakeDetect(t, ["a"]));
  const res = await fetch(`${base}/api/track?awb=AWB1`);
  t.assert.equal(res.status, 502);
  t.assert.deepEqual(await res.json(), { error: "layanan tracking tidak tersedia" });
});

test("explicit courier is a plain proxy (no detect call, no detected field)", async (t) => {
  const detectSeen: string[] = [];
  const base = await gateway(t, await fakeTracking(t, "pos"), await fakeDetect(t, [], detectSeen));
  const res = await fetch(`${base}/api/track?courier=pos&awb=AWB1`);
  t.assert.equal(res.status, 200);
  t.assert.equal("detected" in (await res.json()), false);
  t.assert.deepEqual(detectSeen, []);
});

test("/api/detect is proxied to detect-rust", async (t) => {
  const seen: string[] = [];
  const base = await gateway(t, DEAD, await fakeDetect(t, ["a"], seen));
  const res = await fetch(`${base}/api/detect?awb=x`);
  t.assert.equal(res.status, 200);
  t.assert.deepEqual(seen, ["/api/detect?awb=x"]);
});
