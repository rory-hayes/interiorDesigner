import { MapPin, Play, SlidersHorizontal } from "lucide-react";
import { palettes, roomTypes, styles } from "../data/catalog";
import type { GenerationStatus, IntegrationMode, PaletteId, ProjectPreferences, RoomType, StyleId } from "../types";
import { StatusTimeline } from "./StatusTimeline";

interface PreferencePanelProps {
  preferences: ProjectPreferences;
  integrationMode: IntegrationMode;
  status: GenerationStatus;
  onChange: (preferences: Partial<ProjectPreferences>) => void;
  onGenerate: () => void;
}

const isGenerating = (status: GenerationStatus) =>
  status === "analyzing" || status === "matching" || status === "rendering";

export function PreferencePanel({
  preferences,
  integrationMode,
  status,
  onChange,
  onGenerate,
}: PreferencePanelProps) {
  return (
    <section className="panel controls-panel" aria-label="Project preferences">
      <div className="panel-header">
        <div>
          <p className="section-label">Plan setup</p>
          <h2>Room brief</h2>
        </div>
        <SlidersHorizontal size={19} />
      </div>

      <label className="field">
        <span>
          <MapPin size={14} />
          Location
        </span>
        <input
          value={preferences.location}
          onChange={(event) => onChange({ location: event.target.value })}
          placeholder="City, country"
        />
      </label>

      <div className="field">
        <span>Room type</span>
        <div className="segmented">
          {roomTypes.map((room) => (
            <button
              className={preferences.roomType === room.id ? "selected" : ""}
              key={room.id}
              type="button"
              onClick={() => onChange({ roomType: room.id as RoomType })}
            >
              {room.label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Budget</span>
        <div className="budget-row">
          <input
            min={600}
            max={3500}
            step={50}
            type="range"
            value={preferences.budget}
            onChange={(event) => onChange({ budget: Number(event.target.value) })}
          />
          <input
            className="budget-input"
            min={600}
            step={50}
            type="number"
            value={preferences.budget}
            onChange={(event) => onChange({ budget: Number(event.target.value) })}
          />
        </div>
      </label>

      <div className="field">
        <span>Style</span>
        <div className="style-grid">
          {styles.map((style) => (
            <button
              className={preferences.style === style.id ? "style-card selected" : "style-card"}
              key={style.id}
              type="button"
              onClick={() => onChange({ style: style.id as StyleId })}
            >
              <strong>{style.label}</strong>
              <small>{style.note}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Colour palette</span>
        <div className="palette-grid">
          {palettes.map((palette) => (
            <button
              className={preferences.palette === palette.id ? "palette-card selected" : "palette-card"}
              key={palette.id}
              type="button"
              onClick={() => onChange({ palette: palette.id as PaletteId })}
            >
              <span className="palette-swatches">
                {palette.colors.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span>{palette.label}</span>
            </button>
          ))}
        </div>
      </div>

      <StatusTimeline status={status} />

      <div className="connection-status" role="status">
        <span>Integration status</span>
        <strong>
          {integrationMode === "checking"
            ? "Checking local API..."
            : integrationMode === "live"
              ? "OpenAI image endpoint connected"
              : "Demo mode: OpenAI key not configured"}
        </strong>
      </div>

      <button
        className="primary-button generate-button"
        disabled={isGenerating(status)}
        type="button"
        onClick={onGenerate}
      >
        <Play size={17} />
        {isGenerating(status) ? "Generating plan..." : "Generate room plan"}
      </button>
    </section>
  );
}
