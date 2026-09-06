/**
 * telemetryStore.ts — Zustand Global State for LapForce
 *
 * Single source of truth for the entire session lifecycle:
 *   - Session metadata (mode, gate, calibration)
 *   - Live telemetry (current GPS, IMU data)
 *   - Lap state (current lap, lap list, best lap)
 *   - Calibration state
 *   - UI state (pocket mode, session running)
 *
 * Performance notes:
 *   - High-frequency telemetry ticks (GPS, IMU) update the store but
 *     are also written to Dexie in a debounced batch to avoid IndexedDB
 *     write pressure on every rAF tick.
 *   - Components subscribe to specific slices to avoid unnecessary renders.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { VehicleMode, Session, Lap, Segment, TelemetryTick } from '@/db/lapforce.db';
import type { GPSPosition } from '@/hooks/useGPS';
import type { RawIMUData, IMUCalibration } from '@/hooks/useIMU';
import type { CalibrationAccumulator } from '@/engine/calibration';
import {
  processCalibrationTick,
  manualCalibrate,
  createCalibrationAccumulator,
} from '@/engine/calibration';
import {
  isInsideGate,
  MIN_LAP_DURATION_MS,
} from '@/engine/lapGate';
import { classifySegment, createSegmentationState } from '@/engine/segmentation';
import type { SegmentationState } from '@/engine/segmentation';
import type { LatLng } from '@/engine/lapGate';
import type { SegmentType } from '@/db/lapforce.db';
import { db } from '@/db/lapforce.db';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type SessionStatus = 'idle' | 'setup' | 'running' | 'ended';

export interface LapState {
  lapNumber: number;
  startMs: number;
  maxSpeedMs: number;
  maxLateralG: number;
  maxLongitudinalG: number;
  minLeanAngle: number;
  maxLeanAngle: number;
  segments: Segment[];
  currentSegmentStartMs: number;
  currentSegmentType: SegmentType;
  currentSegmentEntrySpeed: number;
  currentSegmentMinSpeed: number;
}

export interface CompletedLap {
  lapNumber: number;
  durationMs: number;
  deltaMs: number | null; // null for first lap
  maxSpeedMs: number;
  maxLateralG: number;
  maxLongitudinalG: number;
  minLeanAngle: number;
  maxLeanAngle: number;
  segments: Segment[];
}

export interface TelemetryStore {
  // ── Session ──────────────────────────────────
  status: SessionStatus;
  sessionId: number | null;
  vehicleMode: VehicleMode;
  trackName: string;

  // ── Gate config ───────────────────────────────
  gate: LatLng | null;
  gateHeading: number;
  isInsideGate: boolean;
  hasExitedGate: boolean; // must exit gate before next lap can be counted

  // ── Calibration ──────────────────────────────
  calibration: IMUCalibration;
  calibrationAcc: CalibrationAccumulator;
  isCalibrated: boolean;

  // ── Live telemetry (updated at sensor rate) ──
  currentGPS: GPSPosition | null;
  currentIMU: RawIMUData | null;
  currentSegment: SegmentType;

  // ── Lap state ─────────────────────────────────
  currentLap: LapState | null;
  completedLaps: CompletedLap[];
  bestLapMs: number | null;
  predictiveDeltaMs: number | null; // positive = slower, negative = faster

  // ── Segmentation ─────────────────────────────
  segmentationState: SegmentationState;

  // ── UI ────────────────────────────────────────
  isPocketMode: boolean;

  // ── Actions ───────────────────────────────────
  setVehicleMode: (mode: VehicleMode) => void;
  setTrackName: (name: string) => void;
  setGate: (pos: LatLng, heading: number) => void;

  startSession: () => Promise<void>;
  endSession: () => Promise<void>;

  manualZero: () => void;

  /** Called on every GPS position update */
  onGPSTick: (pos: GPSPosition) => void;
  /** Called on every IMU data update */
  onIMUTick: (data: RawIMUData) => void;

  togglePocketMode: () => void;
  reset: () => void;
}

