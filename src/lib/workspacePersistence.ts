import type { PaletteId, ProjectPreferences, RoomConcept, RoomType, StyleId } from "../types";

export const workspaceStorageKey = "roomwise.workspace.v1";

export interface PersistedWorkspace {
  preferences?: Partial<ProjectPreferences>;
  selectedConceptId?: RoomConcept["id"];
  selectedProductIds?: string[];
}

const validStyles: StyleId[] = ["soft-modern", "warm-minimal", "scandi", "rental-refresh"];
const validPalettes: PaletteId[] = ["sage-clay", "walnut-cream", "black-oak", "linen-terracotta"];
const validRoomTypes: RoomType[] = ["living-room", "bedroom", "home-office"];
const validConceptIds: Array<RoomConcept["id"]> = ["soft-modern", "warm-minimal"];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getCleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getAllowedString<T extends string>(value: unknown, allowed: T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

export function normalizePersistedWorkspace(value: unknown): PersistedWorkspace {
  if (!isRecord(value)) {
    return {};
  }

  const workspace: PersistedWorkspace = {};

  if (isRecord(value.preferences)) {
    const preferences: Partial<ProjectPreferences> = {};
    const budget = Number(value.preferences.budget);

    if (Number.isFinite(budget) && budget > 0 && budget <= 100000) {
      preferences.budget = budget;
    }

    const style = getAllowedString(value.preferences.style, validStyles);
    const palette = getAllowedString(value.preferences.palette, validPalettes);
    const roomType = getAllowedString(value.preferences.roomType, validRoomTypes);
    const designIntensity = getAllowedString(value.preferences.designIntensity, validDesignIntensities);
    const shoppingPriority = getAllowedString(value.preferences.shoppingPriority, validShoppingPriorities);
    const location = getCleanText(value.preferences.location, 120);
    const mustKeep = getCleanText(value.preferences.mustKeep, 600);

    if (style) preferences.style = style;
    if (palette) preferences.palette = palette;
    if (roomType) preferences.roomType = roomType;
    if (designIntensity) preferences.designIntensity = designIntensity;
    if (shoppingPriority) preferences.shoppingPriority = shoppingPriority;
    if (location !== undefined) preferences.location = location;
    if (mustKeep !== undefined) preferences.mustKeep = mustKeep;

    if (Object.keys(preferences).length > 0) {
      workspace.preferences = preferences;
    }
  }

  const selectedConceptId = getAllowedString(value.selectedConceptId, validConceptIds);

  if (selectedConceptId) {
    workspace.selectedConceptId = selectedConceptId;
  }

  if (Array.isArray(value.selectedProductIds)) {
    workspace.selectedProductIds = Array.from(
      new Set(value.selectedProductIds.filter((productId): productId is string => typeof productId === "string")),
    ).slice(0, 100);
  }

  return workspace;
}

export function readPersistedWorkspace(storage: Storage = window.localStorage): PersistedWorkspace {
  try {
    const rawWorkspace = storage.getItem(workspaceStorageKey);

    if (!rawWorkspace) {
      return {};
    }

    return normalizePersistedWorkspace(JSON.parse(rawWorkspace));
  } catch {
    return {};
  }
}

export function savePersistedWorkspace(workspace: PersistedWorkspace, storage: Storage = window.localStorage) {
  try {
    storage.setItem(workspaceStorageKey, JSON.stringify(normalizePersistedWorkspace(workspace)));
  } catch {
    // Local persistence is a convenience only; the app should still work if storage is unavailable.
  }
}

export function clearPersistedWorkspace(storage: Storage = window.localStorage) {
  try {
    storage.removeItem(workspaceStorageKey);
  } catch {
    // Ignore storage failures so reset still clears in-memory state.
  }
}
