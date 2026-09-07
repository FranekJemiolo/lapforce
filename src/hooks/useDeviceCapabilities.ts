/**
 * useDeviceCapabilities.ts — Device and environment detection hook
 *
 * Detects:
 *   - Platform: iOS / Android / Desktop / Unknown
 *   - Is running as installed PWA (standalone display mode)
 *   - Sensor availability: GPS, DeviceMotion, DeviceOrientation
 *   - Storage persistence: requests navigator.storage.persist()
 *   - Storage estimate: quota and usage
 *
 * Used to inform the user of what features are available in their context
 * and prompt them to install the PWA for full functionality.
 */

import { useState, useEffect } from 'react';

export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface DeviceCapabilities {
  platform: Platform;
  /** True when launched from home screen / installed PWA */
  isStandalone: boolean;
  /** True when running on a touch-capable mobile device */
  isMobile: boolean;
  /** GPS API is available */
  hasGPS: boolean;
  /** DeviceMotion API is present (actual permission is requested later) */
  hasMotionSensor: boolean;
  /** DeviceOrientation API is present */
  hasOrientationSensor: boolean;
  /** Whether storage is marked as persistent (won't be evicted) */
  storagePersisted: boolean;
  /** Storage quota in MB (-1 if unknown) */
  storageQuotaMB: number;
  /** Storage used in MB (-1 if unknown) */
  storageUsedMB: number;
  /** True when the browser supports the Wake Lock API */
  hasWakeLock: boolean;
  /** True when running over HTTPS (required for GPS + sensors on mobile) */
  isSecureContext: boolean;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mobi|Mobile/.test(ua)) return 'android'; // generic mobile
  return 'desktop';
}

function detectStandalone(): boolean {
  // iOS: window.navigator.standalone
  // Android/Chrome: display-mode: standalone media query
  return (
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

async function requestStoragePersistence(): Promise<boolean> {
  if (!('storage' in navigator && 'persist' in navigator.storage)) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

async function getStorageEstimate(): Promise<{ quotaMB: number; usedMB: number }> {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) {
    return { quotaMB: -1, usedMB: -1 };
  }
  try {
    const estimate = await navigator.storage.estimate();
    return {
      quotaMB: estimate.quota ? Math.round(estimate.quota / 1024 / 1024) : -1,
      usedMB: estimate.usage ? Math.round(estimate.usage / 1024 / 1024 * 10) / 10 : -1,
    };
  } catch {
    return { quotaMB: -1, usedMB: -1 };
  }
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({
    platform: 'unknown',
    isStandalone: false,
    isMobile: false,
    hasGPS: false,
    hasMotionSensor: false,
    hasOrientationSensor: false,
    storagePersisted: false,
    storageQuotaMB: -1,
    storageUsedMB: -1,
    hasWakeLock: false,
    isSecureContext: false,
  });

  useEffect(() => {
    async function detect() {
      const platform = detectPlatform();
      const isStandalone = detectStandalone();
      const isMobile = platform === 'ios' || platform === 'android';

      const [storagePersisted, storageEst] = await Promise.all([
        requestStoragePersistence(),
        getStorageEstimate(),
      ]);

      setCaps({
        platform,
        isStandalone,
        isMobile,
        hasGPS: 'geolocation' in navigator,
        hasMotionSensor: 'DeviceMotionEvent' in window,
        hasOrientationSensor: 'DeviceOrientationEvent' in window,
        storagePersisted,
        storageQuotaMB: storageEst.quotaMB,
        storageUsedMB: storageEst.usedMB,
        hasWakeLock: 'wakeLock' in navigator,
        isSecureContext: window.isSecureContext,
      });
    }
    detect();
  }, []);

  return caps;
}
