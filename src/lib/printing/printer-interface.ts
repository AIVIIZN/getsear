/**
 * Printer interface types and contracts for the Sear POS printing system.
 * All adapters (Star Micronics, Epson) implement IPrinterAdapter.
 */

// ---------- Enums / Unions ----------

export type ConnectionType = 'network' | 'cloudprnt' | 'bluetooth' | 'usb';

export type PrinterRole = 'receipt' | 'kitchen' | 'bar' | 'label' | 'expo';

export type PrinterModel =
  | 'star_tsp143iv'
  | 'star_tsp143iii'
  | 'star_mc_print3'
  | 'star_mpop'
  | 'star_sm_l200'
  | 'epson_tm_t88vii'
  | 'epson_tm_82ii';

export type PrintJobType =
  | 'receipt'
  | 'kitchen_ticket'
  | 'void_ticket'
  | 'refire_ticket'
  | 'test'
  | 'report';

export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'failed';

// ---------- Config ----------

export interface CashDrawerConfig {
  enabled: boolean;
  /** Pin 2 or 5 on the RJ-11 connector */
  pin: 2 | 5;
  /** Pulse duration in milliseconds (100-800) */
  pulseDuration: number;
}

export interface PrinterConfig {
  id: string;
  org_id: string;
  location_id: string;
  name: string;
  model: PrinterModel;
  connection_type: ConnectionType;
  ip_address: string | null;
  port: number | null;
  role: PrinterRole;
  station_name: string | null;
  cash_drawer: CashDrawerConfig;
  is_active: boolean;
  status: 'online' | 'offline' | 'error';
  last_print_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Status ----------

export interface PrinterStatus {
  online: boolean;
  paperOut: boolean;
  coverOpen: boolean;
  error: string | null;
}

// ---------- Print Job ----------

export interface PrintJob {
  id: string;
  printer_id: string;
  job_type: PrintJobType;
  data: Uint8Array;
  status: PrintJobStatus;
  attempts: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ---------- Adapter Interface ----------

export interface IPrinterAdapter {
  /** Establish connection to the printer */
  connect(): Promise<void>;
  /** Disconnect from the printer */
  disconnect(): Promise<void>;
  /** Send binary data (ESC/POS commands) to the printer */
  print(data: Uint8Array): Promise<void>;
  /** Query the printer for its current status */
  getStatus(): Promise<PrinterStatus>;
  /** Check if currently connected */
  isConnected(): boolean;
}

// ---------- Receipt Configuration ----------

export interface ReceiptConfig {
  id: string;
  org_id: string;
  location_id: string;
  header_text: string;
  footer_text: string;
  logo_path: string | null;
  show_dual_pricing: boolean;
  show_qr_code: boolean;
  qr_code_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Routing Rules ----------

export interface PrinterRoutingRule {
  id: string;
  org_id: string;
  location_id: string;
  station_name: string;
  primary_printer_id: string;
  fallback_printer_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Discovery ----------

export interface DiscoveredPrinter {
  ip_address: string;
  port: number;
  model: string;
  connection_type: ConnectionType;
  mac_address: string | null;
  hostname: string | null;
}

// ---------- Display Helpers ----------

export const PRINTER_MODEL_LABELS: Record<PrinterModel, string> = {
  star_tsp143iv: 'Star TSP143IV',
  star_tsp143iii: 'Star TSP143III',
  star_mc_print3: 'Star mC-Print3',
  star_mpop: 'Star mPOP',
  star_sm_l200: 'Star SM-L200',
  epson_tm_t88vii: 'Epson TM-T88VII',
  epson_tm_82ii: 'Epson TM-82II',
};

export const PRINTER_ROLE_LABELS: Record<PrinterRole, string> = {
  receipt: 'Receipt',
  kitchen: 'Kitchen',
  bar: 'Bar',
  label: 'Label',
  expo: 'Expo',
};

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  network: 'Network (TCP/IP)',
  cloudprnt: 'Star CloudPRNT',
  bluetooth: 'Bluetooth',
  usb: 'USB',
};

export const PRINTER_MODELS: PrinterModel[] = [
  'star_tsp143iv',
  'star_tsp143iii',
  'star_mc_print3',
  'star_mpop',
  'star_sm_l200',
  'epson_tm_t88vii',
  'epson_tm_82ii',
];

export const CONNECTION_TYPES: ConnectionType[] = [
  'network',
  'cloudprnt',
  'bluetooth',
  'usb',
];

export const PRINTER_ROLES: PrinterRole[] = [
  'receipt',
  'kitchen',
  'bar',
  'label',
  'expo',
];

/** Determine manufacturer from model string */
export function getManufacturer(model: PrinterModel): 'star' | 'epson' {
  return model.startsWith('epson') ? 'epson' : 'star';
}

/** Default TCP port by manufacturer */
export function getDefaultPort(model: PrinterModel): number {
  return getManufacturer(model) === 'star' ? 9100 : 9100;
}
