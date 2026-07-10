"use client";

import type { PilotFsmOutput } from "@/lib/scene/orcaStrike/types";

const TRICK_LABELS: Record<number, string> = {
  1: "Barrel L",
  2: "Barrel R",
  4: "Tail whip",
  8: "Sky hook",
};

export interface TrickComboProps {
  fsm: PilotFsmOutput | null;
}

export default function TrickCombo({ fsm }: TrickComboProps): JSX.Element | null {
  if (!fsm || fsm.mode !== "breach_air") return null;

  const activeSlots = Object.entries(TRICK_LABELS).filter(
    ([bit]) => (fsm.trickSlots & Number(bit)) !== 0,
  );

  return (
    <div className="orca-strike-trick-combo" aria-label="Air tricks">
      <span className="orca-strike-trick-title">Air tricks</span>
      {activeSlots.length === 0 ? (
        <span className="orca-strike-trick-empty">Mash for tricks</span>
      ) : (
        <ul className="orca-strike-trick-list">
          {activeSlots.map(([bit, label]) => (
            <li key={bit}>{label}</li>
          ))}
        </ul>
      )}
      <div className="orca-strike-breach-meter">
        <span>Breach</span>
        <meter min={0} max={1} value={fsm.breachChargeAtLaunch} />
      </div>
      <style jsx>{`
        .orca-strike-trick-combo {
          position: fixed;
          bottom: 5rem;
          right: 1rem;
          z-index: 40;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          background: rgba(4, 16, 24, 0.82);
          border: 1px solid rgba(100, 200, 255, 0.25);
          color: #e8f4ff;
          font-family: system-ui, sans-serif;
          font-size: 0.8rem;
          min-width: 8rem;
        }
        .orca-strike-trick-title {
          display: block;
          font-weight: 600;
          margin-bottom: 0.35rem;
        }
        .orca-strike-trick-empty {
          opacity: 0.65;
        }
        .orca-strike-trick-list {
          margin: 0;
          padding-left: 1rem;
        }
        .orca-strike-breach-meter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .orca-strike-breach-meter meter {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
