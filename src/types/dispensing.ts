export interface DispensingRecord {
  vstdate: string;
  icode: string;
  drug_name: string | null;
  qty: number | null;
  units: string | null;
  drug_class: string | null;
}
