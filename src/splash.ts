import { listen } from '@tauri-apps/api/event';

const SPLASH_LABEL_ID = 'splash-loading-label';

/**
 * Bridge the `splash-status` events emitted during Rust setup into the
 * splash label rendered by index.html before Vue mounts.
 *
 * Returns an unlisten function, or a no-op when the listener cannot be
 * registered (for example when running outside Tauri).
 */
export async function attachSplashStatusListener(): Promise<() => void> {
  try {
    return await listen<string>('splash-status', (event) => {
      const label = document.getElementById(SPLASH_LABEL_ID);
      if (label && event.payload) {
        label.textContent = event.payload;
      }
    });
  } catch {
    return () => {};
  }
}
