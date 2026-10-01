/**
 * Format a CE ISO date (YYYY-MM-DD, optionally with a time suffix) as a Thai
 * Buddhist Era date (DD/MM/YYYY). Empty input yields '-'; unrecognized input
 * is returned unchanged so a malformed value is visible instead of hidden.
 */
export function formatThaiDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
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
