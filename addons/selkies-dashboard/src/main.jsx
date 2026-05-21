// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PlayerGamepadButton from './components/PlayerGamepadButton.jsx';
import './index.css';
import { getRoutePrefix } from './utils.js';

// Stream-mode probe.
//
// History: we used to AWAIT a /status fetch with a 2-second timeout before
// initializing selkies-core. On a cold-cache visit that added up to 2 s of
// avoidable latency before the WebSocket handshake even started.
//
// New behaviour:
//   1. Read the last session's mode from localStorage (if any) and use it
//      synchronously — no network round-trip, no blocking.
//   2. Kick off the /status probe in parallel with a short 600 ms timeout.
//      If the server reports a different mode, store it for the *next* page
//      load. We deliberately do not reload mid-connection: an opportunistic
//      probe that occasionally lags shouldn't cost the current visitor a
//      restart.
const STREAM_MODE_KEY_RE = /[^a-zA-Z0-9.-_]/g;
function getStreamModeStorageKey() {
  const urlForKey = window.location.href.split('#')[0];
  return `${urlForKey.replace(STREAM_MODE_KEY_RE, '_')}_stream_mode`;
}

function primeStreamModeFromCache() {
  try {
    const cached = localStorage.getItem(getStreamModeStorageKey());
    if (cached) {
      window.__SELKIES_STREAMING_MODE__ = cached;
    }
  } catch { /* localStorage unavailable */ }
}

function probeStreamModeNonBlocking() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600);
  fetch(`${getRoutePrefix()}/status`, {
    credentials: 'same-origin',
    signal: controller.signal,
  })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      if (data && data.current_mode) {
        try {
          localStorage.setItem(getStreamModeStorageKey(), data.current_mode);
        } catch { /* ignore */ }
      }
    })
    .catch(() => { /* network/abort: no harm done, last-session value still active */ })
    .finally(() => clearTimeout(timer));
}

const currentHash = window.location.hash;
const noDashboardModes = ['#shared', '#player2', '#player3', '#player4'];
const playerClientModes = ['#player2', '#player3', '#player4'];

(async () => {
  primeStreamModeFromCache();
  probeStreamModeNonBlocking();
  // Prevent selkies-core from auto-initializing
  window.__SELKIES_DEFER_INITIALIZATION = true;
  await import('./selkies-core.js');
  // Initialize with the cached mode (or selkies-core's own default if none)
  window.selkiesCoreInitialize();
  if (!noDashboardModes.includes(currentHash)) {
    const dashboardRootElement = document.createElement('div');
    dashboardRootElement.id = 'dashboard-root';
    document.body.appendChild(dashboardRootElement);
    const appMountPoint = document.getElementById('root');
    if (appMountPoint) {
      ReactDOM.createRoot(appMountPoint).render(
        <React.StrictMode>
          <App dashboardRoot={dashboardRootElement} />
        </React.StrictMode>,
      );
    } else {
      console.error("CRITICAL: Dashboard mount point #root not found. Primary dashboard will not render.");
    }
  } else {
    console.log(`Dashboard UI rendering skipped for mode: ${currentHash}`);
    if (playerClientModes.includes(currentHash)) {
      console.log(`Player client mode detected. Initializing gamepad button UI for ${currentHash}.`);
      const playerUIRootElement = document.createElement('div');
      playerUIRootElement.id = 'player-ui-root';
      document.body.appendChild(playerUIRootElement);
      ReactDOM.createRoot(playerUIRootElement).render(
        <React.StrictMode>
          <PlayerGamepadButton />
        </React.StrictMode>,
      );
    }
  }
})();
