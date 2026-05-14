"use server";
import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readSession } from "./auth";

const MAX_BYTES = 8 * 1024 * 1024;
const RESOURCES = ["members", "songs", "news", "quotes", "youngmin"] as const;
type Resource = (typeof RESOURCES)[number];

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) return "image/png";
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
  ) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export async function uploadImage(
  formData: FormData,
  resource: Resource,
): Promise<UploadResult> {
  const session = await readSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (!RESOURCES.includes(resource)) {
    return { ok: false, error: "Invalid resource" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file" };
  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > MAX_BYTES) return { ok: false, error: "File too large (max 8MB)" };

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectMimeFromMagic(buf);
  if (!detected) return { ok: false, error: "Unsupported image format" };

  const ext = MIME_EXT[detected];
  const filename = `${randomUUID()}${ext}`;
  // Stored outside public/ because Next 16 + Turbopack only serves
  // public/ files known at build time. Served via the dynamic route
  // handler at src/app/uploads/[resource]/[filename]/route.ts.
  const dir = path.join(process.cwd(), "uploaded-assets", resource);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buf);
  } catch {
    return { ok: false, error: "Failed to save file" };
  }

  return { ok: true, path: `/uploads/${resource}/${filename}` };
}
