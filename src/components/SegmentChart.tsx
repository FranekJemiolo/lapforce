/**
 * SegmentChart.tsx — Recharts-based segment speed chart
 *
 * Visualizes the corner phases with:
 *   - Line chart: Entry speed → Apex speed → Exit speed
 *   - X axis: Segment types (Entry, Apex, Exit)
 *   - Color coding by speed (faster = greener)
 */


import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import type { Segment } from '@/db/lapforce.db';
import { msToKph } from '@/hooks/useGPS';

interface SegmentChartProps {
  segments: Segment[];
  lapNumber: number;
}

interface ChartPoint {
  name: string;
  entry: number;
  min: number;
  exit: number;
  type: string;
}

const SEGMENT_COLORS = {
  entry: '#4DA6FF',
  min: '#FF3B3B',
  exit: '#00FF87',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="lf-card p-2 text-xs space-y-1 shadow-xl">
      <p className="lf-label">{label}</p>
      {payload.map((entry: { name: string; color: string; value: number }) => (
        <div key={entry.name} className="flex justify-between gap-3">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono font-bold text-white">{entry.value.toFixed(0)} km/h</span>
        </div>
      ))}
    </div>
  );
}

export function SegmentChart({ segments, lapNumber }: SegmentChartProps) {
  const corners = segments.filter(s => s.type !== 'straight');

  if (corners.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-white/30 text-sm">No corner segments recorded for Lap {lapNumber}</p>
      </div>
    );
  }

  const data: ChartPoint[] = corners.map((seg, i) => ({
    name: `C${i + 1} ${seg.type.replace('corner_', '').toUpperCase()}`,
    entry: msToKph(seg.entrySpeedMs),
    min: msToKph(seg.minSpeedMs),
    exit: msToKph(seg.exitSpeedMs),
    type: seg.type,
  }));

  const allSpeeds = data.flatMap(d => [d.entry, d.min, d.exit]).filter(Boolean);
  const minSpeed = Math.max(0, Math.min(...allSpeeds) - 20);
  const maxSpeed = Math.max(...allSpeeds) + 20;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="lf-label">LAP {lapNumber} — SEGMENT SPEEDS</p>
        <p className="text-xs text-white/30">{corners.length} corners</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={[minSpeed, maxSpeed]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            unit=" kph"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Line
            type="monotone" dataKey="entry" name="Entry"
            stroke={SEGMENT_COLORS.entry} strokeWidth={2}
            dot={{ fill: SEGMENT_COLORS.entry, r: 3 }} activeDot={{ r: 5 }}
          />
          <Line
            type="monotone" dataKey="min" name="Apex"
            stroke={SEGMENT_COLORS.min} strokeWidth={2}
            dot={{ fill: SEGMENT_COLORS.min, r: 3 }} activeDot={{ r: 5 }}
          />
          <Line
            type="monotone" dataKey="exit" name="Exit"
            stroke={SEGMENT_COLORS.exit} strokeWidth={2}
            dot={{ fill: SEGMENT_COLORS.exit, r: 3 }} activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
