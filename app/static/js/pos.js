/**
 * Sear POS — Main POS JavaScript
 *
 * Alpine.js data components:
 *   - orderEntry()     — order panel, menu, item management
 *   - modifierModal()  — modifier selection & validation
 *   - paymentFlow()    — payment state machine
 *   - checkManager()   — check list, detail, split
 *
 * htmx event handlers, SSE connection, keyboard shortcuts.
 */

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Format cents integer to dollar string (e.g., 1234 → "$12.34").
 */
function formatMoney(cents) {
  if (cents == null) return '$0.00';
  const val = Number(cents);
  return '$' + (val / 100).toFixed(2);
}

/**
 * Generate a CSRF-safe headers object for htmx or fetch.
 */
function csrfHeaders() {
  const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
  return { 'X-CSRFToken': token };
}

/**
 * POST JSON to an endpoint, return parsed response.
 */
async function postJSON(url, data) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': token,
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}

/**
 * DELETE to an endpoint, return parsed response.
 */
async function deleteJSON(url, data) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': token,
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}

/**
 * PATCH to an endpoint, return parsed response.
 */
async function patchJSON(url, data) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': token,
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}


// ─────────────────────────────────────────────────────────────────
// 1. orderEntry() — Main POS Order Entry
// ─────────────────────────────────────────────────────────────────

