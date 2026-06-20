import type { IntegrationMode } from "../types";

export const betaTelemetryStorageKey = "roomwise.telemetry.v1";
export const maxBetaTelemetryEvents = 200;
export const estimatedLiveRenderCostUsd = 0.08;

export type BetaTelemetryMode = IntegrationMode | "unknown";

export type BetaTelemetryEventName =
  | "workspace_opened"
  | "photo_consent_confirmed"
  | "photo_uploaded"
  | "sample_photo_used"
  | "phone_capture_link_copied"
  | "phone_capture_photo_received"
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "shopping_list_copied"
  | "workspace_reset";

export interface BetaTelemetryEvent {
  name: BetaTelemetryEventName;
  occurredAt: string;
  mode: BetaTelemetryMode;
}

export interface BetaTelemetrySummary {
  eventCount: number;
  photosAdded: number;
  generationAttempts: number;
  generationFailures: number;
  shoppingListCopies: number;
  estimatedRenderCostUsd: number;
  lastEventAt?: string;
}

const validEventNames: BetaTelemetryEventName[] = [
  "workspace_opened",
  "photo_consent_confirmed",
  "photo_uploaded",
  "sample_photo_used",
  "phone_capture_link_copied",
  "phone_capture_photo_received",
  "generation_started",
  "generation_completed",
  "generation_failed",
  "shopping_list_copied",
  "workspace_reset",
];

const validModes: BetaTelemetryMode[] = ["checking", "demo", "live", "unknown"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMode(value: unknown): BetaTelemetryMode {
  return typeof value === "string" && validModes.includes(value as BetaTelemetryMode)
    ? (value as BetaTelemetryMode)
    : "unknown";
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function normalizeBetaTelemetry(value: unknown): BetaTelemetryEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((event): event is BetaTelemetryEvent => {
      if (!isRecord(event)) {
        return false;
      }

      return (
        typeof event.name === "string" &&
        validEventNames.includes(event.name as BetaTelemetryEventName) &&
        isValidTimestamp(event.occurredAt)
      );
    })
    .map((event) => ({
      name: event.name,
      occurredAt: event.occurredAt,
      mode: normalizeMode(event.mode),
    }))
    .slice(-maxBetaTelemetryEvents);
}

export function readBetaTelemetry(storage: Storage = window.localStorage): BetaTelemetryEvent[] {
  try {
    const rawEvents = storage.getItem(betaTelemetryStorageKey);

    if (!rawEvents) {
      return [];
    }

    return normalizeBetaTelemetry(JSON.parse(rawEvents));
  } catch {
    return [];
  }
}

export function saveBetaTelemetry(events: BetaTelemetryEvent[], storage: Storage = window.localStorage) {
  try {
    storage.setItem(betaTelemetryStorageKey, JSON.stringify(normalizeBetaTelemetry(events)));
  } catch {
    // Local telemetry should never block the redesign workflow.
  }
}

export function appendBetaTelemetryEvent(
  event: { name: BetaTelemetryEventName; mode?: BetaTelemetryMode },
  storage: Storage = window.localStorage,
  now = new Date(),
) {
  const events = normalizeBetaTelemetry([
    ...readBetaTelemetry(storage),
    {
      name: event.name,
      mode: event.mode ?? "unknown",
      occurredAt: now.toISOString(),
    },
  ]);

  saveBetaTelemetry(events, storage);

  return events;
}

export function clearBetaTelemetry(storage: Storage = window.localStorage) {
  try {
    storage.removeItem(betaTelemetryStorageKey);
  } catch {
    // Ignore storage failures so the in-memory UI state can still reset.
  }
}

export function summarizeBetaTelemetry(events: BetaTelemetryEvent[]): BetaTelemetrySummary {
  const normalizedEvents = normalizeBetaTelemetry(events);
  const count = (name: BetaTelemetryEventName) => normalizedEvents.filter((event) => event.name === name).length;
  const liveGenerationAttempts = normalizedEvents.filter(
    (event) => event.name === "generation_started" && event.mode === "live",
  ).length;
  const lastEvent = normalizedEvents.at(-1);

  return {
    eventCount: normalizedEvents.length,
    photosAdded: count("photo_uploaded") + count("sample_photo_used") + count("phone_capture_photo_received"),
    generationAttempts: count("generation_started"),
    generationFailures: count("generation_failed"),
    shoppingListCopies: count("shopping_list_copied"),
    estimatedRenderCostUsd: liveGenerationAttempts * estimatedLiveRenderCostUsd,
    lastEventAt: lastEvent?.occurredAt,
  };
}
