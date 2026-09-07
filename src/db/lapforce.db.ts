/**
 * LapForce — Dexie.js IndexedDB Schema
 *
 * Three tables:
 *   sessions       — Top-level session metadata
 *   laps           — Per-lap summary data (linked to session)
 *   telemetry_ticks — High-frequency raw sensor vectors (linked to session)
 */

import Dexie, { type EntityTable } from 'dexie';

// ─────────────────────────────────────────────
//  Type Definitions
// ─────────────────────────────────────────────

export type VehicleMode = 'car' | 'bike';

export interface Session {
  id?: number;
  /** ISO timestamp of session start */
  startedAt: string;
  /** ISO timestamp of session end (set when user ends session) */
  endedAt?: string;
  /** Human readable track/location label */
  trackName: string;
  /** Car or bike mode */
  vehicleMode: VehicleMode;
  /** Latitude of the virtual lap gate */
  gateLat: number;
  /** Longitude of the virtual lap gate */
  gateLng: number;
  /** Compass heading recorded at gate (degrees, 0-360) */
  gateHeading: number;
  /** Total number of laps completed */
  totalLaps: number;
  /** Best lap time in milliseconds */
  bestLapMs?: number;
  /** Auto-calibration pitch offset (degrees) */
  calibrationPitch: number;
  /** Auto-calibration roll offset (degrees) */
  calibrationRoll: number;
}

export interface Lap {
  id?: number;
  sessionId: number;
  lapNumber: number;
  /** Lap start timestamp (Unix ms) */
  startMs: number;
  /** Lap end timestamp (Unix ms) — undefined for in-progress lap */
  endMs?: number;
  /** Lap duration in milliseconds */
  durationMs?: number;
  /** Delta vs. session best lap in ms (positive = slower) */
  deltaMs?: number;
  /** Max speed during lap (m/s) */
  maxSpeedMs: number;
  /** Max lateral G-force during lap */
  maxLateralG: number;
  /** Max longitudinal G-force during lap */
  maxLongitudinalG: number;
  /** Min lean angle during lap (degrees, negative = left) */
  minLeanAngle?: number;
  /** Max lean angle during lap (degrees, positive = right) */
  maxLeanAngle?: number;
  /** Serialized segment array (JSON string) */
  segments?: string;
}

export type SegmentType = 'straight' | 'corner_entry' | 'apex' | 'corner_exit';

export interface Segment {
  type: SegmentType;
  startMs: number;
  endMs: number;
  /** Speed at start of segment (m/s) */
  entrySpeedMs: number;
  /** Minimum speed during segment (m/s) */
  minSpeedMs: number;
  /** Speed at end of segment (m/s) */
  exitSpeedMs: number;
  /** Max lateral G during segment (positive = right) */
  maxLateralG: number;

  // ── Granular Car metrics ──────────────────────────────────────────────
  /** Min lateral G during segment (negative = left turn) */
  minLateralG: number;
  /** Peak braking G during segment (positive = braking, i.e. negative longitudinal G) */
  peakBrakingG: number;

  // ── Granular Bike metrics ─────────────────────────────────────────────
  /** Maximum lean angle during segment (degrees, positive = right) */
  maxSegLeanAngle: number;
  /** Average lean angle magnitude during segment (degrees, always positive) */
  avgLeanAngleMag: number;
  /** Number of lean samples accumulated */
  leanSampleCount: number;
  /** Running sum for avgLeanAngle computation */
  leanAngleSum: number;
}

export interface TelemetryTick {
  id?: number;
  sessionId: number;
  /** Unix timestamp in milliseconds */
  timestampMs: number;

  // GPS
  lat: number;
  lng: number;
  /** Speed in m/s from GPS */
  speedMs: number;
  /** GPS accuracy in meters */
  accuracyM: number;
  /** GPS compass heading (degrees, 0-360) */
  gpsHeading: number;

  // Accelerometer (m/s², calibration-corrected)
  accelX: number; // lateral (positive = right)
  accelY: number; // longitudinal (positive = forward/braking)
  accelZ: number; // vertical (positive = up)

  // G-force (divided by 9.80665)
  lateralG: number;
  longitudinalG: number;
  verticalG: number;

  // Gyroscope (deg/s)
  gyroAlpha: number; // z-axis yaw rate
  gyroBeta: number;  // x-axis pitch rate
  gyroGamma: number; // y-axis roll rate

  // Orientation
  pitch: number;      // front/back tilt (degrees)
  roll: number;       // side tilt / lean angle (degrees)
  heading: number;    // compass heading (degrees, 0-360)

  // Derived
  /** Inferred segment type at this tick */
  segmentType: SegmentType | null;
}

// ─────────────────────────────────────────────
//  Database Class
// ─────────────────────────────────────────────

export class LapForceDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  laps!: EntityTable<Lap, 'id'>;
  telemetryTicks!: EntityTable<TelemetryTick, 'id'>;

  constructor() {
    super('LapForceDB');

    this.version(1).stores({
      // Primary key auto-increments (++) unless specified
      sessions: '++id, startedAt, vehicleMode',
      laps: '++id, sessionId, lapNumber, startMs',
      telemetryTicks: '++id, sessionId, timestampMs, [sessionId+timestampMs]',
    });
  }
}

// Singleton — import this everywhere
export const db = new LapForceDB();
