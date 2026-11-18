// HTTP calls from the gateway to internal services (A4, A5).

export type UpstreamResponse =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "unavailable" };

// Call performs one GET against an upstream and decodes its JSON body.
export type Call = (url: string) => Promise<UpstreamResponse>;

export const DEFAULT_TIMEOUT_MS = 3000;

// httpCall returns a Call that treats timeouts, connection errors and
// non-JSON bodies as "unavailable".
export function httpCall(timeoutMs: number): Call {
  return async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      return { kind: "response", status: res.status, body: JSON.parse(text) };
    } catch (err) {
      console.error(`upstream ${url}: ${err instanceof Error ? err.message : err}`);
      return { kind: "unavailable" };
    }
  };
}

export function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return "";
}
