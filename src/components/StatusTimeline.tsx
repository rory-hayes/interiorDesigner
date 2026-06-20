import { Check, Loader2 } from "lucide-react";
import type { GenerationStatus } from "../types";

interface StatusTimelineProps {
  status: GenerationStatus;
}

const steps: Array<{ id: GenerationStatus; label: string }> = [
  { id: "analyzing", label: "Analyze room" },
  { id: "matching", label: "Match products" },
  { id: "rendering", label: "Mock concepts" },
  { id: "ready", label: "Plan ready" },
];

function stepRank(status: GenerationStatus): number {
  return steps.findIndex((step) => step.id === status);
}

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentRank = stepRank(status);

  return (
    <div className="timeline" aria-label="Generation status">
      {steps.map((step, index) => {
        const complete = status === "ready" || (currentRank >= 0 && index < currentRank);
        const active = step.id === status && status !== "ready";

        return (
          <div className={active ? "timeline-step active" : "timeline-step"} key={step.id}>
            <span className={complete ? "timeline-dot complete" : "timeline-dot"}>
              {complete ? <Check size={13} /> : active ? <Loader2 size={13} /> : null}
            </span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
