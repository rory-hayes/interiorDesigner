import {
  ArrowRight,
  BadgeEuro,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Mail,
  Palette,
  Phone,
  RefreshCcw,
  RotateCw,
  Settings,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { concepts, palettes, products, roomTypes, styles } from "./data/catalog";
import { checkIntegrationMode, generateRoomRender } from "./lib/api";
import {
  betaLegalLinks,
  photoConsentLabel,
  photoConsentRequiredMessage,
  phoneCaptureConsentDetail,
} from "./lib/betaSafeguards";
import {
  appendBetaTelemetryEvent,
  readBetaTelemetry,
  type BetaTelemetryEventName,
} from "./lib/betaTelemetry";
import {
  calculateCartSummary,
  createInitialSelection,
  removeProduct,
  swapProduct,
} from "./lib/recommendations";
import {
  buildGoogleOAuthUrl,
  clearAuthSession,
  clearOnboardingProject,
  createDemoAuthSession,
  createOnboardingProject,
  fetchLatestSupabaseProject,
  isSupabaseConfigured,
  isValidEmail,
  projectToPreferences,
  readAuthSession,
  readOnboardingProject,
  readSignupDraft,
  readSupabaseSessionFromUrl,
  requestEmailMagicLink,
  saveAuthSession,
  saveOnboardingProject,
  saveRoomPhotoAsset,
  saveSupabaseProject,
  saveSignupDraft,
  type AuthSession,
  type OnboardingProject,
  type ProjectSetupInput,
} from "./lib/onboarding";
import { normalizeRoomPhoto } from "./lib/roomPhoto";
import { copyShoppingList, formatCurrency } from "./lib/share";
import {
  clearPersistedWorkspace,
  readPersistedWorkspace,
  savePersistedWorkspace,
} from "./lib/workspacePersistence";
import type {
  GeneratedRender,
  GenerationStatus,
  IntegrationMode,
  Product,
  ProjectPreferences,
  RoomConcept,
  UploadedRoom,
} from "./types";

const initialPreferences: ProjectPreferences = {
  budget: 2500,
  style: "warm-minimal",
  palette: "walnut-cream",
  roomType: "living-room",
  location: "Dublin, Ireland",
  designIntensity: "balanced",
  shoppingPriority: "balanced",
  mustKeep: "",
};

const statusSequence: GenerationStatus[] = ["analyzing", "matching", "rendering", "ready"];

const styleNames = new Map(styles.map((style) => [style.id, style.label]));
const paletteNames = new Map(palettes.map((palette) => [palette.id, palette.label]));
const roomTypeNames = new Map(roomTypes.map((room) => [room.id, room.label]));

function getInitialSignupDraft() {
  return readSignupDraft();
}

function getInitialPreferences() {
  const persisted = readPersistedWorkspace();

  return {
    ...initialPreferences,
    ...persisted.preferences,
  };
}

function getInitialConceptId(): RoomConcept["id"] {
  const persisted = readPersistedWorkspace();
  const conceptId = persisted.selectedConceptId;

  return concepts.some((concept) => concept.id === conceptId) ? conceptId! : "warm-minimal";
}

function getInitialSelectedProducts() {
  const persisted = readPersistedWorkspace();
  const selectedIds = persisted.selectedProductIds ?? [];

  return selectedIds
    .map((productId) => products.find((product) => product.id === productId))
    .filter((product): product is Product => Boolean(product));
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function isGenerating(status: GenerationStatus) {
  return status === "analyzing" || status === "matching" || status === "rendering";
}

function isBrowserFriendlyImage(file: File) {
  const lowerName = file.name.toLowerCase();

  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  );
}

function buildQrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(value)}`;
}

function isLikelyMobileCaptureDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const mobileUserAgent = /android|iphone|ipad|ipod|mobile|windows phone/.test(userAgent);
  const narrowViewport = window.innerWidth <= 820;
  const touchCapable = navigator.maxTouchPoints > 0;
  const coarsePointer =
    typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : false;

  return mobileUserAgent || (narrowViewport && (touchCapable || coarsePointer));
}

function isCompactAppLayout() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth <= 920;
}

function clearSupabaseAuthParams() {
  const url = new URL(window.location.href);
  const authKeys = ["access_token", "expires_at", "expires_in", "provider_token", "refresh_token", "token_type", "type"];

  authKeys.forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function CaptureUpload({ sessionId, projectId }: { sessionId: string; projectId: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const hasProjectBinding = Boolean(projectId);
  const [message, setMessage] = useState(
    hasProjectBinding
      ? "Take a clear photo in daylight, showing as much of the room as possible."
      : "This capture link is missing its project. Scan a fresh QR code from Roomwise.",
  );
  const [captureConsent, setCaptureConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!projectId) {
      setStatus("error");
      setMessage("This capture link is missing its project. Scan a fresh QR code from Roomwise.");
      return;
    }

    if (!captureConsent) {
      setStatus("error");
      setMessage(photoConsentRequiredMessage);
      return;
    }

    if (!isBrowserFriendlyImage(file)) {
      setStatus("error");
      setMessage("Please choose a JPG, PNG, or WebP room photo.");
      return;
    }

    setStatus("uploading");
    setMessage("Uploading your room photo to the design session...");

    try {
      const roomPhoto = await normalizeRoomPhoto(file);
      const response = await fetch(`/api/capture-sessions/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: roomPhoto.dataUrl,
          name: file.name,
          type: roomPhoto.type,
          size: roomPhoto.size,
          projectId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed.");
      }

      setStatus("done");
      setMessage("Photo added. You can go back to the larger screen to finish the redesign.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not upload that photo. Please check the link and try again.");
    }
  }

  return (
    <main className="capture-page">
      <section className="capture-card" aria-label="Phone room upload">
        <div className={status === "done" ? "capture-status done" : "capture-status"}>
          {status === "done" ? <Check size={22} /> : <Camera size={22} />}
        </div>
        <p className="eyebrow">Roomwise phone capture</p>
        <h1>Add a room photo</h1>
        <p>{message}</p>

        <label className="photo-consent capture-consent">
          <input
            checked={captureConsent}
            type="checkbox"
            onChange={(event) => setCaptureConsent(event.target.checked)}
          />
          <span>
            <strong>{photoConsentLabel}</strong>
            <small>{phoneCaptureConsentDetail}</small>
          </span>
        </label>

        <button
          className="primary-button capture-button"
          disabled={!hasProjectBinding || !captureConsent || status === "uploading" || status === "done"}
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          {status === "uploading" ? <Loader2 size={18} /> : <Camera size={18} />}
          {status === "uploading" ? "Uploading..." : status === "done" ? "Photo added" : "Take or choose photo"}
        </button>

        <input
          ref={fileInputRef}
          className="file-input"
          accept="image/jpeg,image/png,image/webp"
          aria-hidden="true"
          capture="environment"
          disabled={!hasProjectBinding || !captureConsent || status === "uploading" || status === "done"}
          tabIndex={-1}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
            event.currentTarget.value = "";
          }}
        />

        <div className="photo-tips">
          <span>Good photo checklist</span>
          <ul>
            <li>Use daylight or bright room lighting.</li>
            <li>Stand back enough to show corners and floor.</li>
            <li>Keep people, pets, and clutter out if you can.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const captureSession = searchParams.get("capture");
  const captureProject = searchParams.get("project") ?? "";

  if (captureSession) {
    return <CaptureUpload sessionId={captureSession} projectId={captureProject} />;
  }

  return <RoomwiseWorkspace />;
}

