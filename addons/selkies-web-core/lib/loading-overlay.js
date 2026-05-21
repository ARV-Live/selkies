/*
 * Branded loading overlay for the goIRL streaming client.
 *
 * Renders the goIRL Lottie animation centered on the canvas/video element
 * while selkies-core is connecting. We piggy-back on the existing
 * `#status-display` element: the overlay mirrors its `hidden` class via a
 * MutationObserver so callers can keep the existing show/hide pattern
 * (`statusDisplayElement.classList.add('hidden')`) without changes.
 */

import lottie from 'lottie-web/build/player/lottie_light';
import animationData from './logo-loader.json';

const STYLE_ID = 'goirl-loading-overlay-style';

function ensureStylesInjected() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
        .goirl-loading-overlay {
            position: fixed;
            inset: 0;
            z-index: 1005;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            background: radial-gradient(ellipse at center, #15171c 0%, #0a0b0e 100%);
            color: #f5f6f8;
            font-family: 'Inter', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.45s ease;
        }
        .goirl-loading-overlay.hidden {
            opacity: 0;
            pointer-events: none;
        }
        .goirl-loading-overlay .goirl-loading-lottie {
            width: min(420px, 60vw);
            height: auto;
            position: relative;
            animation: goirl-breathe 2.6s ease-in-out infinite;
        }
        /* The supplied Lottie file is a static svg2lottie conversion; we
           layer a soft cyan halo and a gentle scale-breathe so the loader
           feels alive while we wait. */
        .goirl-loading-overlay .goirl-loading-lottie::before {
            content: '';
            position: absolute;
            inset: -20% -10%;
            background: radial-gradient(ellipse at center,
                rgba(17, 173, 201, 0.35) 0%,
                rgba(17, 173, 201, 0.18) 40%,
                rgba(17, 173, 201, 0) 70%);
            filter: blur(24px);
            z-index: -1;
            animation: goirl-glow 3.4s ease-in-out infinite;
        }
        .goirl-loading-overlay .goirl-loading-lottie svg {
            display: block;
            width: 100%;
            height: auto;
            filter: drop-shadow(0 6px 18px rgba(17, 173, 201, 0.4));
        }
        @keyframes goirl-breathe {
            0%, 100% {
                transform: scale(1);
                opacity: 0.92;
            }
            50% {
                transform: scale(1.04);
                opacity: 1;
            }
        }
        @keyframes goirl-glow {
            0%, 100% { opacity: 0.55; transform: scale(0.95); }
            50%      { opacity: 1;    transform: scale(1.1); }
        }
        .goirl-loading-overlay .goirl-loading-status {
            font-size: 13px;
            font-weight: 500;
            color: rgba(245, 246, 248, 0.7);
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .goirl-loading-overlay .goirl-loading-status::after {
            content: '';
            display: inline-block;
            width: 1.2em;
            text-align: left;
            animation: goirl-dots 1.4s steps(4, jump-none) infinite;
        }
        @keyframes goirl-dots {
            0%   { content: ''; }
            25%  { content: '.'; }
            50%  { content: '..'; }
            75%  { content: '...'; }
        }
        /* While the overlay is visible, hide the original bottom status bar —
           we render our own brand-styled status text inside the overlay. */
        .video-container:has(.goirl-loading-overlay:not(.hidden)) #status-display {
            display: none !important;
        }
    `;
    document.head.appendChild(s);
}

/**
 * Attach the branded Lottie loading overlay to a video container.
 *
 * @param {HTMLElement} videoContainer - container to render into
 * @param {HTMLElement} statusDisplayElement - the existing #status-display node;
 *        its `.hidden` class toggles also toggle this overlay
 * @returns {{ destroy: () => void }}
 */
export function attachLoadingOverlay(videoContainer, statusDisplayElement) {
    if (!videoContainer || !statusDisplayElement) {
        return { destroy() {} };
    }
    ensureStylesInjected();

    const overlay = document.createElement('div');
    overlay.className = 'goirl-loading-overlay';

    const lottieHost = document.createElement('div');
    lottieHost.className = 'goirl-loading-lottie';
    overlay.appendChild(lottieHost);

    const statusText = document.createElement('div');
    statusText.className = 'goirl-loading-status';
    statusText.textContent = statusDisplayElement.textContent || 'Connecting';
    overlay.appendChild(statusText);

    // Reflect existing status visibility immediately.
    if (statusDisplayElement.classList.contains('hidden')) {
        overlay.classList.add('hidden');
    }

    videoContainer.appendChild(overlay);

    const animation = lottie.loadAnimation({
        container: lottieHost,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData,
    });

    const syncFromStatus = () => {
        // The status text we mirror is short; strip trailing ellipses since we
        // add our own animated dots.
        const raw = (statusDisplayElement.textContent || 'Connecting').trim();
        statusText.textContent = raw.replace(/[.…]+$/u, '');
        if (statusDisplayElement.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        } else {
            overlay.classList.remove('hidden');
        }
    };

    const observer = new MutationObserver(syncFromStatus);
    observer.observe(statusDisplayElement, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        characterData: true,
        subtree: true,
    });

    return {
        destroy() {
            observer.disconnect();
            try { animation.destroy(); } catch { /* ignore */ }
            overlay.remove();
        },
    };
}
