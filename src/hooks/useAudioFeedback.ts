/**
 * useAudioFeedback — Web Speech API wrapper for spoken lap time readouts.
 *
 * Used in Pocket Mode to announce lap times without the driver looking at the screen.
 * Handles iOS permission model (speech synthesis is gated behind a user gesture).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAudioFeedbackReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  /** Speak any text string */
  speak: (text: string) => void;
  /** Speak a lap time (e.g. formatLapTime(ms) → "1 minute 23.456 seconds") */
  announceLapTime: (lapMs: number, lapNumber: number) => void;
  /** Announce a delta vs best (e.g. "+0.234 seconds") */
  announceDelta: (deltaMs: number) => void;
  cancel: () => void;
}

/** Format milliseconds as a human-readable spoken string */
export function formatLapTimeSpoken(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secondsStr = seconds.toFixed(3);

  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${secondsStr} seconds`;
  }
  return `${secondsStr} seconds`;
}

export function useAudioFeedback(): UseAudioFeedbackReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Warm up speech synthesis on iOS — first utterance must happen in user gesture context
  useEffect(() => {
    if (!isSupported) return;
    // iOS requires a silent "warmup" utterance to unlock speech synthesis
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = 'en-US';

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const announceLapTime = useCallback(
    (lapMs: number, lapNumber: number) => {
      const timeStr = formatLapTimeSpoken(lapMs);
      speak(`Lap ${lapNumber}. ${timeStr}`);
    },
    [speak]
  );

  const announceDelta = useCallback(
    (deltaMs: number) => {
      const sign = deltaMs >= 0 ? 'plus' : 'minus';
      const abs = Math.abs(deltaMs);
      const seconds = (abs / 1000).toFixed(3);
      speak(`${sign} ${seconds}`);
    },
    [speak]
  );

  const cancel = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { isSupported, isSpeaking, speak, announceLapTime, announceDelta, cancel };
}
