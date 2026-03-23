/**
 * ESC/POS command builder — fluent/chainable API that produces
 * a Uint8Array binary command sequence ready to send to a printer.
 *
 * Usage:
 *   const bytes = new ESCPOSBuilder()
 *     .initialize()
 *     .align('center')
 *     .bold(true)
 *     .text('RECEIPT')
 *     .bold(false)
 *     .lineFeed(2)
 *     .cut()
 *     .build();
 */

import {
  ESCPOS,
  CODEPAGES,
  type BarcodeType,
  type CodepageId,
  LF,
  GS,
} from './escpos-commands';

export class ESCPOSBuilder {
  private buffers: Uint8Array[] = [];
  private codepage: CodepageId = CODEPAGES.PC437_USA;

  /** Reset printer to defaults */
  initialize(): this {
    this.buffers.push(ESCPOS.INITIALIZE);
    return this;
  }

  /** Append raw text, encoded in the current codepage (defaults to ASCII-safe PC437) */
  text(str: string): this {
    this.buffers.push(encodeText(str, this.codepage));
    return this;
  }

  /** Append text followed by a line feed */
  textLine(str: string): this {
    return this.text(str).lineFeed();
  }

  /** Set bold on or off */
  bold(on: boolean): this {
    this.buffers.push(on ? ESCPOS.BOLD_ON : ESCPOS.BOLD_OFF);
    return this;
  }

  /** Set underline on or off */
  underline(on: boolean): this {
    this.buffers.push(on ? ESCPOS.UNDERLINE_ON : ESCPOS.UNDERLINE_OFF);
    return this;
  }

  /** Set text alignment */
  align(alignment: 'left' | 'center' | 'right'): this {
    const cmd =
      alignment === 'center'
        ? ESCPOS.ALIGN_CENTER
        : alignment === 'right'
          ? ESCPOS.ALIGN_RIGHT
          : ESCPOS.ALIGN_LEFT;
    this.buffers.push(cmd);
    return this;
  }

  /** Set double height on or off */
  doubleHeight(on: boolean): this {
    this.buffers.push(on ? ESCPOS.DOUBLE_HEIGHT_ON : ESCPOS.NORMAL_SIZE);
    return this;
  }

  /** Set double width on or off */
  doubleWidth(on: boolean): this {
    this.buffers.push(on ? ESCPOS.DOUBLE_WIDTH_ON : ESCPOS.NORMAL_SIZE);
    return this;
  }

  /** Set both double height and width on or off */
  doubleSize(on: boolean): this {
    this.buffers.push(on ? ESCPOS.DOUBLE_HEIGHT_WIDTH_ON : ESCPOS.NORMAL_SIZE);
    return this;
  }

  /**
   * Set font size multiplier.
   * 1 = normal, 2 = double, 3 = triple (up to 8).
   * Sets both width and height to the same multiplier.
   */
  fontSize(size: number): this {
    const n = Math.max(0, Math.min(7, size - 1));
    // GS ! n — high nybble = width multiplier, low nybble = height multiplier
    this.buffers.push(new Uint8Array([...ESCPOS.CHAR_SIZE, (n << 4) | n]));
    return this;
  }

  /** Select Font A (12x24, typically 42 cols on 80mm) */
  fontA(): this {
    this.buffers.push(ESCPOS.FONT_A);
    return this;
  }

  /** Select Font B (9x17, typically 56 cols on 80mm) */
  fontB(): this {
    this.buffers.push(ESCPOS.FONT_B);
    return this;
  }

