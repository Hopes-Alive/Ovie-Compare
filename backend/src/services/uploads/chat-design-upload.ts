import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { extname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const UPLOADS_ROOT = resolve(__dirname, "../../../uploads/chat-design");

export const UPLOAD_KINDS = ["logo", "header-banner", "background", "background-expanded"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MIME_ALIASES: Record<string, string> = {
  "image/x-png": "image/png",
  "image/jpg": "image/jpeg",
};

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

export function isUploadKind(value: string): value is UploadKind {
  return (UPLOAD_KINDS as readonly string[]).includes(value);
}

function resolveFileMime(file: File): string | null {
  const fromType = MIME_ALIASES[file.type] ?? file.type;
  if (fromType && ALLOWED_MIME.has(fromType)) return fromType;

  const fromExt = EXT_TO_MIME[extname(file.name).toLowerCase()];
  if (fromExt && ALLOWED_MIME.has(fromExt)) return fromExt;

  return null;
}

export async function saveChatDesignImage(
  kind: UploadKind,
  file: File
): Promise<{ path: string; url: string }> {
  const mime = resolveFileMime(file);
  if (!mime) {
    throw new Error(
      `Unsupported file type: ${file.type || extname(file.name) || "unknown"}. Use PNG, JPG, WebP, GIF, or SVG.`
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File too large (max 5 MB)");
  }

  const ext = EXT_BY_MIME[mime] ?? extname(file.name).toLowerCase() ?? ".png";
  const dir = join(UPLOADS_ROOT, kind);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const absolutePath = join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const url = `/uploads/chat-design/${kind}/${filename}`;
  return { path: url, url };
}
