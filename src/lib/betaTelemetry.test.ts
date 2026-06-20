import { describe, expect, it } from "vitest";
import {
  appendBetaTelemetryEvent,
  betaTelemetryStorageKey,
  clearBetaTelemetry,
  estimatedLiveRenderCostUsd,
  maxBetaTelemetryEvents,
  normalizeBetaTelemetry,
  readBetaTelemetry,
  summarizeBetaTelemetry,
} from "./betaTelemetry";

function createStorage(initialValue?: string): Storage {
  const values = new Map<string, string>();

  if (initialValue !== undefined) {
    values.set(betaTelemetryStorageKey, initialValue);
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

describe("beta telemetry", () => {
  it("drops corrupt or unknown events", () => {
    const events = normalizeBetaTelemetry([
      { name: "photo_uploaded", occurredAt: "2026-06-20T10:00:00.000Z", mode: "demo" },
      { name: "unknown_event", occurredAt: "2026-06-20T10:00:00.000Z", mode: "demo" },
      { name: "generation_started", occurredAt: "not-a-date", mode: "live" },
      null,
    ]);

    expect(events).toEqual([{ name: "photo_uploaded", occurredAt: "2026-06-20T10:00:00.000Z", mode: "demo" }]);
  });

  it("stores a bounded local event ledger", () => {
    const storage = createStorage();

    Array.from({ length: maxBetaTelemetryEvents + 5 }).forEach((_, index) => {
      appendBetaTelemetryEvent(
        { name: "workspace_opened", mode: "demo" },
        storage,
        new Date(Date.UTC(2026, 5, 20, 10, 0, index)),
      );
    });

    const events = readBetaTelemetry(storage);

    expect(events).toHaveLength(maxBetaTelemetryEvents);
    expect(events[0].occurredAt).toBe("2026-06-20T10:00:05.000Z");
  });

  it("summarizes funnel events and estimated live render cost", () => {
    const summary = summarizeBetaTelemetry([
      { name: "photo_uploaded", occurredAt: "2026-06-20T10:00:00.000Z", mode: "demo" },
      { name: "sample_photo_used", occurredAt: "2026-06-20T10:01:00.000Z", mode: "demo" },
      { name: "generation_started", occurredAt: "2026-06-20T10:02:00.000Z", mode: "demo" },
      { name: "generation_started", occurredAt: "2026-06-20T10:03:00.000Z", mode: "live" },
      { name: "generation_failed", occurredAt: "2026-06-20T10:04:00.000Z", mode: "live" },
      { name: "shopping_list_copied", occurredAt: "2026-06-20T10:05:00.000Z", mode: "demo" },
    ]);

    expect(summary).toMatchObject({
      eventCount: 6,
      photosAdded: 2,
      generationAttempts: 2,
      generationFailures: 1,
      shoppingListCopies: 1,
      estimatedRenderCostUsd: estimatedLiveRenderCostUsd,
      lastEventAt: "2026-06-20T10:05:00.000Z",
    });
  });

  it("clears local telemetry without throwing", () => {
    const storage = createStorage();

    appendBetaTelemetryEvent({ name: "workspace_opened" }, storage);
    clearBetaTelemetry(storage);

    expect(readBetaTelemetry(storage)).toEqual([]);
  });
});