  /** Print n line feeds (default 1) */
  lineFeed(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.buffers.push(ESCPOS.LINE_FEED);
    }
    return this;
  }

  /** Print a horizontal line of a given character across the full width */
  horizontalLine(char = '-', width = 42): this {
    return this.textLine(char.repeat(width));
  }

  /** Horizontal tab */
  tab(): this {
    this.buffers.push(ESCPOS.HORIZONTAL_TAB);
    return this;
  }

  /** Set line spacing in dots (n/180 inch). Pass undefined for default. */
  lineSpacing(n?: number): this {
    if (n === undefined) {
      this.buffers.push(ESCPOS.LINE_SPACING_DEFAULT);
    } else {
      this.buffers.push(new Uint8Array([...ESCPOS.LINE_SPACING_SET, n & 0xff]));
    }
    return this;
  }

  /** Full paper cut */
  cut(): this {
    this.lineFeed(3);
    this.buffers.push(ESCPOS.FEED_AND_FULL_CUT);
    return this;
  }

  /** Partial paper cut (leaves small connection) */
  partialCut(): this {
    this.lineFeed(3);
    this.buffers.push(ESCPOS.FEED_AND_PARTIAL_CUT);
    return this;
  }

  /**
   * Kick the cash drawer.
   * @param pin - 2 or 5 (which pin to pulse)
   * @param duration - pulse duration in milliseconds (rounded to nearest ESC/POS unit)
   */
  cashDrawerKick(pin: 2 | 5 = 2, duration = 100): this {
    // ESC p m t1 t2 — m=0 for pin 2, m=1 for pin 5
    // t1 and t2 are in units of 2ms
    const m = pin === 5 ? 0x01 : 0x00;
    const t = Math.min(255, Math.max(1, Math.round(duration / 2)));
    this.buffers.push(new Uint8Array([0x1b, 0x70, m, t, t]));
    return this;
  }

  /**
   * Print a QR code containing the given data.
   * @param data - The string to encode
   * @param moduleSize - Module (dot) size, 1-16 (default 6)
   * @param errorCorrection - 48=L, 49=M, 50=Q, 51=H (default 49/M)
   */
  qrCode(data: string, moduleSize = 6, errorCorrection = 49): this {
    const encoded = encodeText(data, this.codepage);
    const storeLen = encoded.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    // Set QR model 2
    this.buffers.push(new Uint8Array([...ESCPOS.QR_MODEL, 0x32, 0x00]));
    // Set module size
    this.buffers.push(new Uint8Array([...ESCPOS.QR_SIZE, moduleSize & 0xff]));
    // Set error correction level
    this.buffers.push(
      new Uint8Array([...ESCPOS.QR_ERROR_CORRECTION, errorCorrection & 0xff])
    );
    // Store QR data
    this.buffers.push(
      new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...encoded])
    );
    // Print QR
    this.buffers.push(ESCPOS.QR_PRINT);

    return this;
  }

  /**
   * Print a barcode.
   * @param type - Barcode type key (e.g. 'CODE128', 'EAN13')
   * @param data - The barcode data string
   * @param height - Bar height in dots (default 80)
   * @param width - Bar width multiplier 2-6 (default 3)
   * @param hriPosition - HRI text position: 0=none, 1=above, 2=below, 3=both (default 2)
   */
  barcode(
    type: BarcodeType,
    data: string,
    height = 80,
    width = 3,
    hriPosition = 2
  ): this {
    const typeCode = ESCPOS.BARCODE_TYPE[type];
    const encoded = encodeText(data, this.codepage);

    // Set height
    this.buffers.push(new Uint8Array([...ESCPOS.BARCODE_HEIGHT, height & 0xff]));
    // Set width
    this.buffers.push(
      new Uint8Array([...ESCPOS.BARCODE_WIDTH, Math.min(6, Math.max(2, width))])
    );
    // Set HRI position
    this.buffers.push(
      new Uint8Array([...ESCPOS.BARCODE_HRI_POSITION, hriPosition & 0x03])
    );
    // Print barcode: GS k m n data
    this.buffers.push(
      new Uint8Array([
        ...ESCPOS.BARCODE_PRINT,
        typeCode,
        encoded.length,
        ...encoded,
      ])
    );

    return this;
  }

  /** Set codepage for text encoding */
  setCodepage(codepage: CodepageId): this {
    this.codepage = codepage;
    this.buffers.push(
      new Uint8Array([...ESCPOS.SELECT_CODEPAGE, codepage & 0xff])
    );
    return this;
  }

  /** Append raw bytes directly */
  raw(bytes: Uint8Array | number[]): this {
    this.buffers.push(
      bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    );
    return this;
  }

  /** Reset to normal text mode */
  resetStyle(): this {
    this.buffers.push(ESCPOS.NORMAL_SIZE);
    this.buffers.push(ESCPOS.BOLD_OFF);
    this.buffers.push(ESCPOS.UNDERLINE_OFF);
    this.buffers.push(ESCPOS.ALIGN_LEFT);
    return this;
  }

  /**
   * Print two columns of text — left-aligned and right-aligned —
   * spanning the full receipt width.
   * @param left - Left text
   * @param right - Right text
   * @param width - Total character width (default 42 for 80mm / Font A)
   */
  twoColumns(left: string, right: string, width = 42): this {
    const gap = width - left.length - right.length;
    if (gap < 1) {
      // Truncate left to fit
      const maxLeft = width - right.length - 1;
      return this.textLine(left.slice(0, maxLeft) + ' ' + right);
    }
    return this.textLine(left + ' '.repeat(gap) + right);
  }

  /** Concatenate all buffered commands into a single Uint8Array */
  build(): Uint8Array {
    let totalLength = 0;
    for (const buf of this.buffers) {
      totalLength += buf.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of this.buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  }
}

