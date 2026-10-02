import { describe, expect, it } from 'vitest';
import { formatThaiDate, outcomeLabel } from '@/utils/format';

describe('formatThaiDate', () => {
  it('should format an ISO date as a Buddhist Era date', () => {
    expect(formatThaiDate('2026-09-01')).toBe('01/09/2569');
  });

  it('should ignore a time suffix', () => {
    expect(formatThaiDate('2026-09-01T10:30:00')).toBe('01/09/2569');
  });

  it('should return a dash for empty input', () => {
    expect(formatThaiDate(null)).toBe('-');
    expect(formatThaiDate(undefined)).toBe('-');
    expect(formatThaiDate('')).toBe('-');
  });

  it('should return unrecognized input unchanged', () => {
    expect(formatThaiDate('not-a-date')).toBe('not-a-date');
  });

  it('should return malformed or invalid calendar dates unchanged', () => {
    expect(formatThaiDate('2026-13-01')).toBe('2026-13-01');
    expect(formatThaiDate('2026-02-30')).toBe('2026-02-30');
    expect(formatThaiDate('2026-09-011')).toBe('2026-09-011');
    expect(formatThaiDate('2026-9-1')).toBe('2026-9-1');
  });

  it('should accept February 29 only in leap years', () => {
    expect(formatThaiDate('2024-02-29')).toBe('29/02/2567');
    expect(formatThaiDate('2026-02-29')).toBe('2026-02-29');
  });
});

describe('outcomeLabel', () => {
  it('should map current outcomes to Thai labels', () => {
    expect(outcomeLabel('cured')).toBe('หาย');
    expect(outcomeLabel('treatment_completed')).toBe('รักษาครบ');
    expect(outcomeLabel('treatment_failed')).toBe('รักษาล้มเหลว');
    expect(outcomeLabel('died')).toBe('เสียชีวิต');
    expect(outcomeLabel('lost_to_followup')).toBe('ขาดการรักษา');
    expect(outcomeLabel('transferred_out')).toBe('ส่งต่อ');
    expect(outcomeLabel('not_evaluated')).toBe('ไม่ได้ประเมิน');
  });

  it('should map legacy patient statuses', () => {
    expect(outcomeLabel('completed')).toBe('รักษาครบ');
    expect(outcomeLabel('transferred')).toBe('ส่งต่อ');
    expect(outcomeLabel('defaulted')).toBe('ขาดการรักษา');
  });

  it('should keep unknown values and show a dash for empty input', () => {
    expect(outcomeLabel('mystery')).toBe('mystery');
    expect(outcomeLabel(null)).toBe('-');
  });
});
