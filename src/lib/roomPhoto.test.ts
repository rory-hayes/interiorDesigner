import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBoundedRoomPhotoSize,
  normalizeRoomPhoto,
  normalizedRoomPhotoMaxDimension,
} from "./roomPhoto";

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  width = 800;
  height = 600;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function mockImageDimensions(width: number, height: number) {
  vi.stubGlobal(
    "Image",
    class extends MockImage {
      naturalWidth = width;
      naturalHeight = height;
      width = width;
      height = height;
    },
  );
}

function mockCanvas(blobType = "image/webp") {
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
        callback(new Blob(["compressed-room-photo"], { type: type || blobType }));
      },
    } as unknown as HTMLCanvasElement;
  });

  return createElement;
}

function mockObjectUrl(value: string) {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => value),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
}

describe("room photo normalization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bounds room photos without changing aspect ratio", () => {
    expect(getBoundedRoomPhotoSize(4000, 3000)).toEqual({ width: 1920, height: 1440 });
    expect(getBoundedRoomPhotoSize(1200, 900)).toEqual({ width: 1200, height: 900 });
    expect(getBoundedRoomPhotoSize(0, 0)).toEqual({
      width: normalizedRoomPhotoMaxDimension,
      height: normalizedRoomPhotoMaxDimension,
    });
  });

  it("keeps small photos as their original data URL", async () => {
    mockImageDimensions(800, 600);
    mockObjectUrl("blob:small-room");

    const photo = await normalizeRoomPhoto(new File(["small"], "room.jpg", { type: "image/jpeg" }));

    expect(photo.wasCompressed).toBe(false);
    expect(photo.type).toBe("image/jpeg");
    expect(photo.width).toBe(800);
    expect(photo.height).toBe(600);
    expect(photo.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:small-room");
  });

  it("compresses high-resolution photos before upload", async () => {
    mockImageDimensions(4032, 3024);
    mockCanvas();
    mockObjectUrl("blob:large-room");

    const photo = await normalizeRoomPhoto(new File(["large"], "room.jpg", { type: "image/jpeg" }));

    expect(photo.wasCompressed).toBe(true);
    expect(photo.type).toBe("image/webp");
    expect(photo.width).toBe(1920);
    expect(photo.height).toBe(1440);
    expect(photo.dataUrl).toMatch(/^data:image\/webp;base64,/);
  });
});
