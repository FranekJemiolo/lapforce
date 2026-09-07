# LapForce — Track Telemetry PWA

[![CI/CD](https://github.com/FranekJemiolo/lapforce/actions/workflows/deploy.yml/badge.svg)](https://github.com/FranekJemiolo/lapforce/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet)](https://FranekJemiolo.github.io/lapforce/)

> High-performance track day telemetry that runs natively on iOS & Android without app store installation.

**[🏁 Launch App →](https://FranekJemiolo.github.io/lapforce/)**

---

## Screenshots

<table>
  <tr>
    <td align="center"><b>Home Screen</b></td>
    <td align="center"><b>Session Setup</b></td>
    <td align="center"><b>Mounting Warning</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/01_home_screen.jpg" width="220" alt="Home screen — install prompt, feature badges, and storage info"/></td>
    <td><img src="docs/screenshots/02_setup_screen.jpg" width="220" alt="Session setup — vehicle mode, GPS gate, live IMU readout"/></td>
    <td><img src="docs/screenshots/03_mounting_modal.jpg" width="220" alt="Mounting warning modal — rigidly mounted vs pocket mode"/></td>
  </tr>
  <tr>
    <td align="center"><b>Glanceable Mode</b></td>
    <td align="center"><b>Detailed Mode</b></td>
    <td align="center"><b>Session Review + GPS Map</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/04_live_glanceable.jpg" width="220" alt="Live dashboard glanceable — giant predictive delta + G-force circle"/></td>
    <td><img src="docs/screenshots/05_live_detailed.jpg" width="220" alt="Live dashboard detailed — speed, lap time, max G, GPS accuracy, mini table"/></td>
    <td><img src="docs/screenshots/06_session_review_map.jpg" width="220" alt="Session review with GPS path trace coloured by speed"/></td>
  </tr>
  <tr>
    <td colspan="3" align="center"><b>Corner Metrics Table (Car mode)</b></td>
  </tr>
  <tr>
    <td colspan="3" align="center"><img src="docs/screenshots/07_corner_metrics.jpg" width="320" alt="Corner metrics — entry/apex/exit speeds, max lat G, min lat G, peak brake G per corner"/></td>
  </tr>
</table>

---

## Features

| Feature | Description |
|---|---|
| 🛰️ **GPS Lap Timing** | Virtual 20m gate with heading validation (±30°) |
| 📐 **G-Force Circle** | Real-time friction circle from accelerometer |
| 🏍️ **Lean Angle** | Live lean angle gauge from gyroscope (bike mode) |
| ⚡ **Predictive Delta** | Green/red real-time delta vs. best lap |
| 🎙️ **Audio Feedback** | Lap time spoken aloud via Web Speech API |
| 📵 **Pocket Mode** | Black screen + voice readouts while tracking |
| 📦 **Fully Offline** | Works without internet on-track via Service Worker |
| 🔋 **Wake Lock** | Keeps screen on during sessions |
| 💾 **Local Storage** | All data stored in IndexedDB via Dexie.js |
| 📊 **Post-Session Charts** | Segment-level speed traces with Recharts |

---

## Architecture

```
lapforce/
├── src/
│   ├── __tests__/        # Vitest unit tests
│   ├── components/        # Reusable UI components
│   │   ├── GForceFrictionCircle.tsx
│   │   ├── LeanAngleGauge.tsx
│   │   ├── LapTable.tsx
│   │   ├── PocketMode.tsx
│   │   ├── PredictiveDelta.tsx
│   │   └── SegmentChart.tsx
│   ├── db/
│   │   └── lapforce.db.ts # Dexie IndexedDB schema
│   ├── engine/            # Core telemetry logic (no React)
│   │   ├── calibration.ts # Auto-calibration at >20mph
│   │   ├── lapGate.ts     # Haversine + heading check
│   │   └── segmentation.ts# Corner vs. straight detection
│   ├── hooks/             # Sensor abstraction hooks
│   │   ├── useAudioFeedback.ts
│   │   ├── useGPS.ts
│   │   ├── useIMU.ts
│   │   └── useWakeLock.ts
│   ├── pages/             # Top-level views
│   │   ├── LiveDashboard.tsx
│   │   ├── SessionReview.tsx
│   │   └── SetupScreen.tsx
│   ├── store/
│   │   └── telemetryStore.ts  # Zustand global state
│   ├── App.tsx            # State-machine view router
│   ├── index.css          # Tailwind + design system
│   └── main.tsx           # Entry + PWA SW registration
├── public/
│   └── icons/             # PWA icons (192, 512, maskable)
├── .github/workflows/
│   └── deploy.yml         # CI/CD: lint → test → build → gh-pages
└── vite.config.ts         # Vite + PWA plugin config
```

### Tech Stack

| Layer | Technology |
|---|---|
| Core | React 18, TypeScript, Vite |
| PWA | vite-plugin-pwa (Workbox) |
| Styling | Tailwind CSS v3 (dark-only) |
| State | Zustand |
| Database | Dexie.js (IndexedDB) |
| Sensors | Geolocation API, DeviceMotion, DeviceOrientation |
| Screen | Wake Lock API |
| Audio | Web Speech API |
| Charts | Recharts |
| Testing | Vitest + React Testing Library |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Core Logic

### 1. Auto-Calibration
The app does **not** assume phone mounting orientation. It:
1. Waits until GPS speed exceeds **20 mph**
2. Records average DeviceOrientation values over **2 seconds**
3. Uses this as the zero-point for pitch, roll, and yaw
4. A manual **"Zero"** button on the Setup screen allows re-calibration

### 2. Lap Detection (Virtual Gate)
- User drops a starting GPS pin on the Setup screen
- A **20-meter radius** is created around that pin
- A lap completes when:
  - GPS coordinate is **inside the 20m radius**, AND
  - Vehicle compass heading matches start heading **±30 degrees**
- Uses the **Haversine formula** for accurate great-circle distances

### 3. Auto-Segmentation
- **Corner** = rapid heading change + lateral G-force > 0.3g
- **Straight** = sustained heading + sustained longitudinal G-force
- Each segment records: entry speed, apex speed, exit speed

### 4. Pocket Mode
- Blacks out the screen entirely (preserves battery)
- Background GPS + IMU tracking continues
- Web Speech API reads lap times aloud at each gate crossing

---

## Setup & Development

### Prerequisites
- Node.js 20+
- npm 9+

### Local Development
```bash
git clone https://github.com/FranekJemiolo/lapforce.git
cd lapforce
npm install
npm run dev
```

Open `http://localhost:5173/lapforce/` in Chrome with DevTools → Sensors for GPS simulation.

### Testing
```bash
npm run test          # Run all tests once
npm run test:watch    # Watch mode
npm run test:ui       # Visual Vitest UI
npm run coverage      # Coverage report
```

### Building
```bash
npm run build         # Production build (output: /dist)
npm run preview       # Preview production build
```

### Linting & Formatting
```bash
npm run lint          # oxlint
npm run format        # Prettier
```

---

## CI/CD

Every push to `main` triggers:
1. `npm run lint` — oxlint static analysis
2. `npm run test` — Vitest unit tests
3. `npm run build` — Vite production build
4. Deploy `/dist` → `gh-pages` branch → GitHub Pages

**Live URL**: https://FranekJemiolo.github.io/lapforce/

---

## Mobile Installation

### iOS (Safari)
1. Open https://FranekJemiolo.github.io/lapforce/ in Safari
2. Tap **Share** → **Add to Home Screen**
3. App launches in standalone mode (no browser UI)

### Android (Chrome)
1. Open in Chrome
2. Tap the **Install** banner, or menu → **Add to Home Screen**

---

## Sensor Permissions (iOS 13+)
On iOS 13+, `DeviceMotionEvent` and `DeviceOrientationEvent` require a user gesture. LapForce handles this by prompting the user to tap **"Enable Sensors"** on the Setup screen, which calls `DeviceMotionEvent.requestPermission()`.

---

## License
MIT © Franek Jemiolo
