#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import process from "node:process";

// Test infrastructure only. Real production cookies must be tested over TLS,
// not relaxed to make a browser accept secure cookies on an HTTP test origin.
assert(process.env.MESH_BROWSER_FIXTURE === "local-seed", "Local fixture acknowledgement required");
assert(process.env.DATABASE_URL?.startsWith("file:") && !process.env.DATABASE_AUTH_TOKEN && !process.env.VERCEL, "Hosted environments are forbidden");
assert(process.env.NEXT_PUBLIC_APP_URL === "https://127.0.0.1:3443", "Unexpected browser test origin");
assert(process.env.BROWSER_TEST_CERT && process.env.BROWSER_TEST_KEY, "Ephemeral test certificate paths required");

const server = https.createServer({
  cert: readFileSync(process.env.BROWSER_TEST_CERT),
  key: readFileSync(process.env.BROWSER_TEST_KEY),
}, (request, response) => {
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: 3000,
    path: request.url,
    method: request.method,
    headers: {
      ...request.headers,
      host: "127.0.0.1:3443",
      "x-forwarded-host": "127.0.0.1:3443",
      "x-forwarded-proto": "https",
      "x-forwarded-for": "127.0.0.1",
    },
  }, (incoming) => {
    response.writeHead(incoming.statusCode || 502, incoming.headers);
    incoming.pipe(response);
    incoming.on("error", () => response.destroy());
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "Content-Type": "text/plain" });
    response.end("Local test server unavailable");
  });
  request.on("aborted", () => upstream.destroy());
  response.on("close", () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(3443, "127.0.0.1", () => console.log("Isolated browser TLS proxy ready"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
