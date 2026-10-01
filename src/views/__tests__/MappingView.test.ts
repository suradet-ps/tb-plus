import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MappingView from '@/views/MappingView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function mountView() {
  return mount(MappingView, {
    global: {
      stubs: {
        MapCanvas: true,
        MapFilters: true,
      },
    },
  });
}

describe('MappingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should show a retryable error state when the initial fetch fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('mapping offline'));

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('mapping offline');
    expect(wrapper.find('.content-grid').exists()).toBe(false);

    vi.mocked(invoke).mockResolvedValueOnce([]);
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('.content-grid').exists()).toBe(true);
  });
});
