import { CheckCircle2, CircleDashed, Home, ListChecks, MapPin, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { GenerationStatus } from "../types";

interface AppShellProps {
  children: ReactNode;
  status: GenerationStatus;
}

const workflowSteps = [
  { label: "Photo", icon: Home },
  { label: "Preferences", icon: MapPin },
  { label: "Concepts", icon: Sparkles },
  { label: "Shopping list", icon: ListChecks },
];

export function AppShell({ children, status }: AppShellProps) {
  const planReady = status === "ready";

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Project navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            R
          </div>
          <div>
            <p className="brand-name">Roomwise</p>
            <p className="brand-note">AI room plans</p>
          </div>
        </div>

        <nav className="rail-steps" aria-label="Room plan progress">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            const complete = planReady || index < (status === "idle" ? 1 : 3);
            return (
              <div className="rail-step" key={step.label}>
                <span className={complete ? "rail-step-icon complete" : "rail-step-icon"}>
                  {complete ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="rail-card">
          <CircleDashed size={18} />
          <div>
            <p>Retail mode</p>
            <strong>{planReady ? "Product matches found" : "Ready to match"}</strong>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div>
            <p className="topbar-label">Room plan</p>
            <h1>Design the room, then buy the list.</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Open saved projects">
              <ListChecks size={18} />
            </button>
            <button className="secondary-button" type="button">
              New project
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
