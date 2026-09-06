/**
 * SetupScreen.tsx — Session setup UI
 *
 * Allows the user to:
 *   1. Select Car vs Bike mode
 *   2. Set track name
 *   3. Drop the start/finish GPS pin (requires active GPS)
 *   4. Manual "Zero" calibration button
 *   5. Enable IMU sensors (iOS permission)
 *   6. Start Session
 */

import { useEffect, useState } from 'react';
import type { AppView } from '@/App';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useGPS } from '@/hooks/useGPS';
import { useIMU } from '@/hooks/useIMU';
import { useWakeLock } from '@/hooks/useWakeLock';
import type { VehicleMode } from '@/db/lapforce.db';

interface SetupScreenProps {
  onNavigate: (view: AppView) => void;
}

export function SetupScreen({ onNavigate }: SetupScreenProps) {
  const {
    vehicleMode, setVehicleMode,
    trackName, setTrackName,
    gate, setGate,
    startSession,
    manualZero,
    calibration,
    isCalibrated,
  } = useTelemetryStore();

  const { position, gpsState, startTracking } = useGPS();
  const { permissionState, requestPermission, data: imuData } = useIMU();
  const { wakeLockState, requestWakeLock } = useWakeLock();
  const [isStarting, setIsStarting] = useState(false);
  const [gateLocked, setGateLocked] = useState(false);

  // Start GPS when screen mounts
  useEffect(() => {
    startTracking();
    requestWakeLock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canDropGate = gpsState === 'active' && position !== null;
  const hasGate = gate !== null && gateLocked;
  const canStart = hasGate && (permissionState === 'granted');

  function handleDropGate() {
    if (!position) return;
    const heading = position.heading ?? imuData?.heading ?? 0;
    setGate({ lat: position.lat, lng: position.lng }, heading);
    setGateLocked(true);
  }

  function handleManualZero() {
    manualZero();
  }

  async function handleStartSession() {
    if (!canStart) return;
    setIsStarting(true);
    try {
      await startSession();
      onNavigate('live');
    } catch (err) {
      console.error('Failed to start session:', err);
      setIsStarting(false);
    }
  }

  const gpsStatusColor = {
    idle: 'text-white/40',
    requesting: 'text-neon-yellow',
    active: 'text-neon-green',
    error: 'text-neon-red',
  }[gpsState];

  const gpsStatusLabel = {
    idle: 'Initializing...',
    requesting: 'Acquiring GPS...',
    active: position
      ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} (±${position.accuracyM.toFixed(0)}m)`
      : 'Active',
    error: 'GPS Error — Check permissions',
  }[gpsState];

  return (
    <div className="lf-screen lf-scrollable overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-track-border">
        <button
          className="lf-btn-icon"
          onClick={() => onNavigate('home')}
          aria-label="Back to home"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Session Setup</h1>
          <p className="text-xs text-white/40">Configure before going to track</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">

        {/* Step 1: Vehicle Mode */}
        <section className="lf-card p-4 space-y-3">
          <h2 className="lf-label">1 — Vehicle Mode</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['car', 'bike'] as VehicleMode[]).map(mode => (
              <button
                key={mode}
                id={`btn-mode-${mode}`}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl
                  border-2 transition-all duration-200 font-bold text-sm uppercase tracking-wider
                  ${vehicleMode === mode
                    ? 'border-neon-green bg-neon-green/10 text-neon-green'
                    : 'border-track-border text-white/50 hover:border-white/30 hover:text-white/80'}
                `}
                onClick={() => setVehicleMode(mode)}
              >
                <span className="text-3xl">{mode === 'car' ? '🚗' : '🏍️'}</span>
                <span>{mode === 'car' ? 'Car' : 'Bike'}</span>
                {vehicleMode === mode && (
                  <span className="absolute top-2 right-2 text-neon-green text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/30">
            {vehicleMode === 'car'
              ? 'Shows G-Force Friction Circle + Predictive Delta'
              : 'Shows Lean Angle Gauge + Predictive Delta'}
          </p>
        </section>

        {/* Step 2: Track Name */}
        <section className="lf-card p-4 space-y-3">
          <h2 className="lf-label">2 — Track Name</h2>
          <input
            id="input-track-name"
            type="text"
            value={trackName}
            onChange={e => setTrackName(e.target.value)}
            placeholder="e.g. Silverstone, Nürburgring"
            className="
              w-full bg-track-surface border border-track-border rounded-lg
              px-4 py-3 text-white placeholder-white/20
              focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/30
              font-display text-sm transition-all
            "
            maxLength={60}
          />
        </section>

        {/* Step 3: GPS Status + Gate */}
        <section className="lf-card p-4 space-y-3">
          <h2 className="lf-label">3 — Start/Finish Line</h2>

          {/* GPS indicator */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-track-surface">
            <div className={`w-2 h-2 rounded-full ${gpsState === 'active' ? 'bg-neon-green animate-pulse' : 'bg-white/20'}`} />
            <span className={`text-xs font-mono ${gpsStatusColor}`}>{gpsStatusLabel}</span>
          </div>

          {/* Drop gate button */}
          <button
            id="btn-drop-gate"
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
              ${canDropGate
                ? 'bg-neon-green/20 border border-neon-green/40 text-neon-green hover:bg-neon-green/30'
                : 'bg-track-surface border border-track-border text-white/20 cursor-not-allowed'}
            `}
            disabled={!canDropGate}
            onClick={handleDropGate}
          >
            {hasGate ? '📍 Gate Set — Tap to Reset' : '📍 Drop Start/Finish Pin Here'}
          </button>

          {hasGate && gate && (
            <div className="p-3 rounded-lg bg-neon-green/5 border border-neon-green/20 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">LAT</span>
                <span className="font-mono text-neon-green">{gate.lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">LNG</span>
                <span className="font-mono text-neon-green">{gate.lng.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">HEADING</span>
                <span className="font-mono text-neon-green">
                  {(position?.heading ?? imuData?.heading ?? 0).toFixed(1)}°
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Step 4: IMU Sensors */}
        <section className="lf-card p-4 space-y-3">
          <h2 className="lf-label">4 — Sensors & Calibration</h2>

          {permissionState !== 'granted' ? (
            <button
              id="btn-enable-sensors"
              className="lf-btn-primary w-full"
              onClick={requestPermission}
            >
              Enable Motion Sensors
            </button>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-track-surface">
              <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span className="text-xs text-neon-green font-mono">SENSORS ACTIVE</span>
              {imuData && (
                <span className="text-xs text-white/30 ml-auto font-mono">
                  P:{imuData.pitch.toFixed(1)}° R:{imuData.roll.toFixed(1)}°
                </span>
              )}
            </div>
          )}

          {/* Wake lock */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-track-surface">
            <div className={`w-2 h-2 rounded-full ${wakeLockState === 'active' ? 'bg-neon-green' : 'bg-white/20'}`} />
            <span className="text-xs text-white/50 font-mono">
              WAKE LOCK: {wakeLockState.toUpperCase()}
            </span>
          </div>

          {/* Calibration */}
          {permissionState === 'granted' && (
            <div className="space-y-2">
              <button
                id="btn-manual-zero"
                className="lf-btn-ghost w-full text-sm"
                onClick={handleManualZero}
                disabled={!imuData}
              >
                ⊙ Zero Sensors (Manual)
              </button>
              {isCalibrated && (
                <div className="text-xs text-neon-green/60 text-center font-mono">
                  ✓ Calibrated — P:{calibration.pitchOffset.toFixed(1)}° R:{calibration.rollOffset.toFixed(1)}°
                </div>
              )}
              {!isCalibrated && (
                <div className="text-xs text-white/30 text-center">
                  Or auto-calibrates at &gt;20 mph
                </div>
              )}
            </div>
          )}
        </section>

        {/* Spacer */}
        <div className="h-2" />
      </div>

      {/* Sticky Start Button */}
      <div className="sticky bottom-0 px-5 pb-6 pt-4 bg-gradient-to-t from-track-black to-transparent">
        <button
          id="btn-start-session"
          className={`
            w-full py-5 rounded-2xl font-bold text-lg transition-all duration-200
            ${canStart
              ? 'lf-btn-primary'
              : 'bg-track-card border border-track-border text-white/20 cursor-not-allowed'}
          `}
          disabled={!canStart || isStarting}
          onClick={handleStartSession}
        >
          {isStarting
            ? 'Starting...'
            : canStart
            ? '🏁 Start Session'
            : !hasGate
            ? 'Set Start/Finish Gate First'
            : 'Enable Sensors First'}
        </button>
        {!canStart && (
          <p className="text-xs text-white/20 text-center mt-2">
            {!hasGate ? 'Step 3: Drop your start/finish pin' : 'Step 4: Enable motion sensors'}
          </p>
        )}
      </div>
    </div>
  );
}
