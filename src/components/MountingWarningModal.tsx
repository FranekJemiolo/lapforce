/**
 * MountingWarningModal.tsx — Mandatory pre-session device mounting acknowledgment
 *
 * Displayed after the user taps "Start Session" but before tracking begins.
 * Forces the user to acknowledge their mounting configuration so they
 * understand the impact on G-force/lean angle accuracy.
 *
 * Options:
 *   A) "Device is rigidly mounted" — full telemetry enabled
 *   B) "Enable Pocket Mode" — IMU telemetry suppressed, GPS + audio only
 */

import { useState } from 'react';

interface MountingWarningModalProps {
  vehicleMode: 'car' | 'bike';
  onConfirmMounted: () => void;
  onConfirmPocket: () => void;
  onCancel: () => void;
}

export function MountingWarningModal({
  vehicleMode,
  onConfirmMounted,
  onConfirmPocket,
  onCancel,
}: MountingWarningModalProps) {
  const [selected, setSelected] = useState<'mounted' | 'pocket' | null>(null);

  const vehicleMetric = vehicleMode === 'car' ? 'G-Force & Braking Data' : 'Lean Angle & G-Force';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mounting-warning-title"
    >
      <div className="w-full max-w-lg bg-track-surface border border-track-border rounded-t-3xl p-6 pb-10 animate-slide-up">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-neon-yellow/15 border border-neon-yellow/30 flex items-center justify-center text-xl">
            ⚠️
          </div>
          <div>
            <h2 id="mounting-warning-title" className="text-white font-bold text-lg leading-tight">
              Device Mounting
            </h2>
            <p className="text-white/40 text-xs">Required before session start</p>
          </div>
        </div>

        {/* Warning body */}
        <p className="text-white/70 text-sm leading-relaxed mb-6">
          For accurate <span className="text-neon-yellow font-semibold">{vehicleMetric}</span>,
          your device must be <strong className="text-white">rigidly secured</strong> to the vehicle
          — handlebar mount, dashboard cradle, or suction cup.
        </p>
        <p className="text-white/50 text-sm leading-relaxed mb-6">
          If placing the device in a pocket, bag, or under a seat,
          enable <span className="text-neon-green font-semibold">Pocket Mode</span> — GPS lap timing
          and audio readouts remain active, but IMU telemetry will be suppressed to prevent
          false readings.
        </p>

        {/* Selection cards */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Option A: Rigidly mounted */}
          <button
            id="btn-confirm-mounted"
            className={`
              flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all
              ${selected === 'mounted'
                ? 'border-neon-green bg-neon-green/10'
                : 'border-track-border bg-track-card hover:border-white/20'}
            `}
            onClick={() => setSelected('mounted')}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
              ${selected === 'mounted' ? 'border-neon-green bg-neon-green' : 'border-white/30'}`}>
              {selected === 'mounted' && <div className="w-2 h-2 rounded-full bg-track-black" />}
            </div>
            <div>
              <div className="font-semibold text-white text-sm">
                Device is rigidly mounted to the vehicle
              </div>
              <div className="text-white/40 text-xs mt-0.5">
                Full telemetry — {vehicleMetric}, GPS, lap timing
              </div>
            </div>
          </button>

          {/* Option B: Pocket mode */}
          <button
            id="btn-confirm-pocket"
            className={`
              flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all
              ${selected === 'pocket'
                ? 'border-neon-blue bg-neon-blue/10'
                : 'border-track-border bg-track-card hover:border-white/20'}
            `}
            onClick={() => setSelected('pocket')}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
              ${selected === 'pocket' ? 'border-neon-blue bg-neon-blue' : 'border-white/30'}`}>
              {selected === 'pocket' && <div className="w-2 h-2 rounded-full bg-track-black" />}
            </div>
            <div>
              <div className="font-semibold text-white text-sm">
                Enable Pocket Mode (Audio &amp; GPS only)
              </div>
              <div className="text-white/40 text-xs mt-0.5">
                IMU telemetry disabled — GPS lap timing + speech readouts only
              </div>
            </div>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            id="btn-mounting-confirm"
            className={`
              w-full py-4 rounded-xl font-bold text-base transition-all
              ${selected !== null
                ? selected === 'mounted'
                  ? 'lf-btn-primary'
                  : 'bg-neon-blue/20 border border-neon-blue/50 text-neon-blue hover:bg-neon-blue/30'
                : 'bg-track-card border border-track-border text-white/20 cursor-not-allowed'}
            `}
            disabled={selected === null}
            onClick={() => {
              if (selected === 'mounted') onConfirmMounted();
              else if (selected === 'pocket') onConfirmPocket();
            }}
          >
            {selected === null
              ? 'Select an option above'
              : selected === 'mounted'
              ? '🏁 Confirm — Start Session'
              : '📱 Confirm — Start in Pocket Mode'}
          </button>
          <button
            id="btn-mounting-cancel"
            className="lf-btn-ghost w-full py-3 text-sm"
            onClick={onCancel}
          >
            Back to Setup
          </button>
        </div>
      </div>
    </div>
  );
}
