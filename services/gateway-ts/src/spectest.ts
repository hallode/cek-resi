// Runs language-neutral spec cases (specs/*/cases*.json) over HTTP.
// Matching rules: specs/README.md#format-casesjson. Test-only module.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";

export type SpecCase = {
  name: string;
  target?: string;
  request: { method: string; path: string; body?: unknown; raw_body?: string };
  expect: { status: number; body?: unknown };
};

export type SpecFile = { spec: string; level: string; target: string; cases: SpecCase[] };

/** Absolute path of the repo root (the directory containing specs/). */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "specs"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`specs/ not found above ${import.meta.url}`);
    dir = parent;
  }
  return dir;
}

/** Loads a JSON file given relative to the repo root, e.g. "specs/000-architecture/cases.json". */
export function loadJSON<T = SpecFile>(rel: string): T {
  return JSON.parse(readFileSync(join(repoRoot(), rel), "utf8")) as T;
}

/** Partial deep match; returns one message per mismatch (empty = match). */
export function matchPartial(expected: unknown, actual: unknown, path = "$"): string[] {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return [`${path}: want array of length ${expected.length}, got ${JSON.stringify(actual)}`];
    }
    return expected.flatMap((e, i) => matchPartial(e, actual[i], `${path}[${i}]`));
  }
  if (expected !== null && typeof expected === "object") {
    const keys = Object.keys(expected);
    if (keys.length === 1 && keys[0] === "$length") {
      const n = (expected as { $length: number }).$length;
      return Array.isArray(actual) && actual.length === n
        ? []
        : [`${path}: want array of length ${n}, got ${JSON.stringify(actual)}`];
    }
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
      return [`${path}: want object, got ${JSON.stringify(actual)}`];
    }
    const obj = actual as Record<string, unknown>;
    return Object.entries(expected).flatMap(([k, v]) =>
      k in obj ? matchPartial(v, obj[k], `${path}.${k}`) : [`${path}.${k}: missing`],
    );
  }
  return expected === actual
    ? []
    : [`${path}: want ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}

/** Runs every case whose target (case-level, else file-level) equals target against baseUrl. */
export async function runCases(
  t: TestContext,
  file: SpecFile,
  target: string,
  baseUrl: string,
): Promise<void> {
  const cases = file.cases.filter((c) => (c.target ?? file.target) === target);
  if (cases.length === 0) throw new Error(`${file.spec}: no cases for target ${target}`);

  for (const c of cases) {
    await t.test(c.name, (t) => runCase(t, c, baseUrl));
  }
}

/** Sends one case's request to baseUrl and asserts status + partial body. */
/** Sends a case's request (raw_body wins over body) and returns status + raw text. */
export async function sendCase(
  c: SpecCase,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ status: number; text: string }> {
  const body =
    c.request.raw_body ??
    (c.request.body === undefined ? undefined : JSON.stringify(c.request.body));
  const res = await fetch(new URL(c.request.path, baseUrl), {
    method: c.request.method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body,
    signal,
  });
  return { status: res.status, text: await res.text() };
}

export async function runCase(t: TestContext, c: SpecCase, baseUrl: string): Promise<void> {
  const { status, text } = await sendCase(c, baseUrl);
  t.assert.equal(status, c.expect.status, `status; body = ${text}`);
  if (c.expect.body !== undefined) {
    t.assert.deepEqual(matchPartial(c.expect.body, JSON.parse(text)), []);
  }
}
