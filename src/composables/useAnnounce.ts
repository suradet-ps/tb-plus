import { ref } from 'vue';

/**
 * Returns a live-region announcer for screen readers.
 * Call `announce(message)` to push a message into the ARIA live region.
 * Messages are debounced - rapid calls keep only the latest message.
 */
export function useAnnounce() {
  const message = ref('');
  let timer: ReturnType<typeof setTimeout> | null = null;

  function announce(text: string, delay = 100): void {
    if (timer) clearTimeout(timer);
    // Clear first so screen readers detect the change
    message.value = '';
    timer = setTimeout(() => {
      message.value = text;
      timer = null;
    }, delay);
  }

  function clear(): void {
    if (timer) clearTimeout(timer);
    message.value = '';
  }

  return { message, announce, clear };
}
