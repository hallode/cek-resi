import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { TestContext } from "node:test";

/** Listens on a random port and closes the server when the test ends. */
export async function listen(t: TestContext, server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Starts a fake upstream service. */
export function fakeUpstream(t: TestContext, handler: RequestListener): Promise<string> {
  return listen(t, createServer(handler));
}
