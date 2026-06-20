import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRenderRateLimits,
  consumeRenderRateLimit,
  getRenderRateLimitKey,
  renderRateLimitMaxRequests,
  renderRateLimitWindowMs,
} from "../../api/_renderRateLimit";

describe("render rate limiting", () => {
  beforeEach(() => {
    clearRenderRateLimits();
  });

  it("uses the first forwarded IP address as the rate limit key", () => {
    expect(
      getRenderRateLimitKey({
        headers: {
          "x-forwarded-for": "203.0.113.10, 198.51.100.2",
        },
      }),
    ).toBe("203.0.113.10");
  });

  it("allows requests until the beta render limit is reached", () => {
    const now = Date.parse("2026-06-20T10:00:00.000Z");

    Array.from({ length: renderRateLimitMaxRequests }).forEach((_, index) => {
      const result = consumeRenderRateLimit("203.0.113.10", now + index);

      expect(result.allowed).toBe(true);
    });

    const blocked = consumeRenderRateLimit("203.0.113.10", now + renderRateLimitMaxRequests + 1);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows rendering again after the rate limit window resets", () => {
    const now = Date.parse("2026-06-20T10:00:00.000Z");

    Array.from({ length: renderRateLimitMaxRequests }).forEach((_, index) => {
      consumeRenderRateLimit("203.0.113.10", now + index);
    });

    const reset = consumeRenderRateLimit(
      "203.0.113.10",
      now + renderRateLimitWindowMs + renderRateLimitMaxRequests + 1,
    );

    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(renderRateLimitMaxRequests - 1);
  });
});
