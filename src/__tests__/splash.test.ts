import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachSplashStatusListener } from '@/splash';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';

type SplashStatusHandler = (event: { payload: string }) => void;

function addSplashLabel(): HTMLElement {
  const label = document.createElement('p');
  label.id = 'splash-loading-label';
  label.textContent = 'กำลังโหลด...';
  document.body.appendChild(label);
  return label;
}

describe('attachSplashStatusListener', () => {
  afterEach(() => {
    document.getElementById('splash-loading-label')?.remove();
  });

  it('should update the splash label from the event payload', async () => {
    let handler: SplashStatusHandler | undefined;
    vi.mocked(listen).mockImplementation((_event, listener) => {
      handler = listener as unknown as SplashStatusHandler;
      return Promise.resolve(() => {});
    });
    const label = addSplashLabel();

    await attachSplashStatusListener();
    handler?.({ payload: 'กำลังโหลดการตั้งค่า...' });

    expect(label.textContent).toBe('กำลังโหลดการตั้งค่า...');
  });

  it('should resolve with a no-op unlisten when the listener cannot attach', async () => {
    vi.mocked(listen).mockRejectedValue(new Error('outside tauri'));

    const unlisten = await attachSplashStatusListener();

    expect(unlisten).toEqual(expect.any(Function));
  });
});
