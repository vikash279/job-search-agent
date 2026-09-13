import { createReadStream } from "node:fs";
import { mkdir, writeFile, unlink, access, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

export interface StoredFile {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
}

function safeExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".pdf", ".docx"].includes(ext)) return ext;
  return "";
}

export function resolveStoragePath(key: string): string {
  if (!key || key.includes("\0") || key.split(/[/\\]/).some((part) => part === ".." || part === "")) {
    throw new ForbiddenError("Invalid file key");
  }
  const root = path.resolve(env.STORAGE_DIR);
  const dest = path.resolve(root, key);
  if (dest !== root && !dest.startsWith(root + path.sep)) {
    throw new ForbiddenError("Invalid file key");
  }
  return dest;
}

export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  ownerId?: string,
): Promise<StoredFile> {
  const owner = ownerId?.replace(/[^a-zA-Z0-9_-]/g, "") || "anon";
  const key = `${owner}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExt(originalName)}`;
  const dest = resolveStoragePath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return { key, originalName, mimeType, size: buffer.length };
}

export async function readFileStream(key: string) {
  const dest = resolveStoragePath(key);
  try {
    await access(dest);
  } catch {
    throw new NotFoundError("File not found");
  }
  return createReadStream(dest);
}

export async function readFileBuffer(key: string): Promise<Buffer> {
  const dest = resolveStoragePath(key);
  try {
    return await readFile(dest);
  } catch {
    throw new NotFoundError("File not found");
  }
}

export async function deleteFile(key: string): Promise<void> {
  const dest = resolveStoragePath(key);
  await unlink(dest).catch(() => undefined);
}

export function signedFilePath(key: string): string {
  return `/api/v1/files/${encodeURIComponent(key)}`;
}