// ─────────────────────────────────────────────
//  Initial State
// ─────────────────────────────────────────────

const NULL_CALIBRATION: IMUCalibration = { pitchOffset: 0, rollOffset: 0, headingOffset: 0 };

const createInitialLap = (lapNumber: number, startMs: number): LapState => ({
  lapNumber,
  startMs,
  maxSpeedMs: 0,
  maxLateralG: 0,
  maxLongitudinalG: 0,
  minLeanAngle: 0,
  maxLeanAngle: 0,
  segments: [],
  currentSegmentStartMs: startMs,
  currentSegmentType: 'straight',
  currentSegmentEntrySpeed: 0,
  currentSegmentMinSpeed: Infinity,
});

// ─────────────────────────────────────────────
//  Store
// ─────────────────────────────────────────────

export const useTelemetryStore = create<TelemetryStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: 'idle',
    sessionId: null,
    vehicleMode: 'car',
    trackName: 'Unknown Track',
    gate: null,
    gateHeading: 0,
    isInsideGate: false,
    hasExitedGate: true,
    calibration: NULL_CALIBRATION,
    calibrationAcc: createCalibrationAccumulator(),
    isCalibrated: false,
    currentGPS: null,
    currentIMU: null,
    currentSegment: 'straight',
    currentLap: null,
    completedLaps: [],
    bestLapMs: null,
    predictiveDeltaMs: null,
    segmentationState: createSegmentationState(),
    isPocketMode: false,

    // ── Setters ────────────────────────────────

    setVehicleMode: mode => set({ vehicleMode: mode }),
    setTrackName: name => set({ trackName: name }),
    setGate: (pos, heading) => set({ gate: pos, gateHeading: heading }),

    // ── Session lifecycle ───────────────────────

    startSession: async () => {
      const { gate, gateHeading, vehicleMode, trackName } = get();
      if (!gate) {
        console.error('[Store] Cannot start session: gate not set');
        return;
      }

      const session: Omit<Session, 'id'> = {
        startedAt: new Date().toISOString(),
        trackName,
        vehicleMode,
        gateLat: gate.lat,
        gateLng: gate.lng,
        gateHeading,
        totalLaps: 0,
        calibrationPitch: 0,
        calibrationRoll: 0,
      };

      const sessionId = await db.sessions.add(session as Session);

      set({
        status: 'running',
        sessionId,
        currentLap: createInitialLap(1, Date.now()),
        completedLaps: [],
        bestLapMs: null,
        predictiveDeltaMs: null,
        calibrationAcc: createCalibrationAccumulator(),
        isCalibrated: false,
        hasExitedGate: false, // Start inside gate, must exit first
      });
    },

    endSession: async () => {
      const { sessionId, completedLaps } = get();
      const bestLapMs = completedLaps.length > 0
        ? Math.min(...completedLaps.map(l => l.durationMs))
        : undefined;

      if (sessionId) {
        await db.sessions.update(sessionId, {
          endedAt: new Date().toISOString(),
          totalLaps: completedLaps.length,
          bestLapMs,
        });
      }

      set({ status: 'ended', currentLap: null, isPocketMode: false });
    },

    // ── Manual Zero ────────────────────────────

    manualZero: () => {
      const { currentIMU } = get();
      if (!currentIMU) return;
      const calibration = manualCalibrate({
        pitch: currentIMU.pitch,
        roll: currentIMU.roll,
        heading: currentIMU.heading,
      });
      set({ calibration, isCalibrated: true });
    },

    // ── GPS Tick ───────────────────────────────

    onGPSTick: (pos: GPSPosition) => {
      const state = get();
      if (state.status !== 'running') {
        set({ currentGPS: pos });
        return;
      }

      const { gate, gateHeading, currentLap, completedLaps, bestLapMs,
              hasExitedGate, calibrationAcc, isCalibrated,
              segmentationState, currentIMU } = state;

      const nowMs = pos.timestampMs;
      let newState: Partial<TelemetryStore> = { currentGPS: pos };

      // ── Auto-calibration ──────────────────────
      if (!isCalibrated && currentIMU) {
        const { acc: newAcc, result } = processCalibrationTick(
          calibrationAcc,
          pos.speedMs,
          { pitch: currentIMU.pitch, roll: currentIMU.roll, heading: currentIMU.heading },
          nowMs
        );
        if (result) {
          newState = {
            ...newState,
            calibration: result.calibration,
            isCalibrated: true,
            calibrationAcc: newAcc,
          };
        } else {
          newState.calibrationAcc = newAcc;
        }
      }

      // ── Gate detection ─────────────────────────
      if (gate && currentLap) {
        const heading = pos.heading ?? currentIMU?.heading ?? gateHeading;
        const insideGate = isInsideGate(pos, heading, gate, gateHeading);

        if (!hasExitedGate && !insideGate) {
          newState.hasExitedGate = true;
        }

        newState.isInsideGate = insideGate;

        if (insideGate && hasExitedGate) {
          const lapDuration = nowMs - currentLap.startMs;
          if (lapDuration >= MIN_LAP_DURATION_MS) {
            // ── Complete lap ────────────────────────
            const newBestLapMs = bestLapMs === null ? lapDuration : Math.min(bestLapMs, lapDuration);
            const deltaMs = bestLapMs !== null ? lapDuration - bestLapMs : null;

            const completedLap: CompletedLap = {
              lapNumber: currentLap.lapNumber,
              durationMs: lapDuration,
              deltaMs,
              maxSpeedMs: currentLap.maxSpeedMs,
              maxLateralG: currentLap.maxLateralG,
              maxLongitudinalG: currentLap.maxLongitudinalG,
              minLeanAngle: currentLap.minLeanAngle,
              maxLeanAngle: currentLap.maxLeanAngle,
              segments: currentLap.segments,
            };

            // Persist to Dexie
            const { sessionId } = state;
            if (sessionId) {
              const lap: Omit<Lap, 'id'> = {
                sessionId,
                lapNumber: completedLap.lapNumber,
                startMs: currentLap.startMs,
                endMs: nowMs,
                durationMs: lapDuration,
                deltaMs: deltaMs ?? undefined,
                maxSpeedMs: completedLap.maxSpeedMs,
                maxLateralG: completedLap.maxLateralG,
                maxLongitudinalG: completedLap.maxLongitudinalG,
                minLeanAngle: completedLap.minLeanAngle,
                maxLeanAngle: completedLap.maxLeanAngle,
                segments: JSON.stringify(completedLap.segments),
              };
              db.laps.add(lap as Lap).catch(console.error);
            }

            newState = {
              ...newState,
              completedLaps: [...completedLaps, completedLap],
              bestLapMs: newBestLapMs,
              currentLap: createInitialLap(currentLap.lapNumber + 1, nowMs),
              predictiveDeltaMs: null,
              hasExitedGate: false,
              segmentationState: createSegmentationState(),
            };
          }
        } else if (currentLap && bestLapMs !== null) {
          // ── Predictive delta ──────────────────────
          const elapsedInCurrentLap = nowMs - currentLap.startMs;
          const predictiveDeltaMs = elapsedInCurrentLap - bestLapMs;
          newState.predictiveDeltaMs = predictiveDeltaMs;
        }
      }

      // ── Segmentation ──────────────────────────
      if (currentLap && currentIMU) {
        const { state: newSegState, segment } = classifySegment(segmentationState, {
          lateralG: currentIMU.lateralG,
          longitudinalG: currentIMU.longitudinalG,
          gyroAlpha: currentIMU.gyroAlpha,
          speedMs: pos.speedMs,
          timestampMs: nowMs,
        });

        newState.segmentationState = newSegState;
        newState.currentSegment = segment;

        // Track max speed in current lap
        if (currentLap.maxSpeedMs < pos.speedMs) {
          newState.currentLap = {
            ...(newState.currentLap ?? currentLap),
            maxSpeedMs: pos.speedMs,
          };
        }
      }

      set(newState as Partial<TelemetryStore>);

      // ── Persist telemetry tick ─────────────────
      persistTick(get, pos, null);
    },

    // ── IMU Tick ───────────────────────────────

    onIMUTick: (data: RawIMUData) => {
      const state = get();
      const { currentLap, status } = state;

      if (status !== 'running') {
        set({ currentIMU: data });
        return;
      }

      let newState: Partial<TelemetryStore> = { currentIMU: data };

      if (currentLap) {
        const updatedLap = { ...currentLap };

        if (Math.abs(data.lateralG) > currentLap.maxLateralG) {
          updatedLap.maxLateralG = Math.abs(data.lateralG);
        }
        if (Math.abs(data.longitudinalG) > currentLap.maxLongitudinalG) {
          updatedLap.maxLongitudinalG = Math.abs(data.longitudinalG);
        }
        if (data.roll < currentLap.minLeanAngle) {
          updatedLap.minLeanAngle = data.roll;
        }
        if (data.roll > currentLap.maxLeanAngle) {
          updatedLap.maxLeanAngle = data.roll;
        }

        newState.currentLap = updatedLap;
      }

      set(newState as Partial<TelemetryStore>);

      // Persist tick with IMU data
      persistTick(get, null, data);
    },

    // ── UI ────────────────────────────────────

    togglePocketMode: () => set(s => ({ isPocketMode: !s.isPocketMode })),

    reset: () =>
      set({
        status: 'idle',
        sessionId: null,
        currentLap: null,
        completedLaps: [],
        bestLapMs: null,
        predictiveDeltaMs: null,
        currentGPS: null,
        currentIMU: null,
        calibrationAcc: createCalibrationAccumulator(),
        isCalibrated: false,
        isPocketMode: false,
        segmentationState: createSegmentationState(),
        currentSegment: 'straight',
        gate: null,
        hasExitedGate: true,
      }),
  }))
);

