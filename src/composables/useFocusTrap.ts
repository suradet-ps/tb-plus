import { nextTick, onUnmounted, watch, type Ref } from 'vue';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside a container element while `active` is true.
 * Moves initial focus to the container (or first focusable child) on open.
 * Returns a ref to attach to the container element.
 */
export function useFocusTrap(active: Ref<boolean>, containerRef: Ref<HTMLElement | null>) {
  function getFocusables(): HTMLElement[] {
    if (!containerRef.value) return [];
    return Array.from(containerRef.value.querySelectorAll(FOCUSABLE));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusables = getFocusables();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function trapKeydown(e: KeyboardEvent) {
    if (!active.value) return;
    handleKeydown(e);
  }

  async function focusInitial() {
    await nextTick();
    if (!containerRef.value) return;
    const focusables = getFocusables();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      containerRef.value.focus();
    }
  }

  watch(active, (isOpen) => {
    if (isOpen) {
      focusInitial();
      document.addEventListener('keydown', trapKeydown);
    } else {
      document.removeEventListener('keydown', trapKeydown);
    }
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', trapKeydown);
  });
}
