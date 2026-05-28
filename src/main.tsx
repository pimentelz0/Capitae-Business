import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handling for debugging
window.onerror = (message, source, lineno, colno, error) => {
  const data = { message, source, lineno, colno, stack: error?.stack };
  console.error('Global Error:', data);
  if (typeof (window as any).logToServer === 'function') {
    (window as any).logToServer('ERROR', 'Main Global Error', data);
  }
};

window.onunhandledrejection = (event) => {
  try {
    event.preventDefault();
  } catch (err) {}
  
  const reason = event?.reason;
  const reasonStr = reason?.message || (typeof reason === 'string' ? reason : String(reason || ''));
  
  console.warn('Unhandled Promise Rejection (suppressed):', reasonStr, reason);
  
  if (typeof (window as any).logToServer === 'function') {
    (window as any).logToServer('WARN', 'Main Unhandled Promise Rejection Suppressed', { reason: reasonStr });
  }
};

if (typeof (window as any).logToServer === 'function') {
  (window as any).logToServer('INFO', 'Milestone 2: main.tsx Loaded');
}

console.log('main.tsx: Starting render...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('main.tsx: Root element not found!');
  if (typeof (window as any).logToServer === 'function') {
    (window as any).logToServer('ERROR', 'main.tsx: Root element not found!');
  }
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Critical Error: Root element not found!</div>';
} else {
  try {
    console.log('main.tsx: Initializing React root...');
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('main.tsx: Render called successfully.');
    if (typeof (window as any).logToServer === 'function') {
      (window as any).logToServer('INFO', 'Milestone 3: React Render Called');
    }
    
    // Hide fallback after a short delay to ensure React has taken over
    setTimeout(() => {
      const fallback = document.getElementById('loading-fallback');
      if (fallback) {
        fallback.style.display = 'none';
        if (typeof (window as any).logToServer === 'function') {
          (window as any).logToServer('INFO', 'Milestone 4: Fallback Hidden');
        }
      }
    }, 500);

    // Perform a one-time clean-up of old PWA cache to recover from the previous buggy SW version
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheClearedKey = 'pwa_cache_cleared_v2';
        let isCleared = false;
        try {
          isCleared = localStorage.getItem(cacheClearedKey) === 'true';
        } catch (e) {
          console.warn('main.tsx: Access to localStorage is restricted:', e);
        }

        if (!isCleared) {
          caches.keys().then((names) => {
            return Promise.all(names.map(name => caches.delete(name)));
          }).then(() => {
            try {
              localStorage.setItem(cacheClearedKey, 'true');
            } catch (e) {
              console.warn('main.tsx: Could not save cleard cache flag to localStorage:', e);
            }
            console.log('main.tsx: Old caches programmatically cleared.');
            // Force reload once to get fresh assets from network
            window.location.reload();
          }).catch(err => {
            console.error('main.tsx: Error clearing old caches:', err);
          });
        }
      }
    } catch (err) {
      console.warn('main.tsx: Cache storage API or localStorage is not available:', err);
    }

    // Register PWA Service Worker
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
              console.log('main.tsx: Service Worker registered successfully, scope:', reg.scope);
              // Force checking for updates immediately to fetch the new pass-through SW
              try {
                reg.update();
              } catch (e) {}
            })
            .catch((err) => {
              console.error('main.tsx: Service Worker registration failed:', err);
            });
        });
      }
    } catch (err) {
      console.warn('main.tsx: Service Worker registration is blocked in this context:', err);
    }
  } catch (err) {
    console.error('main.tsx: Render failed:', err);
    if (typeof (window as any).logToServer === 'function') {
      (window as any).logToServer('ERROR', 'main.tsx: Render failed', { error: String(err) });
    }
    rootElement.innerHTML = `<div style="color: red; padding: 20px; background: white;">Render Error: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
}
