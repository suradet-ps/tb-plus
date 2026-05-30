import type { PatientAlert } from '@/types/alert';

export function createAlert(overrides: Partial<PatientAlert> = {}): PatientAlert {
  return {
    hn: 'HN00001',
    alert_type: 'overdue',
    severity: 'red',
    message: 'ยังไม่ได้รับยาในเดือนนี้',
    details: null,
    ...overrides,
  };
}

export function createRedAlert(overrides: Partial<PatientAlert> = {}): PatientAlert {
  return createAlert({ severity: 'red', ...overrides });
}

export function createYellowAlert(overrides: Partial<PatientAlert> = {}): PatientAlert {
  return createAlert({
    alert_type: 'phase_transition',
    severity: 'yellow',
    message: 'ถึงเวลาเปลี่ยนระยะการรักษา',
    ...overrides,
  });
}
