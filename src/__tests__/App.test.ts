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

const DEFAULT_INVOKE_RESULTS: Record<string, unknown> = {
  load_drug_classes: [],
  get_regimen_definitions: [],
  load_dosage_rules: [],
  load_hosxp_config: {},
  load_alert_config: {},
  load_db_config: null,
  get_mysql_status: true,
  get_patient_alerts: [],
  get_appointments: [],
};

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

function addSplashOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'splash-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

describe('App startup', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation((cmd: string) =>
      Promise.resolve(DEFAULT_INVOKE_RESULTS[cmd] ?? null),
    );
    mockWindow(vi.fn().mockResolvedValue(undefined));
  });

  afterEach(() => {
    document.getElementById('splash-overlay')?.remove();
  });

  it('dismisses the splash and shows a retryable error when settings fail to load', async () => {
    addSplashOverlay();
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'load_drug_classes') {
        return Promise.reject(new Error('settings unavailable'));
      }
      return Promise.resolve(DEFAULT_INVOKE_RESULTS[cmd] ?? null);
    });

    const wrapper = mountApp();
    await flushPromises();

    expect(wrapper.find('.startup-banner').exists()).toBe(true);
    expect(wrapper.find('.startup-banner').text()).toContain('โหลดการตั้งค่าไม่สำเร็จ');
    expect(invoke).toHaveBeenCalledWith('get_mysql_status');

    await vi.waitFor(
      () => {
        expect(document.getElementById('splash-overlay')).toBeNull();
      },
      { timeout: 2000 },
    );
    wrapper.unmount();
  });

  it('shows a retryable error when the connection check itself fails', async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_mysql_status') {
        return Promise.reject(new Error('ipc unavailable'));
      }
      return Promise.resolve(DEFAULT_INVOKE_RESULTS[cmd] ?? null);
    });

    const wrapper = mountApp();
    await flushPromises();

    expect(wrapper.find('.startup-banner').exists()).toBe(true);
    expect(wrapper.find('.startup-banner').text()).toContain('ตรวจสอบการเชื่อมต่อระบบไม่สำเร็จ');
    wrapper.unmount();
  });

  it('retries startup and clears the error banner once loading succeeds', async () => {
    let settingsAvailable = false;
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'load_drug_classes' && !settingsAvailable) {
        return Promise.reject(new Error('settings unavailable'));
      }
      return Promise.resolve(DEFAULT_INVOKE_RESULTS[cmd] ?? null);
    });

    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('.startup-banner').exists()).toBe(true);

    settingsAvailable = true;
    await wrapper.find('.startup-retry').trigger('click');
    await flushPromises();

    expect(wrapper.find('.startup-banner').exists()).toBe(false);
    wrapper.unmount();
  });

  it('still dismisses the splash and reports unexpected startup errors', async () => {
    addSplashOverlay();
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
});