function orderEntry() {
  return {
    // Order state
    orderId: null,
    orderNumber: null,
    orderType: 'dine_in',
    tableId: null,
    tableName: '',
    customerId: null,
    customerName: '',
    serverId: null,
    serverName: '',
    serverInitials: '',
    guestCount: 1,
    activeSeat: null,
    seatCount: 4,

    // Items
    items: [],
    hasUnsent: false,

    // Totals (all in cents)
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,

    // Menu
    categories: [],
    activeCategory: null,
    searchQuery: '',

    // UI state
    editItem: null,
    editPopoverStyle: '',
    showModifiers: false,
    showGuestModal: false,
    modifierItem: null,

    // Order type definitions
    orderTypes: [
      { value: 'dine_in', label: 'Dine-In', icon: '🍽' },
      { value: 'takeout', label: 'Takeout', icon: '📦' },
      { value: 'delivery', label: 'Delivery', icon: '🚗' },
      { value: 'bar', label: 'Bar', icon: '🍺' },
    ],

    get orderTypeLabel() {
      const t = this.orderTypes.find(t => t.value === this.orderType);
      return t ? t.label : 'Dine-In';
    },

    // SSE connection
    _sseSource: null,

    formatMoney,

    async init() {
      // Load initial data from page data attributes if available
      const el = document.querySelector('[data-order-id]');
      if (el) {
        this.orderId = el.dataset.orderId || null;
        this.orderNumber = el.dataset.orderNumber || null;
        this.orderType = el.dataset.orderType || 'dine_in';
        this.tableId = el.dataset.tableId || null;
        this.tableName = el.dataset.tableName || '';
        this.serverId = el.dataset.serverId || null;
        this.serverName = el.dataset.serverName || '';
        this.guestCount = parseInt(el.dataset.guestCount || '1', 10);
      }

      // Derive server initials
      if (this.serverName) {
        this.serverInitials = this.serverName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      }

      // Load categories
      await this.loadCategories();

      // Connect SSE for real-time updates
      this.connectSSE();

      // Listen for keyboard shortcuts
      document.addEventListener('keydown', this.handleKeydown.bind(this));
    },

    async loadCategories() {
      try {
        const resp = await fetch('/api/v1/menu/categories');
        if (resp.ok) {
          const data = await resp.json();
          this.categories = data.data || [];
          if (this.categories.length > 0 && !this.activeCategory) {
            this.activeCategory = this.categories[0].id;
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    },

    selectCategory(categoryId) {
      this.activeCategory = categoryId;
      this.searchQuery = '';
      // htmx handles the actual menu grid swap via hx-get on the category button
    },

    searchMenu() {
      // The search input has hx-get and hx-trigger set up in the template.
      // This method handles clearing/resetting category when searching.
      if (this.searchQuery.length > 0) {
        this.activeCategory = null;
      }
    },

    clearSearch() {
      // Re-select first category after clearing search
      if (this.categories.length > 0) {
        this.activeCategory = this.categories[0].id;
        // Trigger htmx reload of menu grid
        htmx.ajax('GET', '/api/v1/menu/items?category_id=' + this.activeCategory, '#menu-grid');
      }
    },

    setOrderType(type) {
      this.orderType = type;
      if (this.orderId) {
        patchJSON(`/api/v1/orders/${this.orderId}`, { order_type: type }).catch(err => {
          window.showToast('error', 'Failed to update order type');
        });
      }
    },

    showTablePicker() {
      // Navigate to table management / floor plan to pick a table
      window.location.href = '/tables?select=true&return=/pos';
    },

    showGuestPicker() {
      this.showGuestModal = true;
    },

    // Item edit popover
    openEditPopover(event, item) {
      this.editItem = { ...item };
      // Position popover near the tapped element
      const rect = event.currentTarget.getBoundingClientRect();
      const popoverWidth = 280;
      const popoverHeight = 500;

      let top = rect.top;
      let left = rect.right + 8;

      // If popover would overflow right, show on left side
      if (left + popoverWidth > window.innerWidth) {
        left = rect.left - popoverWidth - 8;
      }
      // If popover would overflow bottom, shift up
      if (top + popoverHeight > window.innerHeight) {
        top = window.innerHeight - popoverHeight - 16;
      }
      if (top < 0) top = 8;

      this.editPopoverStyle = `top: ${top}px; left: ${left}px;`;
    },

    async updateItemQuantity(item, newQty) {
      if (newQty < 1 || newQty > 99) return;
      item.quantity = newQty;
      try {
        await patchJSON(`/api/v1/orders/${this.orderId}/items/${item.id}`, { quantity: newQty });
        this.refreshOrderPanel();
      } catch (err) {
        window.showToast('error', 'Failed to update quantity');
      }
    },

    async assignSeat(item, seatNum) {
      item.seat = seatNum;
      try {
        await patchJSON(`/api/v1/orders/${this.orderId}/items/${item.id}`, { seat: seatNum });
        this.refreshOrderPanel();
      } catch (err) {
        window.showToast('error', 'Failed to assign seat');
      }
    },

    async saveSpecialInstructions(item) {
      try {
        await patchJSON(`/api/v1/orders/${this.orderId}/items/${item.id}`, {
          special_instructions: item.special_instructions,
        });
      } catch (err) {
        window.showToast('error', 'Failed to save instructions');
      }
    },

    async repeatItem(item) {
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/items`, {
          menu_item_id: item.menu_item_id,
          quantity: 1,
          modifiers: item.modifier_ids || [],
          special_instructions: item.special_instructions || '',
        });
        this.editItem = null;
        this.refreshOrderPanel();
        window.showToast('success', 'Item repeated');
      } catch (err) {
        window.showToast('error', 'Failed to repeat item');
      }
    },

    async voidItem(item) {
      // Void may require manager PIN
      const reason = prompt('Void reason:');
      if (!reason) return;

      try {
        await postJSON(`/api/v1/orders/${this.orderId}/items/${item.id}/void`, {
          reason,
        });
        this.editItem = null;
        this.refreshOrderPanel();
        window.showToast('success', 'Item voided');
      } catch (err) {
        if (err.message.includes('manager')) {
          const pin = prompt('Manager PIN required:');
          if (!pin) return;
          try {
            await postJSON(`/api/v1/orders/${this.orderId}/items/${item.id}/void`, {
              reason,
              manager_pin: pin,
            });
            this.editItem = null;
            this.refreshOrderPanel();
            window.showToast('success', 'Item voided');
          } catch (e2) {
            window.showToast('error', e2.message);
          }
        } else {
          window.showToast('error', err.message);
        }
      }
    },

    async removeItem(item) {
      try {
        await deleteJSON(`/api/v1/orders/${this.orderId}/items/${item.id}`, {});
        this.editItem = null;
        this.refreshOrderPanel();
        window.showToast('success', 'Item removed');
      } catch (err) {
        window.showToast('error', 'Failed to remove item');
      }
    },

    openModifiers(menuItem) {
      this.modifierItem = menuItem;
      this.showModifiers = true;
    },

    openModifiersForEdit(orderItem) {
      this.modifierItem = {
        ...orderItem,
        _isEdit: true,
        _orderItemId: orderItem.id,
      };
      this.editItem = null;
      this.showModifiers = true;
    },

    animateAdd(event) {
      const btn = event.currentTarget;
      btn.classList.add('scale-95', 'bg-emerald-50');
      setTimeout(() => {
        btn.classList.remove('scale-95', 'bg-emerald-50');
      }, 200);
    },

    // Order actions
    async sendToKitchen() {
      if (!this.orderId || this.items.length === 0) return;
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/send`, {});
        this.refreshOrderPanel();
        window.showToast('success', 'Order sent to kitchen');
      } catch (err) {
        window.showToast('error', err.message || 'Failed to send order');
      }
    },

    async holdOrder() {
      if (!this.orderId) return;
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/hold`, {});
        window.showToast('info', 'Order on hold');
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async fireCourse() {
      if (!this.orderId) return;
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/fire-course`, {});
        window.showToast('success', 'Course fired');
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async rushOrder() {
      if (!this.orderId) return;
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/rush`, {});
        window.showToast('warning', 'Order marked RUSH');
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    showDiscount() {
      // Open discount modal (managed by global Alpine store)
      const amount = prompt('Discount percentage (e.g., 10 for 10%):');
      if (!amount) return;
      const pct = parseFloat(amount);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        window.showToast('error', 'Invalid discount percentage');
        return;
      }
      postJSON(`/api/v1/orders/${this.orderId}/discount`, {
        discount_type: 'percentage',
        discount_value: pct,
      }).then(() => {
        this.refreshOrderPanel();
        window.showToast('success', `${pct}% discount applied`);
      }).catch(err => {
        window.showToast('error', err.message);
      });
    },

    async printCheck() {
      if (!this.orderId) return;
      try {
        await postJSON(`/api/v1/orders/${this.orderId}/print`, {});
        window.showToast('success', 'Check sent to printer');
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    voidOrder() {
      const pin = prompt('Manager PIN required to void order:');
      if (!pin) return;
      const reason = prompt('Void reason:');
      if (!reason) return;

      postJSON(`/api/v1/orders/${this.orderId}/void`, {
        reason,
        manager_pin: pin,
      }).then(() => {
        window.showToast('success', 'Order voided');
        window.location.href = '/pos';
      }).catch(err => {
        window.showToast('error', err.message);
      });
    },

    refreshOrderPanel() {
      if (!this.orderId) return;
      const seatParam = this.activeSeat ? `?seat=${this.activeSeat}` : '';
      htmx.ajax('GET', `/api/v1/orders/${this.orderId}/panel${seatParam}`, '#order-panel');
    },

    // SSE connection for real-time order updates
    connectSSE() {
      if (this._sseSource) {
        this._sseSource.close();
      }

      try {
        this._sseSource = new EventSource('/api/v1/events/orders');

        this._sseSource.addEventListener('order.new', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.order_id === this.orderId) {
              this.refreshOrderPanel();
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        });

        this._sseSource.addEventListener('order.updated', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.order_id === this.orderId) {
              this.refreshOrderPanel();
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        });

        this._sseSource.addEventListener('item.86d', (event) => {
          try {
            const data = JSON.parse(event.data);
            window.showToast('warning', `${data.item_name} has been 86'd`);
            // Refresh menu grid to show 86'd items
            if (this.activeCategory) {
              htmx.ajax('GET', '/api/v1/menu/items?category_id=' + this.activeCategory, '#menu-grid');
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        });

        this._sseSource.onerror = () => {
          // Reconnect after 5 seconds
          setTimeout(() => this.connectSSE(), 5000);
        };
      } catch (err) {
        console.error('SSE connection failed:', err);
      }
    },

    // Keyboard shortcuts
    handleKeydown(event) {
      // Don't capture when typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

      // Number keys 1-9 for quick quantity on last item
      if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.metaKey) {
        const lastItem = this.items[this.items.length - 1];
        if (lastItem && !lastItem.sent_at) {
          this.updateItemQuantity(lastItem, parseInt(event.key, 10));
          event.preventDefault();
        }
      }

      // Enter to send order
      if (event.key === 'Enter' && !event.shiftKey) {
        this.sendToKitchen();
        event.preventDefault();
      }

      // Escape to close popovers/modals
      if (event.key === 'Escape') {
        this.editItem = null;
        this.showModifiers = false;
        this.showGuestModal = false;
      }
    },

    // Cleanup
    destroy() {
      if (this._sseSource) {
        this._sseSource.close();
        this._sseSource = null;
      }
      document.removeEventListener('keydown', this.handleKeydown);
    },
  };
}


