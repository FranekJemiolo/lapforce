/**
 * SessionReview.tsx — Post-session analytics page
 *
 * Shows lap table + segment charts from:
 *   1. Current in-memory session (just ended)
 *   2. Historical sessions from Dexie.js
 */

import { useState, useEffect } from 'react';
import type { AppView } from '@/App';
import { useTelemetryStore } from '@/store/telemetryStore';
import { db } from '@/db/lapforce.db';
import type { Session, Lap, Segment } from '@/db/lapforce.db';
import type { CompletedLap } from '@/store/telemetryStore';
import { LapTable } from '@/components/LapTable';
import { SegmentChart } from '@/components/SegmentChart';
import { msToKph } from '@/hooks/useGPS';

interface SessionReviewProps {
  onNavigate: (view: AppView) => void;
}

interface StoredSession {
  session: Session;
  laps: Lap[];
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

// Convert stored DB Lap to CompletedLap for LapTable
function dbLapToCompleted(lap: Lap): CompletedLap {
  return {
    lapNumber: lap.lapNumber,
    durationMs: lap.durationMs ?? 0,
    deltaMs: lap.deltaMs ?? null,
    maxSpeedMs: lap.maxSpeedMs,
    maxLateralG: lap.maxLateralG,
    maxLongitudinalG: lap.maxLongitudinalG,
    minLeanAngle: lap.minLeanAngle ?? 0,
    maxLeanAngle: lap.maxLeanAngle ?? 0,
    segments: lap.segments ? (JSON.parse(lap.segments) as Segment[]) : [],
  };
}

export function SessionReview({ onNavigate }: SessionReviewProps) {
  const store = useTelemetryStore();
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [selectedLapIndex, setSelectedLapIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Determine if we're viewing the current in-memory session or a historical one
  const hasCurrentSession = store.completedLaps.length > 0;
  const [viewingCurrent, setViewingCurrent] = useState(hasCurrentSession);

  useEffect(() => {
    async function loadSessions() {
      setIsLoading(true);
      try {
        const sessions = await db.sessions.orderBy('startedAt').reverse().limit(20).toArray();
        const sessionsWithLaps = await Promise.all(
          sessions.map(async session => {
            const laps = await db.laps
              .where('sessionId')
              .equals(session.id!)
              .sortBy('lapNumber');
            return { session, laps };
          })
        );
        setStoredSessions(sessionsWithLaps.filter(s => s.laps.length > 0));
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSessions();
  }, []);

  // Current session data
  const currentLaps = store.completedLaps;
  const currentBestMs = store.bestLapMs;

  // Historical session data
  const selectedStored = storedSessions[selectedSessionIndex];
  const storedLaps = selectedStored?.laps.map(dbLapToCompleted) ?? [];
  const storedBestMs = selectedStored?.session.bestLapMs ?? null;

  // Which data to show
  const displayLaps = viewingCurrent ? currentLaps : storedLaps;
  const displayBestMs = viewingCurrent ? currentBestMs : storedBestMs;
  const displaySession = viewingCurrent ? null : selectedStored?.session;

  // Chart data: show segments for selected lap
  const selectedLap = selectedLapIndex !== null ? displayLaps[selectedLapIndex] : null;

  return (
    <div className="lf-screen lf-scrollable overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-track-border">
        <button
          className="lf-btn-icon"
          onClick={() => {
            store.reset();
            onNavigate('home');
          }}
          aria-label="Back to home"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Session Review</h1>
          {displaySession && (
            <p className="text-xs text-white/40">
              {displaySession.trackName} ·{' '}
              {new Date(displaySession.startedAt).toLocaleDateString()}
            </p>
          )}
          {viewingCurrent && (
            <p className="text-xs text-neon-green/60">Current session</p>
          )}
        </div>
        {/* New session button */}
        <button
          id="btn-new-session-from-review"
          className="lf-btn-primary px-4 py-2 text-sm"
          onClick={() => {
            store.reset();
            onNavigate('setup');
          }}
        >
          New Session
        </button>
      </div>

      {/* Session switcher */}
      {(hasCurrentSession || storedSessions.length > 0) && (
        <div className="px-4 pt-4 space-y-2">
          <h2 className="lf-label">Sessions</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 lf-scrollable">
            {hasCurrentSession && (
              <button
                className={`
                  flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${viewingCurrent
                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
                    : 'bg-track-card text-white/50 border border-track-border hover:text-white/80'}
                `}
                onClick={() => { setViewingCurrent(true); setSelectedLapIndex(null); }}
              >
                🔴 Live Session
              </button>
            )}
            {storedSessions.map((s, i) => (
              <button
                key={s.session.id}
                className={`
                  flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                  ${!viewingCurrent && selectedSessionIndex === i
                    ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/40'
                    : 'bg-track-card text-white/50 border border-track-border hover:text-white/80'}
                `}
                onClick={() => {
                  setViewingCurrent(false);
                  setSelectedSessionIndex(i);
                  setSelectedLapIndex(null);
                }}
              >
                {s.session.trackName || 'Session'} ({s.laps.length} laps)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats summary */}
      {displayLaps.length > 0 && (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="lf-card p-3 text-center">
              <div className="lf-label">LAPS</div>
              <div className="font-mono text-2xl font-bold text-white">{displayLaps.length}</div>
            </div>
            <div className="lf-card p-3 text-center">
              <div className="lf-label">BEST</div>
              <div className="font-mono text-lg font-bold text-neon-green">
                {displayBestMs ? formatTime(displayBestMs) : '—'}
              </div>
            </div>
            <div className="lf-card p-3 text-center">
              <div className="lf-label">MAX KPH</div>
              <div className="font-mono text-2xl font-bold text-white">
                {displayLaps.length > 0
                  ? msToKph(Math.max(...displayLaps.map(l => l.maxSpeedMs))).toFixed(0)
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lap Table */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="text-white/30 text-sm animate-pulse">Loading sessions...</div>
        </div>
      ) : displayLaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 gap-4">
          <div className="text-4xl">🏁</div>
          <p className="text-white/30 text-sm text-center">
            No sessions recorded yet.{'\n'}Complete a track session to see your data here.
          </p>
          <button
            className="lf-btn-primary mt-2"
            onClick={() => { store.reset(); onNavigate('setup'); }}
          >
            Start First Session
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          <h2 className="lf-label">Lap Times</h2>
          <div className="lf-card overflow-hidden">
            {/* Tap a lap to see its segment chart */}
            <div className="overflow-x-auto lf-scrollable">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-track-border">
                    {['LAP', 'TIME', 'DELTA', 'MAX KPH', 'MAX G', 'MAX LEAN'].map(h => (
                      <th key={h} className="px-3 py-2 lf-label text-center whitespace-nowrap text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayLaps.map((lap, idx) => {
                    const isBest = displayBestMs !== null && lap.durationMs === displayBestMs;
                    const isSelected = selectedLapIndex === idx;
                    return (
                      <tr
                        key={lap.lapNumber}
                        className={`border-b border-track-border/40 transition-colors cursor-pointer
                          ${isSelected ? 'bg-neon-blue/10' : isBest ? 'bg-neon-green/5' : 'hover:bg-track-card/50'}`}
                        onClick={() => setSelectedLapIndex(isSelected ? null : idx)}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-mono text-white/60 text-xs">{lap.lapNumber}</span>
                            {isBest && <span className="text-[8px] text-neon-green font-bold">BEST</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-mono text-xs font-bold ${isBest ? 'text-neon-green' : 'text-white'}`}>
                            {formatTime(lap.durationMs)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-mono text-xs font-bold ${
                            lap.deltaMs === null ? 'text-neon-yellow' :
                            lap.deltaMs < 0 ? 'text-neon-green' : 'text-neon-red'
                          }`}>
                            {lap.deltaMs === null
                              ? '—'
                              : (lap.deltaMs >= 0 ? '+' : '') + (lap.deltaMs / 1000).toFixed(3)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-white/60">
                          {msToKph(lap.maxSpeedMs).toFixed(0)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-white/60">
                          {Math.max(lap.maxLateralG, lap.maxLongitudinalG).toFixed(2)}g
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-xs text-white/60">
                          {Math.max(Math.abs(lap.minLeanAngle), lap.maxLeanAngle).toFixed(1)}°
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Segment chart for selected lap */}
          {selectedLap && (
            <div className="lf-card p-4 animate-slide-up">
              <SegmentChart
                segments={selectedLap.segments}
                lapNumber={selectedLap.lapNumber}
              />
            </div>
          )}

          {!selectedLap && displayLaps.length > 0 && (
            <p className="text-xs text-white/20 text-center pb-2">
              Tap a lap to view segment chart
            </p>
          )}
        </div>
      )}

      {/* Lap table component (exported separately, used in LiveDashboard) */}
      {false && <LapTable laps={displayLaps} bestLapMs={displayBestMs} />}

      <div className="h-12" />
    </div>
  );
}
