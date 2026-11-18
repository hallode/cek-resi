import { createServer, type Server } from "node:http";
import { sendError, sendJSON } from "./http.ts";
import { proxy } from "./proxy.ts";
import type { Upstreams } from "./resolve.ts";
import { serveStatic } from "./static.ts";
import { handleAutoTrack, handleBulk, isAutoTrack } from "./track.ts";
import { DEFAULT_TIMEOUT_MS, httpCall } from "./upstream.ts";

export type Upstream = "tracking" | "detect";

export type Config = {
  webDir: string;
  upstreams: Record<Upstream, string>;
  upstreamTimeoutMs?: number;
};

/**
 * Public API paths owned by other services (spec 000, A1). The path is
 * forwarded unchanged. Add a row when a service starts owning a new path.
 */
const ROUTES: ReadonlyArray<{ path: string; upstream: Upstream }> = [
  { path: "/api/couriers", upstream: "tracking" },
  { path: "/api/track", upstream: "tracking" },
];

export function createApp(cfg: Config): Server {
  const timeoutMs = cfg.upstreamTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const up: Upstreams = {
    trackingURL: cfg.upstreams.tracking,
    detectURL: cfg.upstreams.detect,
    call: httpCall(timeoutMs),
  };

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://gateway.local");

      if (url.pathname === "/health") {
        sendJSON(res, 200, { status: "ok", service: "gateway-ts" });
        return;
      }

      // Paths owned by the gateway itself (spec 002 R7, spec 003).
      if (url.pathname === "/api/track/bulk") {
        if (req.method !== "POST") {
          sendError(res, 405, "method tidak diizinkan");
          return;
        }
        await handleBulk(req, res, up);
        return;
      }
      if (url.pathname === "/api/track" && req.method === "GET" && isAutoTrack(url)) {
        await handleAutoTrack(res, url, up);
        return;
      }

      const route = ROUTES.find((r) => r.path === url.pathname);
      if (route) {
        const target = new URL(url.pathname + url.search, cfg.upstreams[route.upstream]);
        await proxy(req, res, target, route.upstream, timeoutMs);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendError(res, 404, "endpoint tidak ditemukan");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendError(res, 405, "method tidak diizinkan");
        return;
      }
      await serveStatic(res, cfg.webDir, url.pathname);
    } catch (err) {
      console.error("internal error:", err);
      if (!res.headersSent) sendError(res, 500, "terjadi kesalahan pada server");
    }
  });
}
