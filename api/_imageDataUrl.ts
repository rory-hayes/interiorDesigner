export const roomImageDataUrlMaxLength = 16 * 1024 * 1024;

const roomImageDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/;

export function isSupportedRoomImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= roomImageDataUrlMaxLength &&
    roomImageDataUrlPattern.test(value)
  );
}
