import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useAnnounce } from '@/composables/useAnnounce';

describe('useAnnounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty message', () => {
    const { message } = useAnnounce();
    expect(message.value).toBe('');
  });

  it('sets message after delay', () => {
    const { message, announce } = useAnnounce();

    announce('Patient enrolled');
    expect(message.value).toBe('');

    vi.advanceTimersByTime(100);
    expect(message.value).toBe('Patient enrolled');
  });

  it('clears message with clear()', () => {
    const { message, announce, clear } = useAnnounce();

    announce('Loading');
    vi.advanceTimersByTime(50);
    clear();

    expect(message.value).toBe('');
  });

  it('debounces rapid calls — only last message survives', () => {
    const { message, announce } = useAnnounce();

    announce('First');
    vi.advanceTimersByTime(50);
    announce('Second');
    vi.advanceTimersByTime(50);
    announce('Third');

    vi.advanceTimersByTime(100);
    expect(message.value).toBe('Third');
  });

  it('clears before setting new message (detectable change for screen readers)', () => {
    const { message, announce } = useAnnounce();

    announce('First');
    vi.advanceTimersByTime(100);
    expect(message.value).toBe('First');

    announce('Second');
    expect(message.value).toBe('');

    vi.advanceTimersByTime(100);
    expect(message.value).toBe('Second');
  });

  it('supports custom delay', () => {
    const { message, announce } = useAnnounce();

    announce('Delayed', 300);
    vi.advanceTimersByTime(100);
    expect(message.value).toBe('');

    vi.advanceTimersByTime(200);
    expect(message.value).toBe('Delayed');
  });
});
