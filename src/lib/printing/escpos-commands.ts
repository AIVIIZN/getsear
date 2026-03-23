/**
 * ESC/POS command constants for thermal receipt printers.
 * All values are Uint8Array byte sequences representing standard ESC/POS commands.
 * Covers Star Micronics and Epson printer families.
 */

/** ESC/POS command byte constants */
export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const DLE = 0x10;
export const EOT = 0x04;
export const NUL = 0x00;
export const LF = 0x0a;
export const HT = 0x09;
export const CR = 0x0d;

export const ESCPOS = {
  /** Initialize printer — resets all settings to defaults */
  INITIALIZE: new Uint8Array([ESC, 0x40]),

  // --- Text Alignment ---
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),

  // --- Text Style ---
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  UNDERLINE_OFF: new Uint8Array([ESC, 0x2d, 0x00]),
  UNDERLINE_ON: new Uint8Array([ESC, 0x2d, 0x01]),
  UNDERLINE_DOUBLE: new Uint8Array([ESC, 0x2d, 0x02]),
  DOUBLE_HEIGHT_ON: new Uint8Array([ESC, 0x21, 0x10]),
  DOUBLE_WIDTH_ON: new Uint8Array([ESC, 0x21, 0x20]),
  DOUBLE_HEIGHT_WIDTH_ON: new Uint8Array([ESC, 0x21, 0x30]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0x00]),

  // --- Font Selection ---
  FONT_A: new Uint8Array([ESC, 0x4d, 0x00]),
  FONT_B: new Uint8Array([ESC, 0x4d, 0x01]),

  // --- Line Control ---
  LINE_FEED: new Uint8Array([LF]),
  CARRIAGE_RETURN: new Uint8Array([CR]),

  // --- Line Spacing ---
  LINE_SPACING_DEFAULT: new Uint8Array([ESC, 0x32]),
  /** Set line spacing to n dots. Use lineSpacing(n) helper. */
  LINE_SPACING_SET: new Uint8Array([ESC, 0x33]),

  // --- Horizontal Tab ---
  HORIZONTAL_TAB: new Uint8Array([HT]),

  // --- Cut ---
  FULL_CUT: new Uint8Array([GS, 0x56, 0x00]),
  PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x01]),
  /** Feed and cut (feed n lines then full cut) */
  FEED_AND_FULL_CUT: new Uint8Array([GS, 0x56, 0x41, 0x03]),
  FEED_AND_PARTIAL_CUT: new Uint8Array([GS, 0x56, 0x42, 0x03]),

  // --- Cash Drawer ---
  /** Kick cash drawer pin 2 (connectors 2,5) — 100ms pulse */
  CASH_DRAWER_PIN2: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0x78]),
  /** Kick cash drawer pin 5 (connectors 2,5) — 100ms pulse */
  CASH_DRAWER_PIN5: new Uint8Array([ESC, 0x70, 0x01, 0x19, 0x78]),

  // --- Barcode ---
  /** Set barcode height (default 162 dots) */
  BARCODE_HEIGHT: new Uint8Array([GS, 0x68]),
  /** Set barcode width multiplier (2-6) */
  BARCODE_WIDTH: new Uint8Array([GS, 0x77]),
  /** Set HRI position: 0=none, 1=above, 2=below, 3=both */
  BARCODE_HRI_POSITION: new Uint8Array([GS, 0x48]),
  /** Set HRI font: 0=Font A, 1=Font B */
  BARCODE_HRI_FONT: new Uint8Array([GS, 0x66]),
  /** Print barcode — followed by type byte, then data */
  BARCODE_PRINT: new Uint8Array([GS, 0x6b]),

  // --- Barcode Types (for GS k command) ---
  BARCODE_TYPE: {
    UPC_A: 0x41,
    UPC_E: 0x42,
    EAN13: 0x43,
    EAN8: 0x44,
    CODE39: 0x45,
    ITF: 0x46,
    CODABAR: 0x47,
    CODE93: 0x48,
    CODE128: 0x49,
  } as const,

  // --- QR Code (GS ( k) ---
  QR_MODEL: new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41]),
  QR_SIZE: new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43]),
  QR_ERROR_CORRECTION: new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45]),
  QR_STORE_DATA: new Uint8Array([GS, 0x28, 0x6b]),
  QR_PRINT: new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),

  // --- Status ---
  /** DLE EOT — transmit real-time status */
  STATUS_PRINTER: new Uint8Array([DLE, EOT, 0x01]),
  STATUS_OFFLINE: new Uint8Array([DLE, EOT, 0x02]),
  STATUS_ERROR: new Uint8Array([DLE, EOT, 0x03]),
  STATUS_PAPER: new Uint8Array([DLE, EOT, 0x04]),

  // --- Character Set / Codepage ---
  /** Select character code table. Followed by codepage number. */
  SELECT_CODEPAGE: new Uint8Array([ESC, 0x74]),
  /** Select international character set. Followed by set number. */
  SELECT_CHARSET: new Uint8Array([ESC, 0x52]),

  // --- Font Size (GS !) ---
  /** Set character size — n encodes width (high nybble) + height (low nybble), 0-7 each */
  CHAR_SIZE: new Uint8Array([GS, 0x21]),
} as const;

/** Standard codepage numbers for ESC t command */
export const CODEPAGES = {
  PC437_USA: 0,
  KATAKANA: 1,
  PC850_MULTILINGUAL: 2,
  PC860_PORTUGUESE: 3,
  PC863_CANADIAN_FRENCH: 4,
  PC865_NORDIC: 5,
  PC1252_LATIN1: 16,
  PC866_CYRILLIC: 17,
  PC852_LATIN2: 18,
  PC858_EURO: 19,
  UTF8: 255, // Not standard ESC/POS but some models support it
} as const;

/** International character set numbers for ESC R command */
export const CHARSETS = {
  USA: 0,
  FRANCE: 1,
  GERMANY: 2,
  UK: 3,
  DENMARK: 4,
  SWEDEN: 5,
  ITALY: 6,
  SPAIN: 7,
  JAPAN: 8,
  NORWAY: 9,
  DENMARK2: 10,
  SPAIN2: 11,
  LATIN_AMERICA: 12,
  KOREA: 13,
} as const;

export type BarcodeType = keyof typeof ESCPOS.BARCODE_TYPE;
export type CodepageId = (typeof CODEPAGES)[keyof typeof CODEPAGES];
export type CharsetId = (typeof CHARSETS)[keyof typeof CHARSETS];
