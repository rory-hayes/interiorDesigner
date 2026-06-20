import { describe, expect, it } from "vitest";
import { isSupportedRoomImageDataUrl, roomImageDataUrlMaxLength } from "../../api/_imageDataUrl";

describe("isSupportedRoomImageDataUrl", () => {
  it("accepts supported room image data URLs", () => {
    expect(isSupportedRoomImageDataUrl("data:image/jpeg;base64,abcdEF12+/==")).toBe(true);
    expect(isSupportedRoomImageDataUrl("data:image/png;base64,abcd")).toBe(true);
    expect(isSupportedRoomImageDataUrl("data:image/webp;base64,abcd")).toBe(true);
  });

  it("rejects unsupported or malformed values", () => {
    expect(isSupportedRoomImageDataUrl(undefined)).toBe(false);
    expect(isSupportedRoomImageDataUrl("https://example.com/room.jpg")).toBe(false);
    expect(isSupportedRoomImageDataUrl("data:image/gif;base64,abcd")).toBe(false);
    expect(isSupportedRoomImageDataUrl("data:image/jpeg;base64,not valid")).toBe(false);
  });

  it("rejects images above the upload limit", () => {
    const oversized = `data:image/jpeg;base64,${"a".repeat(roomImageDataUrlMaxLength)}`;

    expect(isSupportedRoomImageDataUrl(oversized)).toBe(false);
  });
});