/**
 * Encode a string to bytes.
 * For codepage 0 (PC437/ASCII), uses simple charCodeAt (ASCII range).
 * For other codepages we still use ASCII — full codepage translation
 * tables would be added for i18n support.
 */
function encodeText(str: string, _codepage: CodepageId): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Map to ASCII range; replace unmappable chars with '?'
    bytes[i] = code <= 0xff ? code : 0x3f;
  }
  return bytes;
}

/**
 * Convenience: print a text-only receipt preview string from an ESCPOSBuilder.
 * Strips all binary ESC/POS commands and returns human-readable text.
 * Used for the ReceiptPreview component.
 */
export function buildReceiptPreviewText(
  buildFn: (builder: PreviewBuilder) => void
): string {
  const preview = new PreviewBuilder();
  buildFn(preview);
  return preview.getPreview();
}

/**
 * A lightweight builder that mirrors ESCPOSBuilder's text API
 * but outputs plain text for previewing.
 */
export class PreviewBuilder {
  private lines: string[] = [];
  private currentLine = '';
  private alignment: 'left' | 'center' | 'right' = 'left';
  private width = 42;

  initialize(): this {
    return this;
  }
  text(str: string): this {
    this.currentLine += str;
    return this;
  }
  textLine(str: string): this {
    this.text(str);
    return this.lineFeed();
  }
  bold(_on: boolean): this {
    return this;
  }
  underline(_on: boolean): this {
    return this;
  }
  align(a: 'left' | 'center' | 'right'): this {
    this.alignment = a;
    return this;
  }
  doubleHeight(_on: boolean): this {
    return this;
  }
  doubleWidth(_on: boolean): this {
    return this;
  }
  doubleSize(_on: boolean): this {
    return this;
  }
  fontSize(_size: number): this {
    return this;
  }
  fontA(): this {
    return this;
  }
  fontB(): this {
    return this;
  }
  lineFeed(n = 1): this {
    this.flushLine();
    for (let i = 1; i < n; i++) {
      this.lines.push('');
    }
    return this;
  }
  horizontalLine(char = '-', width = 42): this {
    return this.textLine(char.repeat(width));
  }
  tab(): this {
    this.currentLine += '    ';
    return this;
  }
  lineSpacing(_n?: number): this {
    return this;
  }
  cut(): this {
    return this.lineFeed(2);
  }
  partialCut(): this {
    return this.lineFeed(2);
  }
  cashDrawerKick(_pin?: 2 | 5, _duration?: number): this {
    return this;
  }
  qrCode(_data: string, _moduleSize?: number): this {
    this.textLine('[QR Code]');
    return this;
  }
  barcode(_type: BarcodeType, data: string): this {
    this.textLine(`[Barcode: ${data}]`);
    return this;
  }
  setCodepage(): this {
    return this;
  }
  raw(_bytes: Uint8Array | number[]): this {
    return this;
  }
  resetStyle(): this {
    this.alignment = 'left';
    return this;
  }
  twoColumns(left: string, right: string, width = 42): this {
    const gap = width - left.length - right.length;
    if (gap < 1) {
      const maxLeft = width - right.length - 1;
      return this.textLine(left.slice(0, maxLeft) + ' ' + right);
    }
    return this.textLine(left + ' '.repeat(gap) + right);
  }

  private flushLine(): void {
    let line = this.currentLine;
    if (this.alignment === 'center') {
      const pad = Math.max(0, Math.floor((this.width - line.length) / 2));
      line = ' '.repeat(pad) + line;
    } else if (this.alignment === 'right') {
      const pad = Math.max(0, this.width - line.length);
      line = ' '.repeat(pad) + line;
    }
    this.lines.push(line);
    this.currentLine = '';
  }

  getPreview(): string {
    if (this.currentLine) {
      this.flushLine();
    }
    return this.lines.join('\n');
  }
}
