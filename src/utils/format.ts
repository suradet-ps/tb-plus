/**
 * Format a CE ISO date (`YYYY-MM-DD`, optionally followed by a time part) as a
 * Thai Buddhist Era date (DD/MM/YYYY). Empty input yields '-'; malformed dates
 * or invalid calendar dates are returned unchanged so bad data stays visible.
 */
export function formatThaiDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(iso);
  if (!match) return iso;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return iso;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return iso;

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`;
}

/**
 * Thai label for a treatment outcome or a legacy patient status.
 * Unknown values are returned unchanged so nothing is silently dropped.
 */
export function outcomeLabel(value: string | null | undefined): string {
  switch (value) {
    case 'cured':
      return 'หาย';
    case 'treatment_completed':
    case 'completed':
      return 'รักษาครบ';
    case 'treatment_failed':
      return 'รักษาล้มเหลว';
    case 'died':
      return 'เสียชีวิต';
    case 'lost_to_followup':
    case 'defaulted':
      return 'ขาดการรักษา';
    case 'transferred_out':
    case 'transferred':
      return 'ส่งต่อ';
    case 'not_evaluated':
      return 'ไม่ได้ประเมิน';
    default:
      return value ?? '-';
  }
}
