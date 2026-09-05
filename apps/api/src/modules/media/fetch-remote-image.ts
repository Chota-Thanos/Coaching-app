import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MEDIA_MAX_FILE_SIZE_BYTES } from "./storage.js";

/**
 * Downloads an image the caller identified by URL, for the "attach a picture to
 * this article" paths.
 *
 * This exists because the MCP image tools originally took a local `file_path`,
 * and `fileSource()` reads that path *in the MCP server process*. That is fine
 * for the stdio server running on someone's laptop; for the remote HTTP
 * deployment the process runs on the production box, so a hosted AI client had
 * no way to supply an image at all — the tools were exposed but unusable, which
 * from the client's side is indistinguishable from missing.
 *
 * Asking the server to fetch a caller-supplied URL is server-side request
 * forgery in miniature, so it is fenced in below. The endpoints that reach here
 * already require an admin or editor session, which means an attacker would
 * have to be staff before any of this matters — the checks are defence in
 * depth, not the only lock on the door.
 */

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Redirect hops to follow. Each one is re-checked; three is plenty for a CDN. */
const MAX_REDIRECTS = 3;

const FETCH_TIMEOUT_MS = 15_000;

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Ranges that must never be reachable through a user-supplied URL: loopback,
 * the RFC1918 private blocks, link-local (which on cloud hosts is where the
 * instance metadata service lives, and therefore where credentials live),
 * carrier-grade NAT, and the IPv6 equivalents.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);

  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local
    // IPv4-mapped addresses — unwrap and re-check, or the v4 rules above are
    // trivially bypassed. Two spellings have to be handled: the readable
    // "::ffff:127.0.0.1", and the hex form "::ffff:7f00:1" that the WHATWG URL
    // parser rewrites it into. A test caught the second one slipping through,
    // which is exactly the bypass this function exists to prevent.
    const dotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateAddress(dotted[1]!);

    const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1]!, 16);
      const low = parseInt(hex[2]!, 16);
      const quad = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
      return isPrivateAddress(quad);
    }

    return false;
  }

  return true;
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw httpError(400, "That image URL is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw httpError(400, "Image URLs must be http or https.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no lookup; a hostname does, and every address it
  // resolves to has to be public — a name with one public and one private
  // answer is still a way in.
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw httpError(400, "That image URL points at a private address.");
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw httpError(400, "That image URL's host could not be resolved.");
  }

  if (addresses.length === 0) throw httpError(400, "That image URL's host could not be resolved.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw httpError(400, "That image URL points at a private address.");
  }

  return url;
}

export type FetchedRemoteImage = {
  buffer: Buffer;
  mime_type: string;
  file_name: string;
};

export async function fetchRemoteImage(rawUrl: string): Promise<FetchedRemoteImage> {
  let target = await assertPublicUrl(rawUrl);
  let response: Response | undefined;

  // Redirects are followed by hand so each hop can be re-validated. `redirect:
  // "follow"` would let a public URL bounce to a private one without the checks
  // above ever seeing the second address.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "image/*" }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw httpError(400, "That image URL redirected without a destination.");
      target = await assertPublicUrl(new URL(location, target).toString());
      continue;
    }
    break;
  }

  if (!response) throw httpError(400, "That image could not be downloaded.");
  if (response.status >= 300 && response.status < 400) {
    throw httpError(400, "That image URL redirected too many times.");
  }
  if (!response.ok) {
    throw httpError(400, `That image could not be downloaded (status ${response.status}).`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw httpError(
      415,
      `That URL returned "${contentType || "an unknown type"}" rather than an image. Supported: JPG, PNG, WebP, GIF.`
    );
  }

  // Content-Length is a claim, not a guarantee, so it is checked as an early
  // exit and the real bytes are counted as they arrive.
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MEDIA_MAX_FILE_SIZE_BYTES) {
    throw httpError(413, "That image is too large.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) throw httpError(400, "That image URL returned an empty file.");
  if (buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) throw httpError(413, "That image is too large.");

  const fromPath = decodeURIComponent(target.pathname.split("/").pop() ?? "").trim();
  const file_name = fromPath || "downloaded-image";

  return { buffer, mime_type: contentType, file_name };
}
