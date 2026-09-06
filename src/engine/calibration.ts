/**
 * calibration.ts — Auto-Calibration Engine
 *
 * Strategy:
 *   1. Monitor GPS speed
 *   2. Once speed exceeds CALIBRATION_SPEED_MPH for CALIBRATION_DURATION_MS,
 *      sample DeviceOrientation values and average them
 *   3. Store these averages as the "zero point" for pitch and roll
 *
 * Manual calibration:
 *   - User presses "Zero" button on setup screen
 *   - Immediately captures current orientation as zero point
 */

import type { IMUCalibration } from '@/hooks/useIMU';

export const CALIBRATION_SPEED_MPH = 20;
export const CALIBRATION_SPEED_MS = CALIBRATION_SPEED_MPH * 0.44704; // ~8.94 m/s
export const CALIBRATION_DURATION_MS = 2_000;
export const MIN_SAMPLES = 10;

export interface OrientationSample {
  pitch: number;
  roll: number;
  heading: number;
  timestampMs: number;
}

export interface CalibrationResult {
  calibration: IMUCalibration;
  sampleCount: number;
  durationMs: number;
}

/**
 * CalibrationAccumulator — used by the Zustand store to accumulate
 * orientation samples during the calibration window.
 */
export interface CalibrationAccumulator {
  samples: OrientationSample[];
  startedAt: number | null;
  isCalibrating: boolean;
  isComplete: boolean;
}

export function createCalibrationAccumulator(): CalibrationAccumulator {
  return {
    samples: [],
    startedAt: null,
    isCalibrating: false,
    isComplete: false,
  };
}

/**
 * Process a new speed + orientation reading.
 * Returns CalibrationResult if calibration just completed, null otherwise.
 */
export function processCalibrationTick(
  acc: CalibrationAccumulator,
  speedMs: number,
  orientation: { pitch: number; roll: number; heading: number },
  nowMs: number
): { acc: CalibrationAccumulator; result: CalibrationResult | null } {
  if (acc.isComplete) return { acc, result: null };

  const isAboveSpeed = speedMs >= CALIBRATION_SPEED_MS;

  if (!isAboveSpeed) {
    // Reset if we drop below threshold
    if (acc.isCalibrating) {
      return {
        acc: { ...acc, isCalibrating: false, startedAt: null, samples: [] },
        result: null,
      };
    }
    return { acc, result: null };
  }

  // Start collecting
  if (!acc.isCalibrating) {
    return {
      acc: {
        ...acc,
        isCalibrating: true,
        startedAt: nowMs,
        samples: [{ ...orientation, timestampMs: nowMs }],
      },
      result: null,
    };
  }

  // Accumulate sample
  const newSamples = [...acc.samples, { ...orientation, timestampMs: nowMs }];
  const elapsed = nowMs - (acc.startedAt ?? nowMs);

  if (elapsed >= CALIBRATION_DURATION_MS && newSamples.length >= MIN_SAMPLES) {
    // Average the samples
    const avgPitch = average(newSamples.map(s => s.pitch));
    const avgRoll = average(newSamples.map(s => s.roll));
    const avgHeading = circularAverage(newSamples.map(s => s.heading));

    const result: CalibrationResult = {
      calibration: {
        pitchOffset: avgPitch,
        rollOffset: avgRoll,
        headingOffset: avgHeading,
      },
      sampleCount: newSamples.length,
      durationMs: elapsed,
    };

    return {
      acc: { ...acc, isComplete: true, samples: newSamples },
      result,
    };
  }

  return {
    acc: { ...acc, samples: newSamples },
    result: null,
  };
}

/**
 * Manual calibration — instantly zero out the current orientation.
 */
export function manualCalibrate(
  orientation: { pitch: number; roll: number; heading: number }
): IMUCalibration {
  return {
    pitchOffset: orientation.pitch,
    rollOffset: orientation.roll,
    headingOffset: orientation.heading,
  };
}

// ─────────────────────────────────────────────
//  Math Utilities
// ─────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Circular mean for heading values to correctly average across 0/360 boundary.
 * e.g., average of 355° and 5° = 0°, not 180°.
 */
function circularAverage(headings: number[]): number {
  const radians = headings.map(h => (h * Math.PI) / 180);
  const sinSum = radians.reduce((s, r) => s + Math.sin(r), 0);
  const cosSum = radians.reduce((s, r) => s + Math.cos(r), 0);
  const meanRad = Math.atan2(sinSum / radians.length, cosSum / radians.length);
  return ((meanRad * 180) / Math.PI + 360) % 360;
}
