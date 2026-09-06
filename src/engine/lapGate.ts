/**
 * lapGate.ts — Virtual Lap Gate Engine
 *
 * Implements the 20-meter virtual gate for lap detection.
 * A lap completes when:
 *   1. GPS position is within LAP_GATE_RADIUS_M of the gate origin
 *   2. Current heading matches the gate heading within HEADING_TOLERANCE_DEG
 *   3. The vehicle has left the gate radius since the last lap (prevents
 *      multiple triggers on a single gate crossing)
 *
 * Distance uses the Haversine formula for accurate great-circle distances
 * on the Earth's surface.
 */

export const LAP_GATE_RADIUS_M = 20;
export const HEADING_TOLERANCE_DEG = 30;
/** Minimum time between lap completions (ms) — prevents double-counting */
export const MIN_LAP_DURATION_MS = 5_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Haversine formula — computes great-circle distance between two GPS points.
 * @returns Distance in meters
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // Earth radius in meters
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const sinHalfΔφ = Math.sin(Δφ / 2);
  const sinHalfΔλ = Math.sin(Δλ / 2);

  const haversine =
    sinHalfΔφ * sinHalfΔφ + Math.cos(φ1) * Math.cos(φ2) * sinHalfΔλ * sinHalfΔλ;

  return R * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/**
 * Compute the absolute angular difference between two headings.
 * Handles 360-degree wraparound (e.g., 355° vs 5° = 10° difference).
 *
 * @returns Positive difference in degrees [0, 180]
 */
export function headingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Check whether the current position and heading trigger a lap gate crossing.
 *
 * @param currentPos - Current GPS position
 * @param currentHeading - Current compass heading (degrees)
 * @param gate - Lap gate origin
 * @param gateHeading - Heading recorded at gate start (degrees)
 * @returns true if inside gate radius AND heading matches
 */
export function isInsideGate(
  currentPos: LatLng,
  currentHeading: number,
  gate: LatLng,
  gateHeading: number
): boolean {
  const distance = haversineDistance(currentPos, gate);
  if (distance > LAP_GATE_RADIUS_M) return false;

  const headingDiff = headingDifference(currentHeading, gateHeading);
  return headingDiff <= HEADING_TOLERANCE_DEG;
}

/**
 * Compute the initial bearing from point A to point B.
 * Useful for setting the gate heading based on the direction of approach.
 *
 * @returns Bearing in degrees (0-360)
 */
export function computeBearing(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
