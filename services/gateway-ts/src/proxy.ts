import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError } from "./http.ts";

/**
 * Forwards req to target and copies status + body back unchanged.
 * Upstream timeout or connection failure → 502 (spec 000, A5).
 */
export async function proxy(
  req: IncomingMessage,
  res: ServerResponse,
  target: URL,
  serviceName: string,
  timeoutMs: number,
): Promise<void> {
  let upstream: Response;
  let body: ArrayBuffer;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await upstream.arrayBuffer();
  } catch {
    sendError(res, 502, `layanan ${serviceName} tidak tersedia`);
    return;
  }
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
  });
  res.end(Buffer.from(body));
}
