export const noStoreCacheControl = "no-store, max-age=0";

export interface HeaderWritableResponse {
  setHeader(name: string, value: string): unknown;
}

export function setNoStoreCacheHeaders(response: HeaderWritableResponse) {
  response.setHeader("Cache-Control", noStoreCacheControl);
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
}
