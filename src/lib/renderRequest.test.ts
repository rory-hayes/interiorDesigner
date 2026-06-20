import { describe, expect, it } from "vitest";
import { normalizeRenderRequest } from "../../api/_renderRequest";

const validRenderRequest = {
  preferences: {
    budget: 2500,
    style: "warm-minimal",
    palette: "walnut-cream",
    roomType: "living-room",
    location: "Dublin, Ireland",
    designIntensity: "balanced",
    shoppingPriority: "balanced",
    mustKeep: "Keep the sofa",
  },
  concept: {
    name: "Warm minimal",
    summary: "A practical, calm update with better storage and layered lighting.",
  },
};

describe("render request normalization", () => {
  it("accepts a valid customer render brief", () => {
    expect(normalizeRenderRequest(validRenderRequest)).toEqual(validRenderRequest);
  });

  it("rejects invalid enum values and unsafe budgets", () => {
    expect(
      normalizeRenderRequest({
        ...validRenderRequest,
        preferences: {
          ...validRenderRequest.preferences,
          style: "industrial",
        },
      }),
    ).toBeNull();

    expect(
      normalizeRenderRequest({
        ...validRenderRequest,
        preferences: {
          ...validRenderRequest.preferences,
          budget: 250000,
        },
      }),
    ).toBeNull();
  });

  it("strips control characters and bounds customer text", () => {
    const normalized = normalizeRenderRequest({
      ...validRenderRequest,
      preferences: {
        ...validRenderRequest.preferences,
        location: " Dublin\u0000\u0008   Ireland ",
        mustKeep: ` Keep the desk\n${"x".repeat(800)}`,
      },
      concept: {
        name: " Warm\u0000minimal ",
        summary: ` Calm\n${"storage ".repeat(80)}`,
      },
    });

    expect(normalized?.preferences.location).toBe("Dublin Ireland");
    expect(normalized?.preferences.mustKeep.startsWith("Keep the desk")).toBe(true);
    expect(normalized?.preferences.mustKeep).toHaveLength(600);
    expect(normalized?.concept.name).toBe("Warm minimal");
    expect(normalized?.concept.summary.length).toBeLessThanOrEqual(360);
  });

  it("requires a design concept and location", () => {
    expect(
      normalizeRenderRequest({
        ...validRenderRequest,
        concept: {
          name: "",
          summary: validRenderRequest.concept.summary,
        },
      }),
    ).toBeNull();

    expect(
      normalizeRenderRequest({
        ...validRenderRequest,
        preferences: {
          ...validRenderRequest.preferences,
          location: "",
        },
      }),
    ).toBeNull();
  });
});
