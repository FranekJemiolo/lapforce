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
 *
 * Granular per-corner metrics are accumulated in ActiveSegmentAccumulator:
 *   Car:  maxLateralG, minLateralG, peakBrakingG
 *   Bike: maxSegLeanAngle, avgLeanAngleMag
 */

import type { SegmentType, Segment } from '@/db/lapforce.db';

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
  /** Lean angle in degrees (for bike mode). Positive = right, negative = left */
  rollDeg?: number;
}

/** Accumulates granular metrics for the active (in-progress) segment */
export interface ActiveSegmentAccumulator {
  type: SegmentType;
  startMs: number;
  entrySpeedMs: number;
  currentMinSpeedMs: number;
  /** Max signed lateral G (positive = right) */
  maxLateralG: number;
  /** Min signed lateral G (negative = left) */
  minLateralG: number;
  /** Peak braking G (stored as positive: max(-longitudinalG)) */
  peakBrakingG: number;
  /** Max lean angle magnitude this segment */
  maxSegLeanAngle: number;
  /** Running sum for avg lean angle */
  leanAngleSum: number;
  leanSampleCount: number;
  lastSpeedMs: number;
}

export interface SegmentationState {
  currentSegment: SegmentType;
  headingRateHistory: number[];
  lateralGHistory: number[];
  speedHistory: number[];
  /** Accumulator for the segment currently being recorded */
  activeAccumulator: ActiveSegmentAccumulator | null;
  /** Completed segments for the current lap */
  completedSegments: Segment[];
}

export function createSegmentationState(): SegmentationState {
  return {
    currentSegment: 'straight',
    headingRateHistory: [],
    lateralGHistory: [],
    speedHistory: [],
    activeAccumulator: null,
    completedSegments: [],
  };
}

function createAccumulator(type: SegmentType, input: SegmentationInput): ActiveSegmentAccumulator {
  return {
    type,
    startMs: input.timestampMs,
    entrySpeedMs: input.speedMs,
    currentMinSpeedMs: input.speedMs,
    maxLateralG: input.lateralG,
    minLateralG: input.lateralG,
    peakBrakingG: Math.max(0, -input.longitudinalG),
    maxSegLeanAngle: Math.abs(input.rollDeg ?? 0),
    leanAngleSum: Math.abs(input.rollDeg ?? 0),
    leanSampleCount: 1,
    lastSpeedMs: input.speedMs,
  };
}

function updateAccumulator(acc: ActiveSegmentAccumulator, input: SegmentationInput): ActiveSegmentAccumulator {
  return {
    ...acc,
    currentMinSpeedMs: Math.min(acc.currentMinSpeedMs, input.speedMs),
    maxLateralG: Math.max(acc.maxLateralG, input.lateralG),
    minLateralG: Math.min(acc.minLateralG, input.lateralG),
    peakBrakingG: Math.max(acc.peakBrakingG, Math.max(0, -input.longitudinalG)),
    maxSegLeanAngle: Math.max(acc.maxSegLeanAngle, Math.abs(input.rollDeg ?? 0)),
    leanAngleSum: acc.leanAngleSum + Math.abs(input.rollDeg ?? 0),
    leanSampleCount: acc.leanSampleCount + 1,
    lastSpeedMs: input.speedMs,
  };
}

function finalizeSegment(acc: ActiveSegmentAccumulator, endMs: number): Segment {
  return {
    type: acc.type,
    startMs: acc.startMs,
    endMs,
    entrySpeedMs: acc.entrySpeedMs,
    minSpeedMs: acc.currentMinSpeedMs,
    exitSpeedMs: acc.lastSpeedMs,
    maxLateralG: acc.maxLateralG,
    minLateralG: acc.minLateralG,
    peakBrakingG: acc.peakBrakingG,
    maxSegLeanAngle: acc.maxSegLeanAngle,
    avgLeanAngleMag: acc.leanSampleCount > 0 ? acc.leanAngleSum / acc.leanSampleCount : 0,
    leanAngleSum: acc.leanAngleSum,
    leanSampleCount: acc.leanSampleCount,
  };
}

/**
 * Classify the current driving state based on latest sensor inputs.
 * Returns updated state, current segment, and any newly completed segments.
 */
export function classifySegment(
  state: SegmentationState,
  input: SegmentationInput
): { state: SegmentationState; segment: SegmentType; newCompletedSegment: Segment | null } {
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
    const speedTrend = speedTrendDirection(speedHistory);
    if (speedTrend < -0.1) {
      segment = 'corner_entry';
    } else if (speedTrend > 0.1) {
      segment = 'corner_exit';
    } else {
      segment = 'apex';
    }
  } else {
    segment = state.currentSegment;
  }

  // ── Segment boundary tracking ──────────────────────────────────────────
  let newCompletedSegment: Segment | null = null;
  let activeAccumulator = state.activeAccumulator;
  let completedSegments = state.completedSegments;

  const segmentChanged = segment !== state.currentSegment;

  if (segmentChanged) {
    // Finalize the previous segment if we were in a corner
    if (activeAccumulator && state.currentSegment !== 'straight') {
      const completed = finalizeSegment(activeAccumulator, input.timestampMs);
      newCompletedSegment = completed;
      completedSegments = [...completedSegments, completed];
    }
    // Start a new accumulator for corners (not for straights)
    if (segment !== 'straight') {
      activeAccumulator = createAccumulator(segment, input);
    } else {
      activeAccumulator = null;
    }
  } else if (activeAccumulator && segment !== 'straight') {
    // Continue updating the active accumulator
    activeAccumulator = updateAccumulator(activeAccumulator, input);
  } else if (segment !== 'straight' && !activeAccumulator) {
    // Start tracking if we just entered a corner without a boundary event
    activeAccumulator = createAccumulator(segment, input);
  }

  return {
    state: {
      currentSegment: segment,
      headingRateHistory,
      lateralGHistory,
      speedHistory,
      activeAccumulator,
      completedSegments,
    },
    segment,
    newCompletedSegment,
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
