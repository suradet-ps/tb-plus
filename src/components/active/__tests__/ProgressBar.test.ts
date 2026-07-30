import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ProgressBar from '../ProgressBar.vue';

describe('ProgressBar', () => {
  it('should display month labels with current and total', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 3, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__text').text()).toContain('3');
    expect(wrapper.find('.progress__text').text()).toContain('6');
  });

  it('should calculate correct percentage', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 3, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__pct').text()).toBe('50%');
  });

  it('should cap percentage at 100%', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 12, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__pct').text()).toBe('100%');
  });

  it('should show 0% when currentMonth is null', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: null, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__pct').text()).toBe('0%');
  });

  it('should show 0% when totalMonths is null', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 3, totalMonths: null },
    });

    expect(wrapper.find('.progress__pct').text()).toBe('0%');
  });

  it('should show 0% when totalMonths is 0', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 3, totalMonths: 0 },
    });

    expect(wrapper.find('.progress__pct').text()).toBe('0%');
  });

  it('should show "?" for null values in labels', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: null, totalMonths: null },
    });

    expect(wrapper.find('.progress__text').text()).toContain('?');
  });

  it('should apply overrun class when currentMonth > totalMonths', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 8, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__fill--overrun').exists()).toBe(true);
  });

  it('should not apply overrun class when within bounds', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 3, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__fill--overrun').exists()).toBe(false);
  });

  it('should use intensive color when phase is intensive', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 1, totalMonths: 6, phase: 'intensive' },
    });

    const fill = wrapper.find('.progress__fill');
    expect(fill.attributes('style')).toContain('var(--color-phase-intensive)');
  });

  it('should use continuation color when phase is continuation', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 4, totalMonths: 6, phase: 'continuation' },
    });

    const fill = wrapper.find('.progress__fill');
    expect(fill.attributes('style')).toContain('var(--color-phase-continuation)');
  });

  it('should render progress track element', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 1, totalMonths: 6 },
    });

    expect(wrapper.find('.progress__track').exists()).toBe(true);
  });

  it('should set fill width to percentage', () => {
    const wrapper = mount(ProgressBar, {
      props: { currentMonth: 1, totalMonths: 4 },
    });

    const fill = wrapper.find('.progress__fill');
    expect(fill.attributes('style')).toContain('width: 25%');
  });
});
