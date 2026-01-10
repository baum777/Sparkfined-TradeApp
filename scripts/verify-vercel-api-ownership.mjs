import fs from "node:fs";
import path from "node:path";

/**
 * CI guardrail:
 * Production /api/* must be handled exclusively by the Node backend.
 *
 * This script fails if vercel routing introduces any /api/* rewrite that
 * resolves to Vercel serverless handlers (relative /api/* destinations) or
 * any destination other than the configured backend rewrite target.
 */

const repoRoot = process.cwd();
const vercelPath = path.join(repoRoot, "vercel.json");

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`❌ ${message}`);
  process.exit(1);
}

function warn(message) {
  // eslint-disable-next-line no-console
  console.warn(`⚠️ ${message}`);
}

function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.parse(text);
  } catch (e) {
    fail(`Unable to read/parse ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function isApiSource(source) {
  return typeof source === "string" && (source === "/api" || source.startsWith("/api/"));
}

function isRelativeApiDestination(destination) {
  return typeof destination === "string" && (destination === "/api" || destination.startsWith("/api/"));
}

// Canonical production routing target (single source of truth).
const CANONICAL_BACKEND_DESTINATION_PREFIX = "https://{env:VERCEL_BACKEND_URL}/api/";

const config = readJson(vercelPath);

// Vercel config shapes we care about.
const rewrites = Array.isArray(config?.rewrites) ? config.rewrites : [];
const routes = Array.isArray(config?.routes) ? config.routes : [];

// This project must not use routes for /api either (keep routing unambiguous).
if (routes.length) {
  const apiRoutes = routes.filter((r) => isApiSource(r?.src) || isApiSource(r?.source));
  if (apiRoutes.length) {
    fail(
      `vercel.json contains routes for /api/* (not allowed). Move all /api/* handling to the Node backend rewrite.\n` +
        `Found: ${JSON.stringify(apiRoutes, null, 2)}`
    );
  }
}

// Enforce: all /api/* rewrites must point to the Node backend.
const apiRewrites = rewrites.filter((r) => isApiSource(r?.source));

if (!apiRewrites.length) {
  warn("No /api/* rewrites found. If this is intentional, ensure production still routes /api/* to the Node backend.");
  process.exit(0);
}

const violations = [];

for (const r of apiRewrites) {
  const source = r?.source;
  const destination = r?.destination;

  if (isRelativeApiDestination(destination)) {
    violations.push({
      kind: "relative_destination",
      source,
      destination,
      message: "Relative /api destination routes to Vercel api/* handlers, which is forbidden in production.",
    });
    continue;
  }

  if (typeof destination !== "string" || !destination.startsWith(CANONICAL_BACKEND_DESTINATION_PREFIX)) {
    violations.push({
      kind: "non_canonical_destination",
      source,
      destination,
      message: `Destination must start with ${CANONICAL_BACKEND_DESTINATION_PREFIX}`,
    });
  }
}

// Enforce: there must be no rewrite exceptions for specific /api subpaths.
// In practice, that means we only allow the single catch-all rule: /api/:path* -> backend.
const hasCatchAll = apiRewrites.some(
  (r) => r?.source === "/api/:path*" && typeof r?.destination === "string" && r.destination.startsWith(CANONICAL_BACKEND_DESTINATION_PREFIX)
);
if (!hasCatchAll) {
  violations.push({
    kind: "missing_catch_all",
    source: "/api/:path*",
    destination: CANONICAL_BACKEND_DESTINATION_PREFIX + ":path*",
    message: "Missing canonical catch-all /api/:path* rewrite to the Node backend.",
  });
}

const nonCatchAllApiRewrites = apiRewrites.filter((r) => r?.source !== "/api/:path*");
if (nonCatchAllApiRewrites.length) {
  violations.push({
    kind: "api_rewrite_exceptions_present",
    source: nonCatchAllApiRewrites.map((r) => r?.source),
    destination: nonCatchAllApiRewrites.map((r) => r?.destination),
    message:
      "Found /api rewrite exceptions. Production must not route any /api subpaths to Vercel api/* handlers (or anywhere other than the backend).",
  });
}

if (violations.length) {
  fail(
    `Vercel routing violates /api ownership rules.\n\n` +
      `Policy:\n` +
      `- Production /api/* must route exclusively to the Node backend.\n` +
      `- No /api rewrite exceptions (allowlist is empty).\n\n` +
      `Violations:\n${JSON.stringify(violations, null, 2)}\n`
  );
}

// eslint-disable-next-line no-console
console.log("✅ Vercel /api ownership verified: all /api/* routes go to the Node backend (no exceptions).");

