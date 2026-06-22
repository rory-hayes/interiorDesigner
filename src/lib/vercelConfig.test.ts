import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

function getHeaderValue(key: string) {
  const headers = vercelConfig.headers[0]?.headers ?? [];

  return headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;
}

describe("vercel security headers", () => {
  it("applies security headers to every route", () => {
    expect(vercelConfig.headers[0]?.source).toBe("/(.*)");
    expect(getHeaderValue("X-Content-Type-Options")).toBe("nosniff");
    expect(getHeaderValue("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(getHeaderValue("Permissions-Policy")).toContain("camera=(self)");
  });

  it("keeps CSP compatible with Roomwise image and API flows", () => {
    const csp = getHeaderValue("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob: https://api.qrserver.com");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co https://*.supabase.in");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
