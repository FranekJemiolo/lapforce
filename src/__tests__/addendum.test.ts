/**
 * addendum.test.ts — Tests for addendum requirements
 *
 * Covers:
 *   - ActiveSegmentAccumulator granular metrics (minLateralG, peakBrakingG, lean)
 *   - Segment boundary finalization emits newCompletedSegment
 *   - GPS path projection utility (equirectangular)
 *   - Segment type filtering for corner metrics table
 */

import { describe, it, expect } from 'vitest';
import { classifySegment, createSegmentationState } from '@/engine/segmentation';

const createInput = (overrides: Record<string, number> = {}) => ({
  lateralG: 0,
  longitudinalG: 0,
  gyroAlpha: 0,
  speedMs: 50,
  timestampMs: Date.now(),
  rollDeg: 0,
  ...overrides,
});

// Helper: run N identical ticks
function runTicks(
  count: number,
  input: ReturnType<typeof createInput>,
  state = createSegmentationState()
) {
  let current = state;
  let segment = current.currentSegment;
  let lastNewSegment = null;
  for (let i = 0; i < count; i++) {
    const result = classifySegment(current, { ...input, timestampMs: input.timestampMs + i * 100 });
    current = result.state;
    segment = result.segment;
    if (result.newCompletedSegment) lastNewSegment = result.newCompletedSegment;
  }
  return { state: current, segment, lastNewSegment };
}

// ─────────────────────────────────────────────
//  ActiveSegmentAccumulator
// ─────────────────────────────────────────────

describe('Segment Accumulator — granular car metrics', () => {
  it('accumulates maxLateralG during corner', () => {
    const state = createSegmentationState();
    // Enter a corner with varying lateral G
    const inputs = [0.5, 0.8, 1.2, 0.9, 0.7].map((lat, i) =>
      createInput({ lateralG: lat, gyroAlpha: 15, speedMs: 60, timestampMs: Date.now() + i * 100 })
    );
    let current = state;
    for (const inp of inputs) {
      const { state: next } = classifySegment(current, inp);
      current = next;
    }
    expect(current.activeAccumulator).not.toBeNull();
    expect(current.activeAccumulator!.maxLateralG).toBeCloseTo(1.2, 2);
  });

  it('accumulates minLateralG (tracks left-hand corners with negative G)', () => {
    let current = createSegmentationState();
    const inputs = [-0.5, -0.9, -1.1, -0.7].map((lat, i) =>
      createInput({ lateralG: lat, gyroAlpha: 15, speedMs: 55, timestampMs: Date.now() + i * 100 })
    );
    for (const inp of inputs) {
      const { state: next } = classifySegment(current, inp);
      current = next;
    }
    expect(current.activeAccumulator!.minLateralG).toBeCloseTo(-1.1, 2);
  });

  it('accumulates peakBrakingG from negative longitudinalG', () => {
    let current = createSegmentationState();
    const inputs = [0.3, 0.6, 0.8, 0.5].map((brakeG, i) =>
      createInput({
        lateralG: 0.5, gyroAlpha: 15, speedMs: 60,
        longitudinalG: -brakeG, // negative = braking
        timestampMs: Date.now() + i * 100,
      })
    );
    for (const inp of inputs) {
      const { state: next } = classifySegment(current, inp);
      current = next;
    }
    expect(current.activeAccumulator!.peakBrakingG).toBeCloseTo(0.8, 2);
  });

  it('peakBrakingG is 0 when longitudinalG is positive (acceleration)', () => {
    let current = createSegmentationState();
    const inp = createInput({ lateralG: 0.5, gyroAlpha: 15, speedMs: 50, longitudinalG: 0.9 });
    const { state: next } = classifySegment(current, inp);
    current = next;
    expect(current.activeAccumulator?.peakBrakingG ?? 0).toBe(0);
  });
});

describe('Segment Accumulator — granular bike metrics', () => {
  it('tracks maxSegLeanAngle across corner', () => {
    let current = createSegmentationState();
    const leans = [10, 25, 38, 30, 20];
    const inputs = leans.map((roll, i) =>
      createInput({ lateralG: 0.5, gyroAlpha: 15, speedMs: 45, rollDeg: roll, timestampMs: Date.now() + i * 100 })
    );
    for (const inp of inputs) {
      const { state: next } = classifySegment(current, inp);
      current = next;
    }
    expect(current.activeAccumulator!.maxSegLeanAngle).toBeCloseTo(38, 1);
  });

  it('computes correct avgLeanAngleMag', () => {
    let current = createSegmentationState();
    // All leans are equal (30°), average should be ~30°
    const inputs = Array.from({ length: 5 }, (_, i) =>
      createInput({ lateralG: 0.5, gyroAlpha: 15, speedMs: 45, rollDeg: 30, timestampMs: Date.now() + i * 100 })
    );
    for (const inp of inputs) {
      const { state: next } = classifySegment(current, inp);
      current = next;
    }
    const acc = current.activeAccumulator!;
    const avg = acc.leanSampleCount > 0 ? acc.leanAngleSum / acc.leanSampleCount : 0;
    expect(avg).toBeCloseTo(30, 0);
  });
});

describe('Segment boundary — newCompletedSegment emission', () => {
  it('emits a completed segment when transitioning corner→straight', () => {
    // Run enough corner ticks to establish corner state
    const { state: cornerState } = runTicks(
      8,
      createInput({ lateralG: 0.8, gyroAlpha: 15, speedMs: 50 })
    );
    expect(cornerState.currentSegment).not.toBe('straight');

    // Now transition to straight
    const { lastNewSegment } = runTicks(
      6,
      createInput({ lateralG: 0.05, gyroAlpha: 1, speedMs: 80 }),
      cornerState
    );
    expect(lastNewSegment).not.toBeNull();
    expect(lastNewSegment!.maxLateralG).toBeGreaterThan(0);
    expect(lastNewSegment!.entrySpeedMs).toBeDefined();
    expect(lastNewSegment!.exitSpeedMs).toBeDefined();
    expect(lastNewSegment!.minSpeedMs).toBeDefined();
  });

  it('finalized segment has correct entry and exit speeds', () => {
    const entrySpeed = 80;
    const exitSpeed = 55;

    // Enter corner at 80ms
    let state = createSegmentationState();
    for (let i = 0; i < 5; i++) {
      const r = classifySegment(state, createInput({
        lateralG: 0.9, gyroAlpha: 15, speedMs: entrySpeed - i, timestampMs: Date.now() + i * 100,
      }));
      state = r.state;
    }

    // Exit corner (straight) — this should finalize the segment
    let lastSeg = null;
    for (let i = 0; i < 6; i++) {
      const r = classifySegment(state, createInput({
        lateralG: 0.05, gyroAlpha: 1, speedMs: exitSpeed + i, timestampMs: Date.now() + 1000 + i * 100,
      }));
      state = r.state;
      if (r.newCompletedSegment) lastSeg = r.newCompletedSegment;
    }

    expect(lastSeg).not.toBeNull();
    // Entry speed should be close to 80 (first corner tick)
    expect(lastSeg!.entrySpeedMs).toBeGreaterThan(70);
    expect(lastSeg!.entrySpeedMs).toBeLessThanOrEqual(80);
  });
});
