import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivePatientRow, createTbPatient } from '@/__tests__/factories/patient';
import type { ActivePatientRow, TbPatient } from '@/types/patient';
import DischargedView from '@/views/DischargedView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function outcomeRow(
  hn: string,
  outcomeValue: string | null,
  status: TbPatient['status'] = 'completed',
): ActivePatientRow {
  return createActivePatientRow({
    tb_patient: createTbPatient({ hn, status }),
    outcome_value: outcomeValue,
  });
}

const OUTCOME_BG_CASES: Array<[string, ActivePatientRow, string]> = [
  ['cured', outcomeRow('HN00001', 'cured'), 'var(--outcome-cured-bg)'],
  [
    'treatment_completed',
    outcomeRow('HN00002', 'treatment_completed'),
    'var(--outcome-completed-bg)',
  ],
  ['treatment_failed', outcomeRow('HN00003', 'treatment_failed'), 'var(--outcome-failed-bg)'],
  ['died', outcomeRow('HN00004', 'died'), 'var(--outcome-died-bg)'],
  ['lost_to_followup', outcomeRow('HN00005', 'lost_to_followup'), 'var(--outcome-lost-bg)'],
  ['transferred_out', outcomeRow('HN00006', 'transferred_out'), 'var(--outcome-transferred-bg)'],
  ['not_evaluated', outcomeRow('HN00007', 'not_evaluated'), 'var(--outcome-not-evaluated-bg)'],
  ['legacy completed', outcomeRow('HN00008', null, 'completed'), 'var(--outcome-completed-bg)'],
  [
    'legacy transferred',
    outcomeRow('HN00009', null, 'transferred'),
    'var(--outcome-transferred-bg)',
  ],
  ['legacy defaulted', outcomeRow('HN00010', null, 'defaulted'), 'var(--outcome-lost-bg)'],
  [
    'unknown outcome',
    outcomeRow('HN00011', 'mystery', 'completed'),
    'var(--outcome-not-evaluated-bg)',
  ],
];

describe('DischargedView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it.each(OUTCOME_BG_CASES)(
    'should render the %s badge with its tint token',
    async (_label, row, expectedBg) => {
      vi.mocked(invoke).mockResolvedValueOnce([row]);

      const wrapper = mount(DischargedView, {
        global: { stubs: { RouterLink: true } },
      });
      await flushPromises();

      const badge = wrapper.find('.outcome-badge');
      expect(badge.exists()).toBe(true);
      expect(badge.attributes('style') ?? '').toContain(expectedBg);
    },
  );

  it('should show a retryable error state when the fetch fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('offline'));

    const wrapper = mount(DischargedView, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('offline');

    vi.mocked(invoke).mockResolvedValueOnce([outcomeRow('HN00001', 'cured')]);
    await wrapper.find('[role="alert"] button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.outcome-badge').exists()).toBe(true);
  });
});
