import type { GeneratedRender, IntegrationMode, ProjectPreferences, RoomConcept } from "../types";

export async function checkIntegrationMode(): Promise<IntegrationMode> {
  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      return "demo";
    }

    const payload = (await response.json()) as { mode?: IntegrationMode; openaiConfigured?: boolean };
    return payload.mode === "live" || payload.openaiConfigured ? "live" : "demo";
  } catch {
    return "demo";
  }
}

export async function generateRoomRender(input: {
  imageDataUrl: string;
  preferences: ProjectPreferences;
  concept: Pick<RoomConcept, "name" | "summary">;
}): Promise<GeneratedRender> {
  const response = await fetch("/api/generate-room-render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? "Image generation failed.");
  }

  return payload as GeneratedRender;
}
