import type { ProjectPreferences, RoomConcept } from "../src/types.js";

export function buildRoomRenderPrompt(preferences: ProjectPreferences, concept: Pick<RoomConcept, "name" | "summary">) {
  const room = preferences.roomType.replace("-", " ");
  const style = preferences.style.replace("-", " ");
  const palette = preferences.palette.replace("-", " ");
  const intensity = preferences.designIntensity.replace("-", " ");
  const priority = preferences.shoppingPriority.replace("-", " ");
  const mustKeep = preferences.mustKeep.trim();

  return [
    `Create one photorealistic after-render for this real ${room}.`,
    "Treat the uploaded photo as the source of truth. Preserve the original architecture, camera angle, lens perspective, windows, doors, ceiling height, flooring direction, wall positions, fixed lighting, radiators, sockets, built-in fixtures, and circulation paths.",
    `Apply the ${concept.name} design direction: ${concept.summary}`,
    `Customer brief: ${style} style, ${palette} colour palette, ${intensity} design intensity, ${priority} shopping priority, budget target EUR ${preferences.budget}, location ${preferences.location}.`,
    mustKeep
      ? `Keep or work around these customer notes: ${mustKeep}.`
      : "If existing large furniture appears reusable, keep scale and placement realistic rather than replacing everything.",
    "Use realistic, currently buyable-looking furniture and homeware: sofa or bed scale, rug size, curtains, lighting, storage, side tables, plants, artwork, cushions, and decor should all look physically plausible.",
    "Design for a homeowner or renter who wants to recreate the room from a shopping list. Avoid bespoke fantasy objects, impossible layouts, blocked doors, blocked windows, blocked radiators, warped furniture, extra rooms, added people, logos, watermarks, labels, captions, or visible text.",
    "The final image should look like the same room professionally redesigned, not a generic showroom or a collage.",
  ].join(" ");
}
