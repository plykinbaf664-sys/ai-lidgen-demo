import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { promisify } from "node:util";
import { brotliDecompress, gunzip, inflate } from "node:zlib";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);
const brotliAsync = promisify(brotliDecompress);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export class UnsafeUrlError extends Error {
  constructor(message = "URL is not allowed") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4Parts(address: string) {
  if (isIP(address) !== 4) return null;
  const values = address.split(".").map(Number);
  return values.length === 4 && values.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? values
    : null;
}

export function isPrivateOrReservedIp(input: string) {
  const address = input.toLowerCase().split("%")[0].replace(/^\[|\]$/g, "");
  const v4 = ipv4Parts(address);
  if (v4) {
    const [a, b, c] = v4;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) !== 6) return true;
  if (address === "::" || address === "::1") return true;
  if (/^(?:fc|fd|fe[89ab]|ff)/i.test(address)) return true;
  if (/^(?:2001:db8|2001:0:|2001:2:|2001:10:|64:ff9b:)/i.test(address)) return true;
  if (address.startsWith("::ffff:")) {
    const tail = address.slice(7);
    const dotted = ipv4Parts(tail);
    if (dotted) return isPrivateOrReservedIp(tail);
    const pair = tail.split(":");
    if (pair.length === 2) {
      const high = Number.parseInt(pair[0], 16);
      const low = Number.parseInt(pair[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isPrivateOrReservedIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
      }
    }
    return true;
  }
  if (address.startsWith("::")) return true;
  return false;
}

async function resolvePublicAddresses(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    throw new UnsafeUrlError("Local hostnames are blocked");
  }
  if (isIP(normalized)) {
    if (isPrivateOrReservedIp(normalized)) throw new UnsafeUrlError("Private or reserved IP is blocked");
    return [{ address: normalized, family: isIP(normalized) as 4 | 6 }];
  }
  const addresses = await lookup(normalized, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
    throw new UnsafeUrlError("Hostname resolves to a private or reserved IP");
  }
  return addresses;
}

function validateUrl(value: string | URL) {
  const url = value instanceof URL ? new URL(value) : new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only HTTP and HTTPS are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("URL credentials are blocked");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new UnsafeUrlError("Non-standard ports are blocked");
  return url;
}

function headersFrom(input?: HeadersInit) {
  const headers = new Headers(input);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("proxy-authorization");
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return Object.fromEntries(headers.entries());
}

async function decompress(body: Buffer, encoding: string | undefined, maxBytes: number) {
  let output = body;
  if (encoding === "gzip") output = await gunzipAsync(body, { maxOutputLength: maxBytes });
  else if (encoding === "deflate") output = await inflateAsync(body, { maxOutputLength: maxBytes });
  else if (encoding === "br") output = await brotliAsync(body, { maxOutputLength: maxBytes });
  if (output.length > maxBytes) throw new Error("Response exceeds the allowed size");
  return output;
}

async function requestOnce(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
  maxResponseBytes: number,
) {
  const addresses = await resolvePublicAddresses(url.hostname);
  const selected = addresses[0];
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") throw new UnsafeUrlError("Crawler only permits GET and HEAD");

  return new Promise<{ response: Response; location: string | null }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method,
      headers: headersFrom(init.headers),
      servername: url.hostname.replace(/^\[|\]$/g, ""),
      lookup: ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
        if (options?.all) callback(null, addresses);
        else callback(null, selected.address, selected.family);
      }) as never,
    }, (incoming) => {
      const chunks: Buffer[] = [];
      let received = 0;
      incoming.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > maxResponseBytes) {
          incoming.destroy(new Error("Response exceeds the allowed size"));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on("error", reject);
      incoming.on("end", async () => {
        try {
          const raw = Buffer.concat(chunks);
          const body = method === "HEAD"
            ? Buffer.alloc(0)
            : await decompress(raw, incoming.headers["content-encoding"], maxResponseBytes);
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) responseHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          responseHeaders.delete("content-encoding");
          responseHeaders.set("content-length", String(body.length));
          const response = new Response(new Uint8Array(body), {
            status: incoming.statusCode ?? 502,
            statusText: incoming.statusMessage,
            headers: responseHeaders,
          });
          Object.defineProperty(response, "url", { value: url.toString() });
          resolve({ response, location: incoming.headers.location ?? null });
        } catch (error) {
          reject(error);
        }
      });
    });
    const abort = () => request.destroy(init.signal?.reason instanceof Error ? init.signal.reason : new Error("Request aborted"));
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener("abort", abort, { once: true });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Request timed out")));
    request.on("error", reject);
    request.on("close", () => init.signal?.removeEventListener("abort", abort));
    request.end();
  });
}

export async function safePublicFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxResponseBytes?: number; maxRedirects?: number } = {},
) {
  const timeoutMs = Math.min(30_000, Math.max(500, options.timeoutMs ?? 8_000));
  const maxResponseBytes = Math.min(5_000_000, Math.max(16_384, options.maxResponseBytes ?? 1_000_000));
  const maxRedirects = Math.min(5, Math.max(0, options.maxRedirects ?? 3));
  let url = validateUrl(input);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const { response, location } = await requestOnce(url, { ...init, redirect: "manual" }, timeoutMs, maxResponseBytes);
    if (!REDIRECTS.has(response.status) || !location) return response;
    if (redirect === maxRedirects) throw new UnsafeUrlError("Too many redirects");
    url = validateUrl(new URL(location, url));
  }
  throw new UnsafeUrlError("Redirect validation failed");
}
