import { useState } from 'react';

// App-level view routing (no router lib needed for V1 — simple state machine)
export type AppView = 'home' | 'setup' | 'live' | 'review';

function App() {
  const [view, setView] = useState<AppView>('home');

  return (
    <div className="lf-screen animate-fade-in">
      {/* Placeholder views — implemented in Milestone 4 */}
      {view === 'home' && <HomeStub onNavigate={setView} />}
      {view === 'setup' && <SetupStub onNavigate={setView} />}
      {view === 'live' && <LiveStub onNavigate={setView} />}
      {view === 'review' && <ReviewStub onNavigate={setView} />}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Milestone 1 Stubs — replaced in M4 & M5
// ─────────────────────────────────────────────

function HomeStub({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 96 96" className="w-full h-full">
            {/* Outer ring */}
            <circle cx="48" cy="48" r="44" fill="none" stroke="#00FF87" strokeWidth="2" strokeOpacity="0.3" />
            <circle cx="48" cy="48" r="44" fill="none" stroke="#00FF87" strokeWidth="2"
              strokeDasharray="200 77"
              strokeDashoffset="0"
              strokeLinecap="round" />
            {/* Speedometer arc */}
            <path d="M 16 64 A 36 36 0 0 1 80 64" fill="none" stroke="#00FF87" strokeWidth="3" strokeLinecap="round" />
            {/* Needle */}
            <line x1="48" y1="48" x2="72" y2="30" stroke="#00FF87" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="48" cy="48" r="3" fill="#00FF87" />
          </svg>
          <div className="absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 40px rgba(0,255,135,0.2)' }} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight font-mono text-white">
          LAP<span className="text-neon-green">FORCE</span>
        </h1>
        <p className="text-sm text-white/40 tracking-widest uppercase">Track Telemetry v1.0</p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 max-w-xs">
        {['GPS Lap Timing', 'G-Force Circle', 'Lean Angle', 'Offline Ready'].map(f => (
          <span key={f} className="lf-badge lf-badge-active text-xs">{f}</span>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          id="btn-start-session"
          className="lf-btn-primary w-full"
          onClick={() => onNavigate('setup')}
        >
          Start Session
        </button>
        <button
          id="btn-review-sessions"
          className="lf-btn-ghost w-full"
          onClick={() => onNavigate('review')}
        >
          Review Sessions
        </button>
      </div>

      {/* Install hint */}
      <p className="text-xs text-white/20 text-center max-w-xs">
        Add to Home Screen for full-screen native experience on iOS and Android
      </p>
    </div>
  );
}

function SetupStub({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6">
      <h2 className="text-2xl font-bold text-white">Session Setup</h2>
      <p className="text-white/40 text-sm">Implemented in Milestone 4</p>
      <div className="flex gap-3">
        <button className="lf-btn-ghost" onClick={() => onNavigate('home')}>Back</button>
        <button className="lf-btn-primary" onClick={() => onNavigate('live')}>Go Live →</button>
      </div>
    </div>
  );
}

function LiveStub({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6">
      <div className="lf-badge lf-badge-active">
        <span className="lf-live-dot mr-1" />
        LIVE
      </div>
      <p className="text-6xl font-mono font-bold lf-delta-ahead">+0.000</p>
      <p className="text-white/40 text-sm">Live Dashboard — Milestone 4</p>
      <button className="lf-btn-danger" onClick={() => onNavigate('review')}>End Session</button>
    </div>
  );
}

function ReviewStub({ onNavigate }: { onNavigate: (v: AppView) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6">
      <h2 className="text-2xl font-bold text-white">Session Review</h2>
      <p className="text-white/40 text-sm">Analytics — Milestone 5</p>
      <button className="lf-btn-ghost" onClick={() => onNavigate('home')}>Home</button>
    </div>
  );
}

export default App;
