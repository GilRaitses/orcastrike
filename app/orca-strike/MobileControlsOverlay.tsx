"use client";

import type { MobilePilotInputSampler } from "@/lib/scene/orcaPilot/mobileInput";
import type { SonarTarget } from "@/lib/scene/sonar";

const HUD_TEXT_STYLE: React.CSSProperties = {
  font: "12px/1.5 ui-monospace, monospace",
  color: "#cfe6ff",
};

const BTN_BASE: React.CSSProperties = {
  border: "1px solid rgba(207,230,255,0.35)",
  borderRadius: 12,
  background: "rgba(8,38,61,0.82)",
  color: "#cfe6ff",
  font: "600 13px/1 ui-monospace, monospace",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  padding: "14px 18px",
  minWidth: 72,
  minHeight: 52,
};

interface MobileControlsOverlayProps {
  sampler: MobilePilotInputSampler | null;
  hasStarted: boolean;
  onStart: () => void;
  onSonarPing: () => void;
  visibleTargets: SonarTarget[] | null;
  onSelectTarget: (target: SonarTarget) => void;
}

function holdButton(
  sampler: MobilePilotInputSampler | null,
  key: "boost" | "back",
  active: boolean,
): void {
  if (!sampler) return;
  sampler.setTouchState({ [key]: active });
}

export default function MobileControlsOverlay({
  sampler,
  hasStarted,
  onStart,
  onSonarPing,
  visibleTargets,
  onSelectTarget,
}: MobileControlsOverlayProps): JSX.Element {
  return (
    <>
      {!hasStarted && (
        <button
          type="button"
          onClick={onStart}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            padding: "16px 22px",
            borderRadius: 12,
            border: "1px solid rgba(207,230,255,0.35)",
            background: "rgba(8,38,61,0.9)",
            ...HUD_TEXT_STYLE,
            fontWeight: 600,
            textAlign: "center",
            maxWidth: 300,
            zIndex: 20,
          }}
        >
          Tap to pilot the orca
          <div style={{ marginTop: 8, opacity: 0.85, fontWeight: 400, fontSize: 11 }}>
            Tilt to steer and dive. Hold Boost to sprint. Tap Sonar to ping targets.
          </div>
        </button>
      )}

      {hasStarted && (
        <>
          <button
            type="button"
            aria-label="Recenter tilt"
            onClick={() => sampler?.recalibrateTilt()}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              ...BTN_BASE,
              padding: "8px 12px",
              minWidth: 0,
              minHeight: 0,
              fontSize: 11,
              zIndex: 15,
            }}
          >
            Center tilt
          </button>

          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 24,
              display: "flex",
              gap: 10,
              zIndex: 15,
            }}
          >
            <button
              type="button"
              aria-label="Brake and reverse"
              style={{ ...BTN_BASE, padding: "18px 20px" }}
              onPointerDown={() => holdButton(sampler, "back", true)}
              onPointerUp={() => holdButton(sampler, "back", false)}
              onPointerCancel={() => holdButton(sampler, "back", false)}
              onPointerLeave={() => holdButton(sampler, "back", false)}
            >
              Brake
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 24,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-end",
              zIndex: 15,
            }}
          >
            <button
              type="button"
              aria-label="Sonar ping"
              onClick={onSonarPing}
              style={{ ...BTN_BASE, background: "rgba(20,60,90,0.9)" }}
            >
              Sonar
            </button>
            <button
              type="button"
              aria-label="Boost swim speed"
              style={{ ...BTN_BASE, padding: "22px 28px", background: "rgba(30,80,50,0.88)" }}
              onPointerDown={() => holdButton(sampler, "boost", true)}
              onPointerUp={() => holdButton(sampler, "boost", false)}
              onPointerCancel={() => holdButton(sampler, "boost", false)}
              onPointerLeave={() => holdButton(sampler, "boost", false)}
            >
              Boost
            </button>
          </div>
        </>
      )}

      {visibleTargets && visibleTargets.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(8,38,61,0.9)",
            border: "1px solid rgba(207,230,255,0.25)",
            ...HUD_TEXT_STYLE,
            minWidth: 220,
            maxHeight: "42vh",
            overflowY: "auto",
            zIndex: 16,
          }}
        >
          <strong>Sonar</strong>
          <div style={{ opacity: 0.75, marginTop: 2, marginBottom: 6 }}>Tap a target to warp</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visibleTargets.slice(0, 9).map((target, index) => (
              <button
                key={target.id}
                type="button"
                onClick={() => onSelectTarget(target)}
                style={{
                  textAlign: "left",
                  background: "rgba(207,230,255,0.1)",
                  border: "1px solid rgba(207,230,255,0.22)",
                  borderRadius: 8,
                  color: "#cfe6ff",
                  padding: "8px 10px",
                  touchAction: "manipulation",
                  ...HUD_TEXT_STYLE,
                }}
              >
                [{index + 1}] {target.kind === "boat" ? "🚤" : "📍"} {target.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
