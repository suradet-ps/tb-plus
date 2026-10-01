import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActiveView from '@/views/ActiveView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function mountView() {
  return mount(ActiveView, {
    global: { stubs: { RouterLink: true } },
  });
}

describe('ActiveView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should show the loading state while the initial fetch is pending', async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('กำลังโหลดข้อมูล');
  });

  it('should show a retryable error state instead of the empty state', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('disk offline'));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('disk offline');
    expect(wrapper.text()).not.toContain('ยังไม่มีผู้ป่วยที่กำลังรับการรักษา');

    vi.mocked(invoke).mockResolvedValueOnce([]);
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('ยังไม่มีผู้ป่วยที่กำลังรับการรักษา');
  });
});
