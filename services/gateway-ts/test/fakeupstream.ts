// Test helper: one HTTP server standing in for tracking-go and detect-rust.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export type FakeReply = { status: number; body: unknown } | "hang" | "not-json";
export type FakeHandler = (path: string, params: URLSearchParams) => FakeReply;

export type FakeUpstream = {
  url: string;
  handler: FakeHandler;
  delayMs: number;
  peak: number;
  calls: string[];
  close: () => Promise<void>;
};

export async function startFakeUpstream(): Promise<FakeUpstream> {
  let active = 0;
  const fake: FakeUpstream = {
    url: "",
    handler: () => ({ status: 500, body: { error: "no handler" } }),
    delayMs: 0,
    peak: 0,
    calls: [],
    close: async () => {},
  };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://fake");
    fake.calls.push(`${u.pathname}${u.search}`);
    active++;
    fake.peak = Math.max(fake.peak, active);
    try {
      if (fake.delayMs) await sleep(fake.delayMs);
      const reply = fake.handler(u.pathname, u.searchParams);
      if (reply === "hang") return; // never answers; the client must time out
      if (reply === "not-json") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end("<html>oops</html>");
      }
      res.writeHead(reply.status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(reply.body));
    } finally {
      active--;
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () =>
    new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return fake;
}

export function track(courier: string, awb: string, status = "DELIVERED", history = [EVENT]) {
  return { status: 200, body: { awb, courier: { code: courier, name: courier }, status, history } };
}

export const EVENT = {
  time: "2026-11-11T13:47:00+07:00",
  location: "Bandung",
  description: "Paket diterima",
};
