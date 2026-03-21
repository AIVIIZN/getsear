/**
 * Reusable numpad Alpine.js component for Sear POS.
 * Used in cash payment, PIN entry, tip amounts.
 *
 * Usage:
 *   <div x-data="numpad()">
 *     <span x-text="displayValue"></span>
 *     ... numpad keys call press(), backspace(), clear()
 *   </div>
 *
 * All values stored as integers in cents.
 * displayValue formats as dollars (e.g., "0.00", "123.45").
 */

function numpad() {
  return {
    // Internal raw string of digits (no decimal point — cents)
    _raw: '',

    /**
     * Integer value in cents.
     */
    get intValue() {
      return parseInt(this._raw || '0', 10);
    },

    /**
     * Display value as dollar string (e.g., "1.50", "0.00").
     */
    get displayValue() {
      const cents = this.intValue;
      return (cents / 100).toFixed(2);
    },

    /**
     * Press a digit key ('0'-'9' or '00').
     */
    press(key) {
      // Limit to 8 digits (999,999.99 max)
      if (this._raw.length >= 8) return;

      if (key === '00') {
        if (this._raw.length >= 7) return;
        this._raw += '00';
      } else {
        this._raw += key;
      }

      // Strip leading zeros (but allow building up from empty)
      this._raw = this._raw.replace(/^0+/, '') || '';
    },

    /**
     * Remove last digit.
     */
    backspace() {
      this._raw = this._raw.slice(0, -1);
    },

    /**
     * Clear entire value.
     */
    clear() {
      this._raw = '';
    },

    /**
     * Set value from cents integer.
     */
    setValue(cents) {
      this._raw = String(Math.round(cents));
    },

    /**
     * Quick amounts for cash payments — computed from the balance due.
     * Returns array of { value (cents), label (string) }.
     */
    get quickAmounts() {
      return [
        { value: 2000, label: '$20' },
        { value: 5000, label: '$50' },
        { value: 10000, label: '$100' },
      ];
    }
  };
}

// Register as Alpine data when Alpine initializes
document.addEventListener('alpine:init', () => {
  Alpine.data('numpad', numpad);
});
