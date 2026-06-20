import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { ConceptSwitcher } from "./components/ConceptSwitcher";
import { PreferencePanel } from "./components/PreferencePanel";
import { RoomCanvas } from "./components/RoomCanvas";
import { ShoppingList } from "./components/ShoppingList";
import { concepts, products } from "./data/catalog";
import {
  calculateCartSummary,
  createInitialSelection,
  removeProduct,
  swapProduct,
} from "./lib/recommendations";
import { checkIntegrationMode, generateRoomRender } from "./lib/api";
import { copyShoppingList } from "./lib/share";
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
  budget: 1700,
  style: "soft-modern",
  palette: "sage-clay",
  roomType: "living-room",
  location: "Dublin, Ireland",
};

const statusSequence: GenerationStatus[] = ["analyzing", "matching", "rendering", "ready"];

export default function App() {
  const [preferences, setPreferences] = useState<ProjectPreferences>(initialPreferences);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [selectedConceptId, setSelectedConceptId] = useState<RoomConcept["id"]>("soft-modern");
  const [uploadedRoom, setUploadedRoom] = useState<UploadedRoom | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generatedRender, setGeneratedRender] = useState<GeneratedRender | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>("checking");
  const [shareState, setShareState] = useState<"idle" | "copied" | "fallback">("idle");
  const timers = useRef<number[]>([]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedConceptId) ?? concepts[0];
  const summary = useMemo(
    () => calculateCartSummary(selectedProducts, preferences.budget),
    [preferences.budget, selectedProducts],
  );

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
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setShareState("idle");
    setGeneratedRender(null);
    setGenerationError(null);
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
        620 * (index + 1),
      );
      timers.current.push(timer);
    });
  }

  function handleUpload(file: File) {
    const lowerName = file.name.toLowerCase();
    const browserFriendlyImage =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp" ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".webp");

    if (!browserFriendlyImage) {
      setUploadedRoom(null);
      setUploadError("That file format could not be previewed here. Please upload a JPG, PNG, or WebP room photo.");
      setStatus("idle");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();

    reader.onload = () => {
      setUploadedRoom({
        url: objectUrl,
        name: file.name,
        type: file.type || "image",
        size: file.size,
        objectUrl: true,
        dataUrl: String(reader.result),
      });
    };

    reader.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setUploadedRoom(null);
      setUploadError("Could not read that image. Please try another JPG, PNG, or WebP room photo.");
    };

    reader.readAsDataURL(file);
    setGeneratedRender(null);
    setGenerationError(null);
    setSelectedProducts([]);
    setUploadError(null);
    setShareState("idle");
    setStatus("idle");
  }

  function handleUseSample() {
    if (uploadedRoom?.objectUrl) {
      URL.revokeObjectURL(uploadedRoom.url);
    }

    setUploadedRoom({
      url: "/samples/whatsapp-bedroom.jpeg",
      name: "WhatsApp bedroom test photo.jpeg",
      type: "image/jpeg",
      size: 0,
      objectUrl: false,
    });
    setUploadError(null);
    setGeneratedRender(null);
    setGenerationError(null);
    setSelectedProducts([]);
    setPreferences((current) => ({ ...current, roomType: "bedroom" }));
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
    <AppShell status={status}>
      <main className="workspace" aria-label="Roomwise room design workspace">
        <section className="workspace-main" aria-label="Room concept preview">
          <RoomCanvas
            concept={selectedConcept}
            generatedRender={generatedRender}
            generationError={generationError}
            integrationMode={integrationMode}
            status={status}
            uploadedRoom={uploadedRoom}
            uploadError={uploadError}
            onUpload={handleUpload}
            onPreviewError={handlePreviewError}
            onUseSample={handleUseSample}
          />
          <ConceptSwitcher
            concepts={concepts}
            selectedConceptId={selectedConceptId}
            onSelect={setSelectedConceptId}
          />
        </section>

        <aside className="workspace-side" aria-label="Room plan controls and shopping list">
          <PreferencePanel
            integrationMode={integrationMode}
            preferences={preferences}
            status={status}
            onChange={updatePreferences}
            onGenerate={handleGeneratePlan}
          />
          <ShoppingList
            products={selectedProducts}
            summary={summary}
            shareState={shareState}
            onSwap={handleSwap}
            onRemove={handleRemove}
            onRestore={handleRestore}
            onShare={handleShare}
          />
        </aside>
      </main>
    </AppShell>
  );
}
