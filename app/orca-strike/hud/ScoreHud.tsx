"use client";

import { formatMatchTimer, isTimerWarning } from "@/lib/scene/orcaStrike/match";
import type { MatchState } from "@/lib/scene/orcaStrike/match";
import type { PilotFsmOutput } from "@/lib/scene/orcaStrike/types";

export interface ScoreHudProps {
  match: MatchState;
  fsm?: PilotFsmOutput | null;
}

export default function ScoreHud({ match, fsm }: ScoreHudProps): JSX.Element | null {
  if (match.phase === "lobby") return null;

  const timerText = formatMatchTimer(match.roundTimeRemainingS);
  const warning = isTimerWarning(match);
  const phaseLabel =
    match.phase === "countdown"
      ? "Starting"
      : match.phase === "replay"
        ? "Replay"
        : match.phase === "ended"
          ? "Results"
          : "Round";

  return (
    <div className="orca-strike-score-hud" aria-live="polite">
      <div className="orca-strike-score-hud-row">
        <span className="orca-strike-score-label">Score</span>
        <span className="orca-strike-score-value">{match.scoring.total}</span>
      </div>
      <div className="orca-strike-score-hud-row">
        <span className="orca-strike-score-label">{phaseLabel}</span>
        <span className={`orca-strike-timer${warning ? " is-warning" : ""}`}>{timerText}</span>
      </div>
      <div className="orca-strike-charge-row">
        <span>Breach</span><i style={{ width: `${Math.round((fsm?.breachCharge ?? 0) * 100)}%` }} />
      </div>
      <div className="orca-strike-charge-row">
        <span>Blowhole</span><i className="is-blowhole" style={{ width: `${Math.round((fsm?.blowholeCharge ?? 0) * 100)}%` }} />
      </div>
      <style jsx>{`
        .orca-strike-score-hud {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 40;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.65rem 0.85rem;
          border-radius: 8px;
          background: rgba(4, 16, 24, 0.82);
          border: 1px solid rgba(100, 200, 255, 0.25);
          color: #e8f4ff;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85rem;
          pointer-events: none;
        }
        .orca-strike-score-hud-row {
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          min-width: 9rem;
        }
        .orca-strike-score-label {
          opacity: 0.7;
        }
        .orca-strike-score-value {
          font-weight: 700;
          color: #3ecfff;
        }
        .orca-strike-timer.is-warning {
          color: #ff6b6b;
        }
        .orca-strike-charge-row {
          display: grid;
          grid-template-columns: 4.2rem 1fr;
          gap: 0.45rem;
          align-items: center;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.9;
        }
        .orca-strike-charge-row i {
          display: block;
          min-width: 2px;
          height: 0.32rem;
          background: #8ee8ff;
          box-shadow: 0 0 8px rgba(142,232,255,0.55);
          transition: width 80ms linear;
        }
        .orca-strike-charge-row i.is-blowhole {
          background: #b4f78a;
          box-shadow: 0 0 8px rgba(180,247,138,0.55);
        }
      `}</style>
    </div>
  );
}
