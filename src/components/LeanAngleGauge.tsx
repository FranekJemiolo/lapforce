/**
 * LeanAngleGauge.tsx — Real-time lean angle gauge for bike mode
 *
 * Displays the current lean angle with:
 *   - Animated pendulum/needle
 *   - Left/Right lean labels
 *   - Angle in degrees (positive = right, negative = left)
 *   - Max lean angle markers from current session
 *
 * The gauge range is ±60° (typical sport bike maximum lean)
 */

import React from 'react';

interface LeanAngleGaugeProps {
  rollDeg: number;
  maxRightDeg: number;
  maxLeftDeg: number;
  size?: number;
}

const MAX_LEAN_DEG = 60;

function clampLean(deg: number): number {
  return Math.max(-MAX_LEAN_DEG, Math.min(MAX_LEAN_DEG, deg));
}

export const LeanAngleGauge = React.memo(function LeanAngleGauge({
  rollDeg,
  maxRightDeg,
  maxLeftDeg,
  size = 240,
}: LeanAngleGaugeProps) {
  const clamped = clampLean(rollDeg);
  const percentage = clamped / MAX_LEAN_DEG; // -1 to +1

  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size / 2) - 16;
  const innerR = outerR - 24;

  // Convert angle to arc parameters
  // 0° = top, positive = right, gauge spans 180° total (±90° from top)
  const startAngle = -180; // degrees from top
  const endAngle = 0;
  const needleAngle = percentage * 90; // -90° to +90°

  // Arc helpers
  function polarToXY(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number, r: number) {
    const start = polarToXY(startDeg, r);
    const end = polarToXY(endDeg, r);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  // Needle tip and base
  const needleTip = polarToXY(needleAngle, innerR - 10);
  const needleBase1 = polarToXY(needleAngle + 90, 8);
  const needleBase2 = polarToXY(needleAngle - 90, 8);

  // Max angle markers
  const maxRightAngle = clampLean(maxRightDeg) / MAX_LEAN_DEG * 90;
  const maxLeftAngle = clampLean(maxLeftDeg) / MAX_LEAN_DEG * 90;
  const maxRightPos = polarToXY(maxRightAngle, outerR - 4);
  const maxLeftPos = polarToXY(maxLeftAngle, outerR - 4);

  // Color based on lean angle severity
  const severity = Math.abs(clamped) / MAX_LEAN_DEG;
  const dotColor = severity > 0.8 ? '#FF3B3B' : severity > 0.5 ? '#FFD60A' : '#00FF87';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Lean angle: ${rollDeg.toFixed(1)} degrees`}
      >
        {/* Background arc track */}
        <path
          d={describeArc(startAngle, endAngle, outerR)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={24}
          strokeLinecap="round"
        />

        {/* Tick marks every 15° */}
        {[-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90].map(angle => {
          const inner = polarToXY(angle / MAX_LEAN_DEG * 90, outerR - 24);
          const outer = polarToXY(angle / MAX_LEAN_DEG * 90, outerR - 10);
          const isMajor = angle % 30 === 0;
          return (
            <line
              key={angle}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={isMajor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}

        {/* Degree labels */}
        {[-60, -30, 0, 30, 60].map(angle => {
          const pos = polarToXY(angle / MAX_LEAN_DEG * 90, outerR - 38);
          return (
            <text
              key={angle}
              x={pos.x} y={pos.y + 4}
              textAnchor="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.3)"
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.abs(angle)}°
            </text>
          );
        })}

        {/* Max lean markers */}
        <circle cx={maxRightPos.x} cy={maxRightPos.y} r={4} fill="rgba(255,214,10,0.8)" />
        <circle cx={maxLeftPos.x} cy={maxLeftPos.y} r={4} fill="rgba(255,214,10,0.8)" />

        {/* Active arc */}
        {Math.abs(clamped) > 1 && (
          <path
            d={describeArc(0, needleAngle / 90 * (needleAngle >= 0 ? 90 : -90) * 0, outerR - 12)}
            fill="none"
            stroke={dotColor}
            strokeWidth={3}
            strokeOpacity={0.4}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={dotColor}
          style={{ filter: `drop-shadow(0 0 6px ${dotColor})` }}
        />

        {/* Center pivot */}
        <circle cx={cx} cy={cy} r={10} fill="rgba(13, 17, 23, 0.9)" stroke={dotColor} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={4} fill={dotColor} />

        {/* Angle readout */}
        <text x={cx} y={cy + 38} textAnchor="middle" fontSize={22} fontWeight="bold"
          fontFamily="JetBrains Mono, monospace" fill={dotColor}>
          {rollDeg >= 0 ? '+' : ''}{rollDeg.toFixed(1)}°
        </text>

        {/* L/R labels */}
        <text x={16} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight="bold"
          fill="rgba(255,255,255,0.4)" fontFamily="JetBrains Mono, monospace">
          L
        </text>
        <text x={size - 16} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight="bold"
          fill="rgba(255,255,255,0.4)" fontFamily="JetBrains Mono, monospace">
          R
        </text>
      </svg>

      {/* Max lean readout */}
      <div className="flex gap-4 text-center">
        <div>
          <div className="lf-label">MAX L</div>
          <div className="font-mono text-neon-yellow text-sm font-bold">
            {maxLeftDeg.toFixed(1)}°
          </div>
        </div>
        <div className="w-px bg-track-border" />
        <div>
          <div className="lf-label">MAX R</div>
          <div className="font-mono text-neon-yellow text-sm font-bold">
            +{maxRightDeg.toFixed(1)}°
          </div>
        </div>
      </div>

      <span className="lf-label">LEAN ANGLE</span>
    </div>
  );
});
