// End-to-end spec cases (`level: e2e`), run against a live gateway with every
// upstream it needs running: `mise run dev`, then `npm run test:e2e`.
import { test } from "node:test";
import { loadJSON, runCases } from "../src/spectest.ts";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";

// e2e spec files whose services are implemented. Add an entry per spec.
const SPEC_FILES = [
  "specs/002-courier-detection/cases.e2e.json",
  "specs/003-bulk-tracking/cases.e2e.json",
];

for (const rel of SPEC_FILES) {
  const file = loadJSON(rel);
  test(file.spec, async (t) => {
    // Every case in an e2e file goes through the gateway.
    await runCases(t, file, file.target, BASE_URL);
  });
}
