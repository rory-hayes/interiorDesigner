import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function setDeviceSignals({
  width,
  maxTouchPoints,
  coarsePointer,
}: {
  width: number;
  maxTouchPoints: number;
  coarsePointer: boolean;
}) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: coarsePointer && query === "(pointer: coarse)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
    setDeviceSignals({ width: 1280, maxTouchPoints: 0, coarsePointer: false });
    mockFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function signIn() {
    const authForm = screen.getByRole("form", { name: /sign in to roomwise/i });
    fireEvent.change(within(authForm).getByLabelText("Name"), { target: { value: "Rory Hayes" } });
    fireEvent.change(within(authForm).getByLabelText("Email"), { target: { value: "rory@example.com" } });
    fireEvent.click(within(authForm).getByRole("button", { name: /continue with email/i }));

    await waitFor(() => expect(screen.getByRole("form", { name: /create your first roomwise project/i })).toBeTruthy());
  }

  async function createProject() {
    const projectForm = screen.getByRole("form", { name: /create your first roomwise project/i });
    fireEvent.change(within(projectForm).getByLabelText("Project name"), { target: { value: "Rory living room" } });
    fireEvent.change(within(projectForm).getByLabelText("Location or country"), { target: { value: "Dublin, Ireland" } });
    fireEvent.click(within(projectForm).getByRole("button", { name: /create project/i }));

    await waitFor(() => expect(screen.getByLabelText(/i have the right to use this room photo/i)).toBeTruthy());
  }

  it("gates real upload controls behind auth, project setup, and photo consent", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue with email/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upload photo/i })).toBeNull();
    expect(screen.queryByAltText(/qr code for phone room upload/i)).toBeNull();

    await signIn();
    expect(screen.queryByRole("button", { name: /upload photo/i })).toBeNull();

    await createProject();
    expect(screen.getByLabelText(/i have the right to use this room photo/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upload photo/i })).toBeNull();

    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));

    expect((screen.getByRole("button", { name: /upload photo/i }) as HTMLButtonElement).disabled).toBe(false);
    const qrImage = await screen.findByAltText(/qr code for phone room upload/i);
    const qrSrc = qrImage.getAttribute("src") ?? "";
    const decodedQrSrc = decodeURIComponent(qrSrc);
    expect(decodedQrSrc).toContain("capture=");
    expect(decodedQrSrc).toContain("project=project_");
    expect(decodedQrSrc).not.toContain(".project_");

    const registerCall = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url).includes("/api/capture-sessions/") && (init as RequestInit | undefined)?.method === "PUT",
      );
    const registerBody = JSON.parse(String((registerCall?.[1] as RequestInit | undefined)?.body ?? "{}")) as {
      projectId?: string;
    };

    expect(registerBody.projectId).toMatch(/^project_/);
  });

  it("uses a direct camera path on mobile instead of asking the user to scan a QR code", async () => {
    setDeviceSignals({ width: 390, maxTouchPoints: 5, coarsePointer: true });

    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());
    await signIn();
    await createProject();
    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));

    expect(screen.getByRole("button", { name: /take room photo/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /choose photo/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^upload photo$/i })).toBeNull();
    expect(screen.queryByAltText(/qr code for phone room upload/i)).toBeNull();
    expect(screen.getByText(/no qr needed on this device/i)).toBeTruthy();
  });

  it("publishes support and legal links in the app chrome", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy.html");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms.html");
    expect(screen.getByRole("link", { name: "Support" }).getAttribute("href")).toBe("mailto:roryh1@gmail.com");
  });

  it("shows a guided redesign workflow instead of beta analytics", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    const workflow = screen.getByRole("list", { name: "Redesign workflow" });

    expect(within(workflow).getByText("Account")).toBeTruthy();
    expect(within(workflow).getByText("Project")).toBeTruthy();
    expect(within(workflow).getByText("Photo")).toBeTruthy();
    expect(within(workflow).getByText("Shop")).toBeTruthy();
    expect(screen.queryByText("Beta insights")).toBeNull();
  });

  it("captures a passwordless sign-in and then requires project basics", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    await signIn();

    expect(screen.getByRole("button", { name: /rory hayes/i })).toBeTruthy();
    expect(screen.getByRole("form", { name: /create your first roomwise project/i })).toBeTruthy();
    expect(window.localStorage.getItem("roomwise.auth.session.v1")).toContain("rory@example.com");
    expect(screen.queryByRole("button", { name: /upload photo/i })).toBeNull();
  });

  it("lets unauthenticated example viewers return to account onboarding", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /see example/i }));

    expect(screen.getByRole("img", { name: /before room preview/i })).toBeTruthy();
    expect(screen.queryByRole("form", { name: /sign in to roomwise/i })).toBeNull();
    expect(screen.getByLabelText(/start your own redesign/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /start with my room/i }));

    await waitFor(() => expect(screen.getByRole("form", { name: /sign in to roomwise/i })).toBeTruthy());
    expect(screen.queryByRole("img", { name: /before room preview/i })).toBeNull();
  });

  it("keeps account controls reachable in compact mobile layouts", async () => {
    setDeviceSignals({ width: 880, maxTouchPoints: 0, coarsePointer: false });

    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    await signIn();

    const mobileControls = screen.getByLabelText(/mobile account controls/i);

    expect(within(mobileControls).getByText("Rory Hayes")).toBeTruthy();
    expect(within(mobileControls).getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy.html");
    expect(within(mobileControls).getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms.html");
    expect(within(mobileControls).getByRole("link", { name: "Support" }).getAttribute("href")).toBe("mailto:roryh1@gmail.com");

    fireEvent.click(within(mobileControls).getByRole("button", { name: /sign out/i }));

    expect(screen.getByRole("form", { name: /sign in to roomwise/i })).toBeTruthy();
  });

  it("validates project setup before moving to photo consent", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());
    await signIn();

    const projectForm = screen.getByRole("form", { name: /create your first roomwise project/i });
    fireEvent.change(within(projectForm).getByLabelText("Project name"), { target: { value: "" } });
    fireEvent.click(within(projectForm).getByRole("button", { name: /create project/i }));

    expect(screen.getByRole("alert").textContent).toContain("Add a project name");
  });

  it("exposes the complete room brief controls in the design drawer", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    await signIn();
    await createProject();
    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));
    fireEvent.click(screen.getByRole("button", { name: /use sample/i }));

    expect(screen.getByLabelText("Room")).toBeTruthy();
    expect(screen.getByLabelText("Style")).toBeTruthy();
    expect(screen.getByLabelText("Colour palette")).toBeTruthy();
    expect(screen.getByLabelText("Budget")).toBeTruthy();
    expect(screen.getByLabelText("Redesign level")).toBeTruthy();
    expect(screen.getByLabelText("Shopping priority")).toBeTruthy();
  });

  it("sign out returns to the public landing gate and hides project upload state", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Demo mode")).toBeTruthy());

    await signIn();
    await createProject();
    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));
    expect(screen.getByRole("button", { name: /upload photo/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(screen.getByRole("form", { name: /sign in to roomwise/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upload photo/i })).toBeNull();
    expect(window.localStorage.getItem("roomwise.auth.session.v1")).toBeNull();
  });

  it("requires consent before uploading a project-bound phone-capture photo", () => {
    window.history.pushState({}, "", "/?capture=session-123&project=project_abc123");
    render(<App />);

    const captureButton = screen.getByRole("button", { name: /take or choose photo/i }) as HTMLButtonElement;
    expect(captureButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));

    expect(captureButton.disabled).toBe(false);
  });

  it("blocks phone-capture links that are missing their project binding", () => {
    window.history.pushState({}, "", "/?capture=session-123");
    render(<App />);

    const captureButton = screen.getByRole("button", { name: /take or choose photo/i }) as HTMLButtonElement;

    expect(screen.getByText(/missing its project/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/i have the right to use this room photo/i));
    expect(captureButton.disabled).toBe(true);
  });
});
