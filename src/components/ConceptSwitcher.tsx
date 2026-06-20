import type { RoomConcept } from "../types";

interface ConceptSwitcherProps {
  concepts: RoomConcept[];
  selectedConceptId: RoomConcept["id"];
  onSelect: (id: RoomConcept["id"]) => void;
}

export function ConceptSwitcher({ concepts, selectedConceptId, onSelect }: ConceptSwitcherProps) {
  return (
    <section className="concept-strip" aria-label="Concept options">
      <div className="concept-strip-header">
        <div>
          <p className="section-label">Concepts</p>
          <h2>Choose a direction</h2>
        </div>
        <span>{concepts.length} concept directions</span>
      </div>
      <div className="concept-cards">
        {concepts.map((concept) => (
          <button
            className={selectedConceptId === concept.id ? "concept-card selected" : "concept-card"}
            key={concept.id}
            type="button"
            onClick={() => onSelect(concept.id)}
          >
            <span className={`mini-room ${concept.id}`} aria-hidden="true">
              <span className="mini-window" />
              <span className="mini-sofa" />
              <span className="mini-table" />
              <span className="mini-lamp" />
            </span>
            <span className="concept-card-copy">
              <strong>{concept.name}</strong>
              <small>{concept.summary}</small>
            </span>
            <span className="concept-meta">{concept.estimatedRenderTime}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
