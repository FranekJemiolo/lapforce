/**
 * LiveDashboard.tsx — Real-time telemetry dashboard
 *
 * Two VIEW MODES (tap anywhere to toggle):
 *
 * GLANCEABLE (default):
 *   Massive fonts. Delta (red/green) + primary metric (G-circle or Lean gauge).
 *   Nothing else — maximum legibility at race speed.
 *
 * DETAILED:
 *   Grid layout. Speed, lap timer, previous lap, session time,
 *   max G/lean, GPS accuracy, segment indicator, mini lap table.
 *
 * Sensor hooks feed the Zustand store. UI updates via rAF-gated timers.
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

type DashView = 'glanceable' | 'detailed';

function formatLapTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

function formatSessionTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
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

  const [dashView, setDashView] = useState<DashView>('glanceable');
  const [elapsedDisplay, setElapsedDisplay] = useState('0:00.000');
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const prevLapCountRef = useRef(0);

  // Start sensors on mount
  useEffect(() => {
    startTracking();
    requestWakeLock();
    sessionStartRef.current = Date.now();
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

  // rAF loop for lap timer + session timer
  useEffect(() => {
    if (store.status !== 'running') return;

    function tick() {
      const lap = useTelemetryStore.getState().currentLap;
      if (lap) setElapsedDisplay(formatElapsed(lap.startMs));
      setSessionElapsedMs(Date.now() - sessionStartRef.current);
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

  const toggleView = useCallback(() => {
    setDashView(v => v === 'glanceable' ? 'detailed' : 'glanceable');
  }, []);

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
  const gpsAccuracy = position?.accuracyM ?? null;

  const lastLap = completedLaps[completedLaps.length - 1];

  // ── Pocket Mode overlay ────────────────────────────
  if (store.isPocketMode) {
    return (
      <PocketMode
        isActive={true}
        onToggle={store.togglePocketMode}
        lastLapMs={lastLap?.durationMs}
        currentLapNumber={currentLap?.lapNumber}
      />
    );
  }

  return (
    <div
      className="lf-screen relative overflow-hidden select-none"
      onClick={toggleView}
    >
      {/* ════════════════════════════════════════════
          GLANCEABLE MODE
         ════════════════════════════════════════════ */}
      {dashView === 'glanceable' && (
        <div className="flex flex-col items-center justify-between h-full px-4 py-4">
          {/* Top status strip */}
          <div className="w-full flex items-center justify-between" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="lf-live-dot" />
              <span className="lf-label">
                LAP {currentLap?.lapNumber ?? '—'}
              </span>
              {store.isInsideGate && (
                <span className="lf-badge lf-badge-active text-[10px]">🚦 GATE</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <button
                id="btn-pocket-mode-glanceable"
                className="lf-btn-icon p-2"
                onClick={e => { e.stopPropagation(); store.togglePocketMode(); }}
                aria-label="Pocket mode"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <circle cx="12" cy="18" r="1" fill="currentColor" />
                </svg>
              </button>
              <button
                id="btn-end-session-glanceable"
                className="px-3 py-1.5 rounded-lg bg-neon-red/15 border border-neon-red/30 text-neon-red text-xs font-bold"
                onClick={e => { e.stopPropagation(); handleEndSession(); }}
              >
                END
              </button>
            </div>
          </div>

          {/* MASSIVE Delta */}
          <div className="flex-1 flex items-center justify-center w-full">
            <PredictiveDelta
              deltaMs={store.predictiveDeltaMs}
              isLapActive={currentLap !== null}
              size="xl"
            />
          </div>

          {/* Primary Visualizer */}
          <div className="flex justify-center w-full mb-2">
            {isCar ? (
              <GForceFrictionCircle lateralG={lateralG} longitudinalG={longitudinalG} size={200} />
            ) : (
              <LeanAngleGauge rollDeg={rollDeg} maxRightDeg={maxRightDeg} maxLeftDeg={maxLeftDeg} size={200} />
            )}
          </div>

          {/* Hint */}
          <p className="text-[10px] text-white/15 tracking-widest uppercase">
            Tap to switch to detailed view
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════
          DETAILED MODE
         ════════════════════════════════════════════ */}
      {dashView === 'detailed' && (
        <div className="flex flex-col h-full overflow-y-auto lf-scrollable">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="lf-live-dot" />
              <span className="lf-label">{store.trackName || 'LIVE SESSION'}</span>
              {store.isCalibrated && (
                <span className="lf-badge lf-badge-active text-[10px]">CAL</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                id="btn-pocket-mode-detailed"
                className="lf-btn-icon p-2"
                onClick={e => { e.stopPropagation(); store.togglePocketMode(); }}
                aria-label="Pocket mode"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <circle cx="12" cy="18" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          {/* Predictive delta (smaller in detailed mode) */}
          <div className="flex justify-center py-2">
            <PredictiveDelta
              deltaMs={store.predictiveDeltaMs}
              isLapActive={currentLap !== null}
              size="md"
            />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 px-4 py-2" onClick={e => e.stopPropagation()}>
            {/* Current Lap Time */}
            <div className="lf-card p-3 col-span-2">
              <div className="lf-label">CURRENT LAP</div>
              <div className="font-mono text-3xl font-bold text-white tabular-nums tracking-tight">
                {elapsedDisplay}
              </div>
            </div>

            {/* Speed */}
            <div className="lf-card p-3">
              <div className="lf-label">SPEED</div>
              <div className="font-mono text-2xl font-bold text-white tabular-nums">
                {speedKph.toFixed(0)}
                <span className="text-sm text-white/40 font-normal ml-1">km/h</span>
              </div>
            </div>

            {/* Previous Lap */}
            <div className="lf-card p-3">
              <div className="lf-label">PREV LAP</div>
              <div className={`font-mono text-lg font-bold tabular-nums ${
                lastLap?.deltaMs == null ? 'text-neon-yellow'
                : lastLap.deltaMs < 0 ? 'text-neon-green'
                : 'text-neon-red'
              }`}>
                {lastLap ? formatLapTime(lastLap.durationMs) : '—'}
              </div>
            </div>

            {/* Session Time */}
            <div className="lf-card p-3">
              <div className="lf-label">SESSION TIME</div>
              <div className="font-mono text-xl font-bold text-white/70 tabular-nums">
                {formatSessionTime(sessionElapsedMs)}
              </div>
            </div>

            {/* Best Lap */}
            <div className="lf-card p-3">
              <div className="lf-label">BEST LAP</div>
              <div className="font-mono text-xl font-bold text-neon-green tabular-nums">
                {store.bestLapMs ? formatLapTime(store.bestLapMs) : '—'}
              </div>
            </div>

            {/* Max G or Lean */}
            {isCar ? (
              <>
                <div className="lf-card p-3">
                  <div className="lf-label">MAX LAT G</div>
                  <div className="font-mono text-xl font-bold text-neon-blue tabular-nums">
                    {currentLap?.maxLateralG.toFixed(2) ?? '—'}g
                  </div>
                </div>
                <div className="lf-card p-3">
                  <div className="lf-label">MAX BRAKE G</div>
                  <div className="font-mono text-xl font-bold text-neon-red tabular-nums">
                    {currentLap?.maxLongitudinalG.toFixed(2) ?? '—'}g
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="lf-card p-3">
                  <div className="lf-label">MAX LEAN R</div>
                  <div className="font-mono text-xl font-bold text-neon-yellow tabular-nums">
                    +{maxRightDeg.toFixed(1)}°
                  </div>
                </div>
                <div className="lf-card p-3">
                  <div className="lf-label">MAX LEAN L</div>
                  <div className="font-mono text-xl font-bold text-neon-yellow tabular-nums">
                    -{maxLeftDeg.toFixed(1)}°
                  </div>
                </div>
              </>
            )}

            {/* GPS Accuracy */}
            <div className="lf-card p-3 col-span-2">
              <div className="lf-label">GPS ACCURACY</div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  gpsAccuracy !== null && gpsAccuracy < 5 ? 'bg-neon-green' :
                  gpsAccuracy !== null && gpsAccuracy < 15 ? 'bg-neon-yellow' : 'bg-neon-red'
                } animate-pulse`} />
                <span className="font-mono text-lg font-bold text-white/70">
                  {gpsAccuracy !== null ? `±${gpsAccuracy.toFixed(1)}m` : 'No signal'}
                </span>
                <span className="text-xs text-white/30 ml-auto">
                  {gpsAccuracy !== null && gpsAccuracy < 5 ? 'Excellent' :
                   gpsAccuracy !== null && gpsAccuracy < 15 ? 'Good' : 'Poor'}
                </span>
              </div>
            </div>
          </div>

          {/* Segment indicator */}
          <div className="flex justify-center gap-2 px-4 py-1" onClick={e => e.stopPropagation()}>
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

          {/* Recent laps mini-table */}
          {completedLaps.length > 0 && (
            <div className="mx-4 my-2 lf-card overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex border-b border-track-border px-3 py-1.5">
                <span className="lf-label flex-1 text-center">LAP</span>
                <span className="lf-label flex-1 text-center">TIME</span>
                <span className="lf-label flex-1 text-center">DELTA</span>
                <span className="lf-label flex-1 text-center">KPH</span>
              </div>
              {completedLaps.slice(-3).reverse().map(lap => (
                <div
                  key={lap.lapNumber}
                  className="flex items-center px-3 py-2 border-b border-track-border/50 last:border-0"
                >
                  <span className="flex-1 text-center font-mono text-white/60 text-xs">{lap.lapNumber}</span>
                  <span className="flex-1 text-center font-mono text-white text-xs font-bold">{formatLapTime(lap.durationMs)}</span>
                  <span className={`flex-1 text-center font-mono text-xs font-bold ${
                    lap.deltaMs === null ? 'text-neon-yellow' : lap.deltaMs < 0 ? 'text-neon-green' : 'text-neon-red'
                  }`}>
                    {lap.deltaMs === null ? '—' : (lap.deltaMs >= 0 ? '+' : '') + (lap.deltaMs / 1000).toFixed(3)}
                  </span>
                  <span className="flex-1 text-center font-mono text-white/50 text-xs">{msToKph(lap.maxSpeedMs).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* End session */}
          <div className="px-4 pb-6 pt-2 mt-auto" onClick={e => e.stopPropagation()}>
            <button
              id="btn-end-session"
              className="lf-btn-danger w-full"
              onClick={handleEndSession}
            >
              End Session
            </button>
          </div>

          {/* View toggle hint */}
          <p className="text-center text-[10px] text-white/15 tracking-widest uppercase pb-4">
            Tap anywhere to switch to glanceable view
          </p>
        </div>
      )}

      {/* IMU permission warning */}
      {permissionState === 'denied' && (
        <div className="absolute bottom-20 left-4 right-4 p-3 rounded-xl bg-neon-red/10 border border-neon-red/30">
          <p className="text-xs text-neon-red text-center">
            Motion sensors denied — G-force and lean angle unavailable
          </p>
        </div>
      )}
    </div>
  );
}
