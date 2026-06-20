interface RenderRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __roomwiseRenderRateLimits: Map<string, number[]> | undefined;
}

const renderRateLimitWindowMs = 10 * 60 * 1000;
const renderRateLimitMaxRequests = 6;

const renderRateLimitStore = globalThis.__roomwiseRenderRateLimits ?? new Map<string, number[]>();

globalThis.__roomwiseRenderRateLimits = renderRateLimitStore;

function readHeader(headers: unknown, name: string) {
  if (!headers) {
    return undefined;
  }

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
}

export function getRenderRateLimitKey(request: { headers?: unknown; socket?: { remoteAddress?: string } }) {
  const forwardedFor = readHeader(request.headers, "x-forwarded-for");
  const forwardedHost = forwardedFor?.split(",")[0]?.trim();

  return forwardedHost || request.socket?.remoteAddress || "unknown";
}

export function consumeRenderRateLimit(
  key: string,
  now = Date.now(),
  limit = renderRateLimitMaxRequests,
  windowMs = renderRateLimitWindowMs,
): RenderRateLimitResult {
  const windowStart = now - windowMs;
  const recentRequests = (renderRateLimitStore.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
  const resetAt = recentRequests[0] ? recentRequests[0] + windowMs : now + windowMs;

  if (recentRequests.length >= limit) {
    renderRateLimitStore.set(key, recentRequests);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  recentRequests.push(now);
  renderRateLimitStore.set(key, recentRequests);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - recentRequests.length),
    resetAt,
    retryAfterSeconds: 0,
  };
}

export function clearRenderRateLimits() {
  renderRateLimitStore.clear();
}

export { renderRateLimitMaxRequests, renderRateLimitWindowMs };
