import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/health")) {
        return {
          ok: true,
          json: async () => ({ ok: true, openaiConfigured: false, mode: "demo" }),
        };
      }

      return {
        ok: true,
        json: async () => ({ capture: null }),
      };
    }),
  );
}

describe("Roomwise beta safeguards", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
    mockFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires consent before uploading a room photo from desktop", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    const uploadButton = screen.getByRole("button", { name: /upload photo/i }) as HTMLButtonElement;
    expect(uploadButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));

    expect(uploadButton.disabled).toBe(false);
  });

  it("publishes support and legal links in the app chrome", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy.html");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms.html");
    expect(screen.getByRole("link", { name: "Support" }).getAttribute("href")).toBe("mailto:roryh1@gmail.com");
  });

  it("requires consent before uploading a phone-capture photo", () => {
    window.history.pushState({}, "", "/?capture=session-123");
    render(<App />);

    const captureButton = screen.getByRole("button", { name: /take or choose photo/i }) as HTMLButtonElement;
    expect(captureButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));

    expect(captureButton.disabled).toBe(false);
  });
});
