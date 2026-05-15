import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const RESOURCES = new Set(["members", "songs", "news", "quotes", "yeongmin"]);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ resource: string; filename: string }> },
) {
  const { resource, filename } = await params;

  if (!RESOURCES.has(resource)) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Path-traversal guard. Filenames are uuid + ext, so reject anything
  // with separators, leading dot, or parent refs.
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..") || filename.startsWith(".")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploaded-assets", resource, filename);
  try {
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
