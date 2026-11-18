import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { resolveTrack, type Upstreams } from "../src/resolve.ts";
import { httpCall } from "../src/upstream.ts";
import {
  EVENT,
  type FakeHandler,
  type FakeReply,
  type FakeUpstream,
  startFakeUpstream,
  track,
} from "./fakeupstream.ts";

let fake: FakeUpstream;
let up: Upstreams;

before(async () => {
  fake = await startFakeUpstream();
  up = { trackingURL: fake.url, detectURL: fake.url, call: httpCall(100) };
});
after(() => fake.close());
beforeEach(() => {
  fake.calls = [];
  fake.delayMs = 0;
});

// detects returns the given candidate codes, then answers tracking per courier.
function detects(codes: string[], tracking: Record<string, ReturnType<FakeHandler>>): FakeHandler {
  return (path, q) => {
    if (path === "/api/detect")
      return {
        status: 200,
        body: { awb: q.get("awb"), candidates: codes.map((code) => ({ code })) },
      };
    return (
      tracking[q.get("courier") ?? ""] ?? { status: 404, body: { error: "resi tidak ditemukan" } }
    );
  };
}

describe("explicit courier", () => {
  const cases: Array<{ name: string; reply: ReturnType<FakeHandler>; failure: string }> = [
    {
      name: "404",
      reply: { status: 404, body: { error: "resi tidak ditemukan" } },
      failure: "not_found",
    },
    {
      name: "400 unknown courier",
      reply: { status: 400, body: { error: "kurir tidak dikenal" } },
      failure: "unknown_courier",
    },
    {
      name: "400 other",
      reply: { status: 400, body: { error: "parameter courier dan awb wajib diisi" } },
      failure: "invalid",
    },
    {
      name: "501",
      reply: { status: 501, body: { error: "kurir belum didukung" } },
      failure: "unsupported_courier",
    },
    {
      name: "502",
      reply: { status: 502, body: { error: "gagal mengambil data dari kurir" } },
      failure: "tracking_unavailable",
    },
    { name: "non-JSON body", reply: "not-json", failure: "tracking_unavailable" },
    { name: "timeout", reply: "hang", failure: "tracking_unavailable" },
  ];
  for (const c of cases) {
    test(`${c.name} -> ${c.failure}`, async () => {
      fake.handler = () => c.reply;
      assert.deepEqual(await resolveTrack(up, "jne", "X1"), { ok: false, failure: c.failure });
    });
  }

  test("200 is not marked as detected and skips detection", async () => {
    fake.handler = () => track("jne", "X1");
    const r = await resolveTrack(up, "jne", "X1");
    assert.equal(r.ok && r.detected, false);
    assert.deepEqual(fake.calls, ["/api/track?courier=jne&awb=X1"]);
  });
});

describe("detection", () => {
  test("first candidate that answers 200 wins, in order", async () => {
    fake.handler = detects(["sicepat", "tiki"], { tiki: track("tiki", "0040") });
    const r = await resolveTrack(up, "", "0040");
    assert.ok(r.ok);
    assert.equal(r.courier, "tiki");
    assert.equal(r.detected, true);
    assert.deepEqual((r.track as { history: unknown }).history, [EVENT]);
    assert.deepEqual(fake.calls, [
      "/api/detect?awb=0040",
      "/api/track?courier=sicepat&awb=0040",
      "/api/track?courier=tiki&awb=0040",
    ]);
  });

  test("no candidates", async () => {
    fake.handler = detects([], {});
    assert.deepEqual(await resolveTrack(up, "", "ZZZ"), { ok: false, failure: "no_candidate" });
  });

  test("all candidates 404", async () => {
    fake.handler = detects(["sicepat", "tiki"], {});
    assert.deepEqual(await resolveTrack(up, "", "0040"), { ok: false, failure: "not_found" });
  });

  test("unavailable wins over 404 in either order (R5a)", async () => {
    const down = { status: 500, body: { error: "x" } };
    const variants: Record<string, FakeReply>[] = [{ sicepat: down }, { tiki: down }];
    for (const tracking of variants) {
      fake.handler = detects(["sicepat", "tiki"], tracking);
      assert.deepEqual(await resolveTrack(up, "", "0040"), {
        ok: false,
        failure: "tracking_unavailable",
      });
    }
  });

  test("candidate 400/501 count as a miss, like 404 (002)", async () => {
    fake.handler = detects(["a", "b", "c"], {
      b: { status: 501, body: { error: "kurir belum didukung" } },
      c: { status: 400, body: { error: "kurir tidak dikenal" } },
    });
    assert.deepEqual(await resolveTrack(up, "", "0040"), { ok: false, failure: "not_found" });
  });

  test("detect 4xx is returned as-is for the caller to pass on", async () => {
    const body = { error: "awb terlalu panjang" };
    fake.handler = () => ({ status: 400, body });
    assert.deepEqual(await resolveTrack(up, "", "A".repeat(41)), {
      ok: false,
      failure: "detect_rejected",
      upstream: { status: 400, body },
    });
  });

  test("tracking uses the AWB normalized by detect", async () => {
    fake.handler = (path, q) =>
      path === "/api/detect"
        ? { status: 200, body: { awb: "JP1", candidates: [{ code: "jnt" }] } }
        : track("jnt", q.get("awb") ?? "");
    await resolveTrack(up, "", " jp1 ");
    assert.deepEqual(fake.calls, ["/api/detect?awb=+jp1+", "/api/track?courier=jnt&awb=JP1"]);
  });

  test("detect timeout", async () => {
    fake.handler = () => "hang";
    assert.deepEqual(await resolveTrack(up, "", "0040"), {
      ok: false,
      failure: "detect_unavailable",
    });
  });

  test("detect 5xx", async () => {
    fake.handler = () => ({ status: 503, body: { error: "x" } });
    assert.deepEqual(await resolveTrack(up, "", "0040"), {
      ok: false,
      failure: "detect_unavailable",
    });
  });
});
