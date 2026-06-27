import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MEDIA_MAX_FILE_SIZE_BYTES = Number(process.env.MEDIA_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);

export function getMediaUploadRoot(): string {
  const configured = process.env.MEDIA_UPLOAD_DIR?.trim();
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../uploads");
}

export function getMediaPublicPrefix(): string {
  const configured = process.env.MEDIA_PUBLIC_PATH?.trim() || "/uploads";
  const withLeadingSlash = configured.startsWith("/") ? configured : `/${configured}`;
  return withLeadingSlash.replace(/\/+$/g, "");
}

export function getMediaStaticPrefix(): string {
  return `${getMediaPublicPrefix()}/`;
}

export function buildMediaUrl(relativePath: string): string {
  return `${getMediaPublicPrefix()}/${relativePath.replace(/\\/g, "/").replace(/^\/+/g, "")}`;
}
