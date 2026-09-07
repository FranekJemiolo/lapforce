/**
 * DeviceStatusBanner.tsx — Environment awareness banner
 *
 * Shown on the Home screen to inform users about:
 *   - Desktop context: GPS and sensors unavailable — demo/review mode only
 *   - Mobile browser (not installed): prompt to "Add to Home Screen" for full PWA features
 *   - Installed PWA on mobile: show green confirmation of full capability
 *   - Missing HTTPS: sensors won't work
 *
 * Each state has a distinct visual style and actionable message.
 */

import type { DeviceCapabilities } from '@/hooks/useDeviceCapabilities';

interface DeviceStatusBannerProps {
  caps: DeviceCapabilities;
}

type BannerState =
  | 'desktop-demo'        // running on laptop/desktop
  | 'mobile-browser'      // mobile Safari/Chrome, not installed
  | 'mobile-installed'    // installed PWA on mobile — full features
  | 'insecure'            // HTTP — sensors blocked
  | 'ready';              // good enough (sensors present, even if not installed)

function getBannerState(caps: DeviceCapabilities): BannerState {
  if (!caps.isSecureContext) return 'insecure';
  if (!caps.isMobile) return 'desktop-demo';
  if (caps.isMobile && caps.isStandalone) return 'mobile-installed';
  if (caps.isMobile && !caps.isStandalone) return 'mobile-browser';
  return 'ready';
}

const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
  unknown: 'Browser',
};

export function DeviceStatusBanner({ caps }: DeviceStatusBannerProps) {
  const state = getBannerState(caps);

  if (state === 'mobile-installed') {
    return (
      <div className="mx-5 rounded-xl border border-neon-green/30 bg-neon-green/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon-green">Full telemetry ready</p>
            <p className="text-xs text-white/50 mt-0.5">
              Running as installed PWA on {PLATFORM_LABELS[caps.platform]} —
              GPS, sensors, and storage are all active.
              {caps.storagePersisted
                ? ' Storage is pinned (won\'t be evicted).'
                : ' Storage may be evicted under memory pressure.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'mobile-browser') {
    const isIOS = caps.platform === 'ios';
    return (
      <div className="mx-5 rounded-xl border border-neon-yellow/30 bg-neon-yellow/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon-yellow">Install for best experience</p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              GPS and sensors work in the browser, but session data may be deleted
              when your browser clears storage.
            </p>
            <p className="text-xs text-neon-yellow/70 mt-1.5 font-medium">
              {isIOS
                ? 'Tap Share → "Add to Home Screen" for persistent storage + fullscreen.'
                : 'Tap the browser menu → "Add to Home Screen" or "Install app".'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'desktop-demo') {
    return (
      <div className="mx-5 rounded-xl border border-neon-blue/30 bg-neon-blue/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">🖥️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon-blue">Desktop — Demo &amp; Review mode</p>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              GPS and motion sensors require a mobile device.
              You can browse past sessions and review analytics here,
              but live telemetry needs a phone or tablet on track.
            </p>
            <div className="flex gap-3 mt-2">
              <CapBadge label="GPS" available={caps.hasGPS} />
              <CapBadge label="Motion" available={caps.hasMotionSensor} />
              <CapBadge label="Wake Lock" available={caps.hasWakeLock} />
              <CapBadge label="Storage" available={caps.storageQuotaMB > 0} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'insecure') {
    return (
      <div className="mx-5 rounded-xl border border-neon-red/30 bg-neon-red/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">🔒</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neon-red">HTTPS required</p>
            <p className="text-xs text-white/50 mt-0.5">
              GPS and motion sensors are blocked on non-secure origins.
              Open the app via HTTPS (GitHub Pages URL or installed PWA).
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 'ready' — mobile with sensors but not installed — show minimal status
  return (
    <div className="mx-5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-base">📡</span>
        <p className="text-xs text-white/50">
          {PLATFORM_LABELS[caps.platform]} · GPS &amp; sensors available ·{' '}
          {caps.storagePersisted ? 'Storage pinned' : 'Install app to pin storage'}
        </p>
      </div>
    </div>
  );
}

function CapBadge({ label, available }: { label: string; available: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
      available ? 'text-neon-green/80' : 'text-neon-red/60'
    }`}>
      <span>{available ? '✓' : '✗'}</span>
      <span>{label}</span>
    </span>
  );
}
