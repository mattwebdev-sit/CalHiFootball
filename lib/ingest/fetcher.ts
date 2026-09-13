import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const USER_AGENT =
  "CalHiFootballBot/0.1 (+https://calhifootball.com; scores ingestion)";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const robotsCache = new Map<string, string[]>();

/**
 * Very small robots.txt check: returns true if `pathname` is not Disallowed for
 * "*" (or our specific agent). Conservative and dependency-free; on any error we
 * fail closed (return false) so we never hammer a host we could not verify.
 */
export async function isAllowedByRobots(
  origin: string,
  pathname: string
): Promise<boolean> {
  try {
    let disallows = robotsCache.get(origin);
    if (!disallows) {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) {
        robotsCache.set(origin, []);
        return true; // No robots.txt => allowed.
      }
      const body = await res.text();
      disallows = parseDisallows(body);
      robotsCache.set(origin, disallows);
    }
    return !disallows.some((rule) => rule !== "" && pathname.startsWith(rule));
  } catch {
    return false;
  }
}

function parseDisallows(robotsTxt: string): string[] {
  const lines = robotsTxt.split(/\r?\n/);
  const rules: string[] = [];
  let appliesToAll = false;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = field.trim().toLowerCase();
    if (key === "user-agent") {
      appliesToAll = value === "*" || value.toLowerCase().includes("calhifootball");
    } else if (key === "disallow" && appliesToAll) {
      rules.push(value);
    }
  }
  return rules;
}

interface FetchOptions {
  /** Milliseconds to wait before the request (basic throttle/politeness). */
  throttleMs?: number;
  /** Cache key used for the raw payload file; skips network if cache exists. */
  cacheKey?: string;
  /** When true, ignore an existing cache file and refetch. */
  refresh?: boolean;
  /** HTTP method (defaults to GET). */
  method?: string;
  /** Request body (for POST). */
  body?: string;
  /** Extra request headers merged over the defaults. */
  headers?: Record<string, string>;
}

/**
 * Polite fetch that honors robots.txt, throttles, and caches the raw response
 * body to data/raw for reproducibility and offline re-parsing. Supports GET and
 * POST (for JSON/GraphQL APIs).
 */
export async function politeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const {
    throttleMs = 1500,
    cacheKey,
    refresh = false,
    method = "GET",
    body,
    headers = {},
  } = options;
  const parsed = new URL(url);

  if (cacheKey && !refresh) {
    const cachePath = path.join(RAW_DIR, cacheKey);
    if (existsSync(cachePath)) {
      return readFile(cachePath, "utf8");
    }
  }

  const allowed = await isAllowedByRobots(parsed.origin, parsed.pathname);
  if (!allowed) {
    throw new Error(`Blocked by robots.txt: ${url}`);
  }

  await sleep(throttleMs);
  const res = await fetch(url, {
    method,
    body,
    headers: { "User-Agent": USER_AGENT, ...headers },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${url}`);
  }
  const responseBody = await res.text();

  if (cacheKey) {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(path.join(RAW_DIR, cacheKey), responseBody, "utf8");
  }
  return responseBody;
}
