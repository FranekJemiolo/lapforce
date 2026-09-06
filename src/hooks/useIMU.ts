/**
 * useIMU — Inertial Measurement Unit hook.
 *
 * Captures raw data from:
 *   - DeviceMotionEvent  → accelerometer (m/s²) + gyroscope (deg/s)
 *   - DeviceOrientationEvent → pitch, roll, heading (degrees)
 *
 * iOS 13+ requires explicit permission via DeviceMotionEvent.requestPermission().
 * This hook handles the permission request flow.
 *
 * Calibration:
 *   - Raw pitch/roll values are offset by the calibration zero-point
 *     (set when auto-calibration fires at >20mph, or manually via "Zero" button)
 *   - G-forces are computed as accel / 9.80665
 *
 * For performance, sensor state is updated via a ref + requestAnimationFrame
 * to avoid React re-renders at 60Hz.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const G = 9.80665; // m/s²

export interface IMUCalibration {
  pitchOffset: number;
  rollOffset: number;
  headingOffset: number;
}

export interface RawIMUData {
  // Accelerometer (m/s²)
  accelX: number; // lateral
  accelY: number; // longitudinal
  accelZ: number; // vertical

  // Gyroscope (deg/s)
  gyroAlpha: number; // yaw
  gyroBeta: number;  // pitch rate
  gyroGamma: number; // roll rate

  // Orientation (degrees, calibration-corrected)
  pitch: number;
  roll: number;
  heading: number;

  // G-forces
  lateralG: number;
  longitudinalG: number;
  verticalG: number;
}

export type IMUPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export interface UseIMUReturn {
  data: RawIMUData | null;
  permissionState: IMUPermissionState;
  requestPermission: () => Promise<void>;
  setCalibration: (cal: IMUCalibration) => void;
  calibration: IMUCalibration;
}

const NULL_CALIBRATION: IMUCalibration = {
  pitchOffset: 0,
  rollOffset: 0,
  headingOffset: 0,
};

export function useIMU(): UseIMUReturn {
  const [permissionState, setPermissionState] = useState<IMUPermissionState>('unknown');
  const [data, setData] = useState<RawIMUData | null>(null);
  const [calibration, setCalibrationState] = useState<IMUCalibration>(NULL_CALIBRATION);

  // Use refs to avoid stale closures in event listeners
  const calibrationRef = useRef<IMUCalibration>(NULL_CALIBRATION);
  const rafRef = useRef<number | null>(null);
  const pendingDataRef = useRef<RawIMUData | null>(null);

  // Track raw orientation separately so it's accessible in both listeners
  const orientationRef = useRef({ pitch: 0, roll: 0, heading: 0 });
  const motionRef = useRef({
    accelX: 0, accelY: 0, accelZ: 0,
    gyroAlpha: 0, gyroBeta: 0, gyroGamma: 0,
  });

  const setCalibration = useCallback((cal: IMUCalibration) => {
    calibrationRef.current = cal;
    setCalibrationState(cal);
  }, []);

  /** Schedule a React state update via rAF to decouple sensor rate from render rate */
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingDataRef.current) {
        setData({ ...pendingDataRef.current });
      }
    });
  }, []);

  const handleDeviceMotion = useCallback(
    (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const accelX = accel.x ?? 0;
      const accelY = accel.y ?? 0;
      const accelZ = accel.z ?? 0;

      const rotation = event.rotationRate;
      const gyroAlpha = rotation?.alpha ?? 0;
      const gyroBeta = rotation?.beta ?? 0;
      const gyroGamma = rotation?.gamma ?? 0;

      motionRef.current = { accelX, accelY, accelZ, gyroAlpha, gyroBeta, gyroGamma };

      const cal = calibrationRef.current;
      const pitch = orientationRef.current.pitch - cal.pitchOffset;
      const roll = orientationRef.current.roll - cal.rollOffset;
      const heading = (orientationRef.current.heading - cal.headingOffset + 360) % 360;

      pendingDataRef.current = {
        accelX,
        accelY,
        accelZ,
        gyroAlpha,
        gyroBeta,
        gyroGamma,
        pitch,
        roll,
        heading,
        lateralG: accelX / G,
        longitudinalG: accelY / G,
        verticalG: accelZ / G,
      };

      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  const handleDeviceOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      orientationRef.current = {
        pitch: event.beta ?? 0,
        roll: event.gamma ?? 0,
        heading: event.alpha ?? 0,
      };
    },
    []
  );

  const startListening = useCallback(() => {
    window.addEventListener('devicemotion', handleDeviceMotion);
    window.addEventListener('deviceorientation', handleDeviceOrientation);
  }, [handleDeviceMotion, handleDeviceOrientation]);

  const requestPermission = useCallback(async () => {
    // Check if DeviceMotionEvent is even available
    if (typeof DeviceMotionEvent === 'undefined') {
      setPermissionState('unsupported');
      return;
    }

    // iOS 13+ requires explicit permission request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission === 'function') {
      try {
        const result: string = await DME.requestPermission();
        if (result === 'granted') {
          setPermissionState('granted');
          startListening();
        } else {
          setPermissionState('denied');
        }
      } catch (err) {
        console.error('[IMU] Permission request failed:', err);
        setPermissionState('denied');
      }
    } else {
      // Android / desktop — no permission needed
      setPermissionState('granted');
      startListening();
    }
  }, [startListening]);

  // Auto-request permission on non-iOS (permission not required)
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') {
      setPermissionState('unsupported');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission !== 'function') {
      // Non-iOS — auto-start
      setPermissionState('granted');
      startListening();
    }
  }, [startListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleDeviceMotion, handleDeviceOrientation]);

  return { data, permissionState, requestPermission, setCalibration, calibration };
}

/**
 * Normalize raw accelerometer to G-force vector.
 * @param accelMs2 - raw accelerometer value in m/s²
 * @returns G-force value
 */
export function accelToG(accelMs2: number): number {
  return accelMs2 / G;
}

/**
 * Clamp a G-force value to the friction circle range.
 * Typical track car limit is ~1.5g, but we allow up to 2g for extreme cases.
 */
export function clampG(g: number, maxG = 2): number {
  return Math.max(-maxG, Math.min(maxG, g));
}
