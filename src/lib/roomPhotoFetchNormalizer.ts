import { normalizeRoomImageDataUrl } from "./roomPhoto";

const capturePhotoPathPattern = /\/api\/capture-sessions\/[^/]+\/photo$/;
const renderPath = "/api/generate-room-render";

let restoreFetch: (() => void) | null = null;

function isRoomPhotoEndpoint(url: string) {
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];

  return path === renderPath || capturePhotoPathPattern.test(path);
}

function readMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

function readUrl(input: RequestInfo | URL) {
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }

  return String(input);
}

function withJsonContentType(headers: HeadersInit | undefined) {
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  return nextHeaders;
}

async function readJsonBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") {
    return init.body;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.clone().text();
  }

  return null;
}

export function installRoomPhotoFetchNormalizer() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return () => undefined;
  }

  if (restoreFetch) {
    return restoreFetch;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = readUrl(input);

    if (readMethod(input, init) !== "POST" || !isRoomPhotoEndpoint(url)) {
      return originalFetch(input, init);
    }

    const rawBody = await readJsonBody(input, init);

    if (!rawBody) {
      return originalFetch(input, init);
    }

    try {
      const payload = JSON.parse(rawBody) as {
        imageDataUrl?: unknown;
        type?: unknown;
        size?: unknown;
      };

      if (typeof payload.imageDataUrl !== "string") {
        return originalFetch(input, init);
      }

      const normalized = await normalizeRoomImageDataUrl(payload.imageDataUrl);
      const nextPayload = {
        ...payload,
        imageDataUrl: normalized.dataUrl,
        type: typeof payload.type === "string" ? payload.type : normalized.type,
        size: normalized.size,
      };

      return originalFetch(input, {
        ...init,
        method: "POST",
        headers: withJsonContentType(init?.headers),
        body: JSON.stringify(nextPayload),
      });
    } catch {
      return originalFetch(input, init);
    }
  };

  restoreFetch = () => {
    window.fetch = originalFetch;
    restoreFetch = null;
  };

  return restoreFetch;
}
