import { describe, expect, it } from "vitest";
import {
  clearPersistedWorkspace,
  normalizePersistedWorkspace,
  readPersistedWorkspace,
  savePersistedWorkspace,
  workspaceStorageKey,
} from "./workspacePersistence";

function createStorage(initialValue?: string): Storage {
  const values = new Map<string, string>();

  if (initialValue !== undefined) {
    values.set(workspaceStorageKey, initialValue);
  }

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("workspace persistence", () => {
  it("drops corrupt storage instead of throwing", () => {
    const storage = createStorage("{not-json");

    expect(readPersistedWorkspace(storage)).toEqual({});
  });

  it("normalizes invalid persisted fields", () => {
    const workspace = normalizePersistedWorkspace({
      preferences: {
        budget: -1,
        style: "industrial",
        palette: "walnut-cream",
        roomType: "bedroom",
        location: "Dublin",
        designIntensity: "extreme",
        shoppingPriority: "premium",
        mustKeep: 42,
      },
      selectedConceptId: "scandi",
      selectedProductIds: ["chair-1", "chair-1", 12, "rug-1"],
    });

    expect(workspace).toEqual({
      preferences: {
        palette: "walnut-cream",
        roomType: "bedroom",
        location: "Dublin",
        shoppingPriority: "premium",
      },
      selectedProductIds: ["chair-1", "rug-1"],
    });
  });

  it("cleans persisted free-text brief fields before restoring app state", () => {
    const workspace = normalizePersistedWorkspace({
      preferences: {
        location: "  Dublin\n\t  Ireland\u0000  ",
        mustKeep: "  Keep sofa\r\nAvoid glass tables\u007f  ",
      },
    });

    expect(workspace.preferences).toEqual({
      location: "Dublin Ireland",
      mustKeep: "Keep sofa Avoid glass tables",
    });
  });

  it("saves and clears lightweight workspace state", () => {
    const storage = createStorage();

    savePersistedWorkspace(
      {
        preferences: {
          budget: 2500,
          style: "warm-minimal",
          palette: "walnut-cream",
          roomType: "living-room",
          location: "Dublin",
          designIntensity: "balanced",
          shoppingPriority: "balanced",
          mustKeep: "Keep the sofa",
        },
        selectedConceptId: "warm-minimal",
        selectedProductIds: ["sofa-1"],
      },
      storage,
    );

    expect(readPersistedWorkspace(storage).selectedProductIds).toEqual(["sofa-1"]);

    clearPersistedWorkspace(storage);

    expect(readPersistedWorkspace(storage)).toEqual({});
  });
});
