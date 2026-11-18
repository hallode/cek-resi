import type { ServerResponse } from "node:http";
import { sendError, sendJSON } from "./http.ts";

type DetectResponse = { awb: string; candidates: { code: string }[] };

/** Tracking statuses that mean "not this courier, try the next candidate". */
const MISS = new Set([400, 404, 501]);

/**
 * GET /api/track without courier (spec 002): ask detect-rust for candidate
 * couriers, then try tracking-go for each in order. The first 200 is returned
 * unchanged plus `detected: true`.
 */
export async function trackAuto(
  res: ServerResponse,
  awb: string,
  urls: { detect: string; tracking: string },
  timeoutMs: number,
): Promise<void> {
  let detect: Response;
  let detectBody: unknown;
  try {
    const target = new URL("/api/detect", urls.detect);
    target.searchParams.set("awb", awb);
    detect = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) });
    detectBody = await detect.json();
  } catch {
    sendError(res, 502, "layanan deteksi tidak tersedia");
    return;
  }
  if (detect.status >= 500) {
    sendError(res, 502, "layanan deteksi tidak tersedia");
    return;
  }
  if (!detect.ok) {
    // Input errors (blank / too long awb) come from detect-rust as-is.
    sendJSON(res, detect.status, detectBody);
    return;
  }

  const { awb: normalized, candidates } = detectBody as DetectResponse;
  if (candidates.length === 0) {
    sendError(res, 400, "kurir tidak terdeteksi, pilih kurir secara manual");
    return;
  }

  for (const { code } of candidates) {
    const target = new URL("/api/track", urls.tracking);
    target.searchParams.set("courier", code);
    target.searchParams.set("awb", normalized);

    let track: Response;
    let body: unknown;
    try {
      track = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) });
      body = await track.json();
    } catch {
      sendError(res, 502, "layanan tracking tidak tersedia");
      return;
    }
    if (track.ok) {
      sendJSON(res, 200, { ...(body as object), detected: true });
      return;
    }
    if (!MISS.has(track.status)) {
      sendJSON(res, track.status, body);
      return;
    }
  }
  sendError(res, 404, "resi tidak ditemukan");
}
