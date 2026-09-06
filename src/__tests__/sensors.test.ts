/**
 * sensors.test.ts — Unit tests for sensor data normalization utilities.
 * Tests: accelToG, clampG, haversine, heading helpers, formatLapTimeSpoken
 */

import { describe, it, expect } from 'vitest';
import { accelToG, clampG } from '@/hooks/useIMU';
import { haversineDistance, headingDifference, isInsideGate, LAP_GATE_RADIUS_M } from '@/engine/lapGate';
import { formatLapTimeSpoken } from '@/hooks/useAudioFeedback';
import { msToMph, msToKph } from '@/hooks/useGPS';

const G = 9.80665;

// ─────────────────────────────────────────────
//  G-Force conversions
// ─────────────────────────────────────────────

describe('accelToG', () => {
  it('converts 0 m/s² to 0g', () => {
    expect(accelToG(0)).toBe(0);
  });

  it('converts 1g (9.80665 m/s²) to exactly 1g', () => {
    expect(accelToG(G)).toBeCloseTo(1.0, 5);
  });

  it('converts 2g correctly', () => {
    expect(accelToG(2 * G)).toBeCloseTo(2.0, 5);
  });

  it('handles negative values (braking)', () => {
    expect(accelToG(-G)).toBeCloseTo(-1.0, 5);
  });
});

describe('clampG', () => {
  it('passes through values within range', () => {
    expect(clampG(0.5)).toBe(0.5);
    expect(clampG(-1.0)).toBe(-1.0);
  });

  it('clamps values exceeding maxG (default 2)', () => {
    expect(clampG(3.0)).toBe(2.0);
    expect(clampG(-3.0)).toBe(-2.0);
  });

  it('respects custom maxG', () => {
    expect(clampG(2.0, 1.5)).toBe(1.5);
    expect(clampG(-2.0, 1.5)).toBe(-1.5);
  });

  it('returns 0 for 0 input', () => {
    expect(clampG(0)).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  Haversine distance
// ─────────────────────────────────────────────

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 51.5074, lng: -0.1278 };
    expect(haversineDistance(p, p)).toBeCloseTo(0, 5);
  });

  it('calculates ~111km per degree of latitude', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    const dist = haversineDistance(a, b);
    // Should be ~111,195 meters
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('known distance: London to Paris ≈ 340km', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const dist = haversineDistance(london, paris);
    // Google Maps shows ~341km great-circle
    expect(dist).toBeGreaterThan(335_000);
    expect(dist).toBeLessThan(345_000);
  });

  it('calculates short distances within track scale (~10m)', () => {
    // Two points ~10 meters apart at Silverstone latitude
    const a = { lat: 52.0786, lng: -1.0169 };
    const b = { lat: 52.0787, lng: -1.0169 }; // ~11m north
    const dist = haversineDistance(a, b);
    expect(dist).toBeGreaterThan(8);
    expect(dist).toBeLessThan(15);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const a = { lat: 52.0786, lng: -1.0169 };
    const b = { lat: 52.0800, lng: -1.0200 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 3);
  });
});

// ─────────────────────────────────────────────
//  Heading difference
// ─────────────────────────────────────────────

describe('headingDifference', () => {
  it('returns 0 for identical headings', () => {
    expect(headingDifference(90, 90)).toBe(0);
  });

  it('handles 360° wraparound correctly', () => {
    // 355° and 5° are only 10° apart, not 350°
    expect(headingDifference(355, 5)).toBeCloseTo(10, 5);
    expect(headingDifference(5, 355)).toBeCloseTo(10, 5);
  });

  it('returns 180 for exact opposite headings', () => {
    expect(headingDifference(0, 180)).toBe(180);
    expect(headingDifference(90, 270)).toBe(180);
  });

  it('always returns positive values', () => {
    expect(headingDifference(10, 350)).toBeGreaterThanOrEqual(0);
    expect(headingDifference(350, 10)).toBeGreaterThanOrEqual(0);
  });

  it('returns max 180', () => {
    expect(headingDifference(0, 180)).toBeLessThanOrEqual(180);
    expect(headingDifference(90, 270)).toBeLessThanOrEqual(180);
  });
});

