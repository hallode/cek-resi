// Runs every specs/*/cases.e2e.json against a running gateway (BASE_URL)
// with all upstream services up: `mise run dev`, then `npm run test:e2e`.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { loadJSON, repoRoot, runCase } from "../src/spectest.ts";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8080";

const files = readdirSync(join(repoRoot(), "specs"))
  .sort()
  .map((dir) => `specs/${dir}/cases.e2e.json`)
  .filter((rel) => existsSync(join(repoRoot(), rel)));

for (const rel of files) {
  const file = loadJSON(rel);
  test(file.spec, async (t) => {
    for (const c of file.cases) {
      await t.test(c.name, (t) => runCase(t, c, baseUrl));
    }
  });
}
