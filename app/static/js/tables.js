/**
 * Table Management / Floor Plan Alpine.js component.
 *
 * Manages floor plan display, drag-and-drop table editing,
 * table status, detail popovers, and real-time SSE updates.
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('floorPlan', () => ({
    // State
    tables: [],
    floorPlans: [],
    activeFloorPlan: null,
    sections: [],
    viewMode: 'floor',  // 'floor' or 'list'
    editMode: false,
    selectedTable: null,
    activeSection: null,
    waitlistCount: 0,
    nextReservation: null,
    sortColumn: 'number',
    sortDirection: 'asc',

    // Internal
    _eventSource: null,
    _timerInterval: null,
    _reconnectTimeout: null,
    _reconnectDelay: 1000,
    _now: Date.now(),
    _dragState: null,
    _popoverClickPos: { x: 0, y: 0 },
    _locationId: '',
    _authToken: '',

    init() {
      this._locationId = new URLSearchParams(window.location.search).get('location_id') || '';
      this._authToken = this._getStoredToken();

      // Timer for seated durations (every second)
      this._timerInterval = setInterval(() => {
        this._now = Date.now();
      }, 1000);

      // Connect SSE
      this._connectSSE();

      // Load initial data
      this._loadFloorPlans();
      this._loadTables();
      this._loadSections();

      // Global event listeners for drag
      window.addEventListener('mousemove', (e) => this._onDragMove(e));
      window.addEventListener('mouseup', (e) => this._onDragEnd(e));
      window.addEventListener('touchmove', (e) => this._onDragMove(e), { passive: false });
      window.addEventListener('touchend', (e) => this._onDragEnd(e));
    },

    destroy() {
      if (this._eventSource) {
        this._eventSource.close();
      }
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
      }
      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
      }
    },

    // ---------------------------------------------------------------
    // SSE Connection
    // ---------------------------------------------------------------

    _connectSSE() {
      if (this._eventSource) {
        this._eventSource.close();
      }

      const url = `/api/v1/events/tables?token=${encodeURIComponent(this._authToken)}&location_id=${encodeURIComponent(this._locationId)}`;
      const es = new EventSource(url);
      this._eventSource = es;

      es.addEventListener('table.status_changed', (e) => {
        const data = JSON.parse(e.data);
        this._handleTableStatusChange(data);
      });

      es.addEventListener('table.seated', (e) => {
        const data = JSON.parse(e.data);
        this._handleTableSeated(data);
      });

      es.addEventListener('table.cleared', (e) => {
        const data = JSON.parse(e.data);
        this._handleTableCleared(data);
      });

      es.addEventListener('table.updated', (e) => {
        const data = JSON.parse(e.data);
        this._handleTableUpdated(data);
      });

      es.addEventListener('waitlist.updated', (e) => {
        const data = JSON.parse(e.data);
        this.waitlistCount = data.count || 0;
      });

      es.addEventListener('reservation.alert', (e) => {
        const data = JSON.parse(e.data);
        this.nextReservation = data.text || null;
      });

      es.onopen = () => {
        this._reconnectDelay = 1000;
      };

      es.onerror = () => {
        es.close();
        this._eventSource = null;
        this._reconnectTimeout = setTimeout(() => {
          this._connectSSE();
        }, this._reconnectDelay);
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000);
      };
    },

    _getStoredToken() {
      try {
        const token = localStorage.getItem('sear_token');
        if (token) return token;
      } catch { /* ignore */ }
      return '';
    },

    // ---------------------------------------------------------------
    // Initial Data Load
    // ---------------------------------------------------------------

    async _loadFloorPlans() {
      try {
        const resp = await fetch(`/api/v1/tables/floor-plans?location_id=${encodeURIComponent(this._locationId)}`, {
          headers: { 'Authorization': `Bearer ${this._authToken}` },
        });
        if (!resp.ok) return;
        const json = await resp.json();
        this.floorPlans = json.data || [];
        if (this.floorPlans.length > 0 && !this.activeFloorPlan) {
          this.activeFloorPlan = this.floorPlans[0];
        }
      } catch (err) {
        console.error('Tables: Failed to load floor plans', err);
      }
    },

    async _loadTables() {
      try {
        const resp = await fetch(`/api/v1/tables?location_id=${encodeURIComponent(this._locationId)}`, {
          headers: { 'Authorization': `Bearer ${this._authToken}` },
        });
        if (!resp.ok) return;
        const json = await resp.json();
        this.tables = (json.data || []).map(t => this._normalizeTable(t));
      } catch (err) {
        console.error('Tables: Failed to load tables', err);
      }
    },

    async _loadSections() {
      try {
        const resp = await fetch(`/api/v1/tables/sections?location_id=${encodeURIComponent(this._locationId)}`, {
          headers: { 'Authorization': `Bearer ${this._authToken}` },
        });
        if (!resp.ok) return;
        const json = await resp.json();
        this.sections = json.data || [];
      } catch (err) {
        console.error('Tables: Failed to load sections', err);
      }
    },

    _normalizeTable(raw) {
      return {
        id: raw.id,
        number: raw.number || raw.table_number || '',
        shape: raw.shape || 'square',
        capacity: raw.capacity || 4,
        x: raw.x || raw.position_x || 100,
        y: raw.y || raw.position_y || 100,
        status: raw.status || 'available',
        guest_count: raw.guest_count || 0,
        server_name: raw.server_name || null,
        server_id: raw.server_id || null,
        section_id: raw.section_id || null,
        section_name: raw.section_name || null,
        floor_plan_id: raw.floor_plan_id || null,
        seated_at: raw.seated_at || null,
        check_amount: raw.check_amount || null,
        check_items: raw.check_items || [],
        last_activity: raw.last_activity || null,
        needs_attention: raw.needs_attention || false,
        _dragging: false,
      };
    },

    // ---------------------------------------------------------------
    // SSE Event Handlers
    // ---------------------------------------------------------------

    _handleTableStatusChange(data) {
      const table = this.tables.find(t => t.id === data.table_id);
      if (!table) return;
      table.status = data.status;
      if (data.guest_count !== undefined) table.guest_count = data.guest_count;
      if (data.server_name !== undefined) table.server_name = data.server_name;
      if (data.needs_attention !== undefined) table.needs_attention = data.needs_attention;
    },

    _handleTableSeated(data) {
      const table = this.tables.find(t => t.id === data.table_id);
      if (!table) return;
      table.status = 'seated';
      table.guest_count = data.guest_count || 0;
      table.server_name = data.server_name || table.server_name;
      table.seated_at = data.seated_at || new Date().toISOString();
    },

    _handleTableCleared(data) {
      const table = this.tables.find(t => t.id === data.table_id);
      if (!table) return;
      table.status = 'available';
      table.guest_count = 0;
      table.server_name = null;
      table.seated_at = null;
      table.check_amount = null;
      table.check_items = [];
      table.last_activity = null;
    },

    _handleTableUpdated(data) {
      const table = this.tables.find(t => t.id === data.table_id || t.id === data.id);
      if (!table) return;
      if (data.status) table.status = data.status;
      if (data.guest_count !== undefined) table.guest_count = data.guest_count;
      if (data.server_name !== undefined) table.server_name = data.server_name;
      if (data.check_amount !== undefined) table.check_amount = data.check_amount;
      if (data.check_items) table.check_items = data.check_items;
      if (data.last_activity) table.last_activity = data.last_activity;
    },

    // ---------------------------------------------------------------
    // Computed / Filtered Data
    // ---------------------------------------------------------------

    get filteredTables() {
      let result = this.tables;

      // Filter by active floor plan
      if (this.activeFloorPlan) {
        result = result.filter(t => !t.floor_plan_id || t.floor_plan_id === this.activeFloorPlan.id);
      }

      // Filter by section
      if (this.activeSection) {
        result = result.filter(t => t.section_id === this.activeSection);
      }

      return result;
    },

    get sortedListTables() {
      const tables = [...this.filteredTables];
      const col = this.sortColumn;
      const dir = this.sortDirection === 'asc' ? 1 : -1;

      tables.sort((a, b) => {
        let va = a[col];
        let vb = b[col];
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (typeof va === 'string') {
          return va.localeCompare(vb) * dir;
        }
        return ((va > vb ? 1 : va < vb ? -1 : 0)) * dir;
      });

      return tables;
    },

    get occupiedCount() {
      let seats = 0;
      for (const t of this.tables) {
        if (t.status !== 'available' && t.status !== 'dirty' && t.status !== 'reserved') {
          seats += (t.guest_count || 0);
        }
      }
      return seats;
    },

    get totalSeats() {
      let seats = 0;
      for (const t of this.tables) {
        seats += (t.capacity || 0);
      }
      return seats;
    },

    // ---------------------------------------------------------------
    // Table Selection & Popover
    // ---------------------------------------------------------------

    selectTable(table, event) {
      if (this.editMode) return;

      this._popoverClickPos = {
        x: event.clientX || (event.touches && event.touches[0]?.clientX) || 200,
        y: event.clientY || (event.touches && event.touches[0]?.clientY) || 200,
      };
      this.selectedTable = table;
    },

    popoverPosition() {
      const w = 320;
      const h = 420;
      let x = this._popoverClickPos.x + 16;
      let y = this._popoverClickPos.y - 40;

      // Keep within viewport
      if (x + w > window.innerWidth) {
        x = this._popoverClickPos.x - w - 16;
      }
      if (y + h > window.innerHeight) {
        y = window.innerHeight - h - 16;
      }
      if (y < 8) y = 8;
      if (x < 8) x = 8;

      return { left: x + 'px', top: y + 'px' };
    },

    // ---------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------

    async tableAction(action) {
      const table = this.selectedTable;
      if (!table) return;

      switch (action) {
        case 'seat':
          await this._postTableAction(table.id, 'seat');
          break;
        case 'view_order':
          window.location.href = `/pos/orders?table_id=${table.id}&location_id=${this._locationId}`;
          return;
        case 'transfer':
          await this._postTableAction(table.id, 'transfer');
          break;
        case 'move':
          // Enter move mode — just close popover, user taps another table
          this.selectedTable = null;
          return;
        case 'clear':
          await this._postTableAction(table.id, 'clear');
          break;
        case 'reserve':
          await this._postTableAction(table.id, 'reserve');
          break;
      }

      this.selectedTable = null;
    },

    async _postTableAction(tableId, action) {
      try {
        const resp = await fetch(`/api/v1/tables/${tableId}/${action}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this._authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ location_id: this._locationId }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          console.error(`Tables: ${action} failed`, err);
        }
      } catch (err) {
        console.error(`Tables: ${action} failed`, err);
      }
    },

    // ---------------------------------------------------------------
    // Drag and Drop (Edit Mode)
    // ---------------------------------------------------------------

    startDrag(table, event) {
      if (!this.editMode) return;

      event.preventDefault();
      event.stopPropagation();

      const clientX = event.clientX || (event.touches && event.touches[0]?.clientX) || 0;
      const clientY = event.clientY || (event.touches && event.touches[0]?.clientY) || 0;

      this._dragState = {
        tableId: table.id,
        startX: clientX,
        startY: clientY,
        origX: table.x,
        origY: table.y,
      };
      table._dragging = true;
    },

    _onDragMove(event) {
      if (!this._dragState) return;

      const clientX = event.clientX || (event.touches && event.touches[0]?.clientX) || 0;
      const clientY = event.clientY || (event.touches && event.touches[0]?.clientY) || 0;

      const dx = clientX - this._dragState.startX;
      const dy = clientY - this._dragState.startY;

      const table = this.tables.find(t => t.id === this._dragState.tableId);
      if (!table) return;

      // Snap to 20px grid
      table.x = Math.round((this._dragState.origX + dx) / 20) * 20;
      table.y = Math.round((this._dragState.origY + dy) / 20) * 20;

      // Keep within bounds
      table.x = Math.max(0, table.x);
      table.y = Math.max(0, table.y);

      if (event.cancelable) event.preventDefault();
    },

    async _onDragEnd(event) {
      if (!this._dragState) return;

      const table = this.tables.find(t => t.id === this._dragState.tableId);
      if (table) {
        table._dragging = false;

        // Save new position to server
        try {
          await fetch(`/api/v1/tables/${table.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${this._authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              x: table.x,
              y: table.y,
              position_x: table.x,
              position_y: table.y,
            }),
          });
        } catch (err) {
          console.error('Tables: Failed to save position', err);
        }
      }

      this._dragState = null;
    },

    // ---------------------------------------------------------------
    // Floor Plan Navigation
    // ---------------------------------------------------------------

    cycleFloorPlan() {
      if (this.floorPlans.length <= 1) return;
      const idx = this.floorPlans.findIndex(fp => fp.id === this.activeFloorPlan?.id);
      const next = (idx + 1) % this.floorPlans.length;
      this.activeFloorPlan = this.floorPlans[next];
    },

    // ---------------------------------------------------------------
    // Sorting (List View)
    // ---------------------------------------------------------------

    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    },

    // ---------------------------------------------------------------
    // Display Helpers
    // ---------------------------------------------------------------

    tableTime(table) {
      if (!table.seated_at) return '';
      const secs = Math.max(0, Math.floor((this._now - new Date(table.seated_at).getTime()) / 1000));
      if (secs < 60) return `${secs}s`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    },

    statusLabel(status) {
      const labels = {
        available: 'Available',
        seated: 'Seated',
        ordered: 'Ordered',
        served: 'Served',
        check_presented: 'Check',
        needs_attention: 'Attention',
        reserved: 'Reserved',
        dirty: 'Dirty',
      };
      return labels[status] || status;
    },

    statusBgColor(status) {
      const colors = {
        available: '#DCFCE7',
        seated: '#DBEAFE',
        ordered: '#EDE9FE',
        served: '#FEF3C7',
        check_presented: '#FCE7F3',
        needs_attention: '#FEE2E2',
        reserved: '#F3F4F6',
        dirty: '#FEE2E2',
      };
      return colors[status] || '#F3F4F6';
    },

    statusTextColor(status) {
      const colors = {
        available: '#15803D',
        seated: '#1D4ED8',
        ordered: '#6D28D9',
        served: '#B45309',
        check_presented: '#BE185D',
        needs_attention: '#B91C1C',
        reserved: '#374151',
        dirty: '#B91C1C',
      };
      return colors[status] || '#374151';
    },
  }));
});
