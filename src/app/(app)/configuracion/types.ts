export interface BusinessSettingsValues {
  business_name: string;
  legal_name: string | null;
  rtn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_label: string;
  tax_rate: number;
  quote_validity_days: number;
  document_footer: string | null;
}
