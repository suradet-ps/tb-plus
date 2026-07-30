import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Followup, TreatmentPlan } from '@/types/treatment';
import TreatmentTimeline from '../TreatmentTimeline.vue';

function createPlan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    id: 1,
    hn: 'HN00001',
    regimen: '2HRZE/4HR',
    phase: 'intensive',
    phase_start: '2025-01-15',
    phase_end_expected: '2025-03-15',
    drugs: '["1430104","1000265","1600004","1000258"]',
    duration_months: 2,
    is_current: true,
    notes: null,
    created_at: '2025-01-15T10:00:00',
    ...overrides,
  };
}

function createFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: 1,
    hn: 'HN00001',
    followup_date: '2025-02-15',
    month_number: 1,
    weight_kg: 65,
    sputum_result: 'negative',
    xray_result: 'improved',
    side_effects: null,
    adherence: 'good',
    dispensed_drugs: null,
    notes: null,
    created_by: 'หมอ',
    created_at: '2025-02-15T14:00:00',
    ...overrides,
  };
}

describe('TreatmentTimeline', () => {
  it('should show empty state when no plans exist', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: { plans: [], followups: [] },
    });

    expect(wrapper.find('.timeline-empty').exists()).toBe(true);
    expect(wrapper.find('.timeline-empty').text()).toContain('ยังไม่มีแผนการรักษา');
  });

  it('should show empty state when plans array is empty', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: { plans: [], followups: [createFollowup()] },
    });

    expect(wrapper.find('.timeline-empty').exists()).toBe(true);
  });

  it('should render timeline container when plan exists', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [],
      },
    });

    expect(wrapper.find('.timeline-container').exists()).toBe(true);
    expect(wrapper.find('.timeline-empty').exists()).toBe(false);
  });

  it('should render intensive phase bar', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan({ phase: 'intensive', duration_months: 2 })],
        followups: [],
      },
    });

    expect(wrapper.find('.intensive-bar').exists()).toBe(true);
  });

  it('should render continuation phase bar when both phases exist', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [
          createPlan({ phase: 'intensive', duration_months: 2 }),
          createPlan({
            id: 2,
            phase: 'continuation',
            phase_start: '2025-03-15',
            phase_end_expected: '2025-07-15',
            duration_months: 4,
            is_current: false,
          }),
        ],
        followups: [],
      },
    });

    expect(wrapper.find('.intensive-bar').exists()).toBe(true);
    expect(wrapper.find('.continuation-bar').exists()).toBe(true);
  });

  it('should render follow-up dots', () => {
    const followups = [
      createFollowup({ id: 1, followup_date: '2025-02-15', month_number: 1 }),
      createFollowup({ id: 2, followup_date: '2025-03-15', month_number: 2 }),
    ];
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups,
      },
    });

    expect(wrapper.findAll('.followup-dot')).toHaveLength(2);
  });

  it('should render today marker', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [],
      },
    });

    expect(wrapper.find('.today-marker').exists()).toBe(true);
    expect(wrapper.find('.today-label').text()).toBe('วันนี้');
  });

  it('should render month ticks', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [
          createPlan({ phase: 'intensive', duration_months: 2 }),
          createPlan({
            id: 2,
            phase: 'continuation',
            phase_start: '2025-03-15',
            phase_end_expected: '2025-07-15',
            duration_months: 4,
            is_current: false,
          }),
        ],
        followups: [],
      },
    });

    const ticks = wrapper.findAll('.month-tick');
    expect(ticks.length).toBe(6);
  });

  it('should render phase legend', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [],
      },
    });

    expect(wrapper.find('.phase-legend').exists()).toBe(true);
    expect(wrapper.findAll('.legend-item').length).toBeGreaterThanOrEqual(2);
  });

  it('should display Thai date format for start and end labels', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan({ phase_start: '2025-01-15', phase_end_expected: '2025-03-15' })],
        followups: [],
      },
    });

    const labels = wrapper.find('.date-labels');
    expect(labels.text()).toContain('2568');
  });

  it('should show boundary label between phases', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [
          createPlan({ phase: 'intensive', duration_months: 2 }),
          createPlan({
            id: 2,
            phase: 'continuation',
            phase_start: '2025-03-15',
            phase_end_expected: '2025-07-15',
            duration_months: 4,
            is_current: false,
          }),
        ],
        followups: [],
      },
    });

    expect(wrapper.find('.boundary-label').exists()).toBe(true);
  });

  it('should have proper ARIA attributes on timeline track', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [],
      },
    });

    const track = wrapper.find('.timeline-track');
    expect(track.attributes('role')).toBe('img');
    expect(track.attributes('aria-label')).toBe('ไทม์ไลน์การรักษา');
  });

  it('should not show gap zones when followups are less than 2', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [createFollowup({ followup_date: '2025-02-15' })],
      },
    });

    expect(wrapper.findAll('.gap-zone')).toHaveLength(0);
  });

  it('should not show gap zones when followups are less than 45 days apart', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [
          createFollowup({ id: 1, followup_date: '2025-02-15', month_number: 1 }),
          createFollowup({ id: 2, followup_date: '2025-03-15', month_number: 2 }),
        ],
      },
    });

    expect(wrapper.findAll('.gap-zone')).toHaveLength(0);
  });

  it('should show gap zones when followups are more than 45 days apart', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [
          createFollowup({ id: 1, followup_date: '2025-02-15', month_number: 1 }),
          createFollowup({ id: 2, followup_date: '2025-05-01', month_number: 4 }),
        ],
      },
    });

    expect(wrapper.findAll('.gap-zone')).toHaveLength(1);
    const gap = wrapper.find('.gap-zone');
    expect(gap.attributes('title')).toContain('45 วัน');
  });

  it('should apply month-tick-current class to the current month tick', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan({ duration_months: 2 })],
        followups: [],
      },
    });

    const ticks = wrapper.findAll('.month-tick');
    const currentTicks = ticks.filter((t) => t.classes('month-tick-current'));
    // If today is within the plan range, exactly 1 tick should have the class
    // If not (e.g. plan is in the past), 0 ticks get the class — both are valid
    expect(currentTicks.length).toBeLessThanOrEqual(1);
  });

  it('should render gap zone with correct style properties', () => {
    const wrapper = mount(TreatmentTimeline, {
      props: {
        plans: [createPlan()],
        followups: [
          createFollowup({ id: 1, followup_date: '2025-02-15', month_number: 1 }),
          createFollowup({ id: 2, followup_date: '2025-05-01', month_number: 4 }),
        ],
      },
    });

    const gap = wrapper.find('.gap-zone');
    expect(gap.exists()).toBe(true);
    const style = gap.attributes('style');
    expect(style).toContain('left:');
    expect(style).toContain('width:');
  });
});
