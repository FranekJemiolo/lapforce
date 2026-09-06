/**
 * PredictiveDelta.tsx — Giant delta time display
 *
 * Shows the predictive delta vs. session best lap in large green/red numbers.
 * Format: ±X.XXX (seconds, 3 decimal places)
 *
 * Performance: The delta value is passed as a prop (not subscribed directly here)
 * to allow the parent to control update frequency via rAF throttling.
 */

import React from 'react';

interface PredictiveDeltaProps {
  /** Delta in milliseconds. Positive = slower, negative = faster, null = no reference lap */
  deltaMs: number | null;
  /** Whether there's an active lap (affects display) */
  isLapActive: boolean;
  /** Optional size override */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  sm: 'text-delta-sm',
  md: 'text-delta-md',
  lg: 'text-delta-lg',
  xl: 'text-delta-xl',
};

function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '';
  const secs = (ms / 1000).toFixed(3);
  return `${sign}${secs}`;
}

export const PredictiveDelta = React.memo(function PredictiveDelta({
  deltaMs,
  isLapActive,
  size = 'lg',
}: PredictiveDeltaProps) {
  const sizeClass = SIZE_CLASSES[size];

  // No reference lap yet
  if (deltaMs === null || !isLapActive) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className={`${sizeClass} lf-delta font-mono text-white/20 leading-none`}>
          ---.---
        </span>
        <span className="lf-label">
          {!isLapActive ? 'NO ACTIVE LAP' : 'LAP 1 — NO REF'}
        </span>
      </div>
    );
  }

  const isAhead = deltaMs < 0;
  const deltaClass = isAhead ? 'lf-delta-ahead' : 'lf-delta-behind';
  const glowClass = isAhead ? 'animate-glow-green' : 'animate-glow-red';

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`${sizeClass} ${deltaClass} ${glowClass} font-mono leading-none tabular-nums`}
        aria-label={`Delta ${formatDelta(deltaMs)} seconds`}
      >
        {formatDelta(deltaMs)}
      </span>
      <span className="lf-label">
        {isAhead ? '▲ AHEAD' : '▼ BEHIND'}
      </span>
    </div>
  );
});
