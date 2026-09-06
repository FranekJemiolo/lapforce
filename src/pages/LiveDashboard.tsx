/**
 * LiveDashboard.tsx — Real-time telemetry dashboard
 *
 * Two sub-layouts:
 *   Car mode:  [Delta] [LapTimer] [SpeedBar] [GForceFrictionCircle] [LapList]
 *   Bike mode: [Delta] [LapTimer] [SpeedBar] [LeanAngleGauge] [LapList]
 *
 * All sensor hooks run here and feed into the Zustand store.
 * UI updates are triggered by store subscriptions, gated by rAF.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AppView } from '@/App';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useGPS, msToKph } from '@/hooks/useGPS';
import { useIMU } from '@/hooks/useIMU';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAudioFeedback } from '@/hooks/useAudioFeedback';
import { PredictiveDelta } from '@/components/PredictiveDelta';
import { GForceFrictionCircle } from '@/components/GForceFrictionCircle';
import { LeanAngleGauge } from '@/components/LeanAngleGauge';
import { PocketMode } from '@/components/PocketMode';

interface LiveDashboardProps {
  onNavigate: (view: AppView) => void;
}

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

function formatElapsed(startMs: number): string {
  return formatLapTime(Date.now() - startMs);
}

export function LiveDashboard({ onNavigate }: LiveDashboardProps) {
  const store = useTelemetryStore();
  const { position, startTracking, stopTracking } = useGPS();
  const { data: imuData, permissionState } = useIMU();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const { announceLapTime, announceDelta } = useAudioFeedback();

  const [elapsedDisplay, setElapsedDisplay] = useState('0:00.000');
  const [tickMs, setTickMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevLapCountRef = useRef(0);

  // Start sensors on mount
  useEffect(() => {
    startTracking();
    requestWakeLock();
    return () => {
      stopTracking();
      releaseWakeLock();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Feed GPS into store
  useEffect(() => {
    if (position) store.onGPSTick(position);
  }, [position, store]);

  // Feed IMU into store
  useEffect(() => {
    if (imuData) store.onIMUTick(imuData);
  }, [imuData, store]);

  // Announce completed laps (audio)
  const completedLaps = store.completedLaps;
  useEffect(() => {
    const newCount = completedLaps.length;
    if (newCount > prevLapCountRef.current) {
      const lastLap = completedLaps[newCount - 1];
      if (lastLap) {
        announceLapTime(lastLap.durationMs, lastLap.lapNumber);
        if (lastLap.deltaMs !== null) {
          setTimeout(() => announceDelta(lastLap.deltaMs!), 2000);
        }
      }
      prevLapCountRef.current = newCount;
    }
  }, [completedLaps, announceLapTime, announceDelta]);

  // Lap timer rAF loop
  useEffect(() => {
    if (store.status !== 'running') return;

    function tick() {
      const lap = useTelemetryStore.getState().currentLap;
      if (lap) {
        setElapsedDisplay(formatElapsed(lap.startMs));
        setTickMs(Date.now() - lap.startMs);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [store.status]);

  const handleEndSession = useCallback(async () => {
    await store.endSession();
    onNavigate('review');
  }, [store, onNavigate]);

  const currentLap = store.currentLap;
  const vehicleMode = store.vehicleMode;
  const isCar = vehicleMode === 'car';

  // Telemetry values
  const speedKph = position ? msToKph(position.speedMs) : 0;
  const lateralG = imuData?.lateralG ?? 0;
  const longitudinalG = imuData?.longitudinalG ?? 0;
  const rollDeg = imuData?.roll ?? 0;
  const maxRightDeg = currentLap ? Math.max(0, currentLap.maxLeanAngle) : 0;
  const maxLeftDeg = currentLap ? Math.abs(Math.min(0, currentLap.minLeanAngle)) : 0;

  return (
    <div className="lf-screen relative overflow-hidden">
      {/* Pocket Mode overlay */}
      <PocketMode
        isActive={store.isPocketMode}
        onToggle={store.togglePocketMode}
        lastLapMs={completedLaps[completedLaps.length - 1]?.durationMs}
        currentLapNumber={currentLap?.lapNumber}
      />

      {/* ── Header Bar ────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="lf-live-dot" />
          <span className="lf-label">
            {store.trackName || 'LIVE SESSION'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Calibration badge */}
          {store.isCalibrated && (
            <span className="lf-badge lf-badge-active text-[10px]">CAL</span>
          )}
          {/* Wake lock */}
          <span className={`lf-badge text-[10px] ${
            store.isInsideGate ? 'lf-badge-active' : 'lf-badge-inactive'
          }`}>
            {store.isInsideGate ? '🚦 GATE' : 'OUT'}
          </span>
          {/* GPS accuracy */}
          {position && (
            <span className="lf-badge lf-badge-inactive text-[10px]">
              ±{position.accuracyM.toFixed(0)}m
            </span>
          )}
          {/* Pocket mode toggle */}
          <button
            id="btn-pocket-mode-header"
            className="lf-btn-icon p-2"
            onClick={store.togglePocketMode}
            aria-label="Toggle pocket mode"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Lap Number ─────────────────────────── */}
      <div className="flex justify-between items-center px-4 py-1">
        <span className="text-white/40 text-xs font-mono">
          LAP {currentLap?.lapNumber ?? '—'} / {store.completedLaps.length} DONE
        </span>
        <span className="text-white/40 text-xs font-mono">
          {store.bestLapMs ? `BEST: ${formatLapTime(store.bestLapMs)}` : 'NO BEST YET'}
        </span>
      </div>

      {/* ── Lap Timer ─────────────────────────── */}
      <div className="flex flex-col items-center py-2">
        <span className="font-mono text-4xl font-bold text-white tabular-nums tracking-tight">
          {elapsedDisplay}
        </span>
        <span className="lf-label mt-1">CURRENT LAP</span>
      </div>

      {/* ── Predictive Delta ───────────────────── */}
      <div className="flex justify-center py-2">
        <PredictiveDelta
          deltaMs={store.predictiveDeltaMs}
          isLapActive={currentLap !== null}
          size={store.completedLaps.length === 0 ? 'md' : 'xl'}
        />
      </div>

      {/* ── Speed Bar ────────────────────────── */}
      <div className="px-4 py-2">
        <div className="flex justify-between items-end mb-1">
          <span className="lf-label">SPEED</span>
          <span className="font-mono text-2xl font-bold text-white">
            {speedKph.toFixed(0)} <span className="text-sm text-white/40 font-normal">km/h</span>
          </span>
        </div>
        <div className="h-1.5 bg-track-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${Math.min(100, (speedKph / 250) * 100)}%`,
              background: 'linear-gradient(90deg, #00FF87, #4DA6FF)',
            }}
          />
        </div>
      </div>

      {/* ── Visualizer ─────────────────────────── */}
      <div className="flex justify-center px-4 py-3">
        {isCar ? (
          <GForceFrictionCircle
            lateralG={lateralG}
            longitudinalG={longitudinalG}
            size={220}
          />
        ) : (
          <LeanAngleGauge
            rollDeg={rollDeg}
            maxRightDeg={maxRightDeg}
            maxLeftDeg={maxLeftDeg}
            size={220}
          />
        )}
      </div>

      {/* ── Segment indicator ─────────────────── */}
      <div className="flex justify-center gap-3 px-4 py-1">
        {(['straight', 'corner_entry', 'apex', 'corner_exit'] as const).map(seg => (
          <div
            key={seg}
            className={`
              px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all
              ${store.currentSegment === seg
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                : 'text-white/15'}
            `}
          >
            {seg.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* ── Recent laps ───────────────────────── */}
      {completedLaps.length > 0 && (
        <div className="mx-4 my-2 lf-card overflow-hidden">
          <div className="flex border-b border-track-border px-3 py-1.5">
            <span className="lf-label flex-1 text-center">LAP</span>
            <span className="lf-label flex-1 text-center">TIME</span>
            <span className="lf-label flex-1 text-center">DELTA</span>
            <span className="lf-label flex-1 text-center">MAX KPH</span>
          </div>
          {completedLaps.slice(-4).reverse().map(lap => (
            <div
              key={lap.lapNumber}
              className="flex items-center px-3 py-2 border-b border-track-border/50 last:border-0"
            >
              <span className="flex-1 text-center font-mono text-white/70 text-sm">
                {lap.lapNumber}
              </span>
              <span className="flex-1 text-center font-mono text-white text-sm font-bold">
                {formatLapTime(lap.durationMs)}
              </span>
              <span className={`flex-1 text-center font-mono text-sm font-bold ${
                lap.deltaMs === null
                  ? 'text-neon-yellow'
                  : lap.deltaMs < 0
                  ? 'text-neon-green'
                  : 'text-neon-red'
              }`}>
                {lap.deltaMs === null
                  ? '—'
                  : (lap.deltaMs >= 0 ? '+' : '') + (lap.deltaMs / 1000).toFixed(3)}
              </span>
              <span className="flex-1 text-center font-mono text-white/50 text-sm">
                {msToKph(lap.maxSpeedMs).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── End Session button ─────────────────── */}
      <div className="px-4 pb-6 pt-2 mt-auto">
        <button
          id="btn-end-session"
          className="lf-btn-danger w-full"
          onClick={handleEndSession}
        >
          End Session
        </button>
      </div>

      {/* IMU permission warning */}
      {permissionState === 'denied' && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-neon-red/10 border border-neon-red/30">
          <p className="text-xs text-neon-red text-center">
            Motion sensors denied — G-force and lean angle unavailable
          </p>
        </div>
      )}

      {/* Debug tick counter (dev only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-20 right-4 text-[9px] text-white/10 font-mono">
          {tickMs.toFixed(0)}ms
        </div>
      )}
    </div>
  );
}
