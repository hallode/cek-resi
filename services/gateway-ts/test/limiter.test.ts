import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { createLimiter } from "../src/limiter.ts";

test("never runs more than max tasks at once", async () => {
  const limit = createLimiter(3);
  let active = 0;
  let peak = 0;
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(5);
        active--;
        return i;
      }),
    ),
  );
  assert.equal(peak, 3);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("releases the slot when a task throws", async () => {
  const limit = createLimiter(1);
  await assert.rejects(limit(() => Promise.reject(new Error("boom"))));
  assert.equal(await limit(async () => "next"), "next");
});
