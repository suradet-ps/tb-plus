import { vi } from 'vitest';

export function createInvokeMock() {
  return vi.fn();
}

export function mockInvokeModule(invoke: ReturnType<typeof vi.fn>) {
  vi.mock('@tauri-apps/api/core', () => ({
    invoke,
  }));
}
