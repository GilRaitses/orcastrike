"use client";

import { formatMatchTimer, isTimerWarning } from "@/lib/scene/orcaStrike/match";
import type { MatchState } from "@/lib/scene/orcaStrike/match";

export interface ScoreHudProps {
  match: MatchState;
}

export default function ScoreHud({ match }: ScoreHudProps): JSX.Element | null {
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
      `}</style>
    </div>
  );
}
