import { isIP } from "node:net";

function normalizedIp(value) {
  if (!value) return null;
  let candidate = value.trim();
  if (candidate.startsWith("[") && candidate.includes("]")) candidate = candidate.slice(1, candidate.indexOf("]"));
  if (candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4) candidate = candidate.slice(7);
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

export function getRateLimitClientAddress(request) {
  const realIp = normalizedIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((part) => normalizedIp(part))
    .filter(Boolean)
    .at(-1);
  return forwarded || "local";
}
