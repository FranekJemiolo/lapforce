import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Silently auto-update — user is on a track, don't disrupt
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[LapForce] Ready to work offline');
  },
  onRegistered(registration: ServiceWorkerRegistration | undefined) {
    console.log('[LapForce] Service worker registered', registration);
  },
  onRegisterError(error: unknown) {
    console.error('[LapForce] Service worker registration failed', error);
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
