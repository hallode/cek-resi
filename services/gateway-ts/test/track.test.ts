import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { createApp } from "../src/app.ts";
import { repoRoot } from "../src/spectest.ts";
import { MAX_BODY_BYTES } from "../src/track.ts";
import { EVENT, type FakeUpstream, startFakeUpstream, track } from "./fakeupstream.ts";

let fake: FakeUpstream;
let baseURL = "";
let gateway: ReturnType<typeof createApp>;

before(async () => {
  fake = await startFakeUpstream();
  gateway = createApp({
    webDir: join(repoRoot(), "web"),
    upstreams: { tracking: fake.url, detect: fake.url },
    upstreamTimeoutMs: 100,
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});
after(async () => {
  gateway.closeAllConnections();
  gateway.close();
  await fake.close();
});
beforeEach(() => {
  fake.calls = [];
  fake.delayMs = 0;
  fake.peak = 0;
});

async function bulk(items: unknown[]) {
  const res = await fetch(`${baseURL}/api/track/bulk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return { status: res.status, body: await res.json() };
}

describe("POST /api/track/bulk", () => {
  test("keeps order, dedups, maps errors and fills courier per R6", async () => {
    fake.handler = (path, q) => {
      if (path === "/api/detect") {
        return {
          status: 200,
          body: { candidates: q.get("awb") === "JP1" ? [{ code: "jnt" }] : [] },
        };
      }
      if (q.get("courier") === "foo")
        return { status: 400, body: { error: "kurir tidak dikenal" } };
      if (q.get("awb") === "EMPTY") return track("jne", "EMPTY", "PICKED_UP", []);
      if (q.get("awb") === "MISS") return { status: 404, body: { error: "resi tidak ditemukan" } };
      return track(q.get("courier") ?? "", q.get("awb") ?? "");
    };
    const { status, body } = await bulk([
      { awb: " jp1 " },
      { awb: "ZZZ" },
      { awb: "JP1" },
      { awb: "miss", courier: " JNE " },
      { awb: "X", courier: "foo" },
      { awb: "EMPTY", courier: "jne" },
    ]);
    assert.equal(status, 200);
    assert.deepEqual(body.results, [
      {
        awb: "JP1",
        courier: "jnt",
        detected: true,
        ok: true,
        status: "DELIVERED",
        last_event: EVENT,
      },
      {
        awb: "ZZZ",
        courier: null,
        detected: false,
        ok: false,
        error: "kurir tidak terdeteksi, pilih kurir secara manual",
      },
      { awb: "MISS", courier: "jne", detected: false, ok: false, error: "resi tidak ditemukan" },
      { awb: "X", courier: "foo", detected: false, ok: false, error: "kurir tidak dikenal" },
      { awb: "EMPTY", courier: "jne", detected: false, ok: true, status: "PICKED_UP" },
    ]);
  });

  test("timeout becomes 'layanan sedang tidak tersedia'", async () => {
    fake.handler = () => "hang";
    const { body } = await bulk([{ awb: "A1", courier: "jne" }, { awb: "A2" }]);
    assert.deepEqual(
      body.results.map((r: { error: string }) => r.error),
      ["layanan sedang tidak tersedia", "layanan sedang tidak tersedia"],
    );
  });

  test("at most 5 upstream calls in flight (R4)", async () => {
    fake.delayMs = 30;
    fake.handler = (path, q) =>
      path === "/api/detect"
        ? { status: 200, body: { candidates: [{ code: "jne" }] } }
        : track("jne", q.get("awb") ?? "");
    const items = Array.from({ length: 10 }, (_, i) => ({
      awb: `A${i}`,
      ...(i % 2 ? { courier: "jne" } : {}),
    }));
    const { body } = await bulk(items);
    assert.equal(body.results.length, 10);
    assert.ok(body.results.every((r: { ok: boolean }) => r.ok));
    assert.equal(fake.calls.length, 15); // 5 detect + 10 track
    assert.equal(fake.peak, 5);
  });

  test("body over 64 KiB is rejected", async () => {
    const res = await fetch(`${baseURL}/api/track/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ awb: "A".repeat(MAX_BODY_BYTES) }] }),
    });
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: "body terlalu besar" });
  });

  test("GET is not allowed", async () => {
    const res = await fetch(`${baseURL}/api/track/bulk`);
    assert.equal(res.status, 405);
    assert.deepEqual(await res.json(), { error: "method tidak diizinkan" });
  });
});

describe("GET /api/track", () => {
  test("with courier is a plain proxy", async () => {
    fake.handler = () => ({ status: 404, body: { error: "resi tidak ditemukan" } });
    const res = await fetch(`${baseURL}/api/track?courier=jne&awb=x`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "resi tidak ditemukan" });
    assert.deepEqual(fake.calls, ["/api/track?courier=jne&awb=x"]);
  });

  test("without courier detects and adds detected: true", async () => {
    fake.handler = (path, q) =>
      path === "/api/detect"
        ? { status: 200, body: { candidates: [{ code: "jnt" }] } }
        : track("jnt", q.get("awb") ?? "");
    const res = await fetch(`${baseURL}/api/track?awb=jp1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.awb, "JP1");
    assert.equal(body.detected, true);
  });

  const failures = [
    {
      name: "detect down",
      handler: () => "hang" as const,
      status: 502,
      error: "layanan deteksi tidak tersedia",
    },
    {
      name: "tracking down",
      handler: (path: string) =>
        path === "/api/detect"
          ? { status: 200, body: { candidates: [{ code: "jnt" }] } }
          : ("hang" as const),
      status: 502,
      error: "layanan tracking tidak tersedia",
    },
    {
      name: "no candidate",
      handler: () => ({ status: 200, body: { candidates: [] } }),
      status: 400,
      error: "kurir tidak terdeteksi, pilih kurir secara manual",
    },
  ];
  for (const f of failures) {
    test(`without courier: ${f.name}`, async () => {
      fake.handler = f.handler;
      const res = await fetch(`${baseURL}/api/track?awb=x`);
      assert.equal(res.status, f.status);
      assert.deepEqual(await res.json(), { error: f.error });
    });
  }
});
