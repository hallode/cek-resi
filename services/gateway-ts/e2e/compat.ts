// Backward-compatibility check for the push-pr skill: replays the spec cases
// from a base ref (default origin/master) against the services running from
// the working tree.
//   - failure in a spec marked "Implemented" on the base = breaking change
//   - failure in a spec still Draft on the base = warning (base may fail it too)
//   - service unreachable = not a verdict on behaviour; blocks the check
//
// Usage (needs `mise run dev` running), from the repo root:
//   mise exec -- node services/gateway-ts/e2e/compat.ts [base-ref]
// Env: GATEWAY_URL, TRACKING_URL, DETECT_URL, ONGKIR_URL (default localhost:8080-8083).
// Exit: 0 ok, 1 breaking change, 2 a service was unreachable.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { matchPartial, repoRoot, type SpecFile, sendCase } from "../src/spectest.ts";

const base = process.argv[2] ?? "origin/master";
const root = repoRoot();

const URLS: Record<string, string> = {
  "gateway-ts": process.env.GATEWAY_URL ?? "http://localhost:8080",
  "tracking-go": process.env.TRACKING_URL ?? "http://localhost:8081",
  "detect-rust": process.env.DETECT_URL ?? "http://localhost:8082",
  "ongkir-py": process.env.ONGKIR_URL ?? "http://localhost:8083",
};

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

const files = git("ls-tree", "-r", "--name-only", base, "specs/")
  .split("\n")
  .filter((f) => /\/cases(\.e2e)?\.json$/.test(f));

// Spec ids (e.g. "001") whose status on the base starts with "Implemented".
const implemented = new Set(
  git("show", `${base}:specs/README.md`)
    .split("\n")
    .filter((line) => /^\|\s*\[\d{3}\]/.test(line) && /\|\s*Implemented/.test(line))
    .map((line) => line.match(/\[(\d{3})\]/)?.[1]),
);

let passed = 0;
const breaking: string[] = [];
const warnings: string[] = [];
const unreachable: string[] = [];
const skipped: string[] = [];
const removed: string[] = [];

for (const rel of files) {
  const file = JSON.parse(git("show", `${base}:${rel}`)) as SpecFile;

  // Cases present on the base but gone (or renamed) in the working tree.
  const now = join(root, rel);
  const current = existsSync(now) ? (JSON.parse(readFileSync(now, "utf8")) as SpecFile) : null;
  const currentNames = new Set(current?.cases.map((c) => c.name) ?? []);
  for (const c of file.cases) {
    if (!currentNames.has(c.name)) removed.push(`${rel} / ${c.name}`);
  }

  const specId = rel.match(/^specs\/(\d{3})-/)?.[1] ?? "";
  const sink = implemented.has(specId) ? breaking : warnings;

  for (const c of file.cases) {
    // Targets may carry a note, e.g. "gateway-ts (no upstream needed)": match the service name.
    const raw = file.level === "e2e" ? "gateway-ts" : (c.target ?? file.target);
    const target = Object.keys(URLS).find((name) => raw.startsWith(name)) ?? raw;
    const baseUrl = URLS[target];
    const label = `${rel} / ${c.name}`;
    if (!baseUrl) {
      skipped.push(`${label} (target tidak dikenal: ${target})`);
      continue;
    }

    let res: { status: number; text: string };
    try {
      res = await sendCase(c, baseUrl, AbortSignal.timeout(5000));
    } catch (err) {
      unreachable.push(`${label}: ${target} (${baseUrl}) ${err}`);
      continue;
    }

    const errs: string[] = [];
    if (res.status !== c.expect.status) {
      errs.push(`status ${res.status}, base mengharapkan ${c.expect.status}`);
    }
    if (c.expect.body !== undefined) {
      try {
        errs.push(...matchPartial(c.expect.body, JSON.parse(res.text)));
      } catch {
        errs.push(`respon bukan JSON: ${res.text.slice(0, 120)}`);
      }
    }
    if (errs.length) sink.push(`${label}\n    ${errs.join("\n    ")}`);
    else passed++;
  }
}

const list = (title: string, items: string[]) => {
  if (items.length) console.log(`\n${title}:\n- ${items.join("\n- ")}`);
};

console.log(
  `Kompatibilitas terhadap ${base}: ${passed} lulus, ${breaking.length} breaking, ` +
    `${warnings.length} peringatan, ${unreachable.length} tidak terjangkau, ${skipped.length} dilewati`,
);
list("BREAKING (perilaku lama berubah)", breaking);
list(`PERINGATAN (spec belum Implemented di ${base}; bisa jadi belum lulus sejak base)`, warnings);
list("TIDAK TERJANGKAU (service mati/timeout; bukan putusan soal perilaku)", unreachable);
list(`KASUS DIHAPUS/DIGANTI NAMA sejak ${base}`, removed);
list("DILEWATI", skipped);
process.exit(breaking.length ? 1 : unreachable.length ? 2 : 0);
