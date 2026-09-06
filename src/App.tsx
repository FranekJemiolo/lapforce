import { useState } from 'react';
import { SetupScreen } from '@/pages/SetupScreen';
import { LiveDashboard } from '@/pages/LiveDashboard';
import { SessionReview } from '@/pages/SessionReview';

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
  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-6">
      {/* Top spacer */}
      <div className="flex-1" />

      {/* Logo & Brand */}
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg viewBox="0 0 96 96" className="w-full h-full" aria-hidden="true">
            {/* Outer spinning dashes */}
            <circle
              cx="48" cy="48" r="44"
              fill="none"
              stroke="#00FF87"
              strokeWidth="1.5"
              strokeOpacity="0.15"
              strokeDasharray="6 4"
            />
            {/* Main arc */}
            <circle
              cx="48" cy="48" r="44"
              fill="none"
              stroke="#00FF87"
              strokeWidth="2"
              strokeDasharray="220 58"
              strokeDashoffset="0"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px #00FF87)' }}
            />
            {/* Inner circle */}
            <circle cx="48" cy="48" r="34" fill="rgba(0,255,135,0.03)" stroke="rgba(0,255,135,0.1)" strokeWidth="1" />
            {/* Speedometer arc */}
            <path
              d="M 20 68 A 32 32 0 0 1 76 68"
              fill="none"
              stroke="rgba(0,255,135,0.3)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Needle */}
            <line x1="48" y1="48" x2="70" y2="30" stroke="#00FF87" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 4px #00FF87)' }}
            />
            {/* Pivot */}
            <circle cx="48" cy="48" r="3.5" fill="#00FF87" style={{ filter: 'drop-shadow(0 0 4px #00FF87)' }} />
            {/* Speed ticks */}
            {[0, 30, 60, 90, 120, 150].map((_, i) => {
              const angle = -30 + i * 36;
              const rad = (angle * Math.PI) / 180;
              const x1 = 48 + 30 * Math.cos(rad);
              const y1 = 68 + 30 * Math.sin(rad) - 20;
              const x2 = 48 + 36 * Math.cos(rad);
              const y2 = 68 + 36 * Math.sin(rad) - 20;
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(0,255,135,0.4)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: '0 0 60px rgba(0,255,135,0.12)' }}
          />
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
          {[
            { label: 'GPS Lap Timing', color: 'neon-green' },
            { label: 'G-Force Circle', color: 'neon-blue' },
            { label: 'Lean Angle', color: 'neon-yellow' },
            { label: 'Offline Ready', color: 'neon-green' },
          ].map(f => (
            <span key={f.label} className="lf-badge lf-badge-active text-[11px] px-3 py-1">
              {f.label}
            </span>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex-1 flex items-center justify-center w-full max-w-sm my-8">
        <div className="h-px bg-gradient-to-r from-transparent via-track-border to-transparent w-full" />
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-sm pb-safe mb-8">
        <button
          id="btn-new-session"
          className="lf-btn-primary w-full text-base"
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

        {/* Add to Home Screen hint */}
        <p className="text-center text-[11px] text-white/15 mt-2 px-4 leading-relaxed">
          Add to Home Screen for fullscreen experience on iOS & Android
        </p>
      </div>
    </div>
  );
}

export default App;
