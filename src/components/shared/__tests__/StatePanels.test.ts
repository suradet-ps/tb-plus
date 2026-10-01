import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EmptyState from '@/components/shared/EmptyState.vue';
import ErrorState from '@/components/shared/ErrorState.vue';
import LoadingState from '@/components/shared/LoadingState.vue';

describe('view state components', () => {
  it('should render LoadingState with a status role, title, and subtitle', () => {
    const wrapper = mount(LoadingState, {
      props: { title: 'กำลังโหลดข้อมูลผู้ป่วย...', subtitle: 'HN HN00001' },
    });

    expect(wrapper.attributes('role')).toBe('status');
    expect(wrapper.text()).toContain('กำลังโหลดข้อมูลผู้ป่วย...');
    expect(wrapper.text()).toContain('HN HN00001');
  });

  it('should fall back to the default LoadingState title', () => {
    const wrapper = mount(LoadingState);

    expect(wrapper.text()).toContain('กำลังโหลดข้อมูล...');
  });

  it('should render EmptyState slots, title, and subtitle', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'ยังไม่มีข้อมูล', subtitle: 'คำอธิบาย' },
      slots: {
        icon: '<span class="custom-icon" />',
        default: '<a class="cta" href="/screening">ไปที่การคัดกรอง</a>',
      },
    });

    expect(wrapper.find('.custom-icon').exists()).toBe(true);
    expect(wrapper.text()).toContain('ยังไม่มีข้อมูล');
    expect(wrapper.text()).toContain('คำอธิบาย');
    expect(wrapper.find('.cta').exists()).toBe(true);
  });

  it('should render ErrorState and emit retry', async () => {
    const wrapper = mount(ErrorState, { props: { message: 'การเชื่อมต่อล้มเหลว' } });

    expect(wrapper.attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('การเชื่อมต่อล้มเหลว');

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});
