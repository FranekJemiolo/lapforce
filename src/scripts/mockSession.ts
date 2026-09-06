/**
 * mockSession.ts — Mock session data generator for development/demo purposes
 *
 * Populates IndexedDB (via Dexie) with a realistic 5-lap Silverstone session
 * so the UI can be previewed immediately without a real track session.
 *
 * Usage: Import and call generateMockSession() in browser devtools or
 * on first launch (dev mode only).
 */

import { db } from '@/db/lapforce.db';
import type { Session, Lap, TelemetryTick } from '@/db/lapforce.db';

// Silverstone start/finish
const GATE_LAT = 52.0786;
const GATE_LNG = -1.0169;
const GATE_HEADING = 185;

// Mock lap times (milliseconds) — realistic 1:45-1:50 Silverstone Club times
const MOCK_LAP_TIMES_MS = [
  107_234, // Lap 1 (benchmark)
  106_892, // Lap 2 (slightly faster)
  105_765, // Lap 3 (best lap!)
  106_234, // Lap 4 (slight regression)
  106_567, // Lap 5
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function mockSegments(lapSpeedMs: number) {
  // Generate realistic corner segments for a mock lap
  const corners = [
    { name: 'T1 Entry', entrySpeed: lapSpeedMs * 0.95, minSpeed: lapSpeedMs * 0.55, exitSpeed: lapSpeedMs * 0.65 },
    { name: 'T1 Apex',  entrySpeed: lapSpeedMs * 0.65, minSpeed: lapSpeedMs * 0.50, exitSpeed: lapSpeedMs * 0.72 },
    { name: 'T2 Entry', entrySpeed: lapSpeedMs * 0.88, minSpeed: lapSpeedMs * 0.48, exitSpeed: lapSpeedMs * 0.60 },
    { name: 'T3 Entry', entrySpeed: lapSpeedMs * 0.90, minSpeed: lapSpeedMs * 0.52, exitSpeed: lapSpeedMs * 0.65 },
    { name: 'T4 Entry', entrySpeed: lapSpeedMs * 0.85, minSpeed: lapSpeedMs * 0.40, exitSpeed: lapSpeedMs * 0.55 },
    { name: 'T5 Entry', entrySpeed: lapSpeedMs * 0.78, minSpeed: lapSpeedMs * 0.45, exitSpeed: lapSpeedMs * 0.60 },
  ];

  return corners.map(c => ({
    type: 'corner_entry' as const,
    startMs: Date.now(),
    endMs: Date.now() + 3000,
    entrySpeedMs: c.entrySpeed + randomBetween(-2, 2),
    minSpeedMs: c.minSpeed + randomBetween(-1, 1),
    exitSpeedMs: c.exitSpeed + randomBetween(-2, 2),
    maxLateralG: randomBetween(0.7, 1.4),
  }));
}

export async function generateMockSession(): Promise<number> {
  const baseSpeed = 42; // ~150 kph average

  const session: Omit<Session, 'id'> = {
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    endedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    trackName: 'Silverstone Club Circuit',
    vehicleMode: 'car',
    gateLat: GATE_LAT,
    gateLng: GATE_LNG,
    gateHeading: GATE_HEADING,
    totalLaps: MOCK_LAP_TIMES_MS.length,
    bestLapMs: Math.min(...MOCK_LAP_TIMES_MS),
    calibrationPitch: 2.3,
    calibrationRoll: -0.5,
  };

  const sessionId = (await db.sessions.add(session as Session)) as number;

  const bestLapMs = Math.min(...MOCK_LAP_TIMES_MS);
  let lapStartMs = Date.now() - 90 * 60 * 1000;

  const laps: Omit<Lap, 'id'>[] = MOCK_LAP_TIMES_MS.map((durationMs, idx) => {
    const lapNumber = idx + 1;
    const deltaMs: number | undefined = idx === 0 ? undefined : durationMs - bestLapMs;
    const startMs = lapStartMs;
    lapStartMs += durationMs + 500;
    const maxSpeedMs = baseSpeed + randomBetween(2, 8);

    return {
      sessionId,
      lapNumber,
      startMs,
      endMs: startMs + durationMs,
      durationMs,
      deltaMs,
      maxSpeedMs,
      maxLateralG: randomBetween(0.8, 1.3),
      maxLongitudinalG: randomBetween(0.6, 1.0),
      minLeanAngle: 0,
      maxLeanAngle: 0,
      segments: JSON.stringify(mockSegments(maxSpeedMs)),
    };
  });

  await db.laps.bulkAdd(laps as Lap[]);

  // Generate a sparse telemetry trace (1 tick every 500ms for 5 laps)
  const ticks: Omit<TelemetryTick, 'id'>[] = [];
  let tickTime = Date.now() - 90 * 60 * 1000;

  for (let lap = 0; lap < 5; lap++) {
    const lapDuration = MOCK_LAP_TIMES_MS[lap];
    const tickCount = Math.floor(lapDuration / 500);

    for (let t = 0; t < tickCount; t++) {
      const progress = t / tickCount;
      // Simulate a rough oval track speed profile
      const speedMs = baseSpeed * (0.8 + 0.4 * Math.sin(progress * Math.PI * 2));
      const leanAngle = randomBetween(-3, 3);

      ticks.push({
        sessionId: sessionId as number,
        timestampMs: tickTime,
        lat: GATE_LAT + randomBetween(-0.003, 0.003),
        lng: GATE_LNG + randomBetween(-0.003, 0.003),
        speedMs,
        accuracyM: randomBetween(3, 8),
        gpsHeading: (GATE_HEADING + randomBetween(-20, 20) + 360) % 360,
        accelX: randomBetween(-8, 8),
        accelY: randomBetween(-5, 10),
        accelZ: randomBetween(8, 11),
        lateralG: randomBetween(-1.2, 1.2),
        longitudinalG: randomBetween(-0.8, 0.9),
        verticalG: randomBetween(0.8, 1.1),
        gyroAlpha: randomBetween(-20, 20),
        gyroBeta: randomBetween(-5, 5),
        gyroGamma: leanAngle,
        pitch: randomBetween(-5, 5),
        roll: leanAngle,
        heading: (GATE_HEADING + randomBetween(-25, 25) + 360) % 360,
        segmentType: Math.random() > 0.7 ? 'corner_entry' : 'straight',
      });

      tickTime += 500;
    }
  }

  await db.telemetryTicks.bulkAdd(ticks as TelemetryTick[]);

  console.log(`[MockSession] Generated session ${sessionId} with ${laps.length} laps and ${ticks.length} telemetry ticks`);
  return sessionId;
}

export async function clearAllSessions(): Promise<void> {
  await db.telemetryTicks.clear();
  await db.laps.clear();
  await db.sessions.clear();
  console.log('[MockSession] All sessions cleared');
}

export async function hasMockSession(): Promise<boolean> {
  const count = await db.sessions.count();
  return count > 0;
}
