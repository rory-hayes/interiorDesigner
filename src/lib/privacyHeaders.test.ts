import { describe, expect, it } from "vitest";
import { noStoreCacheControl, setNoStoreCacheHeaders } from "../../api/_privacyHeaders";

describe("privacy response headers", () => {
  it("marks dynamic API responses as non-cacheable", () => {
    const headers = new Map<string, string>();

    setNoStoreCacheHeaders({
      setHeader(name, value) {
        headers.set(name, value);
      },
    });

    expect(headers.get("Cache-Control")).toBe(noStoreCacheControl);
    expect(headers.get("Pragma")).toBe("no-cache");
    expect(headers.get("Expires")).toBe("0");
  });
});
