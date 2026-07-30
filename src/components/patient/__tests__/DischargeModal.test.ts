import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DischargeModal from '../DischargeModal.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('DischargeModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  function mountModal(props: { modelValue?: boolean; hn?: string; patientName?: string } = {}) {
    return mount(DischargeModal, {
      props: {
        modelValue: true,
        hn: 'HN00001',
        patientName: 'นาย ทดสอบ ใจดี',
        ...props,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });
  }

  it('should render the modal when modelValue is true', () => {
    const wrapper = mountModal();
    expect(wrapper.find('.modal-panel').exists()).toBe(true);
  });

  it('should not render the modal when modelValue is false', () => {
    const wrapper = mountModal({ modelValue: false });
    expect(wrapper.find('.modal-panel').exists()).toBe(false);
  });

  it('should display patient name and HN in header', () => {
    const wrapper = mountModal({ hn: 'HN99999', patientName: 'นาง สมหญิง' });

    expect(wrapper.find('.patient-name-highlight').text()).toBe('นาง สมหญิง');
    expect(wrapper.find('.header-hn').text()).toContain('HN99999');
  });

  it('should show the modal title', () => {
    const wrapper = mountModal();
    expect(wrapper.find('#discharge-modal-title').text()).toBe('จำหน่ายผู้ป่วย');
  });

  it('should have all 7 outcome options', () => {
    const wrapper = mountModal();
    const options = wrapper.findAll('#dc-outcome option');

    expect(options.length).toBe(8);
    expect(options[0].text()).toContain('เลือกผลการรักษา');
  });

  it('should show warning notice', () => {
    const wrapper = mountModal();
    expect(wrapper.find('.warning-notice').exists()).toBe(true);
    expect(wrapper.find('.warning-notice').text()).toContain('เปลี่ยนสถานะผู้ป่วย');
  });

  it('should default outcome_date and treatment_end to today', () => {
    const wrapper = mountModal();
    const today = new Date().toISOString().slice(0, 10);

    const dateInput = wrapper.find('#dc-date');
    expect((dateInput.element as HTMLInputElement).value).toBe(today);

    const endInput = wrapper.find('#dc-end');
    expect((endInput.element as HTMLInputElement).value).toBe(today);
  });

  it('should show error when submitting without outcome', async () => {
    const wrapper = mountModal();
    await wrapper.find('#discharge-form').trigger('submit');

    expect(wrapper.find('.form-error').exists()).toBe(true);
    expect(wrapper.find('.form-error').text()).toContain('กรุณาเลือกผลการรักษา');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should show error when outcome_date is in the future', async () => {
    const wrapper = mountModal();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureStr = futureDate.toISOString().slice(0, 10);

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#dc-date').setValue(futureStr);
    await wrapper.find('#discharge-form').trigger('submit');

    expect(wrapper.find('.form-error').text()).toContain('วันที่จำหน่ายต้องไม่เป็นวันในอนาคต');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should show error when treatment_end is in the future', async () => {
    const wrapper = mountModal();
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureStr = futureDate.toISOString().slice(0, 10);

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#dc-date').setValue(today);
    await wrapper.find('#dc-end').setValue(futureStr);
    await wrapper.find('#discharge-form').trigger('submit');

    expect(wrapper.find('.form-error').text()).toContain('วันที่สิ้นสุดการรักษาต้องไม่เป็นวันในอนาคต');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should accept today as a valid outcome_date', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const wrapper = mountModal();
    const today = new Date().toISOString().slice(0, 10);

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#dc-date').setValue(today);
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    expect(invoke).toHaveBeenCalled();
  });

  it('should call invoke with correct payload on valid submit', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const wrapper = mountModal({ hn: 'HN00005' });

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#dc-date').setValue('2025-07-15');
    await wrapper.find('#dc-by').setValue('หมอทดสอบ');
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    expect(invoke).toHaveBeenCalledWith('discharge_patient', {
      outcome: expect.objectContaining({
        hn: 'HN00005',
        outcome: 'cured',
        outcome_date: '2025-07-15',
        created_by: 'หมอทดสอบ',
      }),
    });
  });

  it('should emit "discharged" event on successful submit', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const wrapper = mountModal();

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('discharged')).toHaveLength(1);
  });

  it('should emit update:modelValue(false) after successful submit', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const wrapper = mountModal();

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    const modelUpdate = wrapper.emitted('update:modelValue');
    expect(modelUpdate).toBeTruthy();
    expect(modelUpdate?.[0]).toEqual([false]);
  });

  it('should show error message on invoke failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Duplicate outcome'));
    const wrapper = mountModal();

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.form-error').exists()).toBe(true);
    expect(wrapper.find('.form-error').text()).toContain('Duplicate outcome');
  });

  it('should disable submit button while submitting', async () => {
    let resolveInvoke: ((v: unknown) => void) | undefined;
    vi.mocked(invoke).mockReturnValue(
      new Promise((r) => {
        resolveInvoke = r;
      }),
    );
    const wrapper = mountModal();

    await wrapper.find('#dc-outcome').setValue('cured');
    await wrapper.find('#discharge-form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.btn-discharge').attributes('disabled')).toBeDefined();

    resolveInvoke?.(undefined);
    await flushPromises();
  });

  it('should close modal on Escape key', async () => {
    const wrapper = mountModal();

    await wrapper.find('.modal-overlay').trigger('keydown', { key: 'Escape' });

    const modelUpdate = wrapper.emitted('update:modelValue');
    expect(modelUpdate?.[0]).toEqual([false]);
  });

  it('should emit updated outcome in payload', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const wrapper = mountModal();

    await wrapper.find('#dc-outcome').setValue('treatment_failed');
    await wrapper.find('#dc-notes').setValue('อาการไม่ดีขึ้น');
    await wrapper.find('#discharge-form').trigger('submit');
    await flushPromises();

    const call = vi.mocked(invoke).mock.calls[0];
    const input = (call[1] as { outcome: Record<string, unknown> }).outcome;
    expect(input.outcome).toBe('treatment_failed');
    expect(input.notes).toBe('อาการไม่ดีขึ้น');
  });
});
