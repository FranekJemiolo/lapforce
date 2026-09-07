import { useState } from 'react';
import { SetupScreen } from '@/pages/SetupScreen';
import { LiveDashboard } from '@/pages/LiveDashboard';
import { SessionReview } from '@/pages/SessionReview';
import { DeviceStatusBanner } from '@/components/DeviceStatusBanner';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';

// App-level view routing (no router lib needed for V1 — simple state machine)
export type AppView = 'home' | 'setup' | 'live' | 'review';

function App() {
  const [view, setView] = useState<AppView>('home');

  return (
    <div className="lf-screen animate-fade-in">
      {view === 'home' && <HomeScreen onNavigate={setView} />}
      {view === 'setup' && <SetupScreen onNavigate={setView} />}
      {view === 'live' && <LiveDashboard onNavigate={setView} />}
      {view === 'review' && <SessionReview onNavigate={setView} />}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Home Screen
// ─────────────────────────────────────────────

function HomeScreen({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  const caps = useDeviceCapabilities();
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  return (
    <div className="flex flex-col items-center justify-between min-h-screen">
      {/* Top spacer */}
      <div className="flex-1" />

      {/* Logo & Brand */}
      <div className="flex flex-col items-center gap-4 px-6">
        {/* Animated logo */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg viewBox="0 0 96 96" className="w-full h-full" aria-hidden="true">
            <circle cx="48" cy="48" r="44" fill="none" stroke="#00FF87"
              strokeWidth="1.5" strokeOpacity="0.15" strokeDasharray="6 4" />
            <circle cx="48" cy="48" r="44" fill="none" stroke="#00FF87"
              strokeWidth="2" strokeDasharray="220 58" strokeDashoffset="0"
              strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px #00FF87)' }} />
            <circle cx="48" cy="48" r="34" fill="rgba(0,255,135,0.03)"
              stroke="rgba(0,255,135,0.1)" strokeWidth="1" />
            <path d="M 20 68 A 32 32 0 0 1 76 68" fill="none"
              stroke="rgba(0,255,135,0.3)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="48" y1="48" x2="70" y2="30" stroke="#00FF87" strokeWidth="2.5"
              strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #00FF87)' }} />
            <circle cx="48" cy="48" r="3.5" fill="#00FF87"
              style={{ filter: 'drop-shadow(0 0 4px #00FF87)' }} />
            {[0, 30, 60, 90, 120, 150].map((_, i) => {
              const angle = -30 + i * 36;
              const rad = (angle * Math.PI) / 180;
              return (
                <line key={i}
                  x1={48 + 30 * Math.cos(rad)} y1={68 + 30 * Math.sin(rad) - 20}
                  x2={48 + 36 * Math.cos(rad)} y2={68 + 36 * Math.sin(rad) - 20}
                  stroke="rgba(0,255,135,0.4)" strokeWidth="1.5" strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: '0 0 60px rgba(0,255,135,0.12)' }} />
        </div>

        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
            LAP<span className="text-neon-green">FORCE</span>
          </h1>
          <p className="text-xs text-white/30 tracking-[0.35em] uppercase mt-2">
            Track Telemetry · v1.0
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-xs">
          {['GPS Lap Timing', 'G-Force Circle', 'Lean Angle', 'Offline Ready'].map(f => (
            <span key={f} className="lf-badge lf-badge-active text-[11px] px-3 py-1">{f}</span>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center w-full max-w-sm my-6 px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-track-border to-transparent w-full" />
      </div>

      {/* ── Device/Environment Banner ── */}
      <DeviceStatusBanner caps={caps} />

      {/* ── CTAs ── */}
      <div className="flex flex-col gap-3 w-full max-w-sm px-6 pb-safe mb-8 mt-4">
        <button
          id="btn-new-session"
          className={`lf-btn-primary w-full text-base ${
            // Dim the Start button on desktop since sensors won't work
            !caps.isMobile && caps.platform !== 'unknown' ? 'opacity-50' : ''
          }`}
          onClick={() => onNavigate('setup')}
        >
          <span>🏁</span> New Session
        </button>
        <button
          id="btn-session-review"
          className="lf-btn-ghost w-full text-base"
          onClick={() => onNavigate('review')}
        >
          Review Sessions
        </button>

        {/* Storage info toggle */}
        <button
          className="text-[11px] text-white/25 hover:text-white/50 transition-colors mt-1 underline underline-offset-2"
          onClick={() => setShowStorageInfo(v => !v)}
        >
          {showStorageInfo ? 'Hide storage info' : 'How is my data stored?'}
        </button>

        {showStorageInfo && (
          <div className="lf-card p-4 text-xs space-y-3 text-white/60 animate-fade-in">
            <p className="font-semibold text-white/80">Data is stored locally on your device</p>
            <p>
              LapForce uses <span className="text-neon-green font-mono">IndexedDB</span> —
              a browser-native database — to store all session data, lap times, and GPS telemetry.
              No data is sent to any server.
            </p>
            <div className="border-t border-track-border pt-3 space-y-1.5">
              <Row label="Storage"
                value={caps.storageQuotaMB > 0 ? `${caps.storageUsedMB} MB used / ${caps.storageQuotaMB} MB quota` : 'Estimating...'} />
              <Row label="Persistent"
                value={caps.storagePersisted ? 'Yes — won\'t be evicted' : 'Not pinned — install PWA to pin'} />
              <Row label="Platform" value={caps.platform.toUpperCase()} />
              <Row label="Installed PWA" value={caps.isStandalone ? 'Yes' : 'No'} />
              <Row label="Secure context" value={caps.isSecureContext ? 'Yes (HTTPS)' : 'No (sensors blocked!)'} />
              <Row label="GPS" value={caps.hasGPS ? 'Available' : 'Not available'} />
              <Row label="Motion sensor" value={caps.hasMotionSensor ? 'Available' : 'Not available'} />
            </div>
            <p className="text-white/40 text-[10px] leading-relaxed">
              When installed via "Add to Home Screen", the app runs in standalone mode with its own
              storage scope and pinned quota. Data persists until you uninstall the app.
              In a regular browser tab, data persists until browser storage is cleared.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40 font-mono">{label}</span>
      <span className="text-white/70 font-mono text-right">{value}</span>
    </div>
  );
}

export default App;
