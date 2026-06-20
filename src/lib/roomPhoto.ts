export const normalizedRoomPhotoMaxDataUrlLength = 12 * 1024 * 1024;
export const normalizedRoomPhotoMaxDimension = 1920;

const resizeDimensions = [1920, 1600, 1280];
const resizeQualities = [0.86, 0.76, 0.66];
const roomPhotoOutputTypes = ["image/webp", "image/jpeg"];

export interface NormalizedRoomPhoto {
  dataUrl: string;
  type: string;
  size: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export function getBoundedRoomPhotoSize(width: number, height: number, maxDimension = normalizedRoomPhotoMaxDimension) {
  if (width <= 0 || height <= 0) {
    const fallbackDimension = Number.isFinite(maxDimension) ? maxDimension : normalizedRoomPhotoMaxDimension;

    return { width: fallbackDimension, height: fallbackDimension };
  }

  const longestSide = Math.max(width, height);

  if (longestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / longestSide;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load that image."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function drawImageToCanvas(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare that image.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

async function createCompressedPhoto(image: HTMLImageElement) {
  for (const maxDimension of resizeDimensions) {
    const size = getBoundedRoomPhotoSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);
    const canvas = drawImageToCanvas(image, size.width, size.height);

    for (const type of roomPhotoOutputTypes) {
      for (const quality of resizeQualities) {
        const blob = await canvasToBlob(canvas, type, quality);

        if (!blob) {
          continue;
        }

        const dataUrl = await readFileAsDataUrl(blob);

        if (dataUrl.length <= normalizedRoomPhotoMaxDataUrlLength) {
          return {
            dataUrl,
            type: blob.type || type,
            size: blob.size,
            width: size.width,
            height: size.height,
          };
        }
      }
    }
  }

  return null;
}

export async function normalizeRoomPhoto(file: File): Promise<NormalizedRoomPhoto> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const originalSize = getBoundedRoomPhotoSize(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      Number.POSITIVE_INFINITY,
    );
    const shouldResize =
      file.size > normalizedRoomPhotoMaxDataUrlLength ||
      Math.max(originalSize.width, originalSize.height) > normalizedRoomPhotoMaxDimension;

    if (!shouldResize) {
      const dataUrl = await readFileAsDataUrl(file);

      if (dataUrl.length <= normalizedRoomPhotoMaxDataUrlLength) {
        return {
          dataUrl,
          type: file.type || "image/jpeg",
          size: file.size,
          width: originalSize.width,
          height: originalSize.height,
          wasCompressed: false,
        };
      }
    }

    const compressed = await createCompressedPhoto(image);

    if (!compressed) {
      throw new Error("Room photo is too large. Please try a smaller JPG, PNG, or WebP image.");
    }

    return {
      ...compressed,
      wasCompressed: true,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getDataUrlImageType(dataUrl: string) {
  return /^data:(image\/(?:jpeg|png|webp));base64,/.exec(dataUrl)?.[1] ?? "image/jpeg";
}

export async function normalizeRoomImageDataUrl(dataUrl: string): Promise<NormalizedRoomPhoto> {
  const image = await loadImage(dataUrl);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const originalSize = getBoundedRoomPhotoSize(imageWidth, imageHeight, Number.POSITIVE_INFINITY);
  const shouldResize =
    dataUrl.length > normalizedRoomPhotoMaxDataUrlLength ||
    Math.max(originalSize.width, originalSize.height) > normalizedRoomPhotoMaxDimension;

  if (!shouldResize && dataUrl.length <= normalizedRoomPhotoMaxDataUrlLength) {
    return {
      dataUrl,
      type: getDataUrlImageType(dataUrl),
      size: dataUrl.length,
      width: originalSize.width,
      height: originalSize.height,
      wasCompressed: false,
    };
  }

  const compressed = await createCompressedPhoto(image);

  if (!compressed) {
    throw new Error("Room photo is too large. Please try a smaller JPG, PNG, or WebP image.");
  }

  return {
    ...compressed,
    wasCompressed: true,
  };
}
