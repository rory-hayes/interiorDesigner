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
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { concepts, palettes, products, roomTypes, styles } from "./data/catalog";
import { checkIntegrationMode, generateRoomRender } from "./lib/api";
import {
  betaLegalLinks,
  photoConsentLabel,
  photoConsentRequiredMessage,
  phoneCaptureConsentDetail,
} from "./lib/betaSafeguards";
import {
  calculateCartSummary,
  createInitialSelection,
  removeProduct,
  swapProduct,
} from "./lib/recommendations";
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
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

function CaptureUpload({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("Take a clear photo in daylight, showing as much of the room as possible.");
  const [captureConsent, setCaptureConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
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
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch(`/api/capture-sessions/${sessionId}/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl,
          name: file.name,
          type: file.type || "image",
          size: file.size,
        }),
      });

      if (!response.ok) {
        throw new Error("Upload failed.");
      }

      setStatus("done");
      setMessage("Photo added. You can go back to the larger screen to finish the redesign.");
    } catch {
      setStatus("error");
      setMessage("We could not upload that photo. Please check the link and try again.");
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
          disabled={!captureConsent || status === "uploading" || status === "done"}
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
          capture="environment"
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
  const captureSession = new URLSearchParams(window.location.search).get("capture");

  if (captureSession) {
    return <CaptureUpload sessionId={captureSession} />;
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
  const [photoConsent, setPhotoConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const summary = useMemo(
    () => calculateCartSummary(selectedProducts, preferences.budget),
    [preferences.budget, selectedProducts],
  );
  const captureUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?capture=${captureSessionId}`,
    [captureSessionId],
  );
  const qrUrl = useMemo(() => buildQrUrl(captureUrl), [captureUrl]);
  const hasPlan = selectedProducts.length > 0;
  const displayedRoomUrl = previewMode === "after" && generatedRender ? generatedRender.imageUrl : uploadedRoom?.url;

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
    savePersistedWorkspace({
      preferences,
      selectedConceptId,
      selectedProductIds: selectedProducts.map((product) => product.id),
    });
  }, [preferences, selectedConceptId, selectedProducts]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/capture-sessions/${captureSessionId}`);
        const payload = (await response.json()) as {
          capture?: {
            imageDataUrl: string;
            name: string;
            type: string;
            size: number;
          } | null;
        };

        if (!payload.capture || uploadedRoom?.url === payload.capture.imageDataUrl) {
          return;
        }

        if (uploadedRoom?.objectUrl) {
          URL.revokeObjectURL(uploadedRoom.url);
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
      } catch {
        // The capture bridge is a progressive enhancement; local design still works without it.
      }
    }, 1800);

    return () => window.clearInterval(interval);
  }, [captureSessionId, uploadedRoom]);

  function updatePreferences(nextPreferences: Partial<ProjectPreferences>) {
    setPreferences((current) => ({ ...current, ...nextPreferences }));
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

    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setShareState("idle");
    setGeneratedRender(null);
    setGenerationError(null);
    setPreviewMode("after");
    setStatus("analyzing");

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

            if (roomDataUrl && integrationMode === "live") {
              setStatus("rendering");
              try {
                const render = await generateRoomRender({
                  imageDataUrl: roomDataUrl,
                  preferences,
                  concept: conceptForGeneration,
                });
                setGeneratedRender(render);
                setStatus("ready");
              } catch (error) {
                setGenerationError(error instanceof Error ? error.message : "OpenAI render failed.");
                setStatus("ready");
              }
            }
          }
        },
        720 * (index + 1),
      );
      timers.current.push(timer);
    });
  }

  async function handleUpload(file: File) {
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

    const objectUrl = URL.createObjectURL(file);

    try {
      const dataUrl = await readFileAsDataUrl(file);

      if (uploadedRoom?.objectUrl) {
        URL.revokeObjectURL(uploadedRoom.url);
      }

      setUploadedRoom({
        url: objectUrl,
        name: file.name,
        type: file.type || "image",
        size: file.size,
        objectUrl: true,
        dataUrl,
      });
      setPreviewMode("before");
      setGeneratedRender(null);
      setGenerationError(null);
      setSelectedProducts([]);
      setUploadError(null);
      setShareState("idle");
      setStatus("idle");
    } catch {
      URL.revokeObjectURL(objectUrl);
      setUploadedRoom(null);
      setUploadError("Could not read that image. Please try another JPG, PNG, or WebP room photo.");
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
    try {
      await navigator.clipboard.writeText(captureUrl);
      setCaptureCopied(true);
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
    setStatus("idle");
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
    } catch {
      setShareState("fallback");
    }
  }

  return (
    <main className="workspace-shell" aria-label="Roomwise room redesign workspace">
      <aside className="project-rail" aria-label="Project navigation">
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

        <button className="phone-capture-row" type="button" onClick={handleCopyCaptureLink}>
          <Phone size={19} />
          <span>
            <strong>{captureCopied ? "Link copied" : "Upload from phone"}</strong>
            <small>Scan to take a photo</small>
          </span>
          <img src={qrUrl} alt="QR code for phone room upload" />
          <ArrowRight size={16} />
        </button>

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
            <div className="upload-hero">
              <div>
                <p className="eyebrow">Start with one room photo</p>
                <h1>Transform your room into a design you can actually buy.</h1>
                <p>
                  Upload from this device or scan the QR code to take a photo on your phone. We will keep the room
                  structure and build a realistic shopping plan after the render.
                </p>
                <label className="photo-consent">
                  <input
                    checked={photoConsent}
                    type="checkbox"
                    onChange={(event) => {
                      setPhotoConsent(event.target.checked);
                      if (event.target.checked && uploadError === photoConsentRequiredMessage) {
                        setUploadError(null);
                      }
                    }}
                  />
                  <span>
                    <strong>{photoConsentLabel}</strong>
                    <small>{phoneCaptureConsentDetail}</small>
                  </span>
                </label>
                <div className="upload-actions">
                  <button
                    className="primary-button"
                    disabled={!photoConsent}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={18} />
                    Upload photo
                  </button>
                  <button className="secondary-button" type="button" onClick={handleUseSample}>
                    Use sample
                  </button>
                </div>
              </div>
              <div className="qr-card">
                <ShieldCheck size={19} />
                <img src={qrUrl} alt="QR code for phone room upload" />
                <strong>Use your phone camera</strong>
                <span>Scan to upload into this session.</span>
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
            <strong>{uploadedRoom ? "Photo ready" : "Waiting for photo"}</strong>
            <span>
              {uploadedRoom
                ? "Room structure will be preserved for the redesign."
                : "Upload or scan the QR code to add a room."}
            </span>
          </div>
          <button
            className="primary-button generate-button"
            disabled={!uploadedRoom || isGenerating(status)}
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
        <button className="close-button" type="button" aria-label="Close preferences">
          <X size={20} />
        </button>

        <section className="drawer-section intro">
          <p className="eyebrow">Design preferences</p>
          <h2>Tell us the style, budget, and priorities.</h2>
          <span className={integrationMode === "live" ? "mode-pill live" : "mode-pill"}>
            {integrationMode === "checking"
              ? "Checking OpenAI"
              : integrationMode === "live"
                ? "AI render ready"
                : "Demo mode"}
          </span>
        </section>

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
      </aside>
    </main>
  );
}