// ─────────────────────────────────────────────────────────────────
// 2. modifierModal() — Modifier Selection & Validation
// ─────────────────────────────────────────────────────────────────

function modifierModal() {
  return {
    itemId: null,
    itemName: '',
    basePrice: 0,    // cents
    quantity: 1,
    specialInstructions: '',
    modifierGroups: [],
    selections: {},   // { groupId: [modifierId, ...] }
    isEditMode: false,
    _orderItemId: null,

    get allRequiredMet() {
      for (const group of this.modifierGroups) {
        if (group.is_required) {
          const selected = this.selections[group.id] || [];
          if (group.selection_type === 'exactly_one' && selected.length !== 1) return false;
          if (group.min_selections && selected.length < group.min_selections) return false;
        }
      }
      return true;
    },

    get runningTotal() {
      let total = this.basePrice;
      for (const group of this.modifierGroups) {
        const selected = this.selections[group.id] || [];
        for (const modId of selected) {
          const mod = group.modifiers.find(m => m.id === modId);
          if (mod) {
            total += mod.price_adjustment || 0;
          }
        }
      }
      return (total * this.quantity) / 100;
    },

    initFromParent() {
      // Called when the modifier panel opens — reads modifierItem from parent scope
      const parent = this.$data?.$parent || Alpine.store('pos') || {};
      const item = parent.modifierItem || window._modifierItem;
      if (!item) return;

      this.itemId = item.id;
      this.itemName = item.name;
      this.basePrice = item.price || 0;
      this.quantity = item.quantity || 1;
      this.specialInstructions = item.special_instructions || '';
      this.isEditMode = !!item._isEdit;
      this._orderItemId = item._orderItemId || null;

      // Load modifier groups from the item or fetch from API
      if (item.modifier_groups) {
        this.modifierGroups = item.modifier_groups;
        this._initSelectionsFromExisting(item);
      } else {
        this.loadModifierGroups(item.id || item.menu_item_id);
      }
    },

    _initSelectionsFromExisting(item) {
      // If editing, pre-select existing modifiers
      this.selections = {};
      for (const group of this.modifierGroups) {
        this.selections[group.id] = [];
      }

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          // Find which group this modifier belongs to
          for (const group of this.modifierGroups) {
            const found = group.modifiers.find(m => m.id === mod.id || m.id === mod.modifier_id);
            if (found) {
              if (!this.selections[group.id]) this.selections[group.id] = [];
              this.selections[group.id].push(found.id);
              break;
            }
          }
        }
      }
    },

    async loadModifierGroups(menuItemId) {
      try {
        const resp = await fetch(`/api/v1/menu/items/${menuItemId}/modifiers`);
        if (resp.ok) {
          const data = await resp.json();
          this.modifierGroups = data.data || [];
          // Init empty selections
          this.selections = {};
          for (const group of this.modifierGroups) {
            this.selections[group.id] = [];
          }
        }
      } catch (err) {
        console.error('Failed to load modifiers:', err);
        window.showToast('error', 'Failed to load modifiers');
      }
    },

    toggleModifier(group, mod) {
      if (!this.selections[group.id]) {
        this.selections[group.id] = [];
      }

      const idx = this.selections[group.id].indexOf(mod.id);

      if (group.selection_type === 'exactly_one') {
        // Radio behavior — selecting one deselects all others
        this.selections[group.id] = [mod.id];
      } else {
        // Checkbox behavior
        if (idx >= 0) {
          // Deselect
          this.selections[group.id].splice(idx, 1);
        } else {
          // Select (if not at max)
          if (!this.isMaxed(group)) {
            this.selections[group.id].push(mod.id);
          }
        }
      }
    },

    isSelected(group, mod) {
      return (this.selections[group.id] || []).includes(mod.id);
    },

    isGroupComplete(group) {
      const count = (this.selections[group.id] || []).length;
      if (group.selection_type === 'exactly_one') return count === 1;
      if (group.min_selections) return count >= group.min_selections;
      return count > 0;
    },

    isMaxed(group) {
      if (group.selection_type === 'exactly_one') return (this.selections[group.id] || []).length >= 1;
      return group.max_selections && (this.selections[group.id] || []).length >= group.max_selections;
    },

    selectedCount(group) {
      return (this.selections[group.id] || []).length;
    },

    cancel() {
      // Close modifier panel — dispatch to parent
      this.$dispatch('close-modifiers');
      // Also try direct parent manipulation
      const parent = this._getParentData();
      if (parent) {
        parent.showModifiers = false;
        parent.modifierItem = null;
      }
    },

    done() {
      if (!this.allRequiredMet) return;
      this.addToOrder();
    },

    async addToOrder() {
      if (!this.allRequiredMet) return;

      // Collect selected modifier IDs
      const modifierIds = [];
      for (const groupId of Object.keys(this.selections)) {
        modifierIds.push(...this.selections[groupId]);
      }

      const parent = this._getParentData();
      const orderId = parent?.orderId;

      if (!orderId) {
        window.showToast('error', 'No active order');
        return;
      }

      try {
        if (this.isEditMode && this._orderItemId) {
          // Update existing order item
          await patchJSON(`/api/v1/orders/${orderId}/items/${this._orderItemId}`, {
            quantity: this.quantity,
            modifier_ids: modifierIds,
            special_instructions: this.specialInstructions,
          });
          window.showToast('success', 'Item updated');
        } else {
          // Add new item
          await postJSON(`/api/v1/orders/${orderId}/items`, {
            menu_item_id: this.itemId,
            quantity: this.quantity,
            modifier_ids: modifierIds,
            special_instructions: this.specialInstructions,
          });
          window.showToast('success', `${this.itemName} added`);
        }

        // Close and refresh
        if (parent) {
          parent.showModifiers = false;
          parent.modifierItem = null;
          parent.refreshOrderPanel();
        }
      } catch (err) {
        window.showToast('error', err.message || 'Failed to add item');
      }
    },

    _getParentData() {
      // Walk up the DOM to find the orderEntry Alpine component
      let el = this.$el;
      while (el && el.parentElement) {
        el = el.parentElement;
        if (el._x_dataStack) {
          const data = el._x_dataStack.find(d => d.orderId !== undefined);
          if (data) return data;
        }
      }
      return null;
    },
  };
}


