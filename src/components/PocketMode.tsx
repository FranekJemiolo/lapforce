/**
 * PocketMode.tsx — Black screen overlay for in-pocket tracking
 *
 * When enabled:
 *   - Renders a completely black screen (display: none on all content)
 *   - Shows only a minimal "tap to show" hint that auto-fades
 *   - Relies on useAudioFeedback for lap time announcements
 *   - Screen wake lock must remain active (handled at parent level)
 */

import { useEffect, useState } from 'react';

interface PocketModeProps {
  isActive: boolean;
  onToggle: () => void;
  lastLapMs?: number;
  currentLapNumber?: number;
}

export function PocketMode({ isActive, onToggle, lastLapMs, currentLapNumber }: PocketModeProps) {
  const [showHint, setShowHint] = useState(false);

  // Show hint briefly when pocket mode activates
  useEffect(() => {
    if (isActive) {
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 2500);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  if (!isActive) {
    return (
      <button
        id="btn-pocket-mode"
        className="lf-btn-ghost flex items-center gap-2 text-sm"
        onClick={onToggle}
        aria-label="Enable pocket mode"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
        Pocket Mode
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={onToggle}
      role="button"
      aria-label="Tap to exit pocket mode"
    >
      {showHint && (
        <div className="text-center space-y-2 animate-fade-in">
          <div className="text-white/20 text-xs uppercase tracking-widest">Pocket Mode Active</div>
          <div className="text-white/10 text-xs">Tap to show dashboard</div>
          {lastLapMs && currentLapNumber && (
            <div className="text-white/10 text-xs mt-4">
              Lap {currentLapNumber - 1}: {(lastLapMs / 1000).toFixed(3)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
