/**
 * KDS (Kitchen Display System) Alpine.js component.
 *
 * Manages real-time ticket display, aging timers, bump/recall actions,
 * all-day counts, and audio alerts via SSE from /api/v1/events/kds.
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('kdsDisplay', () => ({
    // State
    tickets: [],
    allDayItems: {},
    recalledTickets: [],
    showAllDay: false,
    showRecall: false,
    soundEnabled: true,
    stationId: null,
    stationName: 'Kitchen',
    locationId: null,
    authToken: null,

    // Internal
    _eventSource: null,
    _timerInterval: null,
    _audioCtx: null,
    _reconnectTimeout: null,
    _reconnectDelay: 1000,
    _now: Date.now(),

    init() {
      // Read config from meta tags or data attributes
      const root = this.$el;
      this.stationId = root.dataset.stationId || new URLSearchParams(window.location.search).get('station_id') || null;
      this.stationName = root.dataset.stationName || new URLSearchParams(window.location.search).get('station_name') || 'Kitchen';
      this.locationId = root.dataset.locationId || new URLSearchParams(window.location.search).get('location_id') || '';
      this.authToken = root.dataset.authToken || new URLSearchParams(window.location.search).get('token') || this._getStoredToken();

      // Start timer updates (every second)
      this._timerInterval = setInterval(() => {
        this._now = Date.now();
      }, 1000);

      // Initialize audio context on first user interaction
      document.addEventListener('click', () => this._initAudio(), { once: true });
      document.addEventListener('touchstart', () => this._initAudio(), { once: true });

      // Connect SSE
      this._connectSSE();

      // Load initial tickets
      this._loadInitialTickets();
    },

    destroy() {
      if (this._eventSource) {
        this._eventSource.close();
        this._eventSource = null;
      }
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = null;
      }
      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
        this._reconnectTimeout = null;
      }
    },

    // ---------------------------------------------------------------
    // SSE Connection
    // ---------------------------------------------------------------

    _connectSSE() {
      if (this._eventSource) {
        this._eventSource.close();
      }

      let url = `/api/v1/events/kds?token=${encodeURIComponent(this.authToken)}&location_id=${encodeURIComponent(this.locationId)}`;
      if (this.stationId) {
        url += `&station_id=${encodeURIComponent(this.stationId)}`;
      }

      const es = new EventSource(url);
      this._eventSource = es;

      es.addEventListener('ticket.new', (e) => {
        const data = JSON.parse(e.data);
        this._handleNewTicket(data);
      });

      es.addEventListener('ticket.bump', (e) => {
        const data = JSON.parse(e.data);
        this._handleBumpEvent(data);
      });

      es.addEventListener('ticket.recall', (e) => {
        const data = JSON.parse(e.data);
        this._handleRecallEvent(data);
      });

      es.addEventListener('ticket.update', (e) => {
        const data = JSON.parse(e.data);
        this._handleTicketUpdate(data);
      });

      es.addEventListener('item.86d', (e) => {
        const data = JSON.parse(e.data);
        this._handleItem86(data);
      });

      es.addEventListener('course.fired', (e) => {
        const data = JSON.parse(e.data);
        this._handleCourseFired(data);
      });

      es.onopen = () => {
        this._reconnectDelay = 1000;
      };

      es.onerror = () => {
        es.close();
        this._eventSource = null;
        // Exponential backoff reconnect
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
    // Initial Load
    // ---------------------------------------------------------------

    async _loadInitialTickets() {
      try {
        const resp = await fetch(`/api/v1/kds/tickets?location_id=${encodeURIComponent(this.locationId)}`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!resp.ok) return;
        const json = await resp.json();
        const data = json.data || [];
        this.tickets = data.map(t => this._normalizeTicket(t));
        this._recalcAllDay();
      } catch (err) {
        console.error('KDS: Failed to load initial tickets', err);
      }
    },

    _normalizeTicket(raw) {
      return {
        id: raw.id,
        order_id: raw.order_id,
        order_number: raw.order_number || raw.order_id?.slice(-4) || '----',
        order_type: raw.order_type || 'dine_in',
        table_number: raw.table_number || null,
        server_name: raw.server_name || '',
        is_rush: raw.is_rush || false,
        fired_at: raw.fired_at || raw.created_at || new Date().toISOString(),
        items: (raw.items || raw.kds_ticket_items || []).map(item => ({
          id: item.id,
          type: item.type || 'item',
          name: item.name || item.menu_item_name || '',
          quantity: item.quantity || 1,
          modifiers: item.modifiers || [],
          removals: item.removals || [],
          special_instructions: item.special_instructions || null,
          allergens: item.allergens || [],
          course_number: item.course_number || null,
          status: item.status || 'pending',
        })),
        station_ids: raw.station_ids || [],
        _bumpCooldown: false,
        _bumping: false,
      };
    },

    // ---------------------------------------------------------------
    // SSE Event Handlers
    // ---------------------------------------------------------------

    _handleNewTicket(data) {
      // Filter by station if configured
      if (this.stationId && data.station_ids && !data.station_ids.includes(this.stationId)) {
        return;
      }

      const existing = this.tickets.find(t => t.id === data.id);
      if (existing) return;

      const ticket = this._normalizeTicket(data);
      this.tickets.push(ticket);
      this._recalcAllDay();

      // Scroll to newest (right)
      this.$nextTick(() => {
        const container = document.getElementById('kds-ticket-scroll');
        if (container) {
          container.scrollLeft = container.scrollWidth;
        }
      });

      // Play new ticket sound
      if (this.soundEnabled) {
        this._playNewTicketSound();
      }
    },

    _handleBumpEvent(data) {
      const idx = this.tickets.findIndex(t => t.id === data.ticket_id);
      if (idx === -1) return;

      const ticket = this.tickets[idx];
      ticket.bumped_at = new Date().toISOString();
      this.recalledTickets.unshift({ ...ticket });
      if (this.recalledTickets.length > 10) {
        this.recalledTickets = this.recalledTickets.slice(0, 10);
      }

      this.tickets.splice(idx, 1);
      this._recalcAllDay();
    },

    _handleRecallEvent(data) {
      const recIdx = this.recalledTickets.findIndex(t => t.id === data.ticket_id);
      if (recIdx !== -1) {
        const ticket = this.recalledTickets.splice(recIdx, 1)[0];
        delete ticket.bumped_at;
        delete ticket._bumping;
        ticket._bumpCooldown = false;
        this.tickets.push(ticket);
        this._recalcAllDay();
      }
    },

    _handleTicketUpdate(data) {
      const ticket = this.tickets.find(t => t.id === data.id || t.id === data.ticket_id);
      if (!ticket) return;

      if (data.items) {
        ticket.items = data.items.map(item => ({
          id: item.id,
          type: item.type || 'item',
          name: item.name || item.menu_item_name || '',
          quantity: item.quantity || 1,
          modifiers: item.modifiers || [],
          removals: item.removals || [],
          special_instructions: item.special_instructions || null,
          allergens: item.allergens || [],
          course_number: item.course_number || null,
          status: item.status || 'pending',
        }));
      }
      if (data.is_rush !== undefined) {
        ticket.is_rush = data.is_rush;
        if (data.is_rush && this.soundEnabled) {
          this._playRushSound();
        }
      }
      this._recalcAllDay();
    },

    _handleItem86(data) {
      // Mark 86'd items across all tickets
      for (const ticket of this.tickets) {
        for (const item of ticket.items) {
          if (item.id === data.menu_item_id || item.name === data.item_name) {
            item._86d = true;
          }
        }
      }
    },

    _handleCourseFired(data) {
      const ticket = this.tickets.find(t => t.id === data.ticket_id);
      if (!ticket) return;

      for (const item of ticket.items) {
        if (item.type === 'course_divider' && item.course_number === data.course_number) {
          item.status = 'fire';
        }
        if (item.type === 'fire_button' && item.course_number === data.course_number) {
          item.type = 'fired_marker';
        }
      }
    },

    // ---------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------

    async bumpTicket(ticket) {
      if (ticket._bumpCooldown) return;

      // Double-tap protection: 500ms cooldown
      ticket._bumpCooldown = true;
      setTimeout(() => {
        ticket._bumpCooldown = false;
      }, 500);

      // Animate out
      ticket._bumping = true;

      // Store for recall
      ticket.bumped_at = new Date().toISOString();
      this.recalledTickets.unshift({ ...ticket, _bumping: false, _bumpCooldown: false });
      if (this.recalledTickets.length > 10) {
        this.recalledTickets = this.recalledTickets.slice(0, 10);
      }

      // Remove after animation
      setTimeout(() => {
        const idx = this.tickets.findIndex(t => t.id === ticket.id);
        if (idx !== -1) {
          this.tickets.splice(idx, 1);
        }
        this._recalcAllDay();
      }, 300);

      // POST to server
      try {
        await fetch(`/api/v1/kds/tickets/${ticket.id}/bump`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.error('KDS: Bump failed', err);
      }
    },

    bumpOldestTicket() {
      if (this.tickets.length === 0) return;
      this.bumpTicket(this.tickets[0]);
    },

    async recallTicket(ticket) {
      const recIdx = this.recalledTickets.findIndex(t => t.id === ticket.id);
      if (recIdx !== -1) {
        this.recalledTickets.splice(recIdx, 1);
      }

      delete ticket.bumped_at;
      delete ticket._bumping;
      ticket._bumpCooldown = false;
      this.tickets.push(ticket);
      this._recalcAllDay();

      try {
        await fetch(`/api/v1/kds/tickets/${ticket.id}/recall`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.error('KDS: Recall failed', err);
      }
    },

    async fireCourse(ticketId, courseNumber) {
      try {
        await fetch(`/api/v1/kds/tickets/${ticketId}/fire-course`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ course_number: courseNumber }),
        });
      } catch (err) {
        console.error('KDS: Fire course failed', err);
      }
    },

    // ---------------------------------------------------------------
    // Timer & Aging
    // ---------------------------------------------------------------

    ticketAge(ticket) {
      // Returns age in seconds
      const fired = new Date(ticket.fired_at).getTime();
      return Math.max(0, Math.floor((this._now - fired) / 1000));
    },

    formatTimer(ticket) {
      const secs = this.ticketAge(ticket);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },

    agingClass(ticket) {
      const secs = this.ticketAge(ticket);
      if (secs >= 900) return 'age-critical';   // 15+ min
      if (secs >= 600) return 'age-late';        // 10-15 min
      if (secs >= 300) return 'age-warning';     // 5-10 min
      return 'age-fresh';                         // 0-5 min
    },

    // ---------------------------------------------------------------
    // All-Day Calculation
    // ---------------------------------------------------------------

    _recalcAllDay() {
      const counts = {};

      for (const ticket of this.tickets) {
        for (const item of (ticket.items || [])) {
          if (item.type && item.type !== 'item') continue;

          const name = item.name;
          if (!name) continue;

          if (!counts[name]) {
            counts[name] = { count: 0, mods: {} };
          }
          counts[name].count += (item.quantity || 1);

          // Track modifier breakdown
          for (const mod of (item.modifiers || [])) {
            if (!counts[name].mods[mod]) {
              counts[name].mods[mod] = 0;
            }
            counts[name].mods[mod] += (item.quantity || 1);
          }
        }
      }

      this.allDayItems = counts;
    },

    get allDaySorted() {
      const items = Object.entries(this.allDayItems).map(([name, data]) => {
        const modParts = Object.entries(data.mods)
          .sort((a, b) => b[1] - a[1])
          .map(([mod, qty]) => `${qty} ${mod}`);
        return {
          name,
          count: data.count,
          modBreakdown: modParts.join(', '),
        };
      });
      items.sort((a, b) => b.count - a.count);
      return items;
    },

    // ---------------------------------------------------------------
    // Display Helpers
    // ---------------------------------------------------------------

    orderTypeBadge(ticket) {
      const type = ticket.order_type;
      if (type === 'dine_in') return ticket.table_number ? `T${ticket.table_number}` : 'Dine';
      if (type === 'takeout') return 'TO';
      if (type === 'delivery') return 'DEL';
      return type || '';
    },

    timeSince(isoString) {
      if (!isoString) return '--';
      const secs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (secs < 60) return `${secs}s`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    },

    // ---------------------------------------------------------------
    // Audio (Web Audio API)
    // ---------------------------------------------------------------

    _initAudio() {
      if (this._audioCtx) return;
      try {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { /* ignore */ }
    },

    _playTone(frequency, duration, type = 'sine') {
      if (!this._audioCtx || !this.soundEnabled) return;
      try {
        const osc = this._audioCtx.createOscillator();
        const gain = this._audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.3, this._audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this._audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this._audioCtx.destination);
        osc.start();
        osc.stop(this._audioCtx.currentTime + duration);
      } catch { /* ignore */ }
    },

    _playNewTicketSound() {
      // Two-tone chime: C5 then E5
      this._playTone(523.25, 0.15);
      setTimeout(() => this._playTone(659.25, 0.2), 150);
    },

    _playAgingAlert() {
      // Warning: three short beeps
      this._playTone(880, 0.1, 'square');
      setTimeout(() => this._playTone(880, 0.1, 'square'), 150);
      setTimeout(() => this._playTone(880, 0.1, 'square'), 300);
    },

    _playRushSound() {
      // Urgent: descending tones
      this._playTone(1046.5, 0.1, 'sawtooth');
      setTimeout(() => this._playTone(880, 0.1, 'sawtooth'), 100);
      setTimeout(() => this._playTone(698.46, 0.15, 'sawtooth'), 200);
    },
  }));
});
