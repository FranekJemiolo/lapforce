/**
 * segmentation.ts — Auto-Segmentation Engine
 *
 * Classifies the current driving state into segments:
 *   - straight: sustained heading + low lateral G
 *   - corner_entry: increasing lateral G + decelerating
 *   - apex: peak lateral G + minimum speed
 *   - corner_exit: decreasing lateral G + accelerating
 *
 * Algorithm:
 *   - "Corner" = heading rate > CORNER_HEADING_RATE_DEG_S AND lateral G > CORNER_LATERAL_G_THRESHOLD
 *   - "Straight" = heading rate < STRAIGHT_HEADING_RATE_DEG_S AND lateral G < STRAIGHT_LATERAL_G_THRESHOLD
 *
 * Corner sub-classification uses the speed derivative:
 *   - Decelerating into corner → corner_entry
 *   - Speed at minimum → apex
 *   - Accelerating out of corner → corner_exit
 */

import type { SegmentType } from '@/db/lapforce.db';

export const CORNER_HEADING_RATE_DEG_S = 8;  // deg/s yaw rate
export const CORNER_LATERAL_G_THRESHOLD = 0.3; // g
export const STRAIGHT_HEADING_RATE_DEG_S = 4;  // deg/s
export const STRAIGHT_LATERAL_G_THRESHOLD = 0.15; // g

/** Rolling window size for smoothing */
export const SMOOTHING_WINDOW = 5;

export interface SegmentationInput {
  lateralG: number;
  longitudinalG: number;
  gyroAlpha: number; // yaw rate deg/s
  speedMs: number;
  timestampMs: number;
}

export interface SegmentationState {
  currentSegment: SegmentType;
  headingRateHistory: number[];
  lateralGHistory: number[];
  speedHistory: number[];
}

export function createSegmentationState(): SegmentationState {
  return {
    currentSegment: 'straight',
    headingRateHistory: [],
    lateralGHistory: [],
    speedHistory: [],
  };
}

/**
 * Classify the current driving state based on latest sensor inputs.
 * Returns updated state and the current segment classification.
 */
export function classifySegment(
  state: SegmentationState,
  input: SegmentationInput
): { state: SegmentationState; segment: SegmentType } {
  // Update rolling histories
  const headingRateHistory = pushWindow(state.headingRateHistory, Math.abs(input.gyroAlpha));
  const lateralGHistory = pushWindow(state.lateralGHistory, Math.abs(input.lateralG));
  const speedHistory = pushWindow(state.speedHistory, input.speedMs);

  const avgHeadingRate = average(headingRateHistory);
  const avgLateralG = average(lateralGHistory);

  const isCorner =
    avgHeadingRate >= CORNER_HEADING_RATE_DEG_S ||
    avgLateralG >= CORNER_LATERAL_G_THRESHOLD;

  const isStraight =
    avgHeadingRate < STRAIGHT_HEADING_RATE_DEG_S &&
    avgLateralG < STRAIGHT_LATERAL_G_THRESHOLD;

  let segment: SegmentType;

  if (isStraight) {
    segment = 'straight';
  } else if (isCorner) {
    // Sub-classify corner phase using speed trend
    const speedTrend = speedTrendDirection(speedHistory);
    if (speedTrend < -0.1) {
      segment = 'corner_entry';
    } else if (speedTrend > 0.1) {
      segment = 'corner_exit';
    } else {
      segment = 'apex';
    }
  } else {
    // Transition zone — maintain previous
    segment = state.currentSegment;
  }

  return {
    state: {
      currentSegment: segment,
      headingRateHistory,
      lateralGHistory,
      speedHistory,
    },
    segment,
  };
}

// ─────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────

function pushWindow(history: number[], value: number): number[] {
  const next = [...history, value];
  return next.length > SMOOTHING_WINDOW ? next.slice(-SMOOTHING_WINDOW) : next;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Returns the linear regression slope of a speed history array.
 * Positive = accelerating, negative = decelerating.
 */
function speedTrendDirection(speeds: number[]): number {
  if (speeds.length < 2) return 0;
  const xs = speeds.map((_, i) => i);
  const xMean = average(xs);
  const yMean = average(speeds);
  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (speeds[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}
