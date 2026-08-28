import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DosageDrugCandidate } from '@/stores/settings';
import { useSettingsStore } from '@/stores/settings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('dosage round-trip - invoke and type validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should load configured dosage drugs via settings store', async () => {
    const store = useSettingsStore();
    const candidates: DosageDrugCandidate[] = [
      {
        class: 'H',
        icode: '1430104',
        drug_name: 'Isoniazid',
        strength: '300',
        units: 'tab',
      },
      {
        class: 'R',
        icode: '1000265',
        drug_name: 'Rifampicin',
        strength: '300',
        units: 'cap',
      },
    ];
    vi.mocked(invoke).mockResolvedValue(candidates);

    const result = await store.loadConfiguredDosageDrugs();

    expect(invoke).toHaveBeenCalledWith('get_configured_dosage_drugs');
    expect(result).toHaveLength(2);
    expect(result[0].class).toBe('H');
    expect(result[1].class).toBe('R');
  });

  it('should invoke assess_patient_dosage with correct shape', async () => {
    const assessmentResult = {
      patient: {
        hn: 'HN00001',
        full_name: 'นาย ทดสอบ',
        age: 45,
        sex: 'M',
        birthday: '1980-03-15',
        latest_weight_kg: 65,
        latest_weight_date: '2025-06-01',
      },
      regimen_name: '2HRZE/4HR',
      phases: [
        {
          phase: 'intensive',
          months: 2,
          items: [
            {
              class: 'H',
              icode: '1430104',
              drug_name: 'Isoniazid',
              strength: '300',
              units: 'tab',
              min_mg_per_kg_day: 5,
              max_mg_per_kg_day: 10,
              target_min_mg_day: 300,
              target_max_mg_day: 600,
              suggested_units_per_day: 1,
              suggested_daily_dose_mg: 300,
              dose_delta_mg: 0,
              within_target_range: true,
              note: null,
            },
          ],
        },
      ],
      warnings: [],
    };
    vi.mocked(invoke).mockResolvedValue(assessmentResult);

    const result = (await invoke('assess_patient_dosage', {
      hn: 'HN00001',
      weightKg: 65,
    })) as {
      regimen_name: string;
      phases: { items: unknown[] }[];
      patient: { latest_weight_kg: number };
    };

    expect(invoke).toHaveBeenCalledWith('assess_patient_dosage', {
      hn: 'HN00001',
      weightKg: 65,
    });
    expect(result.regimen_name).toBe('2HRZE/4HR');
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].items).toHaveLength(1);
    expect(result.patient.latest_weight_kg).toBe(65);
  });

  it('should produce warnings when dose exceeds range', async () => {
    const resultWithWarning = {
      patient: {
        hn: 'HN00002',
        full_name: 'นาย หนัก',
        age: 50,
        sex: 'M',
        birthday: '1975-01-01',
        latest_weight_kg: 40,
        latest_weight_date: '2025-06-01',
      },
      regimen_name: '2HRZE/4HR',
      phases: [
        {
          phase: 'intensive',
          months: 2,
          items: [],
        },
      ],
      warnings: ['Isoniazid dose (300 mg) exceeds recommended max for weight 40 kg'],
    };
    vi.mocked(invoke).mockResolvedValue(resultWithWarning);

    const result = (await invoke('assess_patient_dosage', {
      hn: 'HN00002',
      weightKg: 40,
    })) as { warnings: string[] };

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('exceeds recommended max');
  });
});
