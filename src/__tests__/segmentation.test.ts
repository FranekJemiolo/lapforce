/**
 * segmentation.test.ts — Unit tests for corner/straight detection
 */

import { describe, it, expect } from 'vitest';
import {
  classifySegment,
  createSegmentationState,
  CORNER_HEADING_RATE_DEG_S,
  CORNER_LATERAL_G_THRESHOLD,
  STRAIGHT_HEADING_RATE_DEG_S,
  STRAIGHT_LATERAL_G_THRESHOLD,
} from '@/engine/segmentation';

const createInput = (overrides = {}) => ({
  lateralG: 0,
  longitudinalG: 0,
  gyroAlpha: 0,
  speedMs: 50,
  timestampMs: Date.now(),
  ...overrides,
});

// Helper to run multiple ticks and return the final segment
function runTicks(
  ticks: ReturnType<typeof createInput>[],
  state = createSegmentationState()
) {
  let current = state;
  let segment = current.currentSegment;
  for (const tick of ticks) {
    const result = classifySegment(current, tick);
    current = result.state;
    segment = result.segment;
  }
  return { state: current, segment };
}

describe('Segmentation — Constants', () => {
  it('has correct corner heading rate threshold', () => {
    expect(CORNER_HEADING_RATE_DEG_S).toBe(8);
  });

  it('has correct lateral G threshold', () => {
    expect(CORNER_LATERAL_G_THRESHOLD).toBe(0.3);
  });

  it('has correct straight heading rate threshold', () => {
    expect(STRAIGHT_HEADING_RATE_DEG_S).toBe(4);
  });

  it('has correct straight lateral G threshold', () => {
    expect(STRAIGHT_LATERAL_G_THRESHOLD).toBe(0.15);
  });
});

describe('Segmentation — Straight detection', () => {
  it('classifies low G, low yaw rate as straight', () => {
    const ticks = Array.from({ length: 6 }, () =>
      createInput({ lateralG: 0.05, gyroAlpha: 1.0, speedMs: 60 })
    );
    const { segment } = runTicks(ticks);
    expect(segment).toBe('straight');
  });

  it('initial state is straight', () => {
    const state = createSegmentationState();
    expect(state.currentSegment).toBe('straight');
  });
});

describe('Segmentation — Corner detection', () => {
  it('classifies high lateral G as corner', () => {
    const ticks = Array.from({ length: 6 }, () =>
      createInput({ lateralG: 0.5, gyroAlpha: 15, speedMs: 40 })
    );
    const { segment } = runTicks(ticks);
    expect(['corner_entry', 'apex', 'corner_exit']).toContain(segment);
  });

  it('classifies high yaw rate alone as corner', () => {
    const ticks = Array.from({ length: 6 }, () =>
      createInput({ lateralG: 0.1, gyroAlpha: 12, speedMs: 40 })
    );
    const { segment } = runTicks(ticks);
    expect(['corner_entry', 'apex', 'corner_exit']).toContain(segment);
  });
});

describe('Segmentation — Corner sub-phases', () => {
  it('classifies decelerating corner as corner_entry', () => {
    // Speed decreasing: 80, 75, 70, 65, 60, 55 (decelerating into corner)
    const speeds = [80, 75, 70, 65, 60, 55];
    const ticks = speeds.map(speedMs =>
      createInput({ lateralG: 0.6, gyroAlpha: 15, speedMs })
    );
    const { segment } = runTicks(ticks);
    expect(segment).toBe('corner_entry');
  });

  it('classifies accelerating corner as corner_exit', () => {
    // Speed increasing: 40, 45, 50, 55, 60, 65 (accelerating out of corner)
    const speeds = [40, 45, 50, 55, 60, 65];
    const ticks = speeds.map(speedMs =>
      createInput({ lateralG: 0.6, gyroAlpha: 15, speedMs })
    );
    const { segment } = runTicks(ticks);
    expect(segment).toBe('corner_exit');
  });

  it('classifies constant speed in corner as apex', () => {
    // Speed constant: 40, 40, 40, 40, 40, 40 (at apex)
    const ticks = Array.from({ length: 6 }, () =>
      createInput({ lateralG: 0.8, gyroAlpha: 15, speedMs: 40 })
    );
    const { segment } = runTicks(ticks);
    expect(segment).toBe('apex');
  });
});

describe('Segmentation — Transitions', () => {
  it('transitions from straight to corner on high G', () => {
    const initialTicks = Array.from({ length: 5 }, () =>
      createInput({ lateralG: 0.05, gyroAlpha: 1.0, speedMs: 80 })
    );
    const { state: afterStraight } = runTicks(initialTicks);
    expect(afterStraight.currentSegment).toBe('straight');

    // Now enter a corner
    const cornerTicks = Array.from({ length: 5 }, () =>
      createInput({ lateralG: 0.7, gyroAlpha: 15, speedMs: 60 })
    );
    const { segment: cornerSegment } = runTicks(cornerTicks, afterStraight);
    expect(['corner_entry', 'apex', 'corner_exit']).toContain(cornerSegment);
  });

  it('transitions back to straight after corner', () => {
    const cornerTicks = Array.from({ length: 5 }, () =>
      createInput({ lateralG: 0.7, gyroAlpha: 15, speedMs: 50 })
    );
    const { state: afterCorner } = runTicks(cornerTicks);

    const straightTicks = Array.from({ length: 6 }, () =>
      createInput({ lateralG: 0.05, gyroAlpha: 1.0, speedMs: 80 })
    );
    const { segment } = runTicks(straightTicks, afterCorner);
    expect(segment).toBe('straight');
  });
});

describe('Calibration engine', () => {
  it('exports correct calibration speed threshold', async () => {
    const { CALIBRATION_SPEED_MPH, CALIBRATION_SPEED_MS } = await import('@/engine/calibration');
    expect(CALIBRATION_SPEED_MPH).toBe(20);
    expect(CALIBRATION_SPEED_MS).toBeCloseTo(8.94, 1);
  });

  it('manualCalibrate captures current orientation as zero', async () => {
    const { manualCalibrate } = await import('@/engine/calibration');
    const orientation = { pitch: 5, roll: -3, heading: 45 };
    const cal = manualCalibrate(orientation);
    expect(cal.pitchOffset).toBe(5);
    expect(cal.rollOffset).toBe(-3);
    expect(cal.headingOffset).toBe(45);
  });

  it('processCalibrationTick does not calibrate below speed threshold', async () => {
    const { processCalibrationTick, createCalibrationAccumulator } = await import('@/engine/calibration');
    const acc = createCalibrationAccumulator();
    const { result } = processCalibrationTick(
      acc,
      5.0, // 5 m/s = ~11 mph, below 20mph threshold
      { pitch: 5, roll: -3, heading: 45 },
      Date.now()
    );
    expect(result).toBeNull();
  });

  it('processCalibrationTick starts accumulating above speed threshold', async () => {
    const { processCalibrationTick, createCalibrationAccumulator, CALIBRATION_SPEED_MS } = await import('@/engine/calibration');
    let acc = createCalibrationAccumulator();
    const now = Date.now();

    const { acc: newAcc } = processCalibrationTick(
      acc,
      CALIBRATION_SPEED_MS + 1,
      { pitch: 5, roll: -3, heading: 45 },
      now
    );
    acc = newAcc;
    expect(acc.isCalibrating).toBe(true);
    expect(acc.samples.length).toBeGreaterThan(0);
  });
});
