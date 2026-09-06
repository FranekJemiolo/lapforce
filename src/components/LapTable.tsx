/**
 * LapTable.tsx — Session lap summary table component
 */


import type { CompletedLap } from '@/store/telemetryStore';
import { msToKph } from '@/hooks/useGPS';

interface LapTableProps {
  laps: CompletedLap[];
  bestLapMs: number | null;
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
}

export function LapTable({ laps, bestLapMs }: LapTableProps) {
  if (laps.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/30 text-sm">No laps completed yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto lf-scrollable">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-track-border">
            {['LAP', 'TIME', 'DELTA', 'MAX KPH', 'MAX G', 'MAX LEAN'].map(h => (
              <th key={h} className="px-3 py-2 lf-label text-center whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {laps.map(lap => {
            const isBest = bestLapMs !== null && lap.durationMs === bestLapMs;
            return (
              <tr
                key={lap.lapNumber}
                className={`border-b border-track-border/40 transition-colors
                  ${isBest ? 'bg-neon-green/5' : 'hover:bg-track-card/50'}`}
              >
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-mono text-white/60 text-sm">{lap.lapNumber}</span>
                    {isBest && <span className="text-[9px] text-neon-green font-bold">BEST</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-mono text-sm font-bold ${isBest ? 'text-neon-green' : 'text-white'}`}>
                    {formatTime(lap.durationMs)}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-mono text-sm font-bold ${
                    lap.deltaMs === null ? 'text-neon-yellow' :
                    lap.deltaMs < 0 ? 'text-neon-green' : 'text-neon-red'
                  }`}>
                    {lap.deltaMs === null
                      ? '—'
                      : (lap.deltaMs >= 0 ? '+' : '') + (lap.deltaMs / 1000).toFixed(3)}
                  </span>
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-white/70">
                  {msToKph(lap.maxSpeedMs).toFixed(0)}
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-white/70">
                  {Math.max(lap.maxLateralG, lap.maxLongitudinalG).toFixed(2)}g
                </td>
                <td className="px-3 py-3 text-center font-mono text-sm text-white/70">
                  {Math.max(Math.abs(lap.minLeanAngle), lap.maxLeanAngle).toFixed(1)}°
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
