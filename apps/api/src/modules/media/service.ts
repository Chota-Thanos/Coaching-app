import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { one, query } from "../../db.js";
import type { ListMediaAssetsQuery } from "./schemas.js";
import { buildMediaUrl, getMediaUploadRoot, MEDIA_MAX_FILE_SIZE_BYTES } from "./storage.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

const EXTENSION_BY_MIME = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["application/pdf", ".pdf"]
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);

export type MediaAsset = {
  id: number;
  original_file_name: string;
  file_name: string;
  file_url: string;
  storage_disk: "local";
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  usage_scope: string | null;
  alt_text: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  uploaded_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

type UploadMetadata = {
  usage_scope?: string;
  alt_text?: string;
  caption?: string;
};

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function normalizeOptionalText(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeFileName(fileName: string): string {
  const safeName = basename(fileName || "upload")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return safeName || "upload";
}

function buildStoredFileName(originalFileName: string, mimeType: string): string {
  const originalExtension = extname(originalFileName).toLowerCase();
  const extension = ALLOWED_EXTENSIONS.has(originalExtension)
    ? originalExtension
    : EXTENSION_BY_MIME.get(mimeType) ?? "";
  const baseName = sanitizeFileName(originalFileName.replace(/\.[^.]+$/g, "") || "upload");

  return `${randomUUID()}-${baseName}${extension}`;
}

function utcUploadDirectory(date: Date): string {
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function assertAllowedUpload(file: MultipartFile): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw httpError(415, "Unsupported file type. Upload JPG, PNG, WebP, GIF, or PDF files.");
  }
}

async function removeLocalFile(storagePath: string): Promise<void> {
  const uploadRoot = resolve(getMediaUploadRoot());
  const targetPath = resolve(uploadRoot, storagePath);
  if (targetPath === uploadRoot || !targetPath.startsWith(`${uploadRoot}${sep}`)) return;

  try {
    await unlink(targetPath);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function saveUploadedMedia(
  file: MultipartFile,
  uploadedByUserId: number,
  metadata: UploadMetadata = {}
): Promise<MediaAsset> {
  assertAllowedUpload(file);

  const originalFileName = sanitizeFileName(file.filename || "upload");
  const fileName = buildStoredFileName(originalFileName, file.mimetype);
  const relativeDirectory = utcUploadDirectory(new Date());
  const uploadRoot = getMediaUploadRoot();
  const absoluteDirectory = join(uploadRoot, relativeDirectory);
  const storagePath = `${relativeDirectory}/${fileName}`;
  const absolutePath = join(absoluteDirectory, fileName);
  let sizeBytes = 0;

  await mkdir(absoluteDirectory, { recursive: true });

  const byteCounter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
        callback(httpError(413, "File is too large."));
        return;
      }
      callback(null, chunk);
    }
  });

  try {
    await pipeline(file.file, byteCounter, createWriteStream(absolutePath, { flags: "wx" }));
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  if (file.file.truncated) {
    await unlink(absolutePath).catch(() => undefined);
    throw httpError(413, "File is too large.");
  }

  const insertParams = [
    originalFileName,
    fileName,
    buildMediaUrl(storagePath),
    storagePath,
    file.mimetype,
    sizeBytes,
    normalizeOptionalText(metadata.usage_scope),
    normalizeOptionalText(metadata.alt_text),
    normalizeOptionalText(metadata.caption),
    { field_name: file.fieldname, encoding: file.encoding },
    uploadedByUserId
  ];

  try {
    const asset = await one<MediaAsset>(
      `
        insert into media.assets (
          original_file_name,
          file_name,
          file_url,
          storage_path,
          mime_type,
          size_bytes,
          usage_scope,
          alt_text,
          caption,
          metadata,
          uploaded_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
        returning
          id,
          original_file_name,
          file_name,
          file_url,
          storage_disk,
          storage_path,
          mime_type,
          size_bytes,
          usage_scope,
          alt_text,
          caption,
          metadata,
          uploaded_by_user_id,
          created_at,
          updated_at
      `,
      insertParams
    );

    if (!asset) throw new Error("Failed to create media asset.");
    return asset;
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function listMediaAssets(options: ListMediaAssetsQuery): Promise<MediaAsset[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.usage_scope) {
    params.push(options.usage_scope);
    conditions.push(`usage_scope = $${params.length}`);
  }

  if (options.mime_family === "image") {
    conditions.push("mime_type like 'image/%'");
  } else if (options.mime_family === "document") {
    conditions.push("mime_type not like 'image/%'");
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  return query<MediaAsset>(
    `
      select
        id,
        original_file_name,
        file_name,
        file_url,
        storage_disk,
        storage_path,
        mime_type,
        size_bytes,
        usage_scope,
        alt_text,
        caption,
        metadata,
        uploaded_by_user_id,
        created_at,
        updated_at
      from media.assets
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by created_at desc, id desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );
}

export async function deleteMediaAsset(id: number): Promise<boolean> {
  const asset = await one<Pick<MediaAsset, "storage_path" | "storage_disk">>(
    "select storage_path, storage_disk from media.assets where id = $1",
    [id]
  );
  if (!asset) return false;

  await query("delete from media.assets where id = $1", [id]);
  if (asset.storage_disk === "local") {
    await removeLocalFile(asset.storage_path);
  }
  return true;
}
