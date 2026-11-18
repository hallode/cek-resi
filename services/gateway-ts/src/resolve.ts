// Shared "track, or detect then try candidates" logic (spec 003 R7),
// used by GET /api/track without courier (002) and POST /api/track/bulk (003).
import { type Call, errorMessage } from "./upstream.ts";

export type Upstreams = {
  trackingURL: string;
  detectURL: string;
  call: Call;
};

export type TrackEvent = { time: string; location: string; description: string };

export type TrackBody = { status: string; history: TrackEvent[]; [key: string]: unknown };

export type Failure =
  | "not_found"
  | "unknown_courier"
  | "unsupported_courier"
  | "invalid"
  | "no_candidate"
  | "awb_too_long"
  | "tracking_unavailable"
  | "detect_unavailable";

export type Resolved =
  | { ok: true; courier: string; detected: boolean; track: TrackBody }
  | { ok: false; failure: Failure };

// resolveTrack expects courier and awb already normalized (K3).
// An empty courier means "detect it" (002).
export async function resolveTrack(up: Upstreams, courier: string, awb: string): Promise<Resolved> {
  if (courier) {
    return trackOne(up, courier, awb, false);
  }

  const res = await up.call(`${up.detectURL}/api/detect?awb=${encodeURIComponent(awb)}`);
  if (res.kind === "unavailable" || res.status >= 500) {
    return { ok: false, failure: "detect_unavailable" };
  }
  if (res.status !== 200) {
    const tooLong = res.status === 400 && errorMessage(res.body) === "awb terlalu panjang";
    return { ok: false, failure: tooLong ? "awb_too_long" : "invalid" };
  }
  const candidates = candidateCodes(res.body);
  if (candidates === null) {
    console.error("detect: unexpected response body");
    return { ok: false, failure: "detect_unavailable" };
  }
  if (candidates.length === 0) {
    return { ok: false, failure: "no_candidate" };
  }

  const failures: Failure[] = [];
  for (const code of candidates) {
    const r = await trackOne(up, code, awb, true);
    if (r.ok) return r;
    failures.push(r.failure);
  }
  return { ok: false, failure: pickFailure(failures) };
}

async function trackOne(
  up: Upstreams,
  courier: string,
  awb: string,
  detected: boolean,
): Promise<Resolved> {
  const url = `${up.trackingURL}/api/track?courier=${encodeURIComponent(courier)}&awb=${encodeURIComponent(awb)}`;
  const res = await up.call(url);
  if (res.kind === "unavailable") {
    return { ok: false, failure: "tracking_unavailable" };
  }
  if (res.status === 200) {
    if (!isTrackBody(res.body)) {
      console.error("tracking: unexpected response body");
      return { ok: false, failure: "tracking_unavailable" };
    }
    return { ok: true, courier, detected, track: res.body };
  }
  if (res.status === 404) return { ok: false, failure: "not_found" };
  if (res.status === 501) return { ok: false, failure: "unsupported_courier" };
  if (res.status >= 500) return { ok: false, failure: "tracking_unavailable" };
  if (res.status === 400 && errorMessage(res.body) === "kurir tidak dikenal") {
    return { ok: false, failure: "unknown_courier" };
  }
  return { ok: false, failure: "invalid" };
}

// pickFailure applies R5a: unavailable wins, then all-404, then the first non-404.
function pickFailure(failures: Failure[]): Failure {
  if (failures.includes("tracking_unavailable")) return "tracking_unavailable";
  return failures.find((f) => f !== "not_found") ?? "not_found";
}

function candidateCodes(body: unknown): string[] | null {
  if (
    !body ||
    typeof body !== "object" ||
    !("candidates" in body) ||
    !Array.isArray(body.candidates)
  ) {
    return null;
  }
  const codes: string[] = [];
  for (const c of body.candidates) {
    if (!c || typeof c.code !== "string") return null;
    codes.push(c.code);
  }
  return codes;
}

function isTrackBody(body: unknown): body is TrackBody {
  return (
    !!body &&
    typeof body === "object" &&
    "status" in body &&
    typeof body.status === "string" &&
    "history" in body &&
    Array.isArray(body.history)
  );
}
