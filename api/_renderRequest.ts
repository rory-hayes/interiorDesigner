import type { PaletteId, ProjectPreferences, RoomConcept, RoomType, StyleId } from "../src/types.js";

const validStyles: StyleId[] = ["soft-modern", "warm-minimal", "scandi", "rental-refresh"];
const validPalettes: PaletteId[] = ["sage-clay", "walnut-cream", "black-oak", "linen-terracotta"];
const validRoomTypes: RoomType[] = ["living-room", "bedroom", "home-office"];
const validDesignIntensities: Array<ProjectPreferences["designIntensity"]> = [
  "light-touch",
  "balanced",
  "full-redesign",
];
const validShoppingPriorities: Array<ProjectPreferences["shoppingPriority"]> = [
  "best-value",
  "balanced",
  "premium",
];

const maxLocationLength = 120;
const maxMustKeepLength = 600;
const maxConceptNameLength = 80;
const maxConceptSummaryLength = 360;

export interface NormalizedRenderRequest {
  preferences: ProjectPreferences;
  concept: Pick<RoomConcept, "name" | "summary">;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getAllowedString<T extends string>(value: unknown, allowed: T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function getCleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeRenderRequest(value: unknown): NormalizedRenderRequest | null {
  if (!isRecord(value) || !isRecord(value.preferences) || !isRecord(value.concept)) {
    return null;
  }

  const budget = Number(value.preferences.budget);
  const style = getAllowedString(value.preferences.style, validStyles);
  const palette = getAllowedString(value.preferences.palette, validPalettes);
  const roomType = getAllowedString(value.preferences.roomType, validRoomTypes);
  const designIntensity = getAllowedString(value.preferences.designIntensity, validDesignIntensities);
  const shoppingPriority = getAllowedString(value.preferences.shoppingPriority, validShoppingPriorities);
  const location = getCleanText(value.preferences.location, maxLocationLength);
  const mustKeep = getCleanText(value.preferences.mustKeep, maxMustKeepLength) ?? "";
  const conceptName = getCleanText(value.concept.name, maxConceptNameLength);
  const conceptSummary = getCleanText(value.concept.summary, maxConceptSummaryLength);

  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > 100000 ||
    !style ||
    !palette ||
    !roomType ||
    !designIntensity ||
    !shoppingPriority ||
    !location ||
    !conceptName ||
    !conceptSummary
  ) {
    return null;
  }

  return {
    preferences: {
      budget,
      style,
      palette,
      roomType,
      location,
      designIntensity,
      shoppingPriority,
      mustKeep,
    },
    concept: {
      name: conceptName,
      summary: conceptSummary,
    },
  };
}
