import { describe, expect, it } from "vitest";

import { projectToPreferences, type OnboardingProject } from "./onboarding";

function createProject(overrides: Partial<OnboardingProject> = {}): OnboardingProject {
  return {
    id: "project_123",
    ownerId: "user_123",
    name: "Living room refresh",
    roomType: "living-room",
    location: "Dublin, Ireland",
    onboardingStatus: "project_created",
    createdAt: "2026-06-21T10:00:00.000Z",
    updatedAt: "2026-06-21T10:00:00.000Z",
    ...overrides,
  };
}

describe("onboarding persistence helpers", () => {
  it("does not overwrite the default budget when a persisted project has no budget", () => {
    const preferences = projectToPreferences(createProject());

    expect(preferences).toEqual({
      roomType: "living-room",
      location: "Dublin, Ireland",
    });
    expect("budget" in preferences).toBe(false);
  });

  it("restores a valid persisted project budget", () => {
    const preferences = projectToPreferences(createProject({ budget: 4000 }));

    expect(preferences.budget).toBe(4000);
  });
});
