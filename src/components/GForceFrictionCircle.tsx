/**
 * GForceFrictionCircle.tsx — Real-time G-force friction circle
 *
 * Renders an SVG/Canvas friction circle showing:
 *   - Outer ring: maximum grip boundary (1.5g by default)
 *   - Inner ring: 1g reference
 *   - Moving dot: current lateral (X) and longitudinal (Y) G-force
 *   - Trail: last N positions fading out
 *
 * The coordinate system:
 *   - Right = positive lateral G (right cornering)
 *   - Up = positive longitudinal G (acceleration)
 *   - Left = negative lateral G (left cornering)
 *   - Down = negative longitudinal G (braking)
 */

import React, { useEffect, useRef } from 'react';
import { clampG } from '@/hooks/useIMU';

interface GForceFrictionCircleProps {
  lateralG: number;
  longitudinalG: number;
  maxG?: number;
  size?: number;
}

const TRAIL_LENGTH = 30;
const G_SCALE = 1.5; // g value at circle edge

function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  lineWidth = 1,
  dash: number[] = []
) {
  ctx.beginPath();
  ctx.setLineDash(dash);
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.setLineDash([]);
}

export const GForceFrictionCircle = React.memo(function GForceFrictionCircle({
  lateralG,
  longitudinalG,
  maxG = G_SCALE,
  size = 240,
}: GForceFrictionCircleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const rafRef = useRef<number | null>(null);

  // Clamp inputs
  const clampedLateral = clampG(lateralG, maxG);
  const clampedLongitudinal = clampG(longitudinalG, maxG);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPI scaling for retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = (size / 2) - 8;
    const oneGR = outerR / maxG;

    // Update trail
    const dotX = clampedLateral / maxG * outerR;
    const dotY = -clampedLongitudinal / maxG * outerR;
    trailRef.current = [...trailRef.current, { x: dotX, y: dotY }].slice(-TRAIL_LENGTH);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      ctx.clearRect(0, 0, size, size);

      // Background
      ctx.fillStyle = 'rgba(13, 17, 23, 0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring (max G boundary)
      drawCircle(ctx, cx, cy, outerR, 'rgba(255, 255, 255, 0.15)', 2);

      // 1g reference ring
      drawCircle(ctx, cx, cy, oneGR, 'rgba(255, 255, 255, 0.08)', 1, [4, 4]);

      // Crosshairs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      ctx.lineTo(cx, cy + outerR);
      ctx.moveTo(cx - outerR, cy);
      ctx.lineTo(cx + outerR, cy);
      ctx.stroke();

      // G-force labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${maxG}g`, cx, cy - outerR - 4);
      ctx.fillText(`${maxG}g`, cx, cy + outerR + 12);
      ctx.textAlign = 'left';
      ctx.fillText(`${maxG}g`, cx + outerR + 4, cy + 4);
      ctx.textAlign = 'right';
      ctx.fillText(`${maxG}g`, cx - outerR - 4, cy + 4);
      ctx.textAlign = 'center';

      // Trail
      const trail = trailRef.current;
      for (let i = 0; i < trail.length - 1; i++) {
        const alpha = (i / trail.length) * 0.6;
        const { x, y } = trail[i];
        ctx.beginPath();
        ctx.arc(cx + x, cy + y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 135, ${alpha})`;
        ctx.fill();
      }

      // Current dot
      const currentX = cx + clampedLateral / maxG * outerR;
      const currentY = cy - clampedLongitudinal / maxG * outerR;

      // Outer glow
      const gradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 12);
      gradient.addColorStop(0, 'rgba(0, 255, 135, 0.6)');
      gradient.addColorStop(1, 'rgba(0, 255, 135, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = '#00FF87';
      ctx.beginPath();
      ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
      ctx.fill();

      // G-force readouts
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`LAT: ${lateralG >= 0 ? '+' : ''}${lateralG.toFixed(2)}g`, cx, size - 22);
      ctx.fillText(`LON: ${longitudinalG >= 0 ? '+' : ''}${longitudinalG.toFixed(2)}g`, cx, size - 8);
    });
  }, [lateralG, longitudinalG, clampedLateral, clampedLongitudinal, maxG, size]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        className="rounded-full"
        style={{ width: size, height: size }}
        aria-label={`G-Force Friction Circle: Lateral ${lateralG.toFixed(2)}g, Longitudinal ${longitudinalG.toFixed(2)}g`}
      />
      <span className="lf-label">G-FORCE CIRCLE</span>
    </div>
  );
});
