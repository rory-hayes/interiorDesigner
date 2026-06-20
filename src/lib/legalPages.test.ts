import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readPublicFile(path: string) {
  return readFileSync(resolve("public", path), "utf8");
}

describe("legal beta pages", () => {
  it("publishes a privacy notice for room photos and local storage", () => {
    const privacy = readPublicFile("privacy.html");

    expect(privacy).toContain("Privacy notice");
    expect(privacy).toContain("room photos");
    expect(privacy).toContain("local browser storage");
    expect(privacy).toContain("AI rendering");
    expect(privacy).toContain("roryh1@gmail.com");
  });

  it("publishes beta terms for AI previews and shopping recommendations", () => {
    const terms = readPublicFile("terms.html");

    expect(terms).toContain("Beta terms");
    expect(terms).toContain("AI renders are concept previews");
    expect(terms).toContain("Shopping recommendations");
    expect(terms).toContain("No professional advice");
    expect(terms).toContain("roryh1@gmail.com");
  });
});
