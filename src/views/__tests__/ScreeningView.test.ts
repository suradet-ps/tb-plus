import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnrollModal from '@/components/screening/EnrollModal.vue';
import ScreeningView from '@/views/ScreeningView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function mountView() {
  return mount(ScreeningView, {
    global: {
      stubs: { PatientTable: true },
    },
  });
}

describe('ScreeningView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it('should show a page-level success banner after enrollment', async () => {
    const wrapper = mountView();
    await flushPromises();

    wrapper.findComponent(EnrollModal).vm.$emit('enrolled', 3);
    await flushPromises();

    expect(wrapper.find('.success-banner').text()).toContain('ลงทะเบียนสำเร็จ 3 ราย');

    await wrapper.find('.success-banner__close').trigger('click');
    expect(wrapper.find('.success-banner').exists()).toBe(false);
  });
});