// ─────────────────────────────────────────────
//  isInsideGate
// ─────────────────────────────────────────────

describe('isInsideGate', () => {
  const gate = { lat: 52.0786, lng: -1.0169 };
  const gateHeading = 90; // heading east

  it('returns true when inside radius and heading matches', () => {
    // Point ~5m from gate, heading 90°
    const nearGate = { lat: 52.0786, lng: -1.01683 };
    expect(isInsideGate(nearGate, 90, gate, gateHeading)).toBe(true);
  });

  it('returns false when outside radius', () => {
    // Point ~100m from gate
    const farFromGate = { lat: 52.0795, lng: -1.0169 };
    expect(isInsideGate(farFromGate, 90, gate, gateHeading)).toBe(false);
  });

  it('returns false when inside radius but wrong heading', () => {
    const nearGate = { lat: 52.0786, lng: -1.01683 };
    // Heading 270° (opposite direction) — more than 30° tolerance
    expect(isInsideGate(nearGate, 270, gate, gateHeading)).toBe(false);
  });

  it('returns true when heading is within tolerance (±30°)', () => {
    const nearGate = { lat: 52.0786, lng: -1.01683 };
    // 29° off — within tolerance
    expect(isInsideGate(nearGate, 119, gate, gateHeading)).toBe(true);
  });

  it('returns false when heading is just outside tolerance', () => {
    const nearGate = { lat: 52.0786, lng: -1.01683 };
    // 31° off — outside tolerance
    expect(isInsideGate(nearGate, 121, gate, gateHeading)).toBe(false);
  });

  it('gate radius is ' + LAP_GATE_RADIUS_M + ' meters', () => {
    expect(LAP_GATE_RADIUS_M).toBe(20);
  });
});

// ─────────────────────────────────────────────
//  Speed conversions
// ─────────────────────────────────────────────

describe('speed conversions', () => {
  it('converts 0 m/s correctly', () => {
    expect(msToMph(0)).toBe(0);
    expect(msToKph(0)).toBe(0);
  });

  it('converts 1 m/s to ~2.237 mph', () => {
    expect(msToMph(1)).toBeCloseTo(2.23694, 3);
  });

  it('converts 1 m/s to 3.6 km/h', () => {
    expect(msToKph(1)).toBeCloseTo(3.6, 5);
  });

  it('converts 44.704 m/s to ~100 mph', () => {
    expect(msToMph(44.704)).toBeCloseTo(100, 1);
  });

  it('CALIBRATION_SPEED (20 mph) converts correctly', () => {
    const twentyMphInMs = 20 / 2.23694;
    expect(msToMph(twentyMphInMs)).toBeCloseTo(20, 1);
  });
});

// ─────────────────────────────────────────────
//  Audio feedback formatting
// ─────────────────────────────────────────────

describe('formatLapTimeSpoken', () => {
  it('formats sub-minute times correctly', () => {
    const result = formatLapTimeSpoken(45_000); // 45 seconds
    expect(result).toBe('45.000 seconds');
  });

  it('formats minute-long times correctly', () => {
    const result = formatLapTimeSpoken(83_456); // 1m 23.456s
    expect(result).toContain('1 minute');
    expect(result).toContain('23.456 seconds');
  });

  it('uses plural "minutes" for 2+', () => {
    const result = formatLapTimeSpoken(125_000); // 2m 5s
    expect(result).toContain('2 minutes');
  });

  it('formats millisecond precision correctly', () => {
    const result = formatLapTimeSpoken(61_234); // 1m 1.234s
    expect(result).toContain('1.234 seconds');
  });
});
