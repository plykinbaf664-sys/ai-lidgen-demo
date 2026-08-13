import "server-only";

import path from "node:path";
import { promisify } from "node:util";
import { inflate, inflateRaw } from "node:zlib";
import { PublicError } from "@/lib/leadgen/error-format";
import { getIcpUploadLimit } from "@/lib/security/api-access";

const inflateRawAsync = promisify(inflateRaw);
const inflateAsync = promisify(inflate);
const MAX_EXTRACTED_BYTES = 5_000_000;
const MAX_TEXT_CHARS = 50_000;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type IcpDocumentKind = "pdf" | "docx" | "txt";
export type IcpDocumentInput = { name: string; mimeType: string; bytes: Buffer };
export type ExtractedIcpDocument = { kind: IcpDocumentKind; text: string; truncated: boolean };

function fail(message: string, status = 400): never {
  throw new PublicError(message, status);
}

function cleanText(value: string) {
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const seen = new Set<string>();
  return normalized.split("\n").filter((line) => {
    const key = line.trim().toLocaleLowerCase("ru");
    if (key.length < 40) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function boundedContext(value: string) {
  if (value.length <= MAX_TEXT_CHARS) return value;
  const half = Math.floor((MAX_TEXT_CHARS - 160) / 2);
  return `${value.slice(0, half)}\n\n[Середина очень большого документа опущена для безопасного лимита контекста]\n\n${value.slice(-half)}`;
}

function finalize(kind: IcpDocumentKind, value: string): ExtractedIcpDocument {
  const normalized = cleanText(value);
  if (normalized.length < 20) fail("В документе не найдено достаточно текста.");
  return {
    kind,
    text: boundedContext(normalized),
    truncated: normalized.length > MAX_TEXT_CHARS,
  };
}

function validateMetadata(input: IcpDocumentInput) {
  if (!input.name || input.name.length > 128 || input.name.includes("\0") || /[\\/]/.test(input.name)) {
    fail("Некорректное имя файла.");
  }
  if (path.basename(input.name) !== input.name) fail("Путь в имени файла запрещён.");
  if (input.bytes.length === 0) fail("Файл пуст.");
  if (input.bytes.length > getIcpUploadLimit()) fail("Файл превышает допустимый размер.", 413);
  const extension = path.extname(input.name).toLowerCase();
  if (![".pdf", ".docx", ".txt"].includes(extension)) fail("Разрешены только PDF, DOCX и TXT.");
  const expectedMime = extension === ".pdf" ? "application/pdf" : extension === ".docx" ? DOCX_MIME : "text/plain";
  if (input.mimeType.toLowerCase() !== expectedMime) fail("MIME type не соответствует расширению файла.");
  return extension as ".pdf" | ".docx" | ".txt";
}

function extractTxt(bytes: Buffer) {
  if (bytes.includes(0) || bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || bytes.subarray(0, 2).toString("ascii") === "MZ") {
    fail("TXT содержит бинарные или исполняемые данные.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    fail("TXT должен быть в кодировке UTF-8.");
  }
  const prefix = text.slice(0, 1_024).trimStart().toLowerCase();
  if (/^(?:<!doctype\s+html|<html\b|<script\b|javascript:)/.test(prefix)) {
    fail("HTML или JavaScript под видом TXT запрещён.");
  }
  return text;
}

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

function findEocd(bytes: Buffer) {
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntries(bytes: Buffer) {
  const eocd = findEocd(bytes);
  if (eocd < 0) fail("DOCX повреждён: ZIP directory не найден.");
  const count = bytes.readUInt16LE(eocd + 10);
  const directorySize = bytes.readUInt32LE(eocd + 12);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  if (count < 1 || count > 200 || directorySize > MAX_EXTRACTED_BYTES || directoryOffset + directorySize > bytes.length) {
    fail("DOCX имеет небезопасную ZIP-структуру.");
  }
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  let totalExpanded = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) fail("DOCX ZIP directory повреждён.");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length || flags & 0x1 || (method !== 0 && method !== 8)) fail("DOCX содержит неподдерживаемую ZIP-запись.");
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (!name || name.includes("\0") || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split(/[\\/]/).includes("..")) {
      fail("DOCX содержит небезопасный путь.");
    }
    if (uncompressedSize > MAX_EXTRACTED_BYTES || compressedSize > getIcpUploadLimit() || (compressedSize > 0 && uncompressedSize / compressedSize > 100)) {
      fail("DOCX превышает безопасный лимит распаковки.");
    }
    totalExpanded += uncompressedSize;
    if (totalExpanded > MAX_EXTRACTED_BYTES) fail("DOCX превышает общий лимит распаковки.");
    entries.push({ name, method, flags, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }
  return entries;
}

async function readZipEntry(bytes: Buffer, entry: ZipEntry) {
  const offset = entry.localOffset;
  if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) fail("DOCX local ZIP header повреждён.");
  const nameLength = bytes.readUInt16LE(offset + 26);
  const extraLength = bytes.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.length) fail("DOCX ZIP entry обрезан.");
  const compressed = bytes.subarray(start, end);
  const output = entry.method === 8
    ? await inflateRawAsync(compressed, { maxOutputLength: Math.min(MAX_EXTRACTED_BYTES, entry.uncompressedSize + 1) })
    : compressed;
  if (output.length !== entry.uncompressedSize || output.length > MAX_EXTRACTED_BYTES) fail("DOCX ZIP entry имеет неверный размер.");
  return output;
}

function decodeXml(value: string) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function textFromWordXml(xml: string) {
  return decodeXml(xml
    .replace(/<w:tab\b[^>]*\/?\s*>/gi, "\t")
    .replace(/<w:br\b[^>]*\/?\s*>/gi, "\n")
    .replace(/<\/w:p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

async function extractDocx(bytes: Buffer) {
  if (bytes.length < 4) fail("DOCX повреждён.");
  if (bytes.readUInt32LE(0) !== 0x04034b50) fail("DOCX signature не подтверждена.");
  const entries = readZipEntries(bytes);
  const types = entries.find((entry) => entry.name === "[Content_Types].xml");
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!types || !document) fail("Файл не является корректным DOCX.");
  const contentTypes = (await readZipEntry(bytes, types)).toString("utf8");
  if (!contentTypes.includes("wordprocessingml.document.main+xml")) fail("DOCX content type не подтверждён.");
  const selected = entries.filter((entry) => /^word\/(?:document|header\d*|footer\d*)\.xml$/i.test(entry.name));
  const parts: string[] = [];
  for (const entry of selected) parts.push(textFromWordXml((await readZipEntry(bytes, entry)).toString("utf8")));
  return parts.join("\n");
}

function decodePdfLiteral(raw: string) {
  const bytes: number[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    let code = raw.charCodeAt(index) & 255;
    if (code === 0x5c) {
      index += 1;
      if (index >= raw.length) break;
      const escaped = raw[index];
      const map: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
      if (escaped in map) code = map[escaped];
      else if (/[0-7]/.test(escaped)) {
        const octal = raw.slice(index).match(/^[0-7]{1,3}/)?.[0] ?? escaped;
        code = Number.parseInt(octal, 8);
        index += octal.length - 1;
      } else if (escaped === "\r" || escaped === "\n") {
        if (escaped === "\r" && raw[index + 1] === "\n") index += 1;
        continue;
      }
    }
    bytes.push(code);
  }
  const buffer = Buffer.from(bytes);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(Math.max(0, buffer.length - 2));
    for (let index = 2; index + 1 < buffer.length; index += 2) {
      swapped[index - 2] = buffer[index + 1];
      swapped[index - 1] = buffer[index];
    }
    return swapped.toString("utf16le");
  }
  return new TextDecoder("windows-1252").decode(buffer);
}

function pdfTextOperators(content: Buffer) {
  const source = content.toString("latin1");
  const values: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "(") {
      let depth = 1;
      let escaped = false;
      let end = index + 1;
      for (; end < source.length && depth > 0; end += 1) {
        const char = source[end];
        if (escaped) { escaped = false; continue; }
        if (char === "\\") { escaped = true; continue; }
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
      }
      if (depth === 0) {
        const after = source.slice(end, end + 24);
        if (/^\s*(?:Tj|TJ|'|")/.test(after) || /\]\s*TJ/.test(after)) values.push(decodePdfLiteral(source.slice(index + 1, end - 1)));
        index = end - 1;
      }
    }
  }
  for (const match of source.matchAll(/<([0-9a-f\s]{4,})>\s*Tj/gi)) {
    const hex = match[1].replace(/\s/g, "");
    if (hex.length % 2 === 0) values.push(decodePdfLiteral(Buffer.from(hex, "hex").toString("latin1")));
  }
  return values.join(" ");
}

async function extractPdf(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") fail("PDF signature не подтверждена.");
  const source = bytes.toString("latin1");
  if (/\/Encrypt\b/.test(source)) fail("Зашифрованные PDF не поддерживаются.");
  const parts = [pdfTextOperators(bytes)];
  let cursor = 0;
  while (parts.join(" ").length < MAX_TEXT_CHARS && cursor < source.length) {
    const marker = source.indexOf("stream", cursor);
    if (marker < 0) break;
    const dictionary = source.slice(Math.max(0, marker - 2_048), marker);
    let start = marker + 6;
    if (source.slice(start, start + 2) === "\r\n") start += 2;
    else if (source[start] === "\n" || source[start] === "\r") start += 1;
    const end = source.indexOf("endstream", start);
    if (end < 0) break;
    const raw = bytes.subarray(start, end).subarray(0, 1_000_000);
    try {
      const decoded = /\/FlateDecode\b/.test(dictionary)
        ? await inflateAsync(raw, { maxOutputLength: MAX_EXTRACTED_BYTES })
        : raw;
      if (decoded.length <= MAX_EXTRACTED_BYTES) parts.push(pdfTextOperators(decoded));
    } catch { /* malformed streams are ignored; final text gate remains strict */ }
    cursor = end + 9;
  }
  return parts.join("\n");
}

export async function extractIcpDocument(input: IcpDocumentInput): Promise<ExtractedIcpDocument> {
  const extension = validateMetadata(input);
  if (extension === ".txt") return finalize("txt", extractTxt(input.bytes));
  if (extension === ".docx") return finalize("docx", await extractDocx(input.bytes));
  return finalize("pdf", await extractPdf(input.bytes));
}
