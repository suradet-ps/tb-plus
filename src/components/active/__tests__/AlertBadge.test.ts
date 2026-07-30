import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { PatientAlert } from '@/types/alert';
import AlertBadge from '../AlertBadge.vue';

function createAlert(overrides: Partial<PatientAlert> = {}): PatientAlert {
  return {
    hn: 'HN00001',
    alert_type: 'overdue',
    severity: 'red',
    message: 'ยังไม่ได้รับยาในเดือนนี้',
    details: null,
    ...overrides,
  };
}

describe('AlertBadge', () => {
  it('should render the alert message text', () => {
    const alert = createAlert({ message: 'เกินกำหนดจ่ายยา' });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge__text').text()).toBe('เกินกำหนดจ่ายยา');
  });

  it('should apply red class when severity is red', () => {
    const alert = createAlert({ severity: 'red' });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge--red').exists()).toBe(true);
    expect(wrapper.find('.alert-badge--yellow').exists()).toBe(false);
  });

  it('should apply yellow class when severity is yellow', () => {
    const alert = createAlert({ severity: 'yellow' });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge--yellow').exists()).toBe(true);
    expect(wrapper.find('.alert-badge--red').exists()).toBe(false);
  });

  it('should show details in title when details is provided', () => {
    const alert = createAlert({ details: 'detail text', message: 'short msg' });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge').attributes('title')).toBe('detail text');
  });

  it('should show message in title when details is null', () => {
    const alert = createAlert({ details: null, message: 'fallback title' });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge').attributes('title')).toBe('fallback title');
  });

  it('should render the dot indicator', () => {
    const alert = createAlert();
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find('.alert-badge__dot').exists()).toBe(true);
  });

  it.each([
    ['overdue', 'red'],
    ['ethambutol_overrun', 'red'],
    ['lost_to_followup', 'red'],
    ['phase_transition', 'yellow'],
    ['treatment_complete', 'yellow'],
  ] as const)('alert_type %s renders with severity %s', (alertType, expectedSeverity) => {
    const alert = createAlert({ alert_type: alertType, severity: expectedSeverity });
    const wrapper = mount(AlertBadge, { props: { alert } });

    expect(wrapper.find(`.alert-badge--${expectedSeverity}`).exists()).toBe(true);
  });
});
