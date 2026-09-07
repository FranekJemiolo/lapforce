/**
 * GpsPathCanvas.tsx — 2D SVG trace of a driven GPS path
 *
 * Renders a lightweight SVG path from an array of {lat, lng} coordinates.
 * Used in SessionReview to show the best lap line.
 *
 * Projection: equirectangular (linear lat/lng → pixels), sufficient for
 * the 2-4km scale of a typical circuit.
 *
 * Features:
 *   - Auto-scales to fit the bounding box of the GPS trace
 *   - Colour-maps speed: slow=red → fast=green
 *   - Start/finish gate marker (🏁 dot)
 *   - Loading state while fetching ticks from Dexie
 */

interface GpsPoint {
  lat: number;
  lng: number;
  speedMs?: number;
}

interface GpsPathCanvasProps {
  points: GpsPoint[];
  gateLat?: number;
  gateLng?: number;
  isLoading?: boolean;
  width?: number;
  height?: number;
}

const PADDING = 24;
const MIN_SPEED_MS = 10;  // red
const MAX_SPEED_MS = 60;  // green

function speedToColor(speedMs: number | undefined): string {
  if (speedMs === undefined) return 'rgba(0,255,135,0.6)';
  const t = Math.max(0, Math.min(1, (speedMs - MIN_SPEED_MS) / (MAX_SPEED_MS - MIN_SPEED_MS)));
  // red → yellow → green
  const r = Math.round(255 * (1 - t));
  const g = Math.round(255 * t);
  return `rgb(${r},${g},0)`;
}

function projectPoints(
  points: GpsPoint[],
  width: number,
  height: number
): Array<{ x: number; y: number; speedMs?: number }> {
  if (points.length === 0) return [];

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;

  // Scale preserving aspect ratio
  const drawW = width - PADDING * 2;
  const drawH = height - PADDING * 2;
  const scale = Math.min(drawW / lngSpan, drawH / latSpan);

  const projW = lngSpan * scale;
  const projH = latSpan * scale;
  const offsetX = PADDING + (drawW - projW) / 2;
  const offsetY = PADDING + (drawH - projH) / 2;

  return points.map(p => ({
    x: offsetX + (p.lng - minLng) * scale,
    // lat increases upward in geo coords, downward in SVG → flip
    y: offsetY + (maxLat - p.lat) * scale,
    speedMs: p.speedMs,
  }));
}

export function GpsPathCanvas({
  points,
  gateLat,
  gateLng,
  isLoading = false,
  width = 320,
  height = 240,
}: GpsPathCanvasProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-track-surface border border-track-border"
        style={{ width, height }}
      >
        <span className="text-white/30 text-sm animate-pulse">Loading GPS trace...</span>
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-track-surface border border-track-border"
        style={{ width, height }}
      >
        <span className="text-3xl opacity-30">🗺️</span>
        <span className="text-white/30 text-xs text-center px-4">
          Not enough GPS points to draw path
          {points.length > 0 ? ` (${points.length} points)` : ''}
        </span>
      </div>
    );
  }

  const projected = projectPoints(points, width, height);

  // Build coloured polyline segments
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 0; i < projected.length - 1; i++) {
    segments.push({
      x1: projected[i].x,
      y1: projected[i].y,
      x2: projected[i + 1].x,
      y2: projected[i + 1].y,
      color: speedToColor(projected[i].speedMs),
    });
  }

  // Project gate position
  let gateProj: { x: number; y: number } | null = null;
  if (gateLat !== undefined && gateLng !== undefined) {
    const gatePoints = [...points, { lat: gateLat, lng: gateLng }];
    const allProjected = projectPoints(gatePoints, width, height);
    gateProj = allProjected[allProjected.length - 1];
  }

  const start = projected[0];
  const end = projected[projected.length - 1];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="rounded-xl bg-track-surface border border-track-border"
        aria-label="GPS lap trace"
      >
        {/* Background */}
        <rect width={width} height={height} fill="#0D1117" rx={12} />

        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" rx={12} />

        {/* Path segments, coloured by speed */}
        {segments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1} y1={seg.y1}
            x2={seg.x2} y2={seg.y2}
            stroke={seg.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {/* Glow pass on top */}
        {segments.map((seg, i) => (
          <line
            key={`glow-${i}`}
            x1={seg.x1} y1={seg.y1}
            x2={seg.x2} y2={seg.y2}
            stroke={seg.color}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.12}
          />
        ))}

        {/* Start dot */}
        <circle cx={start.x} cy={start.y} r={6} fill="#00FF87" opacity={0.9}
          style={{ filter: 'drop-shadow(0 0 4px #00FF87)' }}
        />
        <text x={start.x + 9} y={start.y + 4} fontSize={9} fill="rgba(0,255,135,0.8)"
          fontFamily="JetBrains Mono, monospace">
          S
        </text>

        {/* End dot */}
        <circle cx={end.x} cy={end.y} r={5} fill="#FF3B3B" opacity={0.85} />

        {/* Gate marker */}
        {gateProj && (
          <>
            <circle cx={gateProj.x} cy={gateProj.y} r={8} fill="none"
              stroke="#FFD60A" strokeWidth={2} strokeDasharray="3 2" opacity={0.8} />
            <circle cx={gateProj.x} cy={gateProj.y} r={3} fill="#FFD60A" opacity={0.9} />
          </>
        )}

        {/* Speed legend */}
        <defs>
          <linearGradient id="speedGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgb(255,0,0)" />
            <stop offset="50%" stopColor="rgb(255,255,0)" />
            <stop offset="100%" stopColor="rgb(0,255,0)" />
          </linearGradient>
        </defs>
        <rect x={PADDING} y={height - 18} width={60} height={4} fill="url(#speedGrad)" rx={2} opacity={0.6} />
        <text x={PADDING} y={height - 22} fontSize={7} fill="rgba(255,255,255,0.3)"
          fontFamily="JetBrains Mono, monospace">SLOW</text>
        <text x={PADDING + 42} y={height - 22} fontSize={7} fill="rgba(255,255,255,0.3)"
          fontFamily="JetBrains Mono, monospace">FAST</text>
      </svg>
      <div className="flex gap-4 text-[10px] text-white/30 font-mono">
        <span><span className="text-neon-green">●</span> Start</span>
        <span><span className="text-neon-red">●</span> End</span>
        {gateProj && <span><span className="text-neon-yellow">◎</span> Gate</span>}
        <span>{points.length} GPS pts</span>
      </div>
    </div>
  );
}
