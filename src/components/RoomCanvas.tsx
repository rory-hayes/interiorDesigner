import {
  AlertCircle,
  ImagePlus,
  Layers,
  Maximize2,
  MousePointer2,
  Move,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GenerationStatus, RoomConcept, UploadedRoom } from "../types";
import type { GeneratedRender, IntegrationMode } from "../types";

interface RoomCanvasProps {
  concept: RoomConcept;
  generatedRender: GeneratedRender | null;
  generationError: string | null;
  integrationMode: IntegrationMode;
  status: GenerationStatus;
  uploadedRoom: UploadedRoom | null;
  uploadError: string | null;
  onUpload: (file: File) => void;
  onPreviewError: () => void;
  onUseSample: () => void;
}

type PreviewMode = "before" | "after";
type CanvasTool = "select" | "move" | "scale";

export function RoomCanvas({
  concept,
  generatedRender,
  generationError,
  integrationMode,
  status,
  uploadedRoom,
  uploadError,
  onUpload,
  onPreviewError,
  onUseSample,
}: RoomCanvasProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("after");
  const [tool, setTool] = useState<CanvasTool>("select");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conceptClass = useMemo(() => `room-scene concept-${concept.id}`, [concept.id]);
  const showConcept = previewMode === "after" && status === "ready";
  const showGeneratedAfter = Boolean(showConcept && generatedRender);
  const showSimulatedUploadedAfter = Boolean(uploadedRoom && showConcept && !generatedRender);

  useEffect(() => {
    if (uploadedRoom) {
      setPreviewMode("before");
    }
  }, [uploadedRoom]);

  useEffect(() => {
    if (generatedRender || generationError) {
      setPreviewMode("after");
    }
  }, [generatedRender, generationError]);

  return (
    <section className="room-panel" aria-label="Room preview">
      <div className="room-panel-header">
        <div>
          <p className="section-label">Room preview</p>
          <h2>
            {status === "ready"
              ? `${concept.name} plan`
              : uploadedRoom
                ? "Uploaded room ready"
                : "Upload a room photo"}
          </h2>
        </div>
        <div className="preview-toggle" aria-label="Preview mode">
          <button
            className={previewMode === "before" ? "selected" : ""}
            type="button"
            onClick={() => setPreviewMode("before")}
          >
            Before
          </button>
          <button
            className={previewMode === "after" ? "selected" : ""}
            type="button"
            onClick={() => setPreviewMode("after")}
          >
            After
          </button>
        </div>
      </div>

      <div className="canvas-shell">
        <div className="canvas-toolbar" aria-label="Canvas tools">
          <button
            className={tool === "select" ? "selected" : ""}
            type="button"
            aria-label="Select items"
            onClick={() => setTool("select")}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={tool === "move" ? "selected" : ""}
            type="button"
            aria-label="Move items"
            onClick={() => setTool("move")}
          >
            <Move size={16} />
          </button>
          <button
            className={tool === "scale" ? "selected" : ""}
            type="button"
            aria-label="Scale items"
            onClick={() => setTool("scale")}
          >
            <Maximize2 size={16} />
          </button>
        </div>

        <div className="room-frame">
          {showGeneratedAfter ? (
            <img
              className="uploaded-room"
              src={generatedRender!.imageUrl}
              alt={`Generated ${concept.name} room render`}
            />
          ) : uploadedRoom && (!showConcept || showSimulatedUploadedAfter) ? (
            <img
              className={showSimulatedUploadedAfter ? "uploaded-room uploaded-room-after" : "uploaded-room"}
              src={uploadedRoom.url}
              alt={`Uploaded room preview: ${uploadedRoom.name}`}
              onError={onPreviewError}
            />
          ) : (
            <div className={showConcept ? conceptClass : "room-scene sample-room"} aria-label="Sample room preview">
              <span className="room-window" />
              <span className="room-radiator" />
              <span className="room-art" />
              {showConcept ? (
                <>
                  <span className="room-rug" />
                  <span className="room-sofa" />
                  <span className="room-chair" />
                  <span className="room-table" />
                  <span className="room-lamp" />
                  <span className="room-plant" />
                  <span className="room-curtains" />
                </>
              ) : null}
            </div>
          )}

          {status !== "ready" && status !== "idle" ? (
            <div className="render-overlay">
              <Layers size={22} />
              <strong>
                {status === "analyzing"
                  ? "Reading room structure"
                  : status === "matching"
                    ? "Finding local product matches"
                    : "Composing room concept"}
              </strong>
              <span>Building the preview from your budget, style, and palette.</span>
            </div>
          ) : null}

          {showSimulatedUploadedAfter ? (
            <div className="integration-overlay" role="status">
              <AlertCircle size={21} />
              <strong>{integrationMode === "live" ? "OpenAI render failed" : "Real AI render not connected yet"}</strong>
              <span>
                {generationError ??
                  "This is your uploaded room. Add OPENAI_API_KEY and restart the dev server before the After view can generate a new design."}
              </span>
            </div>
          ) : null}
        </div>

        <div className="canvas-foot">
          <button className="upload-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={17} />
            Upload room
          </button>
          <input
            ref={fileInputRef}
            aria-hidden="true"
            tabIndex={-1}
            className="file-input"
            accept="image/jpeg,image/png,image/webp"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onUpload(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <button className="ghost-button" type="button" onClick={onUseSample}>
            <RotateCcw size={16} />
            Use test photo
          </button>
          <span className="canvas-note">
            {uploadedRoom ? `Using ${uploadedRoom.name}` : "Sample room active"} ·{" "}
            {status === "ready" ? "Shopping list simulated" : `Tool: ${tool}`}
          </span>
        </div>

        {uploadError ? <p className="upload-error" role="status">{uploadError}</p> : null}
        {status === "ready" ? (
          <p className="integration-note">
            <Sparkles size={15} />
            {generatedRender
              ? `Generated with ${generatedRender.model}. Product matching is still simulated.`
              : generationError
                ? `OpenAI image generation failed: ${generationError}`
                : integrationMode === "live"
                  ? "OpenAI endpoint is connected. Product matching is still simulated."
                  : "Product matching and concepts are simulated in this MVP. Real image generation needs the local API key configured."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
