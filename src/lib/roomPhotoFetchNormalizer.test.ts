import { afterEach, describe, expect, it, vi } from "vitest";
import { installRoomPhotoFetchNormalizer } from "./roomPhotoFetchNormalizer";

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4032;
  naturalHeight = 3024;
  width = 4032;
  height = 3024;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function mockCanvas() {
  const originalCreateElement = document.createElement.bind(document);
  const createElement = vi.spyOn(document, "createElement");

  createElement.mockImplementation((tagName: string) => {
    if (tagName !== "canvas") {
      return originalCreateElement(tagName);
    }

    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
      }),
      toBlob: (callback: BlobCallback, type: string) => {
        callback(new Blob(["compressed-room-photo"], { type: type || "image/webp" }));
      },
    } as unknown as HTMLCanvasElement;
  });
}

describe("room photo fetch normalizer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("compresses render image payloads before fetch", async () => {
    vi.stubGlobal("Image", MockImage);
    mockCanvas();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const restore = installRoomPhotoFetchNormalizer();

    await fetch("/api/generate-room-render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,large-room-photo",
        type: "image/jpeg",
        size: 9000000,
      }),
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      imageDataUrl: string;
      type: string;
      size: number;
    };

    expect(payload.imageDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(payload.type).toBe("image/jpeg");
    expect(payload.size).toBeLessThan(9000000);

    restore();
  });

  it("routes phone capture uploads through the canonical session endpoint", async () => {
    vi.stubGlobal("Image", MockImage);
    mockCanvas();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const restore = installRoomPhotoFetchNormalizer();

    await fetch("/api/capture-sessions/session-123456/photo?source=phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,large-phone-room-photo",
        type: "image/jpeg",
        size: 9000000,
      }),
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      imageDataUrl: string;
      size: number;
    };

    expect(fetchMock.mock.calls[0][0]).toBe("/api/capture-sessions/session-123456?source=phone");
    expect(payload.imageDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(payload.size).toBeLessThan(9000000);

    restore();
  });

  it("leaves unrelated fetch requests untouched", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const restore = installRoomPhotoFetchNormalizer();

    await fetch("/api/health");

    expect(fetchMock.mock.calls[0]).toEqual(["/api/health", undefined]);

    restore();
  });
});
