// Handlers for the tracking paths the gateway answers itself:
// GET /api/track without courier (002) and POST /api/track/bulk (003).
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseBulkRequest, trackBulk } from "./bulk.ts";
import { sendError, sendJSON } from "./http.ts";
import { type Failure, resolveTrack, type Upstreams } from "./resolve.ts";

export const MAX_BODY_BYTES = 64 * 1024;

// Status + message for GET /api/track without courier (002, 003 R7).
const SINGLE_ERRORS: Record<Failure, [number, string]> = {
  not_found: [404, "resi tidak ditemukan"],
  unknown_courier: [400, "kurir tidak dikenal"],
  unsupported_courier: [501, "kurir belum didukung"],
  invalid: [400, "permintaan tidak valid"],
  no_candidate: [400, "kurir tidak terdeteksi, pilih kurir secara manual"],
  detect_rejected: [400, "permintaan tidak valid"], // detect-rust's own response is sent instead
  tracking_unavailable: [502, "layanan tracking tidak tersedia"],
  detect_unavailable: [502, "layanan deteksi tidak tersedia"],
};

class BodyTooLarge extends Error {}

/** True when /api/track has no (or a blank) courier, so the gateway must detect it (002). */
export function isAutoTrack(url: URL): boolean {
  return (url.searchParams.get("courier") ?? "").trim() === "";
}

export async function handleAutoTrack(res: ServerResponse, url: URL, up: Upstreams): Promise<void> {
  // The AWB goes to detect-rust as given; it validates and normalizes it (002 R1).
  const r = await resolveTrack(up, "", url.searchParams.get("awb") ?? "");
  if (!r.ok) {
    if (r.upstream) {
      sendJSON(res, r.upstream.status, r.upstream.body);
      return;
    }
    const [status, message] = SINGLE_ERRORS[r.failure];
    sendError(res, status, message);
    return;
  }
  sendJSON(res, 200, { ...(r.track as object), detected: true });
}

export async function handleBulk(
  req: IncomingMessage,
  res: ServerResponse,
  up: Upstreams,
): Promise<void> {
  let raw: string;
  try {
    raw = await readBody(req, MAX_BODY_BYTES);
  } catch (err) {
    if (err instanceof BodyTooLarge) {
      sendError(res, 413, "body terlalu besar");
      return;
    }
    throw err;
  }
  const parsed = parseBulkRequest(raw);
  if ("error" in parsed) {
    sendError(res, 400, parsed.error);
    return;
  }
  sendJSON(res, 200, { results: await trackBulk(up, parsed.items) });
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new BodyTooLarge());
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
