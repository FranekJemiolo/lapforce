/**
 * lapGate.test.ts — Comprehensive tests for the virtual lap gate engine
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  headingDifference,
  isInsideGate,
  computeBearing,
  LAP_GATE_RADIUS_M,
  HEADING_TOLERANCE_DEG,
} from '@/engine/lapGate';

// Silverstone start/finish approximate coordinates
const SILVERSTONE_SF = { lat: 52.0786, lng: -1.0169 };

describe('Virtual Gate — Constants', () => {
  it('gate radius is 20m', () => {
    expect(LAP_GATE_RADIUS_M).toBe(20);
  });

  it('heading tolerance is 30°', () => {
    expect(HEADING_TOLERANCE_DEG).toBe(30);
  });
});

describe('Virtual Gate — Gate crossing scenarios', () => {
  const gate = SILVERSTONE_SF;
  const gateHeading = 180; // heading south at start/finish

  it('triggers when exactly on gate with matching heading', () => {
    // Point 0m from gate, heading 180°
    expect(isInsideGate(gate, 180, gate, gateHeading)).toBe(true);
  });

  it('triggers when 10m away with matching heading', () => {
    // 10m south of gate (~0.00009° lat)
    const nearGate = { lat: 52.0785, lng: -1.0169 };
    const dist = haversineDistance(gate, nearGate);
    expect(dist).toBeLessThan(20); // confirm it's within radius
    expect(isInsideGate(nearGate, 180, gate, gateHeading)).toBe(true);
  });

  it('does NOT trigger when 25m away (outside radius)', () => {
    // 25m north of gate
    const farGate = { lat: 52.07882, lng: -1.0169 };
    const dist = haversineDistance(gate, farGate);
    expect(dist).toBeGreaterThan(20);
    expect(isInsideGate(farGate, 180, gate, gateHeading)).toBe(false);
  });

  it('does NOT trigger when heading is opposite direction', () => {
    // Inside gate (0m) but going north = 0° (opposite of 180°)
    expect(isInsideGate(gate, 0, gate, gateHeading)).toBe(false);
  });

  it('triggers at exactly 30° heading tolerance boundary', () => {
    const nearGate = { lat: 52.0785, lng: -1.0169 };
    // 210° = 180° + 30° (exactly at tolerance edge)
    expect(isInsideGate(nearGate, 210, gate, gateHeading)).toBe(true);
    // 150° = 180° - 30° (other edge)
    expect(isInsideGate(nearGate, 150, gate, gateHeading)).toBe(true);
  });

  it('does NOT trigger at 31° outside tolerance', () => {
    const nearGate = { lat: 52.0785, lng: -1.0169 };
    expect(isInsideGate(nearGate, 211, gate, gateHeading)).toBe(false);
    expect(isInsideGate(nearGate, 149, gate, gateHeading)).toBe(false);
  });

  it('handles 360/0 heading wraparound correctly', () => {
    // Gate heading is 350° — should trigger for heading 5° (15° difference)
    const gate2 = { lat: 52.0786, lng: -1.0169 };
    const pos = { lat: 52.0785, lng: -1.0169 };
    expect(isInsideGate(pos, 5, gate2, 350)).toBe(true);
    expect(isInsideGate(pos, 355, gate2, 10)).toBe(true);
  });
});

describe('Bearing computation', () => {
  it('bearing from origin to north is ~0°', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 }; // due north
    const bearing = computeBearing(a, b);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('bearing from origin to east is ~90°', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 1 }; // due east
    const bearing = computeBearing(a, b);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('bearing from origin to south is ~180°', () => {
    const a = { lat: 1, lng: 0 };
    const b = { lat: 0, lng: 0 }; // due south
    const bearing = computeBearing(a, b);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('bearing from origin to west is ~270°', () => {
    const a = { lat: 0, lng: 1 };
    const b = { lat: 0, lng: 0 }; // due west
    const bearing = computeBearing(a, b);
    expect(bearing).toBeCloseTo(270, 0);
  });
});

describe('Edge cases', () => {
  it('handles antipodal points without NaN', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 180 };
    const dist = haversineDistance(a, b);
    expect(isNaN(dist)).toBe(false);
    expect(dist).toBeGreaterThan(0);
  });

  it('headingDifference is commutative', () => {
    expect(headingDifference(10, 350)).toBeCloseTo(headingDifference(350, 10), 5);
    expect(headingDifference(45, 315)).toBeCloseTo(headingDifference(315, 45), 5);
  });
});
