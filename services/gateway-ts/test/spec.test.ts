import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { loadJSON, matchPartial, repoRoot, runCases } from "../src/spectest.ts";
import { listen } from "./helpers.ts";

// Spec cases this service implements at `level: service`. Add an entry when a
// spec owned by gateway-ts is implemented.
const SPEC_FILES = ["specs/000-architecture/cases.json", "specs/003-bulk-tracking/cases.json"];

for (const rel of SPEC_FILES) {
  const file = loadJSON(rel);
  test(file.spec, async (t) => {
    const base = await listen(
      t,
      createApp({
        webDir: join(repoRoot(), "web"),
        upstreams: {
          tracking: "http://127.0.0.1:1",
          detect: "http://127.0.0.1:1",
          ongkir: "http://127.0.0.1:1",
        },
      }),
    );
    await runCases(t, file, "gateway-ts", base);
  });
}

type MatcherVectors = {
  cases: { name: string; expected: unknown; actual: unknown; match: boolean }[];
};

test("matchPartial follows specs/matcher-cases.json", async (t) => {
  for (const v of loadJSON<MatcherVectors>("specs/matcher-cases.json").cases) {
    await t.test(v.name, (t) => {
      t.assert.equal(matchPartial(v.expected, v.actual).length === 0, v.match);
    });
  }
});
