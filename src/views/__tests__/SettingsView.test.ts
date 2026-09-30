import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue';
import { useSettingsStore } from '@/stores/settings';
import SettingsView from '@/views/SettingsView.vue';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

function mountView() {
  return mount(SettingsView, {
    global: {
      stubs: { Teleport: true },
    },
  });
}

async function openSection(wrapper: ReturnType<typeof mountView>, label: string) {
  const navButton = wrapper.findAll('.nav-item').find((button) => button.text().includes(label));
  expect(navButton).toBeTruthy();
  await navButton?.trigger('click');
}

async function openPhaseEditor(wrapper: ReturnType<typeof mountView>) {
  await openSection(wrapper, 'ยาและสูตรยา');
  const editButton = wrapper.findAll('button').find((button) => button.text() === 'แก้ไข');
  expect(editButton).toBeTruthy();
  await editButton?.trigger('click');
}

describe('SettingsView dialogs', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
    useSettingsStore().regimenDefinitions = [
      {
        name: '2HRZE/4HR',
        phases: [
          { phase: 'intensive', months: 2, drug_classes: ['H', 'R', 'Z', 'E'] },
          { phase: 'continuation', months: 4, drug_classes: ['H', 'R'] },
        ],
      },
    ];
  });

  it('opens the phase editor as a dialog and closes it with Escape', async () => {
    const wrapper = mountView();
    await openPhaseEditor(wrapper);

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('2HRZE/4HR');

    await dialog.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('closes the phase editor with the close button', async () => {
    const wrapper = mountView();
    await openPhaseEditor(wrapper);

    await wrapper.find('.modal-close').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('confirms restore through the shared dialog', async () => {
    vi.mocked(openDialog).mockResolvedValue('C:/backup/tb.db');
    const wrapper = mountView();
    await openSection(wrapper, 'สำรองข้อมูล');

    const pickButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('(Import)'));
    expect(pickButton).toBeTruthy();
    await pickButton?.trigger('click');
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('C:/backup/tb.db');

    await dialog.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('admits only one restore when confirm is triggered twice', async () => {
    vi.mocked(openDialog).mockResolvedValue('C:/backup/tb.db');
    let resolveRestore: ((value: unknown) => void) | undefined;
    const restorePending = new Promise((resolve) => {
      resolveRestore = resolve;
    });
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'restore_sqlite') {
        return restorePending;
      }
      return Promise.resolve(undefined);
    });

    const wrapper = mountView();
    await openSection(wrapper, 'สำรองข้อมูล');

    const pickButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('(Import)'));
    expect(pickButton).toBeTruthy();
    await pickButton?.trigger('click');
    await flushPromises();

    const dialog = wrapper.findComponent(ConfirmDialog);
    expect(dialog.exists()).toBe(true);
    dialog.vm.$emit('confirm');
    dialog.vm.$emit('confirm');
    await flushPromises();

    const restoreCalls = vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'restore_sqlite');
    expect(restoreCalls.length).toBe(1);
    expect(restoreCalls[0][1]).toEqual({ sourcePath: 'C:/backup/tb.db' });

    resolveRestore?.(undefined);
    await flushPromises();
    wrapper.unmount();
  });
});
