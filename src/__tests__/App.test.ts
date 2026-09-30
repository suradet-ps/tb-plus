import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

function mockWindow(show: ReturnType<typeof vi.fn>): void {
  vi.mocked(getCurrentWindow).mockReturnValue({
    show,
  } as unknown as ReturnType<typeof getCurrentWindow>);
}

function mountApp() {
  return mount(App, {
    global: {
      stubs: { AppSidebar: true, RouterView: true },
    },
  });
}

describe('App startup', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(invoke).mockRejectedValue(new Error('ipc unavailable'));
  });

  afterEach(() => {
    document.getElementById('splash-overlay')?.remove();
  });

  it('shows a startup error and still dismisses the splash when the window fails to show', async () => {
    const overlay = document.createElement('div');
    overlay.id = 'splash-overlay';
    document.body.appendChild(overlay);
    mockWindow(vi.fn().mockRejectedValue(new Error('window unavailable')));

    const wrapper = mountApp();
    await flushPromises();

    expect(wrapper.find('.startup-banner').exists()).toBe(true);
    expect(wrapper.find('.startup-banner').text()).toContain('window unavailable');

    await vi.waitFor(
      () => {
        expect(document.getElementById('splash-overlay')).toBeNull();
      },
      { timeout: 2000 },
    );
    wrapper.unmount();
  });

  it('retries startup and clears the error banner on success', async () => {
    const show = vi
      .fn()
      .mockRejectedValueOnce(new Error('window unavailable'))
      .mockResolvedValue(undefined);
    mockWindow(show);

    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('.startup-banner').exists()).toBe(true);

    await wrapper.find('.startup-retry').trigger('click');
    await flushPromises();

    expect(wrapper.find('.startup-banner').exists()).toBe(false);
    expect(show).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
