/**
 * Sear POS — Back Office JavaScript
 *
 * Alpine.js component helpers, SortableJS initialization,
 * image upload with drag-and-drop, and form validation.
 * Loaded on all back-office pages (menu, staff, settings).
 */

const SearBackoffice = (() => {
  'use strict';

  // ----------------------------------------------------------------
  // SortableJS Initialization
  // ----------------------------------------------------------------

  /**
   * Initialize SortableJS on modifier options list inside the modifier group editor modal.
   */
  function initModifierSortable() {
    const el = document.getElementById('modifier-options-list');
    if (!el || el._sortableInit) return;

    if (typeof Sortable === 'undefined') {
      console.warn('SortableJS not loaded, drag-and-drop disabled for modifiers');
      return;
    }

    el._sortableInit = true;
    new Sortable(el, {
      handle: '.mod-drag-handle',
      animation: 150,
      ghostClass: 'opacity-50',
      onEnd(evt) {
        // Alpine manages the array, so we need to reorder it
        const component = Alpine.$data(el.closest('[x-data]'));
        if (component?.modifierModal?.form?.modifiers) {
          const mods = component.modifierModal.form.modifiers;
          const item = mods.splice(evt.oldIndex, 1)[0];
          mods.splice(evt.newIndex, 0, item);
        }
      },
    });
  }

  /**
   * Initialize SortableJS on menu tree item lists.
   * Called after menu data loads and tree renders.
   *
   * @param {Function} onReorder - Callback when items are reordered: (evt) => void
   */
  function initMenuTreeSortable(onReorder) {
    if (typeof Sortable === 'undefined') {
      console.warn('SortableJS not loaded, drag-and-drop disabled for menu tree');
      return;
    }

    document.querySelectorAll('.sortable-items').forEach(el => {
      if (el._sortable) el._sortable.destroy();
      el._sortable = new Sortable(el, {
        group: 'menu-items',
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'opacity-50',
        dragClass: 'shadow-lg',
        chosenClass: 'bg-primary-50',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onEnd: onReorder || (() => {}),
      });
    });

    document.querySelectorAll('.sortable-categories').forEach(el => {
      if (el._sortable) el._sortable.destroy();
      el._sortable = new Sortable(el, {
        group: 'menu-categories',
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'opacity-50',
        onEnd: onReorder || (() => {}),
      });
    });
  }

  // ----------------------------------------------------------------
  // Image Upload with Drag-and-Drop
  // ----------------------------------------------------------------

  /**
   * Handle file selection and return a data URL for preview.
   *
   * @param {File} file - Image file
   * @returns {Promise<string>} data URL
   */
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Not a valid image file'));
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image must be under 5MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload an image file to the server and return the URL.
   *
   * @param {File} file
   * @param {string} endpoint - Upload endpoint URL
   * @returns {Promise<string>} Server URL of the uploaded image
   */
  async function uploadImage(file, endpoint = '/api/v1/uploads/image') {
    const formData = new FormData();
    formData.append('image', file);

    const resp = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const json = await resp.json();
    if (json.status === 'success' && json.data?.url) {
      return json.data.url;
    }

    throw new Error(json.message || 'Upload failed');
  }

  // ----------------------------------------------------------------
  // Form Validation Helpers
  // ----------------------------------------------------------------

  /**
   * Validate a form field and return an error message or null.
   *
   * @param {*} value - Field value
   * @param {Object} rules - Validation rules
   * @returns {string|null} Error message or null if valid
   */
  function validateField(value, rules) {
    if (rules.required && (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0))) {
      return rules.label ? `${rules.label} is required` : 'This field is required';
    }

    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      return `Minimum ${rules.minLength} characters`;
    }

    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      return `Maximum ${rules.maxLength} characters`;
    }

    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      return `Minimum value is ${rules.min}`;
    }

    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      return `Maximum value is ${rules.max}`;
    }

    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return rules.patternMessage || 'Invalid format';
    }

    if (rules.money && typeof value === 'number') {
      if (!Number.isInteger(value) || value < 0) {
        return 'Must be a positive amount in cents';
      }
    }

    if (rules.pin && typeof value === 'string') {
      if (!/^\d{4,6}$/.test(value)) {
        return 'PIN must be 4-6 digits';
      }
    }

    if (rules.email && typeof value === 'string' && value.length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Invalid email address';
      }
    }

    if (rules.phone && typeof value === 'string' && value.length > 0) {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        return 'Phone number must be at least 10 digits';
      }
    }

    return null;
  }

  /**
   * Validate all fields in a form object.
   *
   * @param {Object} form - Form data
   * @param {Object} schema - Validation schema: { fieldName: { rules } }
   * @returns {{ valid: boolean, errors: Object }}
   */
  function validateForm(form, schema) {
    const errors = {};
    let valid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const error = validateField(form[field], rules);
      if (error) {
        errors[field] = error;
        valid = false;
      }
    }

    return { valid, errors };
  }

  // ----------------------------------------------------------------
  // Currency Input Helpers
  // ----------------------------------------------------------------

  /**
   * Convert a display dollar string to cents.
   * @param {string} display - e.g. "42.00"
   * @returns {number} cents
   */
  function dollarsToCents(display) {
    const num = parseFloat(display);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }

  /**
   * Convert cents to display dollar string.
   * @param {number} cents
   * @returns {string} e.g. "42.00"
   */
  function centsToDollars(cents) {
    return ((cents || 0) / 100).toFixed(2);
  }

  /**
   * Format cents as a full dollar display string with $ prefix.
   * @param {number} cents
   * @returns {string} e.g. "$42.00"
   */
  function formatMoney(cents) {
    return '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ----------------------------------------------------------------
  // Keyboard Shortcut Registration
  // ----------------------------------------------------------------

  /**
   * Register a keyboard shortcut handler.
   *
   * @param {string} key - Key combo (e.g. 'ctrl+s', 'escape')
   * @param {Function} handler
   */
  function onKeyboard(key, handler) {
    document.addEventListener('keydown', (e) => {
      const parts = key.toLowerCase().split('+');
      const mainKey = parts[parts.length - 1];
      const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt');

      if (mainKey === 'escape' && e.key === 'Escape') {
        handler(e);
        return;
      }

      if (e.key.toLowerCase() === mainKey) {
        if (needsCtrl && !(e.ctrlKey || e.metaKey)) return;
        if (needsShift && !e.shiftKey) return;
        if (needsAlt && !e.altKey) return;
        e.preventDefault();
        handler(e);
      }
    });
  }

  // ----------------------------------------------------------------
  // Debounce Utility
  // ----------------------------------------------------------------

  /**
   * Debounce a function.
   * @param {Function} fn
   * @param {number} delay - Milliseconds
   * @returns {Function}
   */
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ----------------------------------------------------------------
  // Confirmation Dialog
  // ----------------------------------------------------------------

  /**
   * Show a confirmation dialog using the modal store.
   *
   * @param {string} title
   * @param {string} message
   * @param {Object} options - { confirmText, cancelText, danger }
   * @returns {Promise<boolean>}
   */
  function confirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result);
    });
  }

  // ----------------------------------------------------------------
  // Initialize
  // ----------------------------------------------------------------

  function init() {
    // Register Ctrl+S / Cmd+S to trigger save on the closest form
    onKeyboard('ctrl+s', () => {
      const saveBtn = document.querySelector('[data-save-btn], .btn-primary');
      if (saveBtn) saveBtn.click();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API
  return {
    initModifierSortable,
    initMenuTreeSortable,
    readImageFile,
    uploadImage,
    validateField,
    validateForm,
    dollarsToCents,
    centsToDollars,
    formatMoney,
    onKeyboard,
    debounce,
    confirm,
  };
})();

// Export for ES module consumers
if (typeof window !== 'undefined') {
  window.SearBackoffice = SearBackoffice;
}
