import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivePatientRow, createTbPatient } from '@/__tests__/factories/patient';
import ReportsView from '@/views/ReportsView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function mockCommands(overrides: Record<string, () => Promise<unknown>>): void {
  vi.mocked(invoke).mockImplementation((cmd: string) => {
    const handler = overrides[cmd];
    return handler ? handler() : Promise.resolve([]);
  });
}

describe('ReportsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should render the discharged error with its own retry', async () => {
    mockCommands({
      get_discharged_patients: () => Promise.reject(new Error('discharged offline')),
    });

    const wrapper = mount(ReportsView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('discharged offline');
    expect(wrapper.find('.report-grid').exists()).toBe(false);

    mockCommands({
      get_discharged_patients: () =>
        Promise.resolve([
          createActivePatientRow({
            tb_patient: createTbPatient({ hn: 'HN00001', status: 'completed' }),
            outcome_value: 'cured',
          }),
        ]),
    });
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('.report-grid').exists()).toBe(true);
  });
});
