/**
 * Alpine.js Store Definitions for Sear POS
 * Loaded before Alpine.js initializes via x-data.
 */
document.addEventListener('alpine:init', () => {

  // ---- Sidebar State ----
  Alpine.store('sidebar', {
    expanded: false,
    hovered: false,

    toggle() {
      this.expanded = !this.expanded;
      localStorage.setItem('sear_sidebar', this.expanded ? 'expanded' : 'collapsed');
    },

    init() {
      const saved = localStorage.getItem('sear_sidebar');
      if (saved === 'expanded') {
        this.expanded = true;
      }
    }
  });

  // ---- Toast Notifications ----
  Alpine.store('toasts', {
    items: [],
    _counter: 0,

    add(message, type = 'info', duration = 5000) {
      const id = ++this._counter;
      const toast = { id, type, message, visible: true };
      this.items.push(toast);

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => {
          this.remove(id);
        }, duration);
      }

      // Limit stack to 5
      if (this.items.length > 5) {
        this.items.shift();
      }

      return id;
    },

    remove(id) {
      const idx = this.items.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.items[idx].visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== id);
        }, 200);
      }
    },

    clear() {
      this.items = [];
    }
  });

  // ---- Modal State ----
  Alpine.store('modal', {
    open: false,
    content: '',
    title: '',
    size: 'md', // sm, md, lg, xl

    show(content, { title = '', size = 'md' } = {}) {
      this.content = content;
      this.title = title;
      this.size = size;
      this.open = true;
      document.body.style.overflow = 'hidden';
    },

    close() {
      this.open = false;
      this.content = '';
      this.title = '';
      document.body.style.overflow = '';
    }
  });

  // ---- Connection Status ----
  Alpine.store('connection', {
    online: navigator.onLine,
    syncing: false,
    pendingCount: 0,

    init() {
      window.addEventListener('online', () => {
        this.online = true;
        this.syncing = true;
        // Trigger sync of pending items
        window.dispatchEvent(new CustomEvent('sear:reconnected'));
        setTimeout(() => { this.syncing = false; }, 3000);
      });

      window.addEventListener('offline', () => {
        this.online = false;
        this.syncing = false;
      });
    }
  });

  // ---- Auth State ----
  Alpine.store('auth', {
    user: null,
    token: null,
    isManager: false,
    clockedIn: false,

    init() {
      // Restore token from localStorage
      const token = localStorage.getItem('sear_token');
      if (token) {
        this.token = token;
        // Decode basic user info from JWT payload (if present)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.user = {
            id: payload.sub || payload.user_id,
            display_name: payload.display_name || payload.name || 'Staff',
            first_name: payload.first_name || '',
            last_name: payload.last_name || '',
            role: payload.role || 'server',
          };
          this.isManager = ['owner', 'admin', 'manager'].includes(payload.role);
        } catch (e) {
          // Token not decodable, that's fine
        }
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      this.isManager = false;
      this.clockedIn = false;
      localStorage.removeItem('sear_token');
      window.location.href = '/login';
    }
  });

});
