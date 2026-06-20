import type { ProjectPreferences, RoomConcept } from "../src/types";

export function buildRoomRenderPrompt(preferences: ProjectPreferences, concept: Pick<RoomConcept, "name" | "summary">) {
  const room = preferences.roomType.replace("-", " ");
  const style = preferences.style.replace("-", " ");
  const palette = preferences.palette.replace("-", " ");

  return [
    `Create a photorealistic interior redesign for this ${room}.`,
    `Preserve the original room architecture, camera angle, windows, doors, ceiling, flooring, wall positions, fixed lighting, and built-in fixtures.`,
    `Apply the ${concept.name} direction: ${concept.summary}`,
    `Style preference: ${style}. Colour palette: ${palette}. Budget target: EUR ${preferences.budget}. Location: ${preferences.location}.`,
    "Use realistic, buyable-looking furniture and homeware. Keep scale plausible and avoid blocking doors, windows, radiators, and circulation paths.",
    "Do not add people, logos, watermarks, text, impossible architecture, or extra rooms.",
    "Return one polished after-render that looks like the same room redesigned, not a generic showroom.",
  ].join(" ");
}
