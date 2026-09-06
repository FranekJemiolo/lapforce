/**
 * useWakeLock — Keeps the screen on during active tracking sessions.
 *
 * Uses the Screen Wake Lock API. Automatically re-acquires the lock
 * when the page becomes visible again (e.g., after a notification pull-down).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type WakeLockState = 'active' | 'released' | 'unsupported';

export interface UseWakeLockReturn {
  wakeLockState: WakeLockState;
  requestWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockState, setWakeLockState] = useState<WakeLockState>(
    'wakeLock' in navigator ? 'released' : 'unsupported'
  );

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setWakeLockState('unsupported');
      return;
    }
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setWakeLockState('active');

      sentinelRef.current.addEventListener('release', () => {
        setWakeLockState('released');
      });
    } catch (err) {
      console.warn('[WakeLock] Failed to acquire:', err);
      setWakeLockState('released');
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (sentinelRef.current) {
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setWakeLockState('released');
    }
  }, []);

  // Re-acquire when page becomes visible (e.g., after notification pull-down)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockState === 'released') {
        // Only auto-reacquire if we previously had it active
        if (sentinelRef.current === null) {
          requestWakeLock().catch(console.warn);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLockState, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(console.warn);
      }
    };
  }, []);

  return { wakeLockState, requestWakeLock, releaseWakeLock };
}
