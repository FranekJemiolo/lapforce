/**
 * CornerMetricsTable.tsx — Granular per-corner analytics table
 *
 * For every identified corner segment in a lap, shows:
 *
 * CAR mode:
 *   Entry Speed | Apex Speed | Exit Speed | Max Lat G | Min Lat G | Peak Brake G
 *
 * BIKE mode:
 *   Entry Speed | Apex Speed | Exit Speed | Max Lean | Avg Lean
 */

import type { Segment } from '@/db/lapforce.db';
import type { VehicleMode } from '@/db/lapforce.db';
import { msToKph } from '@/hooks/useGPS';

interface CornerMetricsTableProps {
  segments: Segment[];
  vehicleMode: VehicleMode;
  lapNumber: number;
}

function kph(ms: number): string {
  return `${msToKph(ms).toFixed(0)}`;
}

export function CornerMetricsTable({
  segments,
  vehicleMode,
  lapNumber,
}: CornerMetricsTableProps) {
  // Only show corner segments (any corner phase)
  const corners = segments.filter(
    s => s.type === 'corner_entry' || s.type === 'apex' || s.type === 'corner_exit'
  );

  if (corners.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-white/30 text-sm">No corners recorded for Lap {lapNumber}</p>
      </div>
    );
  }

  const isCar = vehicleMode === 'car';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="lf-label">LAP {lapNumber} — CORNER BREAKDOWN</p>
        <p className="text-[10px] text-white/30">{corners.length} corners · km/h</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-track-border">
        <table className="w-full text-left border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b border-track-border bg-track-card">
              <th className="px-3 py-2 lf-label text-center whitespace-nowrap">#</th>
              <th className="px-3 py-2 lf-label text-center whitespace-nowrap">ENTRY</th>
              <th className="px-3 py-2 lf-label text-center whitespace-nowrap">APEX</th>
              <th className="px-3 py-2 lf-label text-center whitespace-nowrap">EXIT</th>
              {isCar ? (
                <>
                  <th className="px-3 py-2 lf-label text-center whitespace-nowrap">MAX LAT G</th>
                  <th className="px-3 py-2 lf-label text-center whitespace-nowrap">MIN LAT G</th>
                  <th className="px-3 py-2 lf-label text-center whitespace-nowrap">PEAK BRAKE</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 lf-label text-center whitespace-nowrap">MAX LEAN</th>
                  <th className="px-3 py-2 lf-label text-center whitespace-nowrap">AVG LEAN</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {corners.map((seg, idx) => {
              const cornerNum = idx + 1;
              const entryKph = kph(seg.entrySpeedMs);
              const apexKph = kph(seg.minSpeedMs);
              const exitKph = kph(seg.exitSpeedMs);

              // Speed delta indicators
              const exitFasterThanEntry = seg.exitSpeedMs > seg.entrySpeedMs;
              const apexLoss = seg.entrySpeedMs - seg.minSpeedMs;

              return (
                <tr
                  key={idx}
                  className="border-b border-track-border/40 hover:bg-track-card/50 transition-colors"
                >
                  {/* Corner number + type badge */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-white/60 text-xs font-bold">C{cornerNum}</span>
                      <span className={`text-[8px] uppercase tracking-wider ${
                        seg.type === 'corner_entry' ? 'text-neon-blue' :
                        seg.type === 'apex' ? 'text-neon-red' : 'text-neon-green'
                      }`}>
                        {seg.type.replace('corner_', '')}
                      </span>
                    </div>
                  </td>

                  {/* Entry speed */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-mono text-sm text-neon-blue font-bold">{entryKph}</span>
                  </td>

                  {/* Apex speed */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-sm text-neon-red font-bold">{apexKph}</span>
                      <span className="text-[9px] text-white/30 font-mono">
                        -{msToKph(apexLoss).toFixed(0)}
                      </span>
                    </div>
                  </td>

                  {/* Exit speed */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`font-mono text-sm font-bold ${
                        exitFasterThanEntry ? 'text-neon-green' : 'text-neon-yellow'
                      }`}>{exitKph}</span>
                      <span className="text-[9px] text-white/30">
                        {exitFasterThanEntry ? '▲' : '▼'}
                      </span>
                    </div>
                  </td>

                  {isCar ? (
                    <>
                      {/* Max lateral G */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-mono text-sm font-bold ${
                          seg.maxLateralG > 1.2 ? 'text-neon-red' :
                          seg.maxLateralG > 0.8 ? 'text-neon-yellow' : 'text-white/70'
                        }`}>
                          +{seg.maxLateralG.toFixed(2)}g
                        </span>
                      </td>

                      {/* Min lateral G */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-mono text-sm font-bold ${
                          Math.abs(seg.minLateralG) > 1.2 ? 'text-neon-red' :
                          Math.abs(seg.minLateralG) > 0.8 ? 'text-neon-yellow' : 'text-white/70'
                        }`}>
                          {seg.minLateralG.toFixed(2)}g
                        </span>
                      </td>

                      {/* Peak braking G */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-mono text-sm font-bold ${
                          seg.peakBrakingG > 0.8 ? 'text-neon-red' :
                          seg.peakBrakingG > 0.5 ? 'text-neon-yellow' : 'text-white/70'
                        }`}>
                          {seg.peakBrakingG.toFixed(2)}g
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Max lean angle */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-mono text-sm font-bold ${
                          seg.maxSegLeanAngle > 45 ? 'text-neon-red' :
                          seg.maxSegLeanAngle > 30 ? 'text-neon-yellow' : 'text-white/70'
                        }`}>
                          {seg.maxSegLeanAngle.toFixed(1)}°
                        </span>
                      </td>

                      {/* Average lean angle magnitude */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-mono text-sm font-bold text-white/70">
                          {seg.avgLeanAngleMag.toFixed(1)}°
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="flex gap-3 px-1 pt-1">
        {isCar ? (
          <>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">MAX LAT G (SESSION)</div>
              <div className="font-mono text-sm font-bold text-neon-blue">
                {Math.max(...corners.map(c => c.maxLateralG)).toFixed(2)}g
              </div>
            </div>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">PEAK BRAKE (SESSION)</div>
              <div className="font-mono text-sm font-bold text-neon-red">
                {Math.max(...corners.map(c => c.peakBrakingG)).toFixed(2)}g
              </div>
            </div>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">AVG APEX</div>
              <div className="font-mono text-sm font-bold text-white/70">
                {msToKph(corners.reduce((s, c) => s + c.minSpeedMs, 0) / corners.length).toFixed(0)} km/h
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">MAX LEAN (SESSION)</div>
              <div className="font-mono text-sm font-bold text-neon-yellow">
                {Math.max(...corners.map(c => c.maxSegLeanAngle)).toFixed(1)}°
              </div>
            </div>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">AVG LEAN (SESSION)</div>
              <div className="font-mono text-sm font-bold text-white/70">
                {(corners.reduce((s, c) => s + c.avgLeanAngleMag, 0) / corners.length).toFixed(1)}°
              </div>
            </div>
            <div className="flex-1 lf-card p-2 text-center">
              <div className="lf-label text-[9px]">AVG APEX</div>
              <div className="font-mono text-sm font-bold text-white/70">
                {msToKph(corners.reduce((s, c) => s + c.minSpeedMs, 0) / corners.length).toFixed(0)} km/h
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
