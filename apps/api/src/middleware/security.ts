import type { Request, Response, NextFunction } from "express";

/**
 * Minimal in-memory rate limiter (no new dependency). Sufficient for a
 * single backend instance; a multi-instance deployment must replace the
 * store with a shared one (e.g. Redis) behind the same interface.
 *
 * Keyed by client IP + bucket name. Fixed-window counting.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function clientIp(req: Request): string {
  // Do NOT trust X-Forwarded-For unless the proxy is trusted (spec §10) —
  // in dev there is no proxy, so use the socket address.
  return req.socket.remoteAddress ?? "unknown";
}

export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip in the automated test environment so API test suites exercising
    // login repeatedly are not throttled. Production is always limited.
    if (process.env.NODE_ENV === "test") {
      next();
      return;
    }
    const key = `${options.name}:${clientIp(req)}`;
    const now = Date.now();

    // Bound memory — drop stale buckets when the map grows large
    if (store.size > MAX_BUCKETS) {
      for (const [k, v] of store) {
        if (v.resetAt < now) store.delete(k);
      }
    }

    const bucket = store.get(key);
    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", String(options.max - 1));
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > options.max) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests — slow down and try again shortly.",
        },
      });
      return;
    }

    next();
  };
}

/** Security headers (spec §7) — hand-rolled, no helmet dependency needed.
 * CSP is report-safe: allows Google Fonts (loaded in index.html) and
 * inline styles used by the SPA, blocks inline scripts and foreign frames. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  // HSTS is only meaningful over HTTPS; harmless over HTTP dev
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}
