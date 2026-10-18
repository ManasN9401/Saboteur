// The checks every API route runs before doing any work: where the request comes from, how big it is,
// and whether this client is over its allowance (lib/security/limits.ts).
import { limiter, type Bucket } from "./limits";

/**
 * Who is asking. Behind a proxy the client's address is in a header, and which header can be trusted
 * depends on the host (docs/deploy.md): set TRUSTED_IP_HEADER (e.g. "fly-client-ip",
 * "cf-connecting-ip", "x-real-ip"). Otherwise the right-most X-Forwarded-For entry is used, which the
 * nearest proxy wrote and a client can't forge (forged entries go on the left).
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const trusted = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const v = headers.get(trusted)?.split(",")[0]?.trim();
    if (v) return v.slice(0, 64);
  }
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // TRUST_PROXY_HOPS: how many proxies of yours sit in front (the entry before them is the client).
    const n = Math.max(1, Number(env.TRUST_PROXY_HOPS ?? 1) || 1);
    const ip = hops[Math.max(0, hops.length - n)];
    if (ip) return ip.slice(0, 64);
  }
  return headers.get("x-real-ip")?.trim().slice(0, 64) || "unknown";
}

/**
 * Browsers say where a request comes from. A page on another site may not use these endpoints (it
 * would be spending this server's AI quota on its own visitors' behalf). Requests with no Origin
 * (curl, server-to-server) pass: the rate limits still apply. ALLOWED_ORIGINS adds origins.
 */
export function sameOrigin(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return !origin;
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (o.host === host) return true;
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((a) => a === origin);
}

export const json = (status: number, error: string, headers: Record<string, string> = {}) => Response.json({ error }, { status, headers });

/**
 * The JSON body, read no further than `maxBytes` (a declared length over the cap is refused before
 * reading anything). Returns a Response to send back instead when the body is too big or not JSON.
 */
export async function readJson(request: Request, maxBytes: number): Promise<{ data: unknown } | { response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (declared > maxBytes) return { response: json(413, "That's too much to send in one go.") };
  if (!request.body) return { response: json(400, "The request was empty.") };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { response: json(413, "That's too much to send in one go.") };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { response: json(400, "The request wasn't valid JSON.") };
  }
}

export interface Pass {
  client: string;
  /** Call when a streaming response ends, to free the client's slot. */
  done: () => void;
}

/** Same-origin and rate-limit checks for one request. A Response means: send that back and stop. */
export function guard(request: Request, bucket: Bucket): Pass | Response {
  if (!sameOrigin(request)) return json(403, "Requests from other sites aren't allowed.");
  const client = clientIp(request.headers);
  const v = limiter().take(bucket, client);
  if (!v.ok) {
    const msg = v.reason === "concurrent" ? "You already have one of these running. Wait for it to finish." : `Too many requests. Try again in ${v.retryAfter} seconds.`;
    return json(429, msg, { "Retry-After": String(v.retryAfter ?? 60) });
  }
  let freed = false;
  return {
    client,
    done: () => {
      if (!freed) limiter().done(bucket, client);
      freed = true;
    },
  };
}

/** Body size caps per route, in bytes. */
export const MAX_BODY = {
  small: 16 * 1024,
  medium: 96 * 1024,
  replay: 160 * 1024,
  /** A re-encoded photo (≤1600 px JPEG) plus text: 7 MB of base64 at most. */
  image: 8 * 1024 * 1024,
} as const;