// ─────────────────────────────────────────────
//  Telemetry Persistence (debounced write)
// ─────────────────────────────────────────────

// Buffer ticks and flush every 500ms to avoid DB write storms
let tickBuffer: Array<Omit<TelemetryTick, 'id'>> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function persistTick(
  get: () => TelemetryStore,
  pos: GPSPosition | null,
  imu: RawIMUData | null
) {
  const state = get();
  if (!state.sessionId) return;

  const gps = pos ?? state.currentGPS;
  const imuData = imu ?? state.currentIMU;
  if (!gps) return;

  const tick: Omit<TelemetryTick, 'id'> = {
    sessionId: state.sessionId,
    timestampMs: gps.timestampMs,
    lat: gps.lat,
    lng: gps.lng,
    speedMs: gps.speedMs,
    accuracyM: gps.accuracyM,
    gpsHeading: gps.heading ?? 0,
    accelX: imuData?.accelX ?? 0,
    accelY: imuData?.accelY ?? 0,
    accelZ: imuData?.accelZ ?? 0,
    lateralG: imuData?.lateralG ?? 0,
    longitudinalG: imuData?.longitudinalG ?? 0,
    verticalG: imuData?.verticalG ?? 0,
    gyroAlpha: imuData?.gyroAlpha ?? 0,
    gyroBeta: imuData?.gyroBeta ?? 0,
    gyroGamma: imuData?.gyroGamma ?? 0,
    pitch: imuData?.pitch ?? 0,
    roll: imuData?.roll ?? 0,
    heading: imuData?.heading ?? gps.heading ?? 0,
    segmentType: state.currentSegment,
  };

  tickBuffer.push(tick);

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      const toFlush = tickBuffer;
      tickBuffer = [];
      flushTimer = null;
      db.telemetryTicks.bulkAdd(toFlush as TelemetryTick[]).catch(console.error);
    }, 500);
  }
}
