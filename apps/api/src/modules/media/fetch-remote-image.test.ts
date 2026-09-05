import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPublicUrl, isPrivateAddress } from "./fetch-remote-image.js";

/**
 * The article-image endpoints now download a URL the caller supplied, which is
 * server-side request forgery unless it is fenced in. These cover the fence.
 *
 * Deliberately pure — no local HTTP server. A test server would have to listen
 * on loopback, which is precisely what the guard blocks, so proving anything
 * through one would mean weakening the guard for tests. The address policy is
 * where the security actually lives, so that is what is tested directly; the
 * download itself was verified end to end against a real public URL.
 */

test("loopback is private", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("127.99.1.2"), true);
  assert.equal(isPrivateAddress("::1"), true);
});

test("the RFC1918 blocks are private", () => {
  assert.equal(isPrivateAddress("10.0.0.1"), true);
  assert.equal(isPrivateAddress("192.168.1.1"), true);
  assert.equal(isPrivateAddress("172.16.0.1"), true);
  assert.equal(isPrivateAddress("172.31.255.255"), true);
  // 172.15 and 172.32 sit just outside the block and are public.
  assert.equal(isPrivateAddress("172.15.0.1"), false);
  assert.equal(isPrivateAddress("172.32.0.1"), false);
});

test("cloud instance metadata is unreachable", () => {
  // The single most valuable SSRF target on a cloud host: this address serves
  // instance credentials over plain HTTP with no authentication.
  assert.equal(isPrivateAddress("169.254.169.254"), true);
});

test("IPv6 link-local and unique-local are private", () => {
  assert.equal(isPrivateAddress("fe80::1"), true);
  assert.equal(isPrivateAddress("fd00::1"), true);
  assert.equal(isPrivateAddress("fc00::1"), true);
});

test("an IPv4-mapped IPv6 literal cannot smuggle a private address through", () => {
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateAddress("::ffff:10.0.0.1"), true);
  assert.equal(isPrivateAddress("::ffff:8.8.8.8"), false);
  // The hex spelling the WHATWG URL parser rewrites the above into. This form
  // bypassed the check until a test caught it.
  assert.equal(isPrivateAddress("::ffff:7f00:1"), true, "::ffff:7f00:1 is 127.0.0.1");
  assert.equal(isPrivateAddress("::ffff:a00:1"), true, "::ffff:a00:1 is 10.0.0.1");
  assert.equal(isPrivateAddress("::ffff:a9fe:a9fe"), true, "::ffff:a9fe:a9fe is 169.254.169.254");
  assert.equal(isPrivateAddress("::ffff:808:808"), false, "::ffff:808:808 is 8.8.8.8");
});

test("ordinary public addresses are allowed", () => {
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("1.1.1.1"), false);
  assert.equal(isPrivateAddress("2606:4700::1111"), false);
});

test("anything that is not an IP at all is treated as private", () => {
  // Fail closed: an unparseable value must never be assumed routable.
  assert.equal(isPrivateAddress("banana"), true);
  assert.equal(isPrivateAddress(""), true);
});

async function refuses(url: string, fragment: string): Promise<void> {
  await assert.rejects(
    () => assertPublicUrl(url),
    (error: Error) => {
      assert.match(error.message, new RegExp(fragment, "i"), `got: ${error.message}`);
      return true;
    },
    `expected ${url} to be refused`
  );
}

test("non-http schemes are refused", async () => {
  await refuses("file:///etc/passwd", "http or https");
  await refuses("ftp://example.com/x.png", "http or https");
  await refuses("gopher://example.com/x", "http or https");
});

test("a malformed URL is refused", async () => {
  await refuses("not a url at all", "not a valid URL");
});

test("literal private addresses are refused before any request is made", async () => {
  await refuses("http://127.0.0.1/x.png", "private address");
  await refuses("http://169.254.169.254/latest/meta-data/", "private address");
  await refuses("http://[::1]/x.png", "private address");
  await refuses("http://[::ffff:127.0.0.1]/x.png", "private address");
});

test("a hostname resolving to loopback is refused", async () => {
  // localhost is the everyday version of the attack: a public-looking name
  // whose DNS answer is 127.0.0.1.
  await refuses("http://localhost/x.png", "private address");
});