// ─────────────────────────────────────────────────────────────────
// 3. paymentFlow() — Payment State Machine
// ─────────────────────────────────────────────────────────────────

function paymentFlow() {
  return {
    // States: method_select, card_waiting, processing, approved, tip_prompt,
    //         receipt_prompt, cash_entry, cash_change, gift_card, done
    state: 'method_select',

    // Order / check data
    orderId: null,
    tableName: '',
    items: [],
    subtotal: 0,       // cents
    discountAmount: 0,  // cents
    taxAmount: 0,       // cents
    totalAmount: 0,     // cents
    balanceDue: 0,      // cents

    // Split
    splitCount: 1,
    currentSplitIndex: 1,

    // Card
    paymentMethod: null,

    // Tip
    selectedTipPct: null,
    customTipAmount: 0,   // cents
    tipAmount: 0,          // cents
    showCustomTipInput: false,

    // Receipt
    receiptInputType: null,  // 'email' or 'sms' or null
    receiptContact: '',

    // Cash
    changeDue: 0,  // cents

    // Gift card
    giftCardNumber: '',
    giftCardBalance: null,  // cents or null

    // Payment record
    paymentId: null,

    formatMoney,

    async init() {
      // Load order data from page data attributes
      const el = document.querySelector('[data-order-id]');
      if (el) {
        this.orderId = el.dataset.orderId;
        this.tableName = el.dataset.tableName || '';
      }
      await this.loadCheckData();
    },

    async loadCheckData() {
      if (!this.orderId) return;
      try {
        const resp = await fetch(`/api/v1/orders/${this.orderId}`);
        if (resp.ok) {
          const data = await resp.json();
          const order = data.data;
          this.items = order.items || [];
          this.subtotal = order.subtotal || 0;
          this.discountAmount = order.discount || 0;
          this.taxAmount = order.tax || 0;
          this.totalAmount = order.total || 0;
          this.balanceDue = order.balance_due || order.total || 0;
          this.tableName = order.table_name || this.tableName;
        }
      } catch (err) {
        console.error('Failed to load check:', err);
        window.showToast('error', 'Failed to load check data');
      }
    },

    selectMethod(method) {
      this.paymentMethod = method;

      switch (method) {
        case 'card':
          this.state = 'card_waiting';
          this.initiateCardPayment();
          break;
        case 'cash':
          this.state = 'cash_entry';
          break;
        case 'gift_card':
          this.state = 'gift_card';
          break;
        case 'house_account':
          this.processHouseAccount();
          break;
      }
    },

    cancelPayment() {
      this.state = 'method_select';
      this.paymentMethod = null;
      this.giftCardNumber = '';
      this.giftCardBalance = null;
    },

    // ── Card payment ──────────────────────────────────

    async initiateCardPayment() {
      try {
        const result = await postJSON(`/api/v1/orders/${this.orderId}/payments/card`, {
          amount: this.balanceDue,
        });

        // Start polling for terminal response
        this.pollCardResult(result.data?.transaction_id);
      } catch (err) {
        window.showToast('error', err.message || 'Failed to initiate card payment');
        this.state = 'method_select';
      }
    },

    async pollCardResult(transactionId) {
      if (!transactionId) {
        // Simulate for development
        setTimeout(() => {
          this.state = 'processing';
          setTimeout(() => {
            this.state = 'approved';
            setTimeout(() => {
              this.state = 'tip_prompt';
            }, 1500);
          }, 2000);
        }, 3000);
        return;
      }

      const maxAttempts = 60; // 60 seconds timeout
      let attempts = 0;

      const check = async () => {
        try {
          const resp = await fetch(`/api/v1/payments/${transactionId}/status`);
          if (resp.ok) {
            const data = await resp.json();
            const status = data.data?.status;

            if (status === 'processing') {
              this.state = 'processing';
            } else if (status === 'approved') {
              this.paymentId = transactionId;
              this.state = 'approved';
              setTimeout(() => {
                this.state = 'tip_prompt';
              }, 1500);
              return;
            } else if (status === 'declined' || status === 'error') {
              window.showToast('error', data.data?.message || 'Payment declined');
              this.state = 'method_select';
              return;
            }
          }
        } catch (err) {
          console.error('Poll error:', err);
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(check, 1000);
        } else {
          window.showToast('error', 'Payment timed out');
          this.state = 'method_select';
        }
      };

      check();
    },

    // ── Tip ───────────────────────────────────────────

    selectTip(pct) {
      this.selectedTipPct = pct;
      this.customTipAmount = 0;
      this.showCustomTipInput = false;
      this.tipAmount = Math.round(this.subtotal * pct / 100);
    },

    showCustomTip() {
      this.showCustomTipInput = true;
      this.selectedTipPct = null;

      // Listen for custom tip confirmation
      this.$el.addEventListener('custom-tip-confirm', (e) => {
        this.customTipAmount = e.detail.amount;
        this.tipAmount = e.detail.amount;
        this.showCustomTipInput = false;
      }, { once: true });
    },

    async confirmTip() {
      if (this.selectedTipPct === null && !this.customTipAmount) {
        this.tipAmount = 0;
      }

      try {
        if (this.paymentId) {
          await postJSON(`/api/v1/payments/${this.paymentId}/tip`, {
            tip_amount: this.tipAmount,
          });
        }
        this.state = 'receipt_prompt';
      } catch (err) {
        window.showToast('error', 'Failed to add tip');
        this.state = 'receipt_prompt'; // Move on anyway
      }
    },

    // ── Receipt ───────────────────────────────────────

    showEmailInput() {
      this.receiptInputType = 'email';
    },

    showSmsInput() {
      this.receiptInputType = 'sms';
    },

    async sendReceipt(method) {
      if ((method === 'email' || method === 'sms') && !this.receiptContact) {
        window.showToast('error', 'Please enter contact info');
        return;
      }

      try {
        await postJSON(`/api/v1/orders/${this.orderId}/receipt`, {
          method,
          contact: this.receiptContact,
        });
        if (method === 'print') {
          window.showToast('success', 'Receipt printing');
        } else if (method !== 'none') {
          window.showToast('success', 'Receipt sent');
        }
      } catch (err) {
        window.showToast('error', 'Failed to send receipt');
      }

      this.finishPayment();
    },

    finishPayment() {
      this.state = 'done';
      // Auto-return to POS after 2 seconds
      setTimeout(() => {
        window.location.href = '/pos';
      }, 2000);
    },

    // ── Cash payment ──────────────────────────────────

    async tenderCash(amountCents) {
      if (amountCents < this.balanceDue) {
        window.showToast('error', 'Insufficient amount');
        return;
      }

      this.changeDue = amountCents - this.balanceDue;
      this.state = 'processing';

      try {
        const result = await postJSON(`/api/v1/orders/${this.orderId}/payments/cash`, {
          amount_tendered: amountCents,
          change_due: this.changeDue,
        });
        this.paymentId = result.data?.payment_id;
        this.state = 'cash_change';
      } catch (err) {
        window.showToast('error', err.message || 'Failed to process cash payment');
        this.state = 'cash_entry';
      }
    },

    // ── Gift card ─────────────────────────────────────

    async lookupGiftCard() {
      if (!this.giftCardNumber) return;

      try {
        const resp = await fetch(`/api/v1/gift-cards/${encodeURIComponent(this.giftCardNumber)}/balance`);
        if (resp.ok) {
          const data = await resp.json();
          this.giftCardBalance = data.data?.balance || 0;
        } else {
          window.showToast('error', 'Gift card not found');
          this.giftCardBalance = null;
        }
      } catch (err) {
        window.showToast('error', 'Failed to look up gift card');
      }
    },

    async applyGiftCard() {
      const applyAmount = Math.min(this.giftCardBalance, this.balanceDue);

      try {
        const result = await postJSON(`/api/v1/orders/${this.orderId}/payments/gift-card`, {
          card_number: this.giftCardNumber,
          amount: applyAmount,
        });

        this.balanceDue -= applyAmount;
        this.paymentId = result.data?.payment_id;

        if (this.balanceDue <= 0) {
          // Fully paid
          this.state = 'receipt_prompt';
        } else {
          // Partial — go back to method select for remaining
          window.showToast('info', `${formatMoney(applyAmount)} applied. ${formatMoney(this.balanceDue)} remaining.`);
          this.giftCardNumber = '';
          this.giftCardBalance = null;
          this.state = 'method_select';
        }
      } catch (err) {
        window.showToast('error', err.message || 'Failed to apply gift card');
      }
    },

    // ── House account ─────────────────────────────────

    async processHouseAccount() {
      this.state = 'processing';
      try {
        const result = await postJSON(`/api/v1/orders/${this.orderId}/payments/house-account`, {
          amount: this.balanceDue,
        });
        this.paymentId = result.data?.payment_id;
        this.state = 'receipt_prompt';
      } catch (err) {
        window.showToast('error', err.message || 'House account not available');
        this.state = 'method_select';
      }
    },

    // ── Split payments ────────────────────────────────

    splitEqual() {
      const count = prompt('Split into how many checks?');
      if (!count) return;
      const n = parseInt(count, 10);
      if (isNaN(n) || n < 2 || n > 20) {
        window.showToast('error', 'Enter a number between 2 and 20');
        return;
      }

      postJSON(`/api/v1/orders/${this.orderId}/split`, {
        method: 'equal',
        count: n,
      }).then(result => {
        this.splitCount = n;
        this.currentSplitIndex = 1;
        this.balanceDue = Math.ceil(this.totalAmount / n);
        window.showToast('success', `Split into ${n} equal checks`);
      }).catch(err => {
        window.showToast('error', err.message);
      });
    },

    splitByItem() {
      // Navigate to check management with split mode
      window.location.href = `/checks?order=${this.orderId}&split=by_item`;
    },

    splitCustom() {
      window.location.href = `/checks?order=${this.orderId}&split=custom`;
    },
  };
}


