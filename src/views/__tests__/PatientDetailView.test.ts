import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientDetail, createTbPatient } from '@/__tests__/factories/patient';
import PatientDetailView from '@/views/PatientDetailView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('PatientDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  function mountView(hn: string) {
    return mount(PatientDetailView, {
      props: { hn },
      shallow: true,
      global: {
        stubs: { Teleport: true },
      },
    });
  }

  it('should not render the previous patient when the new HN fails to load', async () => {
    const detailA = createPatientDetail({
      patient: createTbPatient({ hn: 'HN00001' }),
    });
    vi.mocked(invoke).mockResolvedValueOnce(detailA);

    const wrapper = mountView('HN00001');
    await flushPromises();
    expect(wrapper.find('.patient-name').text()).toContain('นาย ทดสอบ ใจดี');

    vi.mocked(invoke).mockRejectedValueOnce(new Error('offline'));
    await wrapper.setProps({ hn: 'HN00002' });
    await flushPromises();

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('นาย ทดสอบ ใจดี');
  });

  it('should show the loading state while a new HN loads', async () => {
    const detailA = createPatientDetail({
      patient: createTbPatient({ hn: 'HN00001' }),
    });
    vi.mocked(invoke).mockResolvedValueOnce(detailA);

    const wrapper = mountView('HN00001');
    await flushPromises();

    let resolveB: ((value: ReturnType<typeof createPatientDetail>) => void) | undefined;
    const pendingB = new Promise<ReturnType<typeof createPatientDetail>>((resolve) => {
      resolveB = resolve;
    });
    vi.mocked(invoke).mockReturnValueOnce(pendingB);

    await wrapper.setProps({ hn: 'HN00002' });
    expect(wrapper.find('.loading-state').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('นาย ทดสอบ ใจดี');

    resolveB?.(
      createPatientDetail({
        patient: createTbPatient({ hn: 'HN00002' }),
        demographics: null,
      }),
    );
    await flushPromises();
    expect(wrapper.find('.patient-name').text()).toBe('HN00002');
  });
});
