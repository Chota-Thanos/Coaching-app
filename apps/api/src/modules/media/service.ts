import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
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

/**
 * Longest edge an uploaded picture is kept at. Article images are displayed at
 * roughly 800 CSS pixels at most, so 1600 still covers a 2x retina screen with
 * room to spare — anything beyond that is bytes nobody ever sees. Phone
 * cameras routinely produce 4000px+ images, which is where the savings come
 * from.
 */
const IMAGE_MAX_EDGE_PX = 1600;

/** WebP quality. 82 is visually indistinguishable from source for photographs. */
const IMAGE_WEBP_QUALITY = 82;

export type CompressedImage = {
  buffer: Buffer;
  mime_type: string;
  original_bytes: number;
  compressed_bytes: number;
};

/**
 * Shrinks an uploaded picture before it is ever written to disk.
 *
 * Every image upload in the app funnels through here, so a 6MB phone photo
 * becomes a ~150KB WebP whether it arrived from the editor's Image button, the
 * posting agent, or an inline body insert. Three things happen: the longest
 * edge is capped at IMAGE_MAX_EDGE_PX (never upscaled), the result is re-encoded
 * as WebP, and EXIF is dropped — sharp discards metadata unless asked to keep
 * it, which also removes the GPS coordinates phone cameras embed.
 *
 * Two deliberate pass-throughs:
 *  - Animated GIFs. Re-encoding one to a still WebP would silently destroy the
 *    animation, and a wrong picture is worse than a large one.
 *  - Anything sharp cannot decode. A file we cannot parse is stored exactly as
 *    it arrived rather than rejected, so a format sharp does not know about
 *    never becomes a failed upload.
 */
export async function compressImageBuffer(buffer: Buffer, mimeType: string): Promise<CompressedImage> {
  const unchanged: CompressedImage = {
    buffer,
    mime_type: mimeType,
    original_bytes: buffer.byteLength,
    compressed_bytes: buffer.byteLength
  };

  if (!mimeType.startsWith("image/")) return unchanged;

  try {
    const image = sharp(buffer, { animated: mimeType === "image/gif" });
    const metadata = await image.metadata();

    // `pages` > 1 means an animated GIF.
    if (mimeType === "image/gif" && (metadata.pages ?? 1) > 1) return unchanged;

    const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    const pipelineForImage =
      longestEdge > IMAGE_MAX_EDGE_PX
        ? image.resize({ width: IMAGE_MAX_EDGE_PX, height: IMAGE_MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
        : image;

    const output = await pipelineForImage.webp({ quality: IMAGE_WEBP_QUALITY }).toBuffer();

    // A small, already-optimised PNG can come out of WebP larger than it went
    // in. Keep whichever is smaller — compression that inflates is not
    // compression.
    if (output.byteLength >= buffer.byteLength) return unchanged;

    return {
      buffer: output,
      mime_type: "image/webp",
      original_bytes: buffer.byteLength,
      compressed_bytes: output.byteLength
    };
  } catch {
    return unchanged;
  }
}

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
  // The mime wins when we know it. Compression re-encodes to WebP, and keeping
  // the source's ".jpg" on those bytes would leave the extension lying about
  // the file — browsers cope, but anything reading the name would not.
  const mimeExtension = EXTENSION_BY_MIME.get(mimeType);
  const extension = mimeExtension ?? (ALLOWED_EXTENSIONS.has(originalExtension) ? originalExtension : "");
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
  const relativeDirectory = utcUploadDirectory(new Date());
  const uploadRoot = getMediaUploadRoot();
  const absoluteDirectory = join(uploadRoot, relativeDirectory);

  await mkdir(absoluteDirectory, { recursive: true });

  /*
   * Images are buffered rather than streamed straight to disk, because they are
   * compressed before being written and that needs the whole picture in hand.
   * The MEDIA_MAX_FILE_SIZE_BYTES ceiling is enforced while reading, so a
   * hostile upload still cannot grow the buffer without bound — it is refused
   * at the same threshold the streaming path used.
   *
   * PDFs keep streaming: there is nothing to compress, and a large document
   * should not have to fit in memory.
   */
  const isImage = file.mimetype.startsWith("image/");

  let storedMimeType = file.mimetype;
  let fileName: string;
  let storagePath: string;
  let absolutePath: string;
  let sizeBytes = 0;

  if (isImage) {
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      sizeBytes += (chunk as Buffer).length;
      if (sizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) throw httpError(413, "File is too large.");
      chunks.push(chunk as Buffer);
    }
    if (file.file.truncated) throw httpError(413, "File is too large.");

    const compressed = await compressImageBuffer(Buffer.concat(chunks), file.mimetype);
    storedMimeType = compressed.mime_type;
    sizeBytes = compressed.compressed_bytes;

    fileName = buildStoredFileName(originalFileName, storedMimeType);
    storagePath = `${relativeDirectory}/${fileName}`;
    absolutePath = join(absoluteDirectory, fileName);

    try {
      await writeFile(absolutePath, compressed.buffer, { flag: "wx" });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  } else {
    fileName = buildStoredFileName(originalFileName, file.mimetype);
    storagePath = `${relativeDirectory}/${fileName}`;
    absolutePath = join(absoluteDirectory, fileName);

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
  }

  const insertParams = [
    originalFileName,
    fileName,
    buildMediaUrl(storagePath),
    storagePath,
    storedMimeType,
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

export type SavedImageBuffer = {
  file_url: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Disk-write counterpart to `saveUploadedMedia` for bytes that didn't arrive
 * as a multipart upload (e.g. an image the posting agent produced locally).
 * Writes to the same `/uploads/yyyy/mm/...` layout but does not touch
 * `media.assets` — the caller links the result into whatever table it needs.
 */
export async function saveImageBuffer(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string
): Promise<SavedImageBuffer> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw httpError(415, "Unsupported image type. Upload JPG, PNG, WebP, or GIF.");
  }
  if (buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) {
    throw httpError(413, "File is too large.");
  }

  const compressed = await compressImageBuffer(buffer, mimeType);

  const sanitizedOriginalName = sanitizeFileName(originalFileName || "upload");
  // Named from the *compressed* mime, so a JPEG that came out as WebP is stored
  // as .webp rather than a .jpg that is not one.
  const fileName = buildStoredFileName(sanitizedOriginalName, compressed.mime_type);
  const relativeDirectory = utcUploadDirectory(new Date());
  const uploadRoot = getMediaUploadRoot();
  const absoluteDirectory = join(uploadRoot, relativeDirectory);
  const storagePath = `${relativeDirectory}/${fileName}`;
  const absolutePath = join(absoluteDirectory, fileName);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, compressed.buffer);

  return {
    file_url: buildMediaUrl(storagePath),
    storage_path: storagePath,
    file_name: sanitizedOriginalName,
    mime_type: compressed.mime_type,
    size_bytes: compressed.compressed_bytes
  };
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
