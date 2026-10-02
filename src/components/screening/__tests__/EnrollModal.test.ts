import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientDrugRecord } from '@/__tests__/factories/patient';
import EnrollModal from '@/components/screening/EnrollModal.vue';
import { useSettingsStore } from '@/stores/settings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function mountModal() {
  return mount(EnrollModal, {
    props: {
      modelValue: true,
      patients: [createPatientDrugRecord()],
    },
    global: {
      stubs: { Teleport: true },
    },
  });
}

describe('EnrollModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it('should offer a select that closes on selection when staff names exist', async () => {
    useSettingsStore().staffNames = ['เภสัชกร', 'แพทย์'];
    const wrapper = mountModal();

    const select = wrapper.find('select#enrolledBy');
    expect(select.exists()).toBe(true);
    expect(wrapper.find('datalist').exists()).toBe(false);

    await select.setValue('เภสัชกร');

    expect((select.element as HTMLSelectElement).value).toBe('เภสัชกร');
  });

  it('should fall back to a free-text input when no staff names are configured', () => {
    const wrapper = mountModal();

    expect(wrapper.find('select#enrolledBy').exists()).toBe(false);
    expect(wrapper.find('input#enrolledBy').exists()).toBe(true);
  });

  it('should emit enrolled with the count and close on success', async () => {
    const wrapper = mountModal();

    await wrapper.find('input#treatmentStart').setValue('2026-09-01');
    await wrapper.find('.modal-footer .btn-primary').trigger('click');
    await flushPromises();

    expect(invoke).toHaveBeenCalledWith(
      'enroll_patient',
      expect.objectContaining({
        enrollment: expect.objectContaining({ treatment_start_date: '2026-09-01' }),
      }),
    );
    expect(wrapper.emitted('enrolled')).toEqual([[1]]);
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(wrapper.find('.success-alert').exists()).toBe(false);
  });

  it('should emit the number actually enrolled when the selection changes mid-flight', async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'enroll_patient') {
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mount(EnrollModal, {
      props: {
        modelValue: true,
        patients: [
          createPatientDrugRecord({ hn: 'HN00001' }),
          createPatientDrugRecord({ hn: 'HN00002' }),
        ],
      },
      global: {
        stubs: { Teleport: true },
      },
    });

    await wrapper.find('input#treatmentStart').setValue('2026-09-01');
    await wrapper.find('.modal-footer .btn-primary').trigger('click');

    // The parent clears the selection while the first enrollment is pending.
    await wrapper.setProps({ patients: [] });

    resolvers[0]?.(1);
    await flushPromises();
    resolvers[1]?.(1);
    await flushPromises();

    expect(wrapper.emitted('enrolled')).toEqual([[2]]);
  });
});
