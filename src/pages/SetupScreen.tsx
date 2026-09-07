/**
 * SetupScreen.tsx — Session setup UI
 *
 * Flow:
 *   1. Select Car vs Bike mode
 *   2. Set track name
 *   3. Drop the start/finish GPS pin (requires active GPS)
 *   4. Verify mount stability via live pitch/roll/yaw readout + "Set Zero Angle" button
 *   5. Tap "Start Session" → MountingWarningModal
 *   6. Acknowledge mounting → session begins
 */

import { useEffect, useState } from 'react';
import type { AppView } from '@/App';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useGPS } from '@/hooks/useGPS';
import { useIMU } from '@/hooks/useIMU';
import { useWakeLock } from '@/hooks/useWakeLock';
import { MountingWarningModal } from '@/components/MountingWarningModal';
import type { VehicleMode } from '@/db/lapforce.db';

interface SetupScreenProps {
  onNavigate: (view: AppView) => void;
}

// Stability indicator: is the device stable enough to zero?
function isMountStable(gyroAlpha: number, gyroBeta: number, gyroGamma: number): boolean {
  return Math.abs(gyroAlpha) < 2 && Math.abs(gyroBeta) < 2 && Math.abs(gyroGamma) < 2;
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
    isPocketMode,
    togglePocketMode,
  } = useTelemetryStore();

  const { position, gpsState, startTracking } = useGPS();
  const { permissionState, requestPermission, data: imuData } = useIMU();
  const { wakeLockState, requestWakeLock } = useWakeLock();
  const [isStarting, setIsStarting] = useState(false);
  const [gateLocked, setGateLocked] = useState(false);
  const [showMountingModal, setShowMountingModal] = useState(false);

  // Start GPS when screen mounts
  useEffect(() => {
    startTracking();
    requestWakeLock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canDropGate = gpsState === 'active' && position !== null;
  const hasGate = gate !== null && gateLocked;
  const canStart = hasGate && (permissionState === 'granted');

  const pitch = imuData?.pitch ?? 0;
  const roll = imuData?.roll ?? 0;
  const heading = imuData?.heading ?? 0;
  const gyroAlpha = imuData?.gyroAlpha ?? 0;
  const gyroBeta = imuData?.gyroBeta ?? 0;
  const gyroGamma = imuData?.gyroGamma ?? 0;
  const mountIsStable = isMountStable(gyroAlpha, gyroBeta, gyroGamma);

  function handleDropGate() {
    if (!position) return;
    const h = position.heading ?? imuData?.heading ?? 0;
    setGate({ lat: position.lat, lng: position.lng }, h);
    setGateLocked(true);
  }

  function handleManualZero() {
    manualZero();
  }

  function handleStartPress() {
    if (!canStart) return;
    setShowMountingModal(true);
  }

  async function beginSession(pocketMode: boolean) {
    setShowMountingModal(false);
    setIsStarting(true);
    try {
      // Enable pocket mode if user chose it
      if (pocketMode && !isPocketMode) togglePocketMode();
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
    <>
      {/* Mounting Modal (conditionally rendered on top) */}
      {showMountingModal && (
        <MountingWarningModal
          vehicleMode={vehicleMode}
          onConfirmMounted={() => beginSession(false)}
          onConfirmPocket={() => beginSession(true)}
          onCancel={() => setShowMountingModal(false)}
        />
      )}

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
            <h2 className="lf-label">3 — Set Start/Finish Line</h2>

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
              {hasGate ? '📍 Gate Set — Tap to Reset' : '📍 Set Start/Finish Gate Here'}
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

          {/* Step 4: IMU Sensors + Live Mount Verification */}
          <section className="lf-card p-4 space-y-3">
            <h2 className="lf-label">4 — Sensors &amp; Mount Verification</h2>

            {permissionState !== 'granted' ? (
              <button
                id="btn-enable-sensors"
                className="lf-btn-primary w-full"
                onClick={requestPermission}
              >
                Enable Motion Sensors
              </button>
            ) : (
              <>
                {/* Live IMU Readout — the key addition */}
                <div className="rounded-xl bg-track-surface border border-track-border overflow-hidden">
                  <div className="px-3 py-2 border-b border-track-border flex items-center justify-between">
                    <span className="lf-label">LIVE ORIENTATION</span>
                    <span className={`lf-badge text-[10px] ${mountIsStable ? 'lf-badge-active' : 'lf-badge-warning'}`}>
                      {mountIsStable ? '✓ STABLE' : 'MOVING'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-track-border">
                    {[
                      { label: 'PITCH', value: pitch, unit: '°', color: Math.abs(pitch) > 30 ? 'text-neon-red' : 'text-white' },
                      { label: 'ROLL', value: roll, unit: '°', color: Math.abs(roll) > 45 ? 'text-neon-red' : 'text-white' },
                      { label: 'HEADING', value: heading, unit: '°', color: 'text-white' },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} className="flex flex-col items-center py-3 px-2">
                        <span className="lf-label text-[9px] mb-1">{label}</span>
                        <span className={`font-mono text-lg font-bold tabular-nums ${color}`}>
                          {value >= 0 ? '+' : ''}{value.toFixed(1)}
                        </span>
                        <span className="text-white/30 text-[9px]">{unit}</span>
                      </div>
                    ))}
                  </div>
                  {/* Gyro rates row */}
                  <div className="grid grid-cols-3 divide-x divide-track-border border-t border-track-border">
                    {[
                      { label: 'YAW RATE', value: gyroAlpha },
                      { label: 'PITCH RATE', value: gyroBeta },
                      { label: 'ROLL RATE', value: gyroGamma },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col items-center py-2 px-2">
                        <span className="lf-label text-[9px] mb-0.5">{label}</span>
                        <span className={`font-mono text-sm font-bold tabular-nums ${Math.abs(value) > 3 ? 'text-neon-yellow' : 'text-white/50'}`}>
                          {value >= 0 ? '+' : ''}{value.toFixed(1)}°/s
                        </span>
                      </div>
                    ))}
                  </div>
                  {isCalibrated && (
                    <div className="px-3 py-2 border-t border-track-border bg-neon-green/5 text-center">
                      <span className="text-xs text-neon-green/70 font-mono">
                        ✓ ZEROED — P:{calibration.pitchOffset.toFixed(1)}° R:{calibration.rollOffset.toFixed(1)}°
                      </span>
                    </div>
                  )}
                </div>

                {/* Manual Zero button */}
                <div className="space-y-2">
                  <button
                    id="btn-manual-zero"
                    className={`w-full py-3 rounded-xl font-semibold text-sm border transition-all
                      ${mountIsStable
                        ? 'border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
                        : 'border-track-border bg-track-surface text-white/30 cursor-not-allowed'}
                    `}
                    disabled={!mountIsStable}
                    onClick={handleManualZero}
                  >
                    ⊙ Set Zero Angle (Mount is {mountIsStable ? 'stable ✓' : 'moving…'})
                  </button>
                  {!isCalibrated && (
                    <p className="text-[11px] text-white/25 text-center">
                      Or auto-calibrates when speed exceeds 20 mph
                    </p>
                  )}
                </div>

                {/* Wake lock status */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-track-surface">
                  <div className={`w-1.5 h-1.5 rounded-full ${wakeLockState === 'active' ? 'bg-neon-green' : 'bg-white/20'}`} />
                  <span className="text-[11px] text-white/40 font-mono">
                    WAKE LOCK: {wakeLockState.toUpperCase()}
                    {wakeLockState === 'unsupported' ? ' (screen may sleep)' : ''}
                  </span>
                </div>
              </>
            )}
          </section>

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
            onClick={handleStartPress}
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
              {!hasGate ? 'Step 3: Drop your start/finish gate' : 'Step 4: Enable motion sensors'}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
