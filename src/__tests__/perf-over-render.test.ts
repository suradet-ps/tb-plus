import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Over-render audit for PatientTable.
 *
 * Vue 3 re-renders v-for items by comparing :key values. When a single
 * patient's alert changes, only that patient's row should update — not the
 * entire table. This test verifies the structural invariants that make this
 * possible.
 */
const patientTablePath = resolve(process.cwd(), 'src/components/screening/PatientTable.vue');

describe('PatientTable over-render audit', () => {
  const source = readFileSync(patientTablePath, 'utf-8');

  it('should use :key on v-for with a unique field (hn)', () => {
    expect(source).toMatch(/v-for="[^"]*"\s+[^>]*:key="[^"]*hn[^"]*"/);
  });

  it('should not mutate store.results in sortedResults computed', () => {
    // The sortedResults computed must spread the array before sorting
    // to avoid triggering reactive re-renders on the original array.
    expect(source).toMatch(/const arr = \[\.\.\.store\.results\]/);
  });

  it('should use computed (not watch) for sortedResults', () => {
    // computed creates a cached derived value that only recomputes when
    // dependencies change. watch would fire on every mutation.
    expect(source).toMatch(/const sortedResults\s*=\s*computed<PatientDrugRecord\[\]>/);
  });

  it('should render DrugChip as a child component (not inline)', () => {
    // Child components get their own update cycle. If drug chips were
    // rendered inline in the v-for, they would re-render with the row.
    expect(source).toContain('<DrugChip');
  });
});
