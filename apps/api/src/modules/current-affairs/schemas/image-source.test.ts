import assert from "node:assert/strict";
import { test } from "node:test";
import { attachImageBytesSchema, insertBodyImageSchema } from "./posting-agent.schemas.js";

/**
 * The image endpoints accept a picture as raw bytes OR as a URL for the server
 * to download, and exactly one of those must be present.
 *
 * This file exists because the end-to-end check for the URL path called the
 * service function directly and so never ran the schema at all — which is
 * precisely where a "javascript:alert(1)" URL was found sailing through
 * zod's .url(), since that accepts any scheme it can parse.
 */

const schemas: Array<[string, typeof insertBodyImageSchema | typeof attachImageBytesSchema]> = [
  ["insertBodyImage", insertBodyImageSchema],
  ["attachImage", attachImageBytesSchema]
];

const accepted: Array<[string, Record<string, unknown>]> = [
  ["a URL on its own — what a remote client sends", { article_id: 1, source_url: "https://example.com/a.png" }],
  [
    "bytes on their own — what a local agent sends",
    { article_id: 1, base64_data: "AAAA", file_name: "a.png", mime_type: "image/png" }
  ]
];

const refused: Array<[string, Record<string, unknown>]> = [
  [
    "both sources at once",
    { article_id: 1, source_url: "https://example.com/a.png", base64_data: "AAAA", file_name: "a.png", mime_type: "image/png" }
  ],
  ["no source at all", { article_id: 1 }],
  ["bytes missing mime_type", { article_id: 1, base64_data: "AAAA", file_name: "a.png" }],
  ["bytes missing file_name", { article_id: 1, base64_data: "AAAA", mime_type: "image/png" }],
  ["a javascript: URL", { article_id: 1, source_url: "javascript:alert(1)" }],
  ["a file: URL", { article_id: 1, source_url: "file:///etc/passwd" }],
  ["a data: URL", { article_id: 1, source_url: "data:image/png;base64,iVBORw0KGgo=" }],
  ["not a URL at all", { article_id: 1, source_url: "just some text" }]
];

for (const [schemaName, schema] of schemas) {
  for (const [label, input] of accepted) {
    test(`${schemaName}: accepts ${label}`, () => {
      const result = schema.safeParse(input);
      assert.equal(result.success, true, `expected acceptance, got: ${JSON.stringify(result.error?.issues)}`);
    });
  }

  for (const [label, input] of refused) {
    test(`${schemaName}: refuses ${label}`, () => {
      assert.equal(schema.safeParse(input).success, false, "expected this to be refused");
    });
  }
}
