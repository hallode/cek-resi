import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { sendError } from "./http.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Serves a file from webDir; never serves anything outside of it. */
export async function serveStatic(
  res: ServerResponse,
  webDir: string,
  pathname: string,
): Promise<void> {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    sendError(res, 400, "path tidak valid");
    return;
  }
  if (rel.endsWith("/")) rel += "index.html";

  const root = resolve(webDir);
  const file = resolve(join(root, rel));
  if (!file.startsWith(root + sep)) {
    sendError(res, 404, "tidak ditemukan");
    return;
  }

  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    sendError(res, 404, "tidak ditemukan");
    return;
  }
  res.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
  });
  res.end(body);
}
