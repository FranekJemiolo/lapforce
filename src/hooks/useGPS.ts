/**
 * useGPS — High-accuracy GPS tracking hook.
 *
 * Uses navigator.geolocation.watchPosition with enableHighAccuracy: true.
 * Computes speed from successive coordinates if the native speed field
 * is unavailable (some Android devices omit it).
 *
 * Speed is always returned in m/s.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineDistance } from '@/engine/lapGate';

export interface GPSPosition {
  lat: number;
  lng: number;
  /** Speed in m/s */
  speedMs: number;
  /** Accuracy in meters */
  accuracyM: number;
  /** Compass heading in degrees (0-360), null if unavailable */
  heading: number | null;
  /** Raw timestamp from Geolocation API (Unix ms) */
  timestampMs: number;
}

export type GPSState = 'idle' | 'requesting' | 'active' | 'error';

export interface UseGPSReturn {
  position: GPSPosition | null;
  gpsState: GPSState;
  error: GeolocationPositionError | null;
  startTracking: () => void;
  stopTracking: () => void;
}

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

export function useGPS(): UseGPSReturn {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const prevPositionRef = useRef<GPSPosition | null>(null);
  const prevTimestampRef = useRef<number | null>(null);

  const computeSpeed = useCallback(
    (current: GeolocationPosition): number => {
      // Use native speed if available and valid
      if (current.coords.speed !== null && current.coords.speed >= 0) {
        return current.coords.speed;
      }

      // Fall back to computing from successive positions
      const prev = prevPositionRef.current;
      const prevTs = prevTimestampRef.current;
      if (!prev || !prevTs) return 0;

      const distanceM = haversineDistance(
        { lat: prev.lat, lng: prev.lng },
        { lat: current.coords.latitude, lng: current.coords.longitude }
      );
      const dtSeconds = (current.timestamp - prevTs) / 1000;
      if (dtSeconds <= 0) return prev.speedMs;

      return distanceM / dtSeconds;
    },
    []
  );

  const handleSuccess = useCallback(
    (geo: GeolocationPosition) => {
      const speedMs = computeSpeed(geo);
      const heading =
        geo.coords.heading !== null && !isNaN(geo.coords.heading)
          ? geo.coords.heading
          : null;

      const pos: GPSPosition = {
        lat: geo.coords.latitude,
        lng: geo.coords.longitude,
        speedMs,
        accuracyM: geo.coords.accuracy,
        heading,
        timestampMs: geo.timestamp,
      };

      prevPositionRef.current = pos;
      prevTimestampRef.current = geo.timestamp;

      setPosition(pos);
      setGpsState('active');
      setError(null);
    },
    [computeSpeed]
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.error('[GPS] Error:', err.message);
    setError(err);
    setGpsState('error');
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('[GPS] Geolocation API not available');
      setGpsState('error');
      return;
    }
    setGpsState('requesting');
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      GPS_OPTIONS
    );
  }, [handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, gpsState, error, startTracking, stopTracking };
}

/** Convert m/s to mph */
export const msToMph = (ms: number): number => ms * 2.23694;

/** Convert m/s to km/h */
export const msToKph = (ms: number): number => ms * 3.6;
