import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useFocusTrap } from '@/composables/useFocusTrap';

function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('tabindex', '-1');
  const btn1 = document.createElement('button');
  btn1.textContent = 'First';
  const btn2 = document.createElement('button');
  btn2.textContent = 'Second';
  const btn3 = document.createElement('button');
  btn3.textContent = 'Third';
  container.append(btn1, btn2, btn3);
  document.body.appendChild(container);
  return container;
}

describe('useFocusTrap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
  });

  it('focuses the first focusable child when activated', async () => {
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(container.querySelector('button'));
  });

  it('focuses the container itself when no focusable children', async () => {
    const empty = document.createElement('div');
    empty.setAttribute('tabindex', '-1');
    document.body.appendChild(empty);

    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(empty);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(empty);
    empty.remove();
  });

  it('wraps focus from last to first on Tab', async () => {
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    const buttons = container.querySelectorAll('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('wraps focus from first to last on Shift+Tab', async () => {
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    const buttons = container.querySelectorAll('button');
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('does not trap Tab when inactive', async () => {
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    const buttons = container.querySelectorAll('button');
    buttons[0].focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('does nothing on non-Tab keydown', async () => {
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    const buttons = container.querySelectorAll('button');
    buttons[0].focus();

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('handles empty focusable list on Tab without error', async () => {
    const empty = document.createElement('div');
    empty.setAttribute('tabindex', '-1');
    document.body.appendChild(empty);

    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(empty);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();
    await nextTick();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    expect(() => document.dispatchEvent(event)).not.toThrow();
    empty.remove();
  });

  it('registers and removes document keydown listener on activate/deactivate', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const active = ref(false);
    const panelRef = ref<HTMLElement | null>(container);
    useFocusTrap(active, panelRef);

    active.value = true;
    await nextTick();

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    active.value = false;
    await nextTick();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