function RoomwiseWorkspace() {
  const [preferences, setPreferences] = useState<ProjectPreferences>(getInitialPreferences);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(getInitialSelectedProducts);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [selectedConceptId, setSelectedConceptId] = useState<RoomConcept["id"]>(getInitialConceptId);
  const [uploadedRoom, setUploadedRoom] = useState<UploadedRoom | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generatedRender, setGeneratedRender] = useState<GeneratedRender | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>("checking");
  const [shareState, setShareState] = useState<"idle" | "copied" | "fallback">("idle");
  const [previewMode, setPreviewMode] = useState<"before" | "after">("before");
  const [captureSessionId] = useState(createSessionId);
  const [captureCopied, setCaptureCopied] = useState(false);
  const [captureRegistrationStatus, setCaptureRegistrationStatus] = useState<"idle" | "registering" | "ready" | "error">(
    "idle",
  );
  const [photoConsent, setPhotoConsent] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(readAuthSession);
  const [project, setProject] = useState<OnboardingProject | null>(() => readOnboardingProject(readAuthSession()?.user.id));
  const [signupDraft, setSignupDraft] = useState(getInitialSignupDraft);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectSetupInput>(() => ({
    name: `${roomTypeNames.get(preferences.roomType) ?? "Room"} redesign`,
    roomType: preferences.roomType,
    location: preferences.location,
    budget: preferences.budget,
  }));
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isDirectCameraDevice, setIsDirectCameraDevice] = useState(isLikelyMobileCaptureDevice);
  const [isCompactLayout, setIsCompactLayout] = useState(isCompactAppLayout);
  const [telemetryEvents, setTelemetryEvents] = useState(readBetaTelemetry);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const signupEmailRef = useRef<HTMLInputElement>(null);
  const hasTrackedWorkspaceOpen = useRef(false);
  const timers = useRef<number[]>([]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const summary = useMemo(
    () => calculateCartSummary(selectedProducts, preferences.budget),
    [preferences.budget, selectedProducts],
  );
  const hasPlan = selectedProducts.length > 0;
  const isAuthenticated = Boolean(authSession);
  const hasProject = Boolean(project);
  const canUseCapture = isAuthenticated && hasProject && photoConsent;
  const canUploadRealPhoto = isAuthenticated && hasProject && photoConsent;
  const isSamplePhoto = uploadedRoom?.name.toLowerCase().includes("sample") ?? false;
  const canGenerateLive = Boolean(uploadedRoom && authSession && project && photoConsent && !isSamplePhoto);
  const activeStep = !authSession
    ? "account"
    : !project
      ? "project"
      : !photoConsent
        ? "consent"
        : !uploadedRoom
          ? "photo"
          : hasPlan
            ? "shop"
            : "brief";
  const captureUrl = useMemo(() => {
    if (!project) {
      return "";
    }

    const captureParams = new URLSearchParams({
      capture: captureSessionId,
      project: project.id,
    });

    return `${window.location.origin}${window.location.pathname}?${captureParams.toString()}`;
  }, [captureSessionId, project]);
  const qrUrl = useMemo(() => buildQrUrl(captureUrl), [captureUrl]);
  const displayedRoomUrl = previewMode === "after" && generatedRender ? generatedRender.imageUrl : uploadedRoom?.url;
  const workflowSteps = [
    {
      label: "Account",
      detail: authSession ? authSession.user.email : "Sign in",
      state: authSession ? "complete" : "active",
    },
    {
      label: "Project",
      detail: project ? project.name : "Room basics",
      state: project ? "complete" : authSession ? "active" : "idle",
    },
    {
      label: "Photo",
      detail: uploadedRoom ? "Ready" : photoConsent ? (isDirectCameraDevice ? "Take or choose" : "Upload or scan") : "Consent first",
      state: uploadedRoom ? "complete" : project ? "active" : "idle",
    },
    {
      label: "Shop",
      detail: hasPlan ? `${summary.itemCount} matched items` : "Generate and shop",
      state: hasPlan ? "complete" : uploadedRoom || isGenerating(status) ? "active" : "idle",
    },
  ] as const;

  function trackBetaEvent(name: BetaTelemetryEventName, mode: IntegrationMode | "unknown" = integrationMode) {
    setTelemetryEvents(appendBetaTelemetryEvent({ name, mode }));
  }

  useEffect(() => {
    return () => {
      timers.current.forEach(window.clearTimeout);
      if (uploadedRoom?.objectUrl) {
        URL.revokeObjectURL(uploadedRoom.url);
      }
    };
  }, [uploadedRoom]);

  useEffect(() => {
    void checkIntegrationMode().then(setIntegrationMode);
  }, []);

  useEffect(() => {
    function updateDevicePath() {
      setIsDirectCameraDevice(isLikelyMobileCaptureDevice());
      setIsCompactLayout(isCompactAppLayout());
    }

    updateDevicePath();
    window.addEventListener("resize", updateDevicePath);

    return () => window.removeEventListener("resize", updateDevicePath);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void readSupabaseSessionFromUrl()
      .then((session) => {
        if (!session || cancelled) {
          return;
        }

        saveAuthSession(session);
        setAuthSession(session);
        clearSupabaseAuthParams();
        setSignupError(null);
      })
      .catch((error) => {
        if (!cancelled) {
          setSignupError(error instanceof Error ? error.message : "Could not finish Supabase sign in.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authSession?.accessToken) {
      return;
    }

    let cancelled = false;

    void fetchLatestSupabaseProject(authSession)
      .then((latestProject) => {
        if (!latestProject || cancelled) {
          return;
        }

        saveOnboardingProject(latestProject);
        setProject(latestProject);
        updatePreferences(projectToPreferences(latestProject));
      })
      .catch((error) => {
        if (!cancelled) {
          setSignupError(error instanceof Error ? error.message : "Could not load your latest project.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authSession?.accessToken, authSession?.user.id]);

  useEffect(() => {
    if (hasTrackedWorkspaceOpen.current) {
      return;
    }

    hasTrackedWorkspaceOpen.current = true;
    trackBetaEvent("workspace_opened", "unknown");
  });

  useEffect(() => {
    savePersistedWorkspace({
      preferences,
      selectedConceptId,
      selectedProductIds: selectedProducts.map((product) => product.id),
    });
  }, [preferences, selectedConceptId, selectedProducts]);

  useEffect(() => {
    if (!canUseCapture || isDirectCameraDevice || !project || uploadedRoom) {
      setCaptureRegistrationStatus("idle");
      return;
    }

    const controller = new AbortController();

    setCaptureRegistrationStatus("registering");

    void fetch(`/api/capture-sessions/${captureSessionId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        ownerId: authSession?.user.id,
      }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not prepare the phone capture link.");
        }

        if (!controller.signal.aborted) {
          setCaptureRegistrationStatus("ready");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setCaptureRegistrationStatus("error");
        }
      });

    return () => controller.abort();
  }, [authSession?.user.id, canUseCapture, captureSessionId, isDirectCameraDevice, project, uploadedRoom]);

  useEffect(() => {
    if (!canUseCapture || !project || uploadedRoom || isDirectCameraDevice || captureRegistrationStatus !== "ready") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/capture-sessions/${captureSessionId}?projectId=${encodeURIComponent(project.id)}`,
        );
        const payload = (await response.json()) as {
          capture?: {
            imageDataUrl: string;
            name: string;
            type: string;
            size: number;
          } | null;
        };

        if (!payload.capture) {
          return;
        }

        if (authSession && project) {
          await saveRoomPhotoAsset({
            session: authSession,
            project,
            imageDataUrl: payload.capture.imageDataUrl,
            name: payload.capture.name,
            type: payload.capture.type,
            size: payload.capture.size,
            sourceDevice: "phone-capture",
          });
        }

        setUploadedRoom({
          url: payload.capture.imageDataUrl,
          dataUrl: payload.capture.imageDataUrl,
          name: payload.capture.name,
          type: payload.capture.type,
          size: payload.capture.size,
          objectUrl: false,
        });
        setPreviewMode("before");
        setGeneratedRender(null);
        setGenerationError(null);
        setSelectedProducts([]);
        setUploadError(null);
        setShareState("idle");
        setStatus("idle");
        trackBetaEvent("phone_capture_photo_received", integrationMode);
      } catch {
        // The capture bridge is a progressive enhancement; local design still works without it.
      }
    }, 1800);

    return () => window.clearInterval(interval);
  }, [
    authSession,
    canUseCapture,
    captureRegistrationStatus,
    captureSessionId,
    isDirectCameraDevice,
    project,
    uploadedRoom,
    integrationMode,
  ]);

  function updatePreferences(nextPreferences: Partial<ProjectPreferences>) {
    setPreferences((current) => ({ ...current, ...nextPreferences }));
  }

  function handleFocusSignup() {
    if (!signupEmailRef.current && !authSession) {
      if (uploadedRoom?.objectUrl) {
        URL.revokeObjectURL(uploadedRoom.url);
      }

      setUploadedRoom(null);
      setGeneratedRender(null);
      setGenerationError(null);
      setSelectedProducts([]);
      setPreviewMode("before");
      setStatus("idle");
      setUploadError(null);
      window.setTimeout(() => signupEmailRef.current?.focus(), 0);
      return;
    }

    signupEmailRef.current?.focus();
  }

  function clearPrivateWorkspaceState() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];

    if (uploadedRoom?.objectUrl) {
      URL.revokeObjectURL(uploadedRoom.url);
    }

    setProject(null);
    setPhotoConsent(false);
    setUploadedRoom(null);
    setUploadError(null);
    setGeneratedRender(null);
    setGenerationError(null);
    setSelectedProducts([]);
    setShareState("idle");
    setPreviewMode("before");
    setCaptureRegistrationStatus("idle");
    setStatus("idle");
  }

  async function handleGoogleSignin() {
    const googleUrl = buildGoogleOAuthUrl(window.location.href);

    if (googleUrl) {
      window.location.assign(googleUrl);
      return;
    }

    const email = signupDraft.email.trim().toLowerCase();
    const name = signupDraft.name.trim() || "Roomwise user";

    if (!isValidEmail(email)) {
      setSignupError("Enter your email first so the demo session has an account identity.");
      setSignupMessage(null);
      return;
    }

    const session = createDemoAuthSession({ name, email });
    saveAuthSession(session);
    setAuthSession(session);
    setProject(readOnboardingProject(session.user.id));
    setSignupError(null);
    setSignupMessage("Signed in locally. Connect Supabase to enable Google in production.");
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = signupDraft.name.trim();
    const email = signupDraft.email.trim().toLowerCase();

    if (!name) {
      setSignupError("Add your name to create the workspace.");
      setSignupMessage(null);
      return;
    }

    if (!isValidEmail(email)) {
      setSignupError("Enter a valid email address.");
      setSignupMessage(null);
      return;
    }

    saveSignupDraft({ name, email });

    try {
      const result = await requestEmailMagicLink(email, window.location.href);

      if (result.mode === "supabase") {
        setSignupError(null);
        setSignupMessage("Check your email for the Roomwise sign-in link.");
        return;
      }

      const session = createDemoAuthSession({ name, email });
      saveAuthSession(session);
      setAuthSession(session);
      setProject(readOnboardingProject(session.user.id));
      setSignupError(null);
      setSignupMessage("Signed in locally. Connect Supabase to send magic links in production.");
    } catch (error) {
      setSignupError(error instanceof Error ? error.message : "Could not start sign in. Please try again.");
      setSignupMessage(null);
    }
  }

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authSession) {
      setProjectError("Sign in before creating a project.");
      return;
    }

    const name = projectDraft.name.trim();
    const location = projectDraft.location.trim();

    if (!name) {
      setProjectError("Add a project name.");
      return;
    }

    if (!projectDraft.roomType) {
      setProjectError("Choose a room type.");
      return;
    }

    if (!location) {
      setProjectError("Add the country or city for shopping availability.");
      return;
    }

    const nextProject = createOnboardingProject(
      {
        ...projectDraft,
        name,
        location,
      },
      authSession.user.id,
    );

    try {
      await saveSupabaseProject(nextProject, authSession);
      saveOnboardingProject(nextProject);
      setProject(nextProject);
      updatePreferences(projectToPreferences(nextProject));
      setProjectError(null);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not save this project. Please try again.");
    }
  }

  function handlePhotoConsentChange(checked: boolean) {
    setPhotoConsent(checked);

    if (checked) {
      trackBetaEvent("photo_consent_confirmed", integrationMode);
    }

    if (checked && uploadError === photoConsentRequiredMessage) {
      setUploadError(null);
    }
  }

  function handleSignOut() {
    clearAuthSession();
    clearOnboardingProject();
    clearPersistedWorkspace();
    setAuthSession(null);
    clearPrivateWorkspaceState();
    setPreferences(initialPreferences);
    setSelectedConceptId("warm-minimal");
    trackBetaEvent("workspace_reset", integrationMode);
  }

  async function getRoomDataUrl(): Promise<string | null> {
    if (!uploadedRoom) {
      return null;
    }

    if (uploadedRoom.dataUrl) {
      return uploadedRoom.dataUrl;
    }

    const response = await fetch(uploadedRoom.url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read room image."));
      reader.readAsDataURL(blob);
    });
  }

  async function handleGeneratePlan() {
    if (!uploadedRoom) {
      setUploadError("Add a room photo first so Roomwise can redesign the actual space.");
      return;
    }

    if (!canGenerateLive && !isSamplePhoto) {
      setUploadError("Sign in, create a project, and confirm photo consent before generating a redesign.");
      return;
    }

    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setShareState("idle");
    setGeneratedRender(null);
    setGenerationError(null);
    setPreviewMode("after");
    setStatus("analyzing");
    trackBetaEvent("generation_started", canGenerateLive ? integrationMode : "demo");

    statusSequence.slice(1).forEach((nextStatus, index) => {
      const timer = window.setTimeout(
        async () => {
          setStatus(nextStatus);
          if (nextStatus === "ready") {
            const conceptForGeneration =
              concepts.find((concept) =>
                concept.id === (preferences.style === "warm-minimal" ? "warm-minimal" : "soft-modern"),
              ) ?? selectedConcept;

            setSelectedProducts(createInitialSelection(preferences, products));
            setSelectedConceptId(conceptForGeneration.id);

            const roomDataUrl = await getRoomDataUrl();

            if (roomDataUrl && integrationMode === "live" && canGenerateLive) {
              setStatus("rendering");
              try {
                const render = await generateRoomRender({
                  imageDataUrl: roomDataUrl,
                  preferences,
                  concept: conceptForGeneration,
                });
                setGeneratedRender(render);
                setStatus("ready");
                trackBetaEvent("generation_completed", "live");
              } catch (error) {
                setGenerationError(error instanceof Error ? error.message : "OpenAI render failed.");
                setStatus("ready");
                trackBetaEvent("generation_failed", "live");
              }
            } else {
              trackBetaEvent("generation_completed", canGenerateLive ? integrationMode : "demo");
            }
          }
        },
        720 * (index + 1),
      );
      timers.current.push(timer);
    });
  }

  async function handleUpload(file: File) {
    if (!authSession || !project) {
      setUploadedRoom(null);
      setUploadError("Create your Roomwise account and project before uploading a room photo.");
      setStatus("idle");
      return;
    }

    if (!photoConsent) {
      setUploadedRoom(null);
      setUploadError(photoConsentRequiredMessage);
      setStatus("idle");
      return;
    }

    if (!isBrowserFriendlyImage(file)) {
      setUploadedRoom(null);
      setUploadError("Please upload a JPG, PNG, or WebP room photo.");
      setStatus("idle");
      return;
    }

    try {
      const roomPhoto = await normalizeRoomPhoto(file);

      await saveRoomPhotoAsset({
        session: authSession,
        project,
        imageDataUrl: roomPhoto.dataUrl,
        name: file.name,
        type: roomPhoto.type,
        size: roomPhoto.size,
        sourceDevice: "desktop",
      });

      if (uploadedRoom?.objectUrl) {
        URL.revokeObjectURL(uploadedRoom.url);
      }

      setUploadedRoom({
        url: roomPhoto.dataUrl,
        name: file.name,
        type: roomPhoto.type,
        size: roomPhoto.size,
        objectUrl: false,
        dataUrl: roomPhoto.dataUrl,
      });
      setPreviewMode("before");
      setGeneratedRender(null);
      setGenerationError(null);
      setSelectedProducts([]);
      setUploadError(null);
      setShareState("idle");
      setStatus("idle");
      trackBetaEvent("photo_uploaded", integrationMode);
    } catch (error) {
      setUploadedRoom(null);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not prepare that image. Please try a smaller JPG, PNG, or WebP room photo.",
      );
      setStatus("idle");
    }
  }

  function handleUseSample() {
    if (uploadedRoom?.objectUrl) {
      URL.revokeObjectURL(uploadedRoom.url);
    }

    setUploadedRoom({
      url: "/samples/whatsapp-bedroom.jpeg",
      name: "Sample bedroom photo.jpeg",
      type: "image/jpeg",
      size: 0,
      objectUrl: false,
    });
    setPreferences((current) => ({ ...current, roomType: "bedroom" }));
    setPreviewMode("before");
    setUploadError(null);
    setGeneratedRender(null);
    setGenerationError(null);
    setSelectedProducts([]);
    setStatus("idle");
    trackBetaEvent("sample_photo_used", integrationMode);
  }

  function handlePreviewError() {
    const failedName = uploadedRoom?.name;
    setUploadedRoom(null);
    setUploadError(
      failedName
        ? `Could not preview "${failedName}". Please try a JPG, PNG, or WebP room photo.`
        : "Could not preview that image. Please try a JPG, PNG, or WebP room photo.",
    );
    setStatus("idle");
  }

  async function handleCopyCaptureLink() {
    if (!captureUrl) {
      setUploadError("Create a project and confirm photo consent before using phone capture.");
      return;
    }

    if (captureRegistrationStatus !== "ready") {
      setUploadError("The secure phone link is not ready yet. Please try again in a moment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(captureUrl);
      setCaptureCopied(true);
      trackBetaEvent("phone_capture_link_copied", integrationMode);
      window.setTimeout(() => setCaptureCopied(false), 1600);
    } catch {
      setCaptureCopied(false);
    }
  }

  function handleSwap(productId: string) {
    setSelectedProducts((current) => swapProduct(current, productId, products));
    setShareState("idle");
  }

  function handleRemove(productId: string) {
    setSelectedProducts((current) => removeProduct(current, productId));
    setShareState("idle");
  }

  function handleRestore() {
    setSelectedProducts(createInitialSelection(preferences, products));
    setShareState("idle");
  }

  function handleResetWorkspace() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];

    if (uploadedRoom?.objectUrl) {
      URL.revokeObjectURL(uploadedRoom.url);
    }

    clearPersistedWorkspace();
    setPreferences(initialPreferences);
    setSelectedProducts([]);
    setSelectedConceptId("warm-minimal");
    setUploadedRoom(null);
    setUploadError(null);
    setGeneratedRender(null);
    setGenerationError(null);
    setShareState("idle");
    setPreviewMode("before");
    setCaptureRegistrationStatus("idle");
    setStatus("idle");
    trackBetaEvent("workspace_reset", integrationMode);
  }

  async function handleShare() {
    try {
      await copyShoppingList({
        roomType: preferences.roomType,
        location: preferences.location,
        budget: preferences.budget,
        products: selectedProducts,
      });
      setShareState("copied");
      trackBetaEvent("shopping_list_copied", integrationMode);
    } catch {
      setShareState("fallback");
    }
  }

  return (
    <main className="workspace-shell" aria-label="Roomwise room redesign workspace">
      <header className="workspace-header">
        <div className="header-brand">
          <div className="wordmark">
            <span className="wordmark-mark">R</span>
            <span>Roomwise</span>
          </div>
          <span>{roomTypeNames.get(preferences.roomType) ?? "Room"} redesign</span>
        </div>

        <ol className="workflow-steps" aria-label="Redesign workflow">
          {workflowSteps.map((step, index) => (
            <li className={`workflow-step ${step.state}`} key={step.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          ))}
        </ol>

        <div className="header-actions">
          <span className={integrationMode === "live" ? "mode-pill live" : "mode-pill"}>
            {integrationMode === "checking"
              ? "Checking OpenAI"
              : integrationMode === "live"
                ? "AI render ready"
                : "Demo mode"}
          </span>
          <button className="account-button" type="button" onClick={handleFocusSignup}>
            <UserRound size={15} />
            {authSession ? authSession.user.name : "Sign in"}
          </button>
          {authSession ? (
            <button className="text-button" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
          <nav className="header-links" aria-label="Support and legal links">
            {betaLegalLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <aside className="project-rail" aria-hidden="true" hidden>
        <div className="wordmark">
          <span className="wordmark-mark">R</span>
          <span>Roomwise</span>
        </div>

        <section className="project-card" aria-label="Current project">
          <strong>{roomTypeNames.get(preferences.roomType) ?? "Room"} redesign</strong>
          <span>{preferences.location || "No location set"}</span>
        </section>

        <section className="rail-section" aria-label="Room photo status">
          <p className="rail-label">Photo</p>
          {uploadedRoom ? (
            <div className="photo-added">
              <img src={uploadedRoom.url} alt={`Uploaded room: ${uploadedRoom.name}`} onError={handlePreviewError} />
              <span className="photo-check">
                <Check size={14} />
              </span>
              <strong>{preferences.roomType.replace("-", " ")}</strong>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                Retake photo
              </button>
            </div>
          ) : (
            <div className="photo-empty">
              <ImagePlus size={20} />
              <strong>No room photo yet</strong>
              <span>Add one to start the redesign.</span>
            </div>
          )}
        </section>

        {canUseCapture ? (
          <button className="phone-capture-row" type="button" onClick={handleCopyCaptureLink}>
            <Phone size={19} />
            <span>
              <strong>{captureCopied ? "Link copied" : "Upload from phone"}</strong>
              <small>Scan to take a photo</small>
            </span>
            <ArrowRight size={16} />
          </button>
        ) : null}

        <section className="rail-section workspace-save" aria-label="Workspace save status">
          <p className="rail-label">Workspace</p>
          <div className="save-state">
            <Check size={17} />
            <span>
              <strong>Saved on this device</strong>
              <small>Preferences and shopping picks restore on refresh.</small>
            </span>
          </div>
          <button type="button" onClick={handleResetWorkspace}>
            <RefreshCcw size={14} />
            Reset workspace
          </button>
        </section>

        <section className="rail-section support-links" aria-label="Support and legal links">
          <p className="rail-label">Support</p>
          <div>
            {betaLegalLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </section>

        <div className="rail-footer">
          <span className="avatar">RH</span>
          <span>Rory Hayes</span>
          <Settings size={17} />
        </div>
      </aside>

      <section className="room-stage" aria-label="Room preview and generation">
        <header className="stage-topbar">
          <div className="preview-segment" aria-label="Preview mode">
            <button
              className={previewMode === "before" ? "selected" : ""}
              disabled={!uploadedRoom}
              type="button"
              onClick={() => setPreviewMode("before")}
            >
              Before
            </button>
            <button
              className={previewMode === "after" ? "selected" : ""}
              disabled={!uploadedRoom}
              type="button"
              onClick={() => setPreviewMode("after")}
            >
              After
            </button>
          </div>
        </header>

        <div className={uploadedRoom ? "room-viewport has-photo" : "room-viewport"}>
          {displayedRoomUrl ? (
            <img src={displayedRoomUrl} alt={`${previewMode} room preview`} onError={handlePreviewError} />
          ) : (
            <div className={`upload-hero onboarding-step-${activeStep}`}>
              <div className="landing-copy">
                <h1>Design a room you can actually buy.</h1>
                <p>
                  Upload a room photo, set the style and budget, then generate a realistic redesign with a shopping
                  plan you can act on.
                </p>
                <div className="onboarding-strip" aria-label="How Roomwise works">
                  <span>Add photo</span>
                  <span>Set brief</span>
                  <span>Generate and shop</span>
                </div>

                {!authSession ? (
                  <form className="signup-card auth-card" aria-label="Sign in to Roomwise" onSubmit={handleSignupSubmit}>
                    <div className="signup-card-head">
                      <UserRound size={18} />
                      <span>
                        <strong>Create your free workspace</strong>
                        <small>Sign in before uploading private room photos.</small>
                      </span>
                    </div>
                    <button className="secondary-button auth-provider-button" type="button" onClick={() => void handleGoogleSignin()}>
                      <ShieldCheck size={17} />
                      Continue with Google
                    </button>
                    <div className="signup-fields">
                      <label>
                        <span>Name</span>
                        <input
                          value={signupDraft.name}
                          autoComplete="name"
                          placeholder="Rory Hayes"
                          onChange={(event) => {
                            const nextDraft = { ...signupDraft, name: event.target.value };
                            setSignupDraft(nextDraft);
                            saveSignupDraft(nextDraft);
                            setSignupError(null);
                          }}
                        />
                      </label>
                      <label>
                        <span>Email</span>
                        <input
                          ref={signupEmailRef}
                          value={signupDraft.email}
                          autoComplete="email"
                          inputMode="email"
                          placeholder="you@example.com"
                          type="email"
                          onChange={(event) => {
                            const nextDraft = { ...signupDraft, email: event.target.value };
                            setSignupDraft(nextDraft);
                            saveSignupDraft(nextDraft);
                            setSignupError(null);
                          }}
                        />
                      </label>
                    </div>
                    <button className="primary-button signup-submit" type="submit">
                      <Mail size={17} />
                      Continue with email
                    </button>
                    <p className="auth-note">
                      {isSupabaseConfigured()
                        ? "We will send a passwordless sign-in link."
                        : "Local auth mode is active until Supabase env vars are connected."}
                    </p>
                    {signupError ? (
                      <span className="signup-feedback error" role="alert">
                        {signupError}
                      </span>
                    ) : null}
                    {signupMessage ? (
                      <span className="signup-feedback" role="status">
                        {signupMessage}
                      </span>
                    ) : null}
                    <div className="upload-actions landing-actions">
                      <button className="secondary-button" type="button" onClick={handleUseSample}>
                        See example
                      </button>
                    </div>
                  </form>
                ) : null}

                {authSession && !project ? (
                  <form
                    className="signup-card project-setup-card"
                    aria-label="Create your first Roomwise project"
                    onSubmit={handleProjectSubmit}
                  >
                    <div className="signup-card-head">
                      <ClipboardList size={18} />
                      <span>
                        <strong>Set up the room</strong>
                        <small>Keep this short. Style and detail choices come after upload.</small>
                      </span>
                    </div>
                    <div className="signup-fields project-fields">
                      <label>
                        <span>Project name</span>
                        <input
                          value={projectDraft.name}
                          autoComplete="off"
                          placeholder="Living room redesign"
                          onChange={(event) => {
                            setProjectDraft((current) => ({ ...current, name: event.target.value }));
                            setProjectError(null);
                          }}
                        />
                      </label>
                      <label>
                        <span>Room type</span>
                        <select
                          value={projectDraft.roomType}
                          onChange={(event) => {
                            setProjectDraft((current) => ({
                              ...current,
                              roomType: event.target.value as ProjectPreferences["roomType"],
                            }));
                            setProjectError(null);
                          }}
                        >
                          {roomTypes.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Location or country</span>
                        <input
                          value={projectDraft.location}
                          autoComplete="country-name"
                          placeholder="Dublin, Ireland"
                          onChange={(event) => {
                            setProjectDraft((current) => ({ ...current, location: event.target.value }));
                            setProjectError(null);
                          }}
                        />
                      </label>
                      <label>
                        <span>Budget</span>
                        <select
                          value={projectDraft.budget ?? 2500}
                          onChange={(event) => {
                            setProjectDraft((current) => ({ ...current, budget: Number(event.target.value) }));
                            setProjectError(null);
                          }}
                        >
                          <option value={1200}>EUR 1,200 - light refresh</option>
                          <option value={2500}>EUR 2,500 - balanced redesign</option>
                          <option value={4000}>EUR 4,000 - premium room</option>
                        </select>
                      </label>
                    </div>
                    <button className="primary-button signup-submit" type="submit">
                      Create project
                      <ArrowRight size={17} />
                    </button>
                    {projectError ? (
                      <span className="signup-feedback error" role="alert">
                        {projectError}
                      </span>
                    ) : null}
                  </form>
                ) : null}

                {authSession && project && !photoConsent ? (
                  <section className="signup-card consent-card" aria-label="Photo consent">
                    <div className="signup-card-head">
                      <ShieldCheck size={18} />
                      <span>
                        <strong>Confirm photo consent</strong>
                        <small>Required before desktop upload or phone capture is available.</small>
                      </span>
                    </div>
                    <label className="photo-consent">
                      <input
                        checked={photoConsent}
                        type="checkbox"
                        onChange={(event) => handlePhotoConsentChange(event.target.checked)}
                      />
                      <span>
                        <strong>{photoConsentLabel}</strong>
                        <small>{phoneCaptureConsentDetail}</small>
                      </span>
                    </label>
                  </section>
                ) : null}

                {authSession && project && photoConsent ? (
                  <section className="signup-card upload-gate-card" aria-label="Upload room photo">
                    <div className="signup-card-head">
                      {isDirectCameraDevice ? <Phone size={18} /> : <Camera size={18} />}
                      <span>
                        <strong>{isDirectCameraDevice ? "Take one clear room photo" : "Add one clear room photo"}</strong>
                        <small>
                          {isDirectCameraDevice
                            ? "Use your phone camera now, or choose an existing room photo."
                            : "Upload from this device or scan the QR code with your phone camera."}
                        </small>
                      </span>
                    </div>
                    <div className="upload-actions">
                      {isDirectCameraDevice ? (
                        <>
                          <button
                            className="primary-button"
                            disabled={!canUploadRealPhoto}
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                          >
                            <Camera size={18} />
                            Take room photo
                          </button>
                          <button
                            className="secondary-button"
                            disabled={!canUploadRealPhoto}
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImagePlus size={18} />
                            Choose photo
                          </button>
                        </>
                      ) : (
                        <button
                          className="primary-button"
                          disabled={!canUploadRealPhoto}
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={18} />
                          Upload photo
                        </button>
                      )}
                      <button className="secondary-button" type="button" onClick={handleUseSample}>
                        Use sample
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>
              <div className="landing-side">
                {!authSession ? (
                  <div className="landing-preview-card" aria-hidden="true">
                    <span />
                    <strong>Same room, clearer plan</strong>
                    <small>Before, after, and shopping list stay together.</small>
                  </div>
                ) : null}

                {authSession && !project ? (
                  <div className="onboarding-side-card" aria-label="Onboarding progress">
                    <strong>Next steps</strong>
                    <span className="complete">
                      <Check size={14} />
                      Account created
                    </span>
                    <span className="active">
                      <ClipboardList size={14} />
                      Project basics
                    </span>
                    <span>
                      <Camera size={14} />
                      Photo upload
                    </span>
                  </div>
                ) : null}

                {authSession && project && !photoConsent ? (
                  <div className="onboarding-side-card privacy-card" aria-label="Private photo handling">
                    <ShieldCheck size={22} />
                    <strong>Private by default</strong>
                    <span>Real uploads are locked until consent is confirmed for this project.</span>
                  </div>
                ) : null}

                {canUseCapture && isDirectCameraDevice ? (
                  <div className="onboarding-side-card mobile-camera-card" aria-label="Mobile camera upload">
                    <Phone size={22} />
                    <strong>Camera ready</strong>
                    <span>No QR needed on this device. Take a photo directly from the app.</span>
                  </div>
                ) : null}

                {canUseCapture && !isDirectCameraDevice ? (
                  <div className="qr-card">
                    {captureRegistrationStatus === "ready" ? (
                      <>
                        <ShieldCheck size={19} />
                        <img src={qrUrl} alt="QR code for phone room upload" />
                        <strong>Use your phone camera</strong>
                        <span>Scan to upload into {project?.name ?? "this project"}.</span>
                        <button className="text-button" type="button" onClick={() => void handleCopyCaptureLink()}>
                          {captureCopied ? "Copied" : "Copy link"}
                        </button>
                      </>
                    ) : captureRegistrationStatus === "error" ? (
                      <>
                        <ShieldCheck size={19} />
                        <strong>Phone link unavailable</strong>
                        <span>Upload from this device, or try refreshing the page before scanning.</span>
                      </>
                    ) : (
                      <>
                        <Loader2 size={19} />
                        <strong>Preparing secure phone link</strong>
                        <span>We are tying this QR code to {project?.name ?? "this project"}.</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {isGenerating(status) ? (
            <div className="render-status" role="status">
              <Loader2 size={22} />
              <strong>
                {status === "analyzing"
                  ? "Reading the room"
                  : status === "matching"
                    ? "Planning buyable changes"
                    : "Generating redesign"}
              </strong>
              <span>Keeping architecture fixed while refreshing furniture, lighting, and finishes.</span>
            </div>
          ) : null}

          {previewMode === "after" && status === "ready" && !generatedRender ? (
            <div className="demo-render-note" role="status">
              <Sparkles size={18} />
              <span>
                {generationError
                  ? `OpenAI render failed: ${generationError}`
                  : integrationMode === "live"
                    ? "OpenAI is connected. Try Generate again if the after image has not appeared."
                    : "Demo mode: add OPENAI_API_KEY to generate a real after image."}
              </span>
            </div>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          className="file-input"
          accept="image/jpeg,image/png,image/webp"
          aria-hidden="true"
          disabled={!canUploadRealPhoto}
          tabIndex={-1}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUpload(file);
            }
            event.currentTarget.value = "";
          }}
        />

        <input
          ref={cameraInputRef}
          className="file-input"
          accept="image/jpeg,image/png,image/webp"
          aria-hidden="true"
          capture="environment"
          disabled={!canUploadRealPhoto}
          tabIndex={-1}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUpload(file);
            }
            event.currentTarget.value = "";
          }}
        />

        {uploadError ? <p className="upload-error" role="status">{uploadError}</p> : null}

        <footer className="stage-actionbar">
          <div className={uploadedRoom ? "ready-state ready" : "ready-state"}>
            {uploadedRoom ? <Check size={17} /> : <Camera size={17} />}
            <strong>
              {uploadedRoom
                ? "Photo ready"
                : !authSession
                  ? "Account required"
                  : !project
                    ? "Project basics"
                    : !photoConsent
                      ? "Consent required"
                      : "Waiting for photo"}
            </strong>
            <span>
              {uploadedRoom
                ? "Room structure will be preserved for the redesign."
                : !authSession
                  ? "Sign in before uploading private room photos."
                  : !project
                    ? "Create a project to unlock upload."
                    : !photoConsent
                      ? "Confirm photo consent to unlock upload and phone capture."
                      : isDirectCameraDevice
                        ? "Take a photo or choose one from this phone."
                        : "Upload or scan the QR code to add a room."}
            </span>
          </div>
          <button
            className="primary-button generate-button"
            disabled={!uploadedRoom || isGenerating(status) || (!canGenerateLive && !isSamplePhoto)}
            type="button"
            onClick={() => void handleGeneratePlan()}
          >
            {isGenerating(status) ? <Loader2 size={18} /> : <Sparkles size={18} />}
            {isGenerating(status) ? "Generating..." : "Generate redesign"}
            <ArrowRight size={18} />
          </button>
        </footer>
      </section>

      <aside className="design-drawer" aria-label="Design preferences and shopping plan">
        <section className="drawer-section intro">
          <p className="eyebrow">{uploadedRoom ? "Step 4 · Design brief" : "Onboarding"}</p>
          <h2>{uploadedRoom ? "Tell us what should change." : "Your private project starts here."}</h2>
          {authSession && isCompactLayout ? (
            <div className="drawer-account-row" aria-label="Mobile account controls">
              <span>
                <UserRound size={15} />
                <strong>{authSession.user.name}</strong>
              </span>
              <button className="text-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
              <nav aria-label="Mobile support and legal links">
                {betaLegalLinks.map((link) => (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          ) : null}
          {!authSession && uploadedRoom && isSamplePhoto ? (
            <div className="demo-conversion-card" aria-label="Start your own redesign">
              <span>
                <UserRound size={16} />
                <strong>Ready to use your own room?</strong>
              </span>
              <p>Create a workspace first, then upload a private room photo from this device or your phone camera.</p>
              <button className="primary-button" type="button" onClick={handleFocusSignup}>
                Start with my room
                <ArrowRight size={16} />
              </button>
            </div>
          ) : null}
        </section>

        {uploadedRoom ? (
          <>
        <section className="preference-stack" aria-label="Room brief">
          <label className="quiet-field">
            <span>
              <Camera size={15} />
              Room
            </span>
            <select
              value={preferences.roomType}
              onChange={(event) => updatePreferences({ roomType: event.target.value as ProjectPreferences["roomType"] })}
            >
              {roomTypes.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="quiet-field">
            <span>
              <Palette size={15} />
              Style
            </span>
            <select
              value={preferences.style}
              onChange={(event) => updatePreferences({ style: event.target.value as ProjectPreferences["style"] })}
            >
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="quiet-field">
            <span>
              <Palette size={15} />
              Colour palette
            </span>
            <select
              value={preferences.palette}
              onChange={(event) => updatePreferences({ palette: event.target.value as ProjectPreferences["palette"] })}
            >
              {palettes.map((palette) => (
                <option key={palette.id} value={palette.id}>
                  {palette.label}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="quiet-field">
            <span>
              <BadgeEuro size={15} />
              Budget
            </span>
            <select value={preferences.budget} onChange={(event) => updatePreferences({ budget: Number(event.target.value) })}>
              <option value={1200}>EUR 1,200 - light refresh</option>
              <option value={2500}>EUR 2,500 - balanced redesign</option>
              <option value={4000}>EUR 4,000 - premium room</option>
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="quiet-field">
            <span>
              <Sparkles size={15} />
              Redesign level
            </span>
            <select
              value={preferences.designIntensity}
              onChange={(event) =>
                updatePreferences({ designIntensity: event.target.value as ProjectPreferences["designIntensity"] })
              }
            >
              <option value="light-touch">Light refresh</option>
              <option value="balanced">Balanced redesign</option>
              <option value="full-redesign">Full redesign</option>
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="quiet-field">
            <span>
              <ShoppingBag size={15} />
              Shopping priority
            </span>
            <select
              value={preferences.shoppingPriority}
              onChange={(event) =>
                updatePreferences({ shoppingPriority: event.target.value as ProjectPreferences["shoppingPriority"] })
              }
            >
              <option value="best-value">Best value</option>
              <option value="balanced">Balance of look and value</option>
              <option value="premium">Premium finish</option>
            </select>
            <ChevronDown size={17} />
          </label>

          <label className="must-keep-field">
            <span>Keep or avoid</span>
            <textarea
              value={preferences.mustKeep}
              placeholder="Example: keep the sofa, hide TV cables, avoid beige rugs"
              rows={3}
              onChange={(event) => updatePreferences({ mustKeep: event.target.value })}
            />
          </label>
        </section>

        {hasPlan ? (
          <section className="shopping-plan" aria-label="Shopping plan">
            <div className="shopping-head">
              <div>
                <p className="eyebrow">Shopping plan</p>
                <h2>{summary.itemCount} matched items</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Restore curated list" onClick={handleRestore}>
                <RefreshCcw size={17} />
              </button>
            </div>

            <div className={summary.overBudget ? "plan-total over" : "plan-total"}>
              <span>Total</span>
              <strong>{formatCurrency(summary.total)}</strong>
              <small>
                {summary.overBudget ? "Over by" : "Remaining"} {formatCurrency(Math.abs(summary.remaining))}
              </small>
            </div>

            <div className="product-list">
              {selectedProducts.slice(0, 5).map((product) => (
                <article className="product-row" key={product.id}>
                  <span className="product-swatch" style={{ background: product.swatch }} />
                  <div>
                    <h3>{product.name}</h3>
                    <p>
                      {product.retailer} - {product.color}
                    </p>
                    <a href={product.url} target="_blank" rel="noreferrer">
                      View retailer <ExternalLink size={12} />
                    </a>
                  </div>
                  <strong>{formatCurrency(product.price)}</strong>
                  <span className="product-actions">
                    <button type="button" aria-label={`Swap ${product.name}`} onClick={() => handleSwap(product.id)}>
                      <RotateCw size={14} />
                    </button>
                    <button type="button" aria-label={`Remove ${product.name}`} onClick={() => handleRemove(product.id)}>
                      <Trash2 size={14} />
                    </button>
                  </span>
                </article>
              ))}
            </div>

            <button className="secondary-button share-button" type="button" onClick={() => void handleShare()}>
              <Copy size={16} />
              {shareState === "copied" ? "Copied shopping list" : "Copy shopping list"}
            </button>
          </section>
        ) : (
          <section className="locked-shopping" aria-label="Shopping plan placeholder">
            <ClipboardList size={18} />
            <div>
              <strong>Shopping plan will appear after render</strong>
              <span>
                We will match pieces to {styleNames.get(preferences.style)} style, {paletteNames.get(preferences.palette)} palette,
                and your {formatCurrency(preferences.budget)} budget.
              </span>
            </div>
            <ArrowRight size={16} />
          </section>
        )}
          </>
        ) : (
          <section className="drawer-locked" aria-label="Onboarding checklist">
            <span className={authSession ? "complete" : "active"}>
              <UserRound size={16} />
              <strong>{authSession ? "Signed in" : "Sign in required"}</strong>
            </span>
            <span className={project ? "complete" : authSession ? "active" : ""}>
              <ClipboardList size={16} />
              <strong>{project ? project.name : "Create project"}</strong>
            </span>
            <span className={photoConsent ? "complete" : project ? "active" : ""}>
              <ShieldCheck size={16} />
              <strong>{photoConsent ? "Photo consent confirmed" : "Confirm consent"}</strong>
            </span>
            <span className={uploadedRoom ? "complete" : photoConsent ? "active" : ""}>
              <Camera size={16} />
              <strong>{uploadedRoom ? "Photo uploaded" : "Upload photo"}</strong>
            </span>
          </section>
        )}
      </aside>
    </main>
  );
}
