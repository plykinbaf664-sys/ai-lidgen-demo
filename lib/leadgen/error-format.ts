type ErrorRecord = Record<string, unknown>;

const sensitiveKeyPattern = /password|secret|token|authorization|api[_-]?key|credential/i;

export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string) {
  let cleaned = value;
  for (const name of [
    "AUTH_PASSWORD_HASH",
    "AUTH_SESSION_SECRET",
    "OPENAI_API_KEY",
    "TAVILY_API_KEY",
    "YANDEX_SEARCH_API_KEY",
    "SMTP_PASSWORD",
    "IMAP_PASSWORD",
    "OUTREACH_PROCESSOR_SECRET",
    "CRON_SECRET",
  ]) {
    const secret = process.env[name];
    if (secret && secret.length >= 6) cleaned = cleaned.split(secret).join("[redacted]");
  }
  return cleaned
    .replace(/\b(?:sk|sess|key)-[A-Za-z0-9_-]{12,}\b/g, "[redacted]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/(password|secret|token|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPublicError(
  error: unknown,
  fallback = "Не удалось выполнить операцию.",
) {
  return error instanceof PublicError ? error.message.slice(0, 500) : fallback;
}

function collect(value: unknown, depth: number, seen: Set<unknown>): string[] {
  if (value === null || value === undefined || depth > 3 || seen.has(value)) return [];
  if (typeof value === "string") return cleanText(value) ? [cleanText(value)] : [];
  if (["number", "boolean", "bigint"].includes(typeof value)) return [String(value)];
  if (value instanceof Error) {
    seen.add(value);
    return [cleanText(value.message), ...collect(value.cause, depth + 1, seen)].filter(Boolean);
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.flatMap((item) => collect(item, depth + 1, seen)).slice(0, 6);
  }
  if (!isRecord(value)) return [];
  seen.add(value);
  const preferred = ["message", "error", "details", "hint", "code", "reason"];
  const output: string[] = [];
  for (const key of preferred) {
    if (sensitiveKeyPattern.test(key) || !(key in value)) continue;
    const parts = collect(value[key], depth + 1, seen);
    for (const part of parts) {
      if (part && !output.includes(part)) output.push(part);
    }
  }
  return output.slice(0, 6);
}

export function formatUnknownError(
  error: unknown,
  fallback = "Не удалось выполнить операцию.",
) {
  const parts = collect(error, 0, new Set());
  const message = parts.join(" · ").trim();
  if (!message || message === "[object Object]") return fallback;
  if (
    /AbortError|TimeoutError|operation was aborted|request was aborted|signal timed out|timeout or manual cancellation/i.test(
      message,
    )
  ) {
    return "Запрос к хранилищу был прерван по таймауту. Проверьте состояние очереди и повторите действие.";
  }
  if (
    /ECONNRESET|ECONNREFUSED|EPIPE|UND_ERR_SOCKET|socket hang up|other side closed|terminated|fetch failed/i.test(
      message,
    )
  ) {
    return "Внешний сервис временно разорвал соединение. Запрос можно безопасно повторить.";
  }
  return message.slice(0, 800);
}
