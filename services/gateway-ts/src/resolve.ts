// Shared "track, or detect then try candidates" logic (spec 003 R7),
// used by GET /api/track without courier (002) and POST /api/track/bulk (003).
import { type Call, errorMessage } from "./upstream.ts";

export type Upstreams = {
  trackingURL: string;
  detectURL: string;
  call: Call;
};

export type Failure =
  | "not_found"
  | "unknown_courier"
  | "unsupported_courier"
  | "invalid"
  | "no_candidate"
  | "detect_rejected"
  | "tracking_unavailable"
  | "detect_unavailable";

export type Resolved =
  | { ok: true; courier: string; detected: boolean; track: unknown }
  | {
      ok: false;
      failure: Failure;
      /** Only for detect_rejected: detect-rust's 4xx response, passed on as-is (002). */
      upstream?: { status: number; body: unknown };
    };

/** Tracking statuses that mean "not this courier, try the next candidate" (002). */
const MISS = new Set([400, 404, 501]);

/**
 * Explicit courier: one tracking call. Empty courier: ask detect-rust, then try
 * each candidate in order; the first 200 wins (002). `track` is tracking-go's
 * body, unchanged.
 */
export async function resolveTrack(up: Upstreams, courier: string, awb: string): Promise<Resolved> {
  if (courier) {
    return trackOne(up, courier, awb, false);
  }

  const res = await up.call(withQuery(up.detectURL, "/api/detect", { awb }));
  if (res.kind === "unavailable" || res.status >= 500) {
    return { ok: false, failure: "detect_unavailable" };
  }
  if (res.status !== 200) {
    return {
      ok: false,
      failure: "detect_rejected",
      upstream: { status: res.status, body: res.body },
    };
  }
  const detected = parseDetect(res.body);
  if (detected === null) {
    console.error("detect: unexpected response body");
    return { ok: false, failure: "detect_unavailable" };
  }
  if (detected.candidates.length === 0) {
    return { ok: false, failure: "no_candidate" };
  }

  // Tracking uses the AWB as normalized by detect-rust (002 R1).
  const normalized = detected.awb ?? awb;
  let unavailable = false;
  for (const code of detected.candidates) {
    const r = await trackOne(up, code, normalized, true);
    if (r.ok) return r;
    // R5a: a down tracking service must not read as "not found", but the
    // remaining candidates are still tried.
    if (r.failure === "tracking_unavailable") unavailable = true;
  }
  return { ok: false, failure: unavailable ? "tracking_unavailable" : "not_found" };
}

async function trackOne(
  up: Upstreams,
  courier: string,
  awb: string,
  detected: boolean,
): Promise<Resolved> {
  const res = await up.call(withQuery(up.trackingURL, "/api/track", { courier, awb }));
  if (res.kind === "unavailable") return { ok: false, failure: "tracking_unavailable" };
  if (res.status === 200) return { ok: true, courier, detected, track: res.body };
  if (detected && MISS.has(res.status)) return { ok: false, failure: "not_found" };
  if (res.status === 404) return { ok: false, failure: "not_found" };
  if (res.status === 501) return { ok: false, failure: "unsupported_courier" };
  if (res.status >= 500) return { ok: false, failure: "tracking_unavailable" };
  if (res.status === 400 && errorMessage(res.body) === "kurir tidak dikenal") {
    return { ok: false, failure: "unknown_courier" };
  }
  return { ok: false, failure: "invalid" };
}

function withQuery(base: string, path: string, params: Record<string, string>): string {
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function parseDetect(body: unknown): { awb: string | null; candidates: string[] } | null {
  if (
    !body ||
    typeof body !== "object" ||
    !("candidates" in body) ||
    !Array.isArray(body.candidates)
  ) {
    return null;
  }
  const candidates: string[] = [];
  for (const c of body.candidates) {
    if (!c || typeof c.code !== "string") return null;
    candidates.push(c.code);
  }
  const awb = "awb" in body && typeof body.awb === "string" ? body.awb : null;
  return { awb, candidates };
}
