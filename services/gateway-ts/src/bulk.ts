// POST /api/track/bulk (spec 003).
import { createLimiter } from "./limiter.ts";
import { type Failure, type Resolved, resolveTrack, type Upstreams } from "./resolve.ts";
import { errorMessage } from "./upstream.ts";

export const MAX_ITEMS = 10;
export const MAX_CONCURRENCY = 5;

export type TrackEvent = { time: string; location: string; description: string };

export type BulkItem = { awb: string; courier: string };

export type BulkResult = {
  awb: string;
  courier: string | null;
  detected: boolean;
  ok: boolean;
  status?: string;
  last_event?: TrackEvent;
  error?: string;
};

// Per-item messages (R5).
const MESSAGES: Record<Failure, string> = {
  not_found: "resi tidak ditemukan",
  unknown_courier: "kurir tidak dikenal",
  unsupported_courier: "kurir belum didukung",
  invalid: "permintaan tidak valid",
  no_candidate: "kurir tidak terdeteksi, pilih kurir secara manual",
  detect_rejected: "permintaan tidak valid", // replaced by detect-rust's own message when it has one
  tracking_unavailable: "layanan sedang tidak tersedia",
  detect_unavailable: "layanan sedang tidak tersedia",
};

const BAD_BODY = "body harus JSON dengan field items";

// parseBulkRequest validates the raw body in the order given by the spec's
// request-level error table, returning either deduped items or an error message.
export function parseBulkRequest(raw: string): { items: BulkItem[] } | { error: string } {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: BAD_BODY };
  }
  if (!isObject(body) || !Array.isArray(body.items)) {
    return { error: BAD_BODY };
  }

  const items: BulkItem[] = [];
  for (const it of body.items) {
    if (!isObject(it)) return { error: BAD_BODY };
    const awb = optionalString(it.awb);
    const courier = optionalString(it.courier);
    if (awb === null || courier === null) return { error: BAD_BODY };
    items.push({ awb: awb.trim().toUpperCase(), courier: courier.trim().toLowerCase() });
  }
  if (items.length === 0) {
    return { error: "items wajib diisi" };
  }

  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const key = `${it.courier}\n${it.awb}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.some((it) => it.awb === "")) {
    return { error: "setiap item wajib punya awb" };
  }
  if (unique.length > MAX_ITEMS) {
    return { error: `maksimal ${MAX_ITEMS} resi per permintaan` };
  }
  return { items: unique };
}

// trackBulk resolves all items in parallel, with at most MAX_CONCURRENCY
// upstream calls in flight (R4). Results keep the input order (R3).
export function trackBulk(up: Upstreams, items: BulkItem[]): Promise<BulkResult[]> {
  const limit = createLimiter(MAX_CONCURRENCY);
  const limited: Upstreams = { ...up, call: (url) => limit(() => up.call(url)) };
  return Promise.all(items.map((it) => trackItem(limited, it)));
}

async function trackItem(up: Upstreams, item: BulkItem): Promise<BulkResult> {
  const r = await resolveTrack(up, item.courier, item.awb);
  const fail = (failure: Failure, upstream?: Extract<Resolved, { ok: false }>["upstream"]) => ({
    awb: item.awb,
    courier: item.courier || null,
    detected: false,
    ok: false,
    error: (upstream && errorMessage(upstream.body)) || MESSAGES[failure],
  });
  if (!r.ok) return fail(r.failure, r.upstream);
  if (!isTrackBody(r.track)) {
    console.error("tracking: unexpected response body");
    return fail("tracking_unavailable");
  }

  const result: BulkResult = {
    awb: item.awb,
    courier: r.courier,
    detected: r.detected,
    ok: true,
    status: r.track.status,
  };
  if (r.track.history.length > 0) {
    result.last_event = r.track.history[0];
  }
  return result;
}

function isTrackBody(body: unknown): body is { status: string; history: TrackEvent[] } {
  return isObject(body) && typeof body.status === "string" && Array.isArray(body.history);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// optionalString maps missing/null to "", strings to themselves, anything else to null.
function optionalString(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v : null;
}