// ─────────────────────────────────────────────────────────────────
// 4. checkManager() — Check Management & Split
// ─────────────────────────────────────────────────────────────────

function checkManager() {
  return {
    // Check list
    checks: [],
    filteredChecks: [],
    searchQuery: '',
    activeTab: 'open',
    tabs: [
      { id: 'open', label: 'Open Checks', count: 0 },
      { id: 'by_server', label: 'By Server', count: 0 },
      { id: 'by_type', label: 'By Type', count: 0 },
    ],

    // Selected check detail
    selectedCheck: null,
    detailSeatFilter: null,

    // Split modal
    showSplitModal: false,
    activeSplitMethod: 'by_seat',
    splitMethods: [
      { id: 'by_seat', label: 'By Seat' },
      { id: 'equal', label: 'Equal Split' },
      { id: 'custom', label: 'Custom' },
    ],
    splitChecks: [],

    // Drag state
    _dragItem: null,
    _dragFromIdx: null,

    formatMoney,

    async init() {
      await this.loadChecks();
    },

    async loadChecks() {
      try {
        const resp = await fetch('/api/v1/orders?status=open,fired,ready,served');
        if (resp.ok) {
          const data = await resp.json();
          this.checks = (data.data || []).map(order => ({
            id: order.id,
            display_number: order.display_number,
            table_name: order.table_name || (order.order_type === 'takeout' ? `TO #${order.display_number}` : ''),
            order_type: order.order_type,
            order_type_label: this._orderTypeLabel(order.order_type),
            server_name: order.server_name || 'Unassigned',
            guest_count: order.guest_count || 1,
            seat_count: order.guest_count || 1,
            elapsed_time: this._elapsedTime(order.opened_at),
            items: order.items || [],
            subtotal: order.subtotal || 0,
            discount: order.discount || 0,
            discount_label: order.discount_label || 'Discount',
            tax: order.tax || 0,
            total: order.total || 0,
          }));
          this.tabs[0].count = this.checks.length;
          this.filterChecks();
        }
      } catch (err) {
        console.error('Failed to load checks:', err);
        window.showToast('error', 'Failed to load checks');
      }
    },

    filterChecks() {
      let results = [...this.checks];

      // Filter by tab
      if (this.activeTab === 'by_server') {
        results.sort((a, b) => a.server_name.localeCompare(b.server_name));
      } else if (this.activeTab === 'by_type') {
        results.sort((a, b) => a.order_type.localeCompare(b.order_type));
      }

      // Filter by search
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        results = results.filter(c =>
          c.table_name.toLowerCase().includes(q) ||
          c.server_name.toLowerCase().includes(q) ||
          String(c.display_number).includes(q)
        );
      }

      this.filteredChecks = results;
    },

    selectCheck(check) {
      this.selectedCheck = check;
      this.detailSeatFilter = null;
    },

    get detailSeats() {
      if (!this.selectedCheck) return [];
      const items = this.selectedCheck.items || [];
      const seatMap = {};

      for (const item of items) {
        const seatNum = item.seat || 1;
        if (this.detailSeatFilter && seatNum !== this.detailSeatFilter) continue;
        if (!seatMap[seatNum]) {
          seatMap[seatNum] = { number: seatNum, items: [] };
        }
        seatMap[seatNum].items.push(item);
      }

      return Object.values(seatMap).sort((a, b) => a.number - b.number);
    },

    // ── Actions ──────────────────────────────────────

    addItems() {
      if (!this.selectedCheck) return;
      window.location.href = `/pos?order=${this.selectedCheck.id}`;
    },

    payNow() {
      if (!this.selectedCheck) return;
      window.location.href = `/pos/payment?order=${this.selectedCheck.id}`;
    },

    async applyDiscount() {
      if (!this.selectedCheck) return;
      const amount = prompt('Discount percentage (e.g., 10 for 10%):');
      if (!amount) return;
      const pct = parseFloat(amount);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        window.showToast('error', 'Invalid percentage');
        return;
      }
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/discount`, {
          discount_type: 'percentage',
          discount_value: pct,
        });
        window.showToast('success', `${pct}% discount applied`);
        await this.loadChecks();
        this.selectedCheck = this.checks.find(c => c.id === this.selectedCheck.id) || null;
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async transferCheck() {
      if (!this.selectedCheck) return;
      const target = prompt('Transfer to server (name or ID):');
      if (!target) return;
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/transfer`, { server: target });
        window.showToast('success', 'Check transferred');
        await this.loadChecks();
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async voidCheck() {
      if (!this.selectedCheck) return;
      const pin = prompt('Manager PIN required:');
      if (!pin) return;
      const reason = prompt('Void reason:');
      if (!reason) return;
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/void`, { manager_pin: pin, reason });
        window.showToast('success', 'Check voided');
        this.selectedCheck = null;
        await this.loadChecks();
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async compCheck() {
      if (!this.selectedCheck) return;
      const pin = prompt('Manager PIN required:');
      if (!pin) return;
      const reason = prompt('Comp reason:');
      if (!reason) return;
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/comp`, { manager_pin: pin, reason });
        window.showToast('success', 'Check comped');
        await this.loadChecks();
        this.selectedCheck = this.checks.find(c => c.id === this.selectedCheck.id) || null;
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async addGratuity() {
      if (!this.selectedCheck) return;
      const amount = prompt('Gratuity amount (e.g., 15.00):');
      if (!amount) return;
      const cents = Math.round(parseFloat(amount) * 100);
      if (isNaN(cents) || cents <= 0) {
        window.showToast('error', 'Invalid amount');
        return;
      }
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/gratuity`, { amount: cents });
        window.showToast('success', 'Gratuity added');
        await this.loadChecks();
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async reprintCheck() {
      if (!this.selectedCheck) return;
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/print`, {});
        window.showToast('success', 'Check sent to printer');
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    async reopenCheck() {
      if (!this.selectedCheck) return;
      const pin = prompt('Manager PIN required:');
      if (!pin) return;
      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/reopen`, { manager_pin: pin });
        window.showToast('success', 'Check reopened');
        await this.loadChecks();
      } catch (err) {
        window.showToast('error', err.message);
      }
    },

    // ── Split Check ──────────────────────────────────

    openSplitCheck() {
      if (!this.selectedCheck) return;
      this.showSplitModal = true;
      this.activeSplitMethod = 'by_seat';
      this.initSplitBySeat();
    },

    selectSplitMethod(method) {
      this.activeSplitMethod = method;
      switch (method) {
        case 'by_seat':
          this.initSplitBySeat();
          break;
        case 'equal':
          this.initSplitEqual();
          break;
        case 'custom':
          this.initSplitCustom();
          break;
      }
    },

    initSplitBySeat() {
      const items = this.selectedCheck?.items || [];
      const seatMap = {};

      for (const item of items) {
        const seat = item.seat || 1;
        if (!seatMap[seat]) {
          seatMap[seat] = { seat_label: `Seat ${seat}`, items: [], total: 0 };
        }
        seatMap[seat].items.push({ ...item });
        seatMap[seat].total += item.total_price || 0;
      }

      this.splitChecks = Object.values(seatMap);
    },

    initSplitEqual() {
      const items = this.selectedCheck?.items || [];
      const total = this.selectedCheck?.total || 0;
      const count = this.selectedCheck?.seat_count || 2;

      this.splitChecks = [];
      for (let i = 0; i < count; i++) {
        this.splitChecks.push({
          seat_label: `Equal share`,
          items: i === 0 ? items.map(it => ({ ...it })) : [],
          total: Math.ceil(total / count),
        });
      }
    },

    initSplitCustom() {
      const items = this.selectedCheck?.items || [];

      this.splitChecks = [
        {
          seat_label: 'Check A',
          items: items.map(it => ({ ...it })),
          total: this.selectedCheck?.total || 0,
        },
      ];
    },

    addSplitCheck() {
      this.splitChecks.push({
        seat_label: `Check ${String.fromCharCode(65 + this.splitChecks.length)}`,
        items: [],
        total: 0,
      });
    },

    // Drag and drop for custom split
    onDragStart(event, item, fromIdx) {
      this._dragItem = item;
      this._dragFromIdx = fromIdx;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
      event.currentTarget.classList.add('opacity-50');
    },

    onDragEnd(event) {
      event.currentTarget.classList.remove('opacity-50');
      this._dragItem = null;
      this._dragFromIdx = null;
    },

    onDragOver(event, toIdx) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },

    onDrop(event, toIdx) {
      event.preventDefault();
      if (this._dragItem && this._dragFromIdx !== null && this._dragFromIdx !== toIdx) {
        // Remove from source
        const srcItems = this.splitChecks[this._dragFromIdx].items;
        const idx = srcItems.findIndex(i => i.id === this._dragItem.id);
        if (idx >= 0) {
          const [moved] = srcItems.splice(idx, 1);
          // Add to destination
          this.splitChecks[toIdx].items.push(moved);
          // Recalc totals
          this._recalcSplitTotals();
        }
      }
    },

    _recalcSplitTotals() {
      for (const check of this.splitChecks) {
        check.total = check.items.reduce((sum, it) => sum + (it.total_price || 0), 0);
      }
    },

    async confirmSplit() {
      const splits = this.splitChecks.map((check, idx) => ({
        label: check.seat_label,
        item_ids: check.items.map(it => it.id),
      }));

      try {
        await postJSON(`/api/v1/orders/${this.selectedCheck.id}/split`, {
          method: this.activeSplitMethod,
          splits,
        });
        this.showSplitModal = false;
        window.showToast('success', 'Check split');
        // Navigate to payment for the first split
        window.location.href = `/pos/payment?order=${this.selectedCheck.id}`;
      } catch (err) {
        window.showToast('error', err.message || 'Failed to split check');
      }
    },

    // ── Helpers ───────────────────────────────────────

    _orderTypeLabel(type) {
      const labels = {
        dine_in: 'Dine-In',
        takeout: 'Takeout',
        delivery: 'Delivery',
        bar: 'Bar',
        catering: 'Catering',
      };
      return labels[type] || type;
    },

    _elapsedTime(openedAt) {
      if (!openedAt) return '';
      const opened = new Date(openedAt);
      const now = new Date();
      const diffMs = now - opened;
      const minutes = Math.floor(diffMs / 60000);

      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const remaining = minutes % 60;
      return `${hours}h ${remaining}m`;
    },
  };
}


// ─────────────────────────────────────────────────────────────────
// htmx Event Handlers
// ─────────────────────────────────────────────────────────────────

document.addEventListener('htmx:afterSwap', function (event) {
  const target = event.detail.target;

  // After order panel swap, update Alpine state
  if (target.id === 'order-panel') {
    // Scroll to bottom to show newly added items
    target.scrollTop = target.scrollHeight;

    // Extract totals from data attributes on the panel wrapper (set by server)
    const wrapper = target.querySelector('[data-order-totals]');
    if (wrapper) {
      const alpine = Alpine.$data(target.closest('[x-data]'));
      if (alpine) {
        alpine.subtotal = parseInt(wrapper.dataset.subtotal || '0', 10);
        alpine.discount = parseInt(wrapper.dataset.discount || '0', 10);
        alpine.tax = parseInt(wrapper.dataset.tax || '0', 10);
        alpine.total = parseInt(wrapper.dataset.total || '0', 10);
        alpine.items = JSON.parse(wrapper.dataset.items || '[]');
        alpine.hasUnsent = wrapper.dataset.hasUnsent === 'true';
      }
    }
  }

  // After menu grid swap, restore scroll position
  if (target.id === 'menu-grid') {
    target.scrollTop = 0;
  }
});

document.addEventListener('htmx:sendError', function (event) {
  window.showToast('error', 'Network error. Check your connection.');
});

document.addEventListener('htmx:responseError', function (event) {
  const status = event.detail.xhr?.status;
  if (status === 401) {
    window.showToast('error', 'Session expired. Please log in again.');
    setTimeout(() => { window.location.href = '/login'; }, 2000);
  } else if (status === 403) {
    window.showToast('error', 'Permission denied');
  } else if (status >= 500) {
    window.showToast('error', 'Server error. Try again.');
  }
});


// ─────────────────────────────────────────────────────────────────
// Register Alpine.js components
// ─────────────────────────────────────────────────────────────────

if (typeof Alpine !== 'undefined') {
  Alpine.data('orderEntry', orderEntry);
  Alpine.data('modifierModal', modifierModal);
  Alpine.data('paymentFlow', paymentFlow);
  Alpine.data('checkManager', checkManager);
} else {
  // If Alpine hasn't loaded yet, wait for it
  document.addEventListener('alpine:init', () => {
    Alpine.data('orderEntry', orderEntry);
    Alpine.data('modifierModal', modifierModal);
    Alpine.data('paymentFlow', paymentFlow);
    Alpine.data('checkManager', checkManager);
  });
}

// Also expose on window for non-Alpine usage
window.orderEntry = orderEntry;
window.modifierModal = modifierModal;
window.paymentFlow = paymentFlow;
window.checkManager = checkManager;
