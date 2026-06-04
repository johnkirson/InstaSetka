import { useEffect, useMemo, useState } from "react";

export type TourStep = {
  id: string;
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  placement?: "top" | "right" | "bottom" | "left";
};

type FeatureTourProps = {
  isOpen: boolean;
  steps: TourStep[];
  advancedSteps?: TourStep[];
  onClose: () => void;
  onFinish: () => void;
  onAdvanced?: () => void;
};

type TourLayout = {
  targetRect: DOMRect;
  panel: {
    left: number;
    top: number;
  };
  arrow: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
};

const panelWidth = 300;
const panelHeight = 168;
const panelGap = 18;
const viewportPadding = 14;

export function FeatureTour({ isOpen, steps, advancedSteps = [], onClose, onFinish, onAdvanced }: FeatureTourProps) {
  const visibleSteps = useMemo(() => steps.filter((step) => Boolean(getVisibleTarget(step.target))), [steps, isOpen]);
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const activeStep = visibleSteps[stepIndex] ?? visibleSteps[0];

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setLayout(null);
      return;
    }

    if (stepIndex >= visibleSteps.length) {
      setStepIndex(Math.max(0, visibleSteps.length - 1));
    }
  }, [isOpen, stepIndex, visibleSteps.length]);

  useEffect(() => {
    if (!isOpen || !activeStep) {
      return;
    }

    function updateLayout() {
      const target = getVisibleTarget(activeStep.target);
      if (!target) {
        return;
      }

      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      setLayout(createTourLayout(target.getBoundingClientRect(), activeStep.placement ?? "bottom"));
    }

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [activeStep, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        showNextStep();
      }

      if (event.key === "ArrowLeft") {
        setStepIndex((current) => Math.max(0, current - 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isOpen || !activeStep || !layout || visibleSteps.length === 0) {
    return null;
  }

  const isLastStep = stepIndex === visibleSteps.length - 1;

  function showNextStep() {
    if (isLastStep) {
      onFinish();
      return;
    }

    setStepIndex((current) => Math.min(visibleSteps.length - 1, current + 1));
  }

  return (
    <div className="feature-tour" aria-live="polite">
      <div
        className="tour-highlight"
        style={{
          left: layout.targetRect.left - 7,
          top: layout.targetRect.top - 7,
          width: layout.targetRect.width + 14,
          height: layout.targetRect.height + 14,
        }}
      />
      <svg className="tour-arrow" aria-hidden="true">
        <line x1={layout.arrow.x1} y1={layout.arrow.y1} x2={layout.arrow.x2} y2={layout.arrow.y2} />
        <circle cx={layout.arrow.x2} cy={layout.arrow.y2} r="3" />
      </svg>
      <section
        className="tour-card"
        role="dialog"
        aria-label={activeStep.title}
        style={{ left: layout.panel.left, top: layout.panel.top }}
      >
        <div className="tour-card-header">
          <p className="eyebrow">{activeStep.eyebrow}</p>
          <span>{stepIndex + 1} / {visibleSteps.length}</span>
        </div>
        <h3>{activeStep.title}</h3>
        <p>{activeStep.body}</p>
        <div className="tour-actions">
          <button className="button secondary" onClick={onClose}>
            Skip
          </button>
          <div>
            <button
              className="button secondary"
              aria-label="Previous tour step"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            >
              ←
            </button>
            <button className="button primary" onClick={showNextStep}>
              {isLastStep ? "Done" : "Next"}
            </button>
            {isLastStep && advancedSteps.length > 0 && onAdvanced ? (
              <button className="button secondary" onClick={onAdvanced}>
                Advanced
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function getVisibleTarget(selector: string): HTMLElement | null {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return target;
}

function createTourLayout(targetRect: DOMRect, placement: NonNullable<TourStep["placement"]>): TourLayout {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const targetCenter = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2,
  };
  const preferredPanel = getPreferredPanelPosition(targetRect, placement);
  const panel = {
    left: clamp(preferredPanel.left, viewportPadding, viewportWidth - panelWidth - viewportPadding),
    top: clamp(preferredPanel.top, viewportPadding, viewportHeight - panelHeight - viewportPadding),
  };
  const panelAnchor = getPanelAnchor(panel, targetCenter);

  return {
    targetRect,
    panel,
    arrow: {
      x1: panelAnchor.x,
      y1: panelAnchor.y,
      x2: targetCenter.x,
      y2: targetCenter.y,
    },
  };
}

function getPreferredPanelPosition(targetRect: DOMRect, placement: NonNullable<TourStep["placement"]>) {
  if (placement === "top") {
    return {
      left: targetRect.left + targetRect.width / 2 - panelWidth / 2,
      top: targetRect.top - panelHeight - panelGap,
    };
  }

  if (placement === "right") {
    return {
      left: targetRect.right + panelGap,
      top: targetRect.top + targetRect.height / 2 - panelHeight / 2,
    };
  }

  if (placement === "left") {
    return {
      left: targetRect.left - panelWidth - panelGap,
      top: targetRect.top + targetRect.height / 2 - panelHeight / 2,
    };
  }

  return {
    left: targetRect.left + targetRect.width / 2 - panelWidth / 2,
    top: targetRect.bottom + panelGap,
  };
}

function getPanelAnchor(panel: { left: number; top: number }, targetCenter: { x: number; y: number }) {
  return {
    x: clamp(targetCenter.x, panel.left + 18, panel.left + panelWidth - 18),
    y: clamp(targetCenter.y, panel.top + 18, panel.top + panelHeight - 18),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
