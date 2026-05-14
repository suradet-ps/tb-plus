export interface PatientAlert {
  hn: string;
  alert_type:
    | 'overdue'
    | 'ethambutol_overrun'
    | 'phase_transition'
    | 'treatment_complete'
    | 'lost_to_followup';
  severity: 'red' | 'yellow';
  message: string;
  details: string | null;
}
