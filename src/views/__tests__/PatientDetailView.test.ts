import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPatientDetail,
  createTbPatient,
  createTreatmentPlan,
} from '@/__tests__/factories/patient';
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

  it('should render the phase badge background from a token, not concatenation', async () => {
    const detail = createPatientDetail({
      patient: createTbPatient({ hn: 'HN00001' }),
      current_plan: createTreatmentPlan({
        phase_start: '2026-09-01',
        phase_end_expected: '2026-11-01',
      }),
    });
    vi.mocked(invoke).mockResolvedValueOnce(detail);

    const wrapper = mountView('HN00001');
    await flushPromises();

    const badge = wrapper.find('.phase-badge');
    expect(badge.exists()).toBe(true);
    const style = badge.attributes('style') ?? '';
    expect(style).toContain('var(--phase-intensive-bg)');
    expect(style).toContain('var(--phase-intensive-text)');
  });

  it('should render continuation phase badge tokens', async () => {
    const detail = createPatientDetail({
      patient: createTbPatient({ hn: 'HN00001' }),
      current_plan: createTreatmentPlan({ phase: 'continuation' }),
    });
    vi.mocked(invoke).mockResolvedValueOnce(detail);

    const wrapper = mountView('HN00001');
    await flushPromises();

    const badge = wrapper.find('.phase-badge');
    expect(badge.exists()).toBe(true);
    const style = badge.attributes('style') ?? '';
    expect(style).toContain('var(--phase-continuation-bg)');
    expect(style).toContain('var(--phase-continuation-text)');
  });
});
