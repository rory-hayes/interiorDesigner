interface CaptureRecord {
  imageDataUrl: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

declare global {
  var __roomwiseCaptureSessions: Map<string, CaptureRecord> | undefined;
}

export const captureSessions = globalThis.__roomwiseCaptureSessions ?? new Map<string, CaptureRecord>();

globalThis.__roomwiseCaptureSessions = captureSessions;

export type { CaptureRecord };
