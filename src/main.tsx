import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker Registration
const ENABLE_SW_POLLING = import.meta.env.VITE_ENABLE_SW_POLLING === "true";

async function registerServiceWorker(): Promise<void> {
  // In dev/test the file `/sw.js` may not be served with a valid JS MIME type.
  // Register only for production builds.
  if (!import.meta.env.PROD) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('[App] Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[App] Service Worker registered:', registration.scope);

    // Listen for SW messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      const message = event.data;
      
      if (message.type === 'SW_STATUS') {
        console.log('[App] SW Status:', message.status);
        
        if (message.status === 'authRequired') {
          // Auth is intentionally disabled by default. Only surface auth-required status
          // if auth is explicitly enabled; otherwise treat as a standard error state.
          if (import.meta.env.VITE_ENABLE_AUTH === 'true') {
            // BACKEND_TODO: Handle auth required - show login prompt
            console.warn('[App] SW requires authentication');
          } else {
            console.warn('[App] SW reported authRequired, but auth is disabled');
          }
        }
      }
      
      if (message.type === 'NAVIGATE') {
        // Navigate to URL from notification click
        window.location.href = message.url;
      }
    });

    // BACKEND_TODO: enable polling only when backend is wired.
    if (ENABLE_SW_POLLING) {
      // Send tick to SW every 30 seconds while app is open
      setInterval(() => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SW_TICK' });
        }
      }, 30000);

      // Send initial tick
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SW_TICK' });
      }
    } else {
      console.log('[App] SW polling disabled (VITE_ENABLE_SW_POLLING!=true)');
    }

  } catch (error) {
    console.error('[App] Service Worker registration failed:', error);
  }
}

// Register SW after page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
